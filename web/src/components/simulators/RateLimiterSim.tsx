'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Send, Square, Zap } from 'lucide-react';
import {
  RATE_LIMIT_ALGORITHMS,
  advanceRateLimiter,
  createRateLimiter,
  rateLimiterFill,
  tryAcquire,
  type RateLimitAlgorithm,
  type RateLimiterConfig,
  type RateLimiterState,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { LogList, Range, Select, SimShell, Stat } from './ui';
import { numParam, strParam, type SimulatorProps } from './types';

const ALGOS = RATE_LIMIT_ALGORITHMS.map((a) => a.id);
const TIMELINE_MS = 10_000;
const MAX_HISTORY = 400;

interface Hit {
  id: number;
  at: number;
  allowed: boolean;
  reason: string;
}

const L = {
  tr: {
    title: 'Rate limiter',
    rps: 'Otomatik trafik (istek/sn)',
    timeline: 'Son 10 saniye',
    fill: { bucket: 'Kova doluluğu', queue: 'Kuyruk', window: 'Pencere sayacı' },
    hint: {
      'token-bucket':
        'Kova token ile dolar; her istek bir token harcar. Patlamalara (burst) kapasite kadar izin verir.',
      'leaky-bucket':
        'İstekler kuyruğa girer ve sabit hızla işlenir; kuyruk doluysa istek düşer. Çıkış hızı düzgündür.',
      'fixed-window': 'Her pencerede sayaç sıfırlanır. Pencere sınırında 2× patlama mümkündür.',
      'sliding-window-log':
        'Her isteğin zamanı tutulur; son pencere içindeki istek sayısı limiti aşamaz. Kesin ama bellek ister.',
      'sliding-window-counter':
        'Önceki pencerenin sayısı ağırlıklandırılarak tahmin yapılır. Bellek dostu ve yeterince doğru.',
    } satisfies Record<RateLimitAlgorithm, string>,
  },
  en: {
    title: 'Rate limiter',
    rps: 'Auto traffic (req/s)',
    timeline: 'Last 10 seconds',
    fill: { bucket: 'Bucket tokens', queue: 'Queue', window: 'Window counter' },
    hint: {
      'token-bucket':
        'The bucket refills with tokens; each request spends one. Bursts up to capacity are allowed.',
      'leaky-bucket':
        'Requests queue up and drain at a constant rate; when the queue is full they are dropped. Output is smooth.',
      'fixed-window':
        'The counter resets every window. A 2× burst is possible at window boundaries.',
      'sliding-window-log':
        'Every request timestamp is stored; count within the last window may not exceed the limit. Exact but memory-hungry.',
      'sliding-window-counter':
        'Estimates using a weighted count of the previous window. Memory-friendly and accurate enough.',
    } satisfies Record<RateLimitAlgorithm, string>,
  },
};

/**
 * Rate limiter simülatörü: beş algoritma, shared/simulators/rateLimiter mantığı.
 * Limiter durumu ref'te tutulur ki aynı tik içindeki ardışık istekler doğru sırayla değerlendirilsin.
 */
export default function RateLimiterSim({ params, onInteract }: SimulatorProps) {
  const { t, locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const [config, setConfig] = useState<RateLimiterConfig>(() => ({
    algorithm: strParam(params, 'algorithm', 'token-bucket', ALGOS as RateLimitAlgorithm[]),
    limit: numParam(params, 'capacity', numParam(params, 'limit', 10, 1, 50), 1, 50),
    windowMs: numParam(params, 'windowMs', 1000, 200, 5000),
    ratePerSec: numParam(
      params,
      'refillPerSec',
      numParam(params, 'refillPerSecond', numParam(params, 'rate', 5, 0.5, 50), 0.5, 50),
      0.5,
      50,
    ),
  }));
  const limiterRef = useRef<RateLimiterState>(createRateLimiter(config, Date.now()));
  const [limiter, setLimiter] = useState<RateLimiterState>(limiterRef.current);
  const [history, setHistory] = useState<Hit[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [auto, setAuto] = useState(false);
  const [rps, setRps] = useState(8);
  const seq = useRef(0);
  const carry = useRef(0);
  const clipId = `rl-${useId().replace(/:/g, '')}`;

  // Konfigürasyon değişince limiter'ı yeniden oluştur
  useEffect(() => {
    limiterRef.current = createRateLimiter(config, Date.now());
    setLimiter(limiterRef.current);
  }, [config]);

  const fire = useCallback((count: number) => {
    const at = Date.now();
    const hits: Hit[] = [];
    for (let i = 0; i < count; i++) {
      const r = tryAcquire(limiterRef.current, at);
      limiterRef.current = r.state;
      hits.push({ id: ++seq.current, at, allowed: r.decision.allowed, reason: r.decision.reason });
    }
    setLimiter(limiterRef.current);
    setHistory((h) => [...h, ...hits].slice(-MAX_HISTORY));
  }, []);

  // Saat: dolum/sızma görünsün diye limiter'ı ilerlet, otomatik trafiği üret
  useEffect(() => {
    const id = setInterval(() => {
      const ts = Date.now();
      limiterRef.current = advanceRateLimiter(limiterRef.current, ts);
      setLimiter(limiterRef.current);
      setNow(ts);
      setHistory((h) =>
        h.length && ts - h[0].at > TIMELINE_MS ? h.filter((x) => ts - x.at <= TIMELINE_MS) : h,
      );
      if (auto) {
        carry.current += rps * 0.1;
        const n = Math.floor(carry.current);
        carry.current -= n;
        if (n > 0) fire(n);
      }
    }, 100);
    return () => clearInterval(id);
  }, [auto, rps, fire]);

  const send = (n: number) => {
    onInteract();
    fire(n);
  };

  const reset = () => {
    setAuto(false);
    setHistory([]);
    limiterRef.current = createRateLimiter(config, Date.now());
    setLimiter(limiterRef.current);
  };

  const fill = Math.max(0, Math.min(1, rateLimiterFill(limiter)));
  const isBucket = config.algorithm === 'token-bucket' || config.algorithm === 'leaky-bucket';
  const fillLabel =
    config.algorithm === 'token-bucket'
      ? l.fill.bucket
      : config.algorithm === 'leaky-bucket'
        ? l.fill.queue
        : l.fill.window;
  const recent = history.filter((h) => now - h.at <= TIMELINE_MS);
  const allowedCount = recent.filter((h) => h.allowed).length;
  const rejectedCount = recent.length - allowedCount;
  const fillTone =
    config.algorithm === 'token-bucket'
      ? fill < 0.2
        ? 'var(--da-danger)'
        : 'var(--da-success)'
      : fill > 0.8
        ? 'var(--da-danger)'
        : 'var(--da-primary)';

  // Pencere algoritmalarında aktif pencere sınırlarını zaman çizelgesinde göster
  const windowMarks: number[] = [];
  if (!isBucket && config.windowMs >= 200) {
    const start =
      limiter.algorithm === 'fixed-window'
        ? limiter.windowStart
        : limiter.algorithm === 'sliding-window-counter'
          ? limiter.currentWindowStart
          : now - config.windowMs;
    for (let ts = start; ts > now - TIMELINE_MS; ts -= config.windowMs) windowMarks.push(ts);
  }
  const tx = (at: number) => 20 + ((at - (now - TIMELINE_MS)) / TIMELINE_MS) * 560;

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button type="button" className="btn-primary" onClick={() => send(1)}>
            <Send size={14} /> {t('sim.send')}
          </button>
          <button type="button" className="btn-ghost" onClick={() => send(10)}>
            <Zap size={14} /> {t('sim.burst')}
          </button>
          <button
            type="button"
            className="btn-ghost"
            aria-pressed={auto}
            onClick={() => {
              onInteract();
              setAuto((a) => !a);
            }}
          >
            {auto ? <Square size={14} /> : <Zap size={14} />} {auto ? t('sim.stop') : t('sim.auto')}
          </button>
          <button type="button" className="btn-ghost" onClick={reset}>
            <RotateCcw size={14} /> {t('sim.reset')}
          </button>
        </>
      }
      aside={
        <>
          <Select
            label={t('sim.algorithm')}
            value={config.algorithm}
            options={RATE_LIMIT_ALGORITHMS.map((a) => ({ id: a.id, label: a.label[locale] }))}
            onChange={(v) => {
              onInteract();
              setConfig((c) => ({ ...c, algorithm: v }));
            }}
          />
          <Range
            label={isBucket ? t('sim.capacity') : t('sim.limit')}
            value={config.limit}
            min={1}
            max={30}
            onChange={(v) => setConfig((c) => ({ ...c, limit: v }))}
          />
          {isBucket ? (
            <Range
              label={t('sim.rate')}
              value={config.ratePerSec}
              min={0.5}
              max={20}
              step={0.5}
              onChange={(v) => setConfig((c) => ({ ...c, ratePerSec: v }))}
            />
          ) : (
            <Range
              label={t('sim.window')}
              value={config.windowMs}
              min={500}
              max={5000}
              step={250}
              onChange={(v) => setConfig((c) => ({ ...c, windowMs: v }))}
            />
          )}
          <Range label={l.rps} value={rps} min={1} max={30} onChange={setRps} />
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t('sim.allowed')} value={allowedCount} tone="success" />
            <Stat
              label={t('sim.rejected')}
              value={rejectedCount}
              tone={rejectedCount ? 'danger' : undefined}
            />
          </div>
          <div>
            <p className="label">{t('sim.log')}</p>
            <LogList
              items={history
                .slice(-10)
                .reverse()
                .map((h) => ({
                  key: h.id,
                  text: `#${h.id} ${h.allowed ? '✓' : '✗'} ${h.reason}`,
                  tone: h.allowed ? 'success' : 'danger',
                }))}
            />
          </div>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">{l.hint[config.algorithm]}</p>
      <svg
        viewBox="0 0 600 300"
        className="h-auto w-full"
        role="img"
        aria-label={`${fillLabel} ${(fill * 100).toFixed(0)}%`}
      >
        {/* Kova / sayaç görseli */}
        <text x={20} y={20} fontSize={12} fill="var(--da-muted)">
          {fillLabel}
        </text>
        <path
          d="M 40 36 L 52 176 L 148 176 L 160 36"
          fill="var(--da-elevated)"
          stroke="var(--da-border)"
          strokeWidth={2}
        />
        <clipPath id={clipId}>
          <path d="M 40 36 L 52 176 L 148 176 L 160 36 Z" />
        </clipPath>
        <motion.rect
          x={30}
          width={140}
          clipPath={`url(#${clipId})`}
          fill={fillTone}
          opacity={0.75}
          animate={{ y: 176 - 140 * fill, height: 140 * fill }}
          transition={{ duration: reduced ? 0 : 0.15 }}
        />
        <text
          x={100}
          y={196}
          textAnchor="middle"
          fontSize={13}
          fontWeight={600}
          fill="var(--da-fg)"
        >
          {limiter.algorithm === 'token-bucket'
            ? `${limiter.tokens.toFixed(1)} / ${limiter.capacity}`
            : limiter.algorithm === 'leaky-bucket'
              ? `${limiter.queue.length} / ${limiter.capacity}`
              : limiter.algorithm === 'fixed-window'
                ? `${limiter.count} / ${limiter.limit}`
                : limiter.algorithm === 'sliding-window-log'
                  ? `${limiter.log.length} / ${limiter.limit}`
                  : `${limiter.currentCount} (+${limiter.previousCount}) / ${limiter.limit}`}
        </text>
        {config.algorithm === 'token-bucket' && (
          <text x={100} y={30} textAnchor="middle" fontSize={10} fill="var(--da-success)">
            +{config.ratePerSec}/s ↓
          </text>
        )}
        {config.algorithm === 'leaky-bucket' && (
          <text x={100} y={214} textAnchor="middle" fontSize={10} fill="var(--da-primary)">
            ↓ {config.ratePerSec}/s
          </text>
        )}

        {/* Algoritma özeti */}
        <g transform="translate(200, 40)">
          <rect
            width={380}
            height={140}
            rx={12}
            fill="var(--da-surface)"
            stroke="var(--da-border)"
          />
          <text x={16} y={28} fontSize={13} fontWeight={600} fill="var(--da-fg)">
            {RATE_LIMIT_ALGORITHMS.find((a) => a.id === config.algorithm)?.label[locale]}
          </text>
          <text x={16} y={56} fontSize={12} fill="var(--da-muted)">
            {t('sim.allowed')}:{' '}
            <tspan fill="var(--da-success)" fontWeight={600}>
              {allowedCount}
            </tspan>
          </text>
          <text x={16} y={78} fontSize={12} fill="var(--da-muted)">
            {t('sim.rejected')}:{' '}
            <tspan fill="var(--da-danger)" fontWeight={600}>
              {rejectedCount}
            </tspan>
          </text>
          <text x={16} y={100} fontSize={12} fill="var(--da-muted)">
            {isBucket
              ? `${t('sim.rate')}: ${config.ratePerSec}`
              : `${t('sim.window')}: ${config.windowMs}`}
          </text>
          <text x={16} y={122} fontSize={12} fill="var(--da-muted)">
            {auto ? `→ ${rps} req/s` : ''}
          </text>
          {/* Kabul oranı halkası */}
          <circle
            cx={320}
            cy={72}
            r={40}
            fill="none"
            stroke="var(--da-elevated)"
            strokeWidth={10}
          />
          <circle
            cx={320}
            cy={72}
            r={40}
            fill="none"
            stroke="var(--da-success)"
            strokeWidth={10}
            strokeDasharray={`${(recent.length ? allowedCount / recent.length : 0) * 251.3} 251.3`}
            transform="rotate(-90 320 72)"
          />
          <text
            x={320}
            y={77}
            textAnchor="middle"
            fontSize={14}
            fontWeight={600}
            fill="var(--da-fg)"
          >
            {recent.length ? `${Math.round((allowedCount / recent.length) * 100)}%` : '—'}
          </text>
        </g>

        {/* Zaman çizelgesi */}
        <text x={20} y={236} fontSize={12} fill="var(--da-muted)">
          {l.timeline}
        </text>
        <line x1={20} y1={270} x2={580} y2={270} stroke="var(--da-border)" />
        {windowMarks.map((m) => (
          <line
            key={m}
            x1={tx(m)}
            y1={244}
            x2={tx(m)}
            y2={292}
            stroke="var(--da-primary)"
            strokeDasharray="3 3"
            opacity={0.5}
          />
        ))}
        {recent.map((h, i) => {
          // Aynı anda gelen istekleri dikeyde dağıt
          const sameIdx = i > 0 && recent[i - 1].at === h.at ? i % 5 : 0;
          return (
            <circle
              key={h.id}
              cx={tx(h.at)}
              cy={(h.allowed ? 260 : 282) - sameIdx * 3}
              r={3.5}
              fill={h.allowed ? 'var(--da-success)' : 'var(--da-danger)'}
            />
          );
        })}
        <text x={580} y={298} textAnchor="end" fontSize={10} fill="var(--da-muted)">
          now
        </text>
        <text x={20} y={298} fontSize={10} fill="var(--da-muted)">
          -10s
        </text>
      </svg>
    </SimShell>
  );
}
