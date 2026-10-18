'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Zap } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { Range, SimShell, Stat } from './ui';
import { numParam, strParam, type SimulatorProps } from './types';

type HopKind = 'client' | 'dns' | 'cdn' | 'lb' | 'gateway' | 'service' | 'cache' | 'db' | 'net' | 'generic';

interface Hop {
  id: string;
  label: string;
  kind: HopKind;
  /** Bu katmanın kendi işlem süresi (ms) */
  ms: number;
}

const DEFAULT_LAYERS = ['user', 'dns', 'cdn', 'lb', 'gateway', 'service', 'cache', 'db'];

/** Ders parametresindeki serbest katman adını bilinen bir türe eşler */
function classify(name: string): { kind: HopKind; ms: number } {
  const n = name.toLowerCase();
  if (/^(user|client|browser)/.test(n)) return { kind: 'client', ms: 2 };
  if (n.includes('dns')) return { kind: 'dns', ms: 40 };
  if (n.includes('cdn') || n.includes('edge')) return { kind: 'cdn', ms: 15 };
  if (n === 'lb' || n.includes('load')) return { kind: 'lb', ms: 2 };
  if (n.includes('gateway') || n === 'bff' || n.includes('routing') || n.includes('auth') || n.includes('rate')) return { kind: 'gateway', ms: 5 };
  if (n.includes('cache') || n.includes('redis')) return { kind: 'cache', ms: 2 };
  if (n === 'db' || n.includes('database') || n.includes('postgres')) return { kind: 'db', ms: 25 };
  if (['tcp', 'tls', 'http', 'websocket', 'quic'].some((k) => n.includes(k))) return { kind: 'net', ms: 0 };
  if (n.includes('lambda-cold')) return { kind: 'service', ms: 800 };
  if (n.includes('service') || n.includes('lambda') || ['orders', 'catalog', 'payments', 'aggregation', 'circuit-breaker'].some((k) => n.includes(k))) return { kind: 'service', ms: 30 };
  return { kind: 'generic', ms: 8 };
}

const L = {
  tr: {
    title: 'Bir isteğin yolculuğu',
    send: 'İstek gönder',
    send20: '20 istek (rastgele hit)',
    dnsCached: 'DNS önbellekte',
    cdnHit: 'CDN hit (statik içerik)',
    cacheHit: 'Cache hit',
    fail: (s: string) => `Hata enjekte et: ${s}`,
    hitRate: 'Cache hit oranı (toplu gönderim)',
    rtt: 'Ağ gidiş-dönüş (RTT) ms',
    total: 'Toplam gecikme',
    hops: 'Atlanan katman',
    avg: 'Ortalama (20 istek)',
    p95: 'p95 (20 istek)',
    waterfall: 'Gecikme şelalesi',
    served: (s: string) => `Yanıt “${s}” katmanından döndü`,
    failed: (s: string) => `İstek “${s}” katmanında 5xx ile başarısız oldu`,
    slow: 'yavaş',
    hint: 'Kısa devre: CDN veya cache hit olduğunda istek arka katmanlara hiç gitmez — en ucuz istek, hiç yapılmayan istektir.',
  },
  en: {
    title: 'The journey of a request',
    send: 'Send request',
    send20: '20 requests (random hits)',
    dnsCached: 'DNS cached',
    cdnHit: 'CDN hit (static content)',
    cacheHit: 'Cache hit',
    fail: (s: string) => `Inject failure: ${s}`,
    hitRate: 'Cache hit rate (batch)',
    rtt: 'Network round trip (RTT) ms',
    total: 'Total latency',
    hops: 'Hops visited',
    avg: 'Average (20 req)',
    p95: 'p95 (20 req)',
    waterfall: 'Latency waterfall',
    served: (s: string) => `Response served by “${s}”`,
    failed: (s: string) => `Request failed with 5xx at “${s}”`,
    slow: 'slow',
    hint: 'Short-circuit: on a CDN or cache hit the request never reaches the back layers — the cheapest request is the one you never make.',
  },
};

interface Journey {
  visited: { hop: Hop; ms: number }[];
  terminal: number;
  failed: boolean;
  total: number;
}

export default function RequestJourneySim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const raw = ['layers', 'path', 'stages', 'services'].map((k) => params[k]).find((v): v is string => typeof v === 'string' && v.trim().length > 0);
  const names = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10) : DEFAULT_LAYERS;
  const withClient = classify(names[0]).kind === 'client' ? names : ['user', ...names];
  const slowService = strParam<string>(params, 'slowService', '');
  const failureStage = strParam<string>(params, 'failureStage', '');
  const layersKey = withClient.join(',');
  const hops: Hop[] = useMemo(
    () =>
      layersKey.split(',').map((n) => {
        const c = classify(n);
        return { id: n, label: n, kind: c.kind, ms: c.ms + (n === slowService ? 300 : 0) };
      }),
    [layersKey, slowService],
  );

  const [dnsCached, setDnsCached] = useState(false);
  const [cdnHit, setCdnHit] = useState(false);
  const [cacheHit, setCacheHit] = useState(false);
  const [injectFail, setInjectFail] = useState(false);
  const [hitRate, setHitRate] = useState(() => numParam(params, 'cacheHitRate', 70, 0, 100));
  const [rtt, setRtt] = useState(() => numParam(params, 'rttMs', 20, 1, 300));
  const [journey, setJourney] = useState<Journey | null>(null);
  const [cursor, setCursor] = useState(-1);
  const [batch, setBatch] = useState<{ avg: number; p95: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /** Bir isteğin yolunu ve gecikmesini hesaplar (ağ: katmanlar arası RTT'nin bir kısmı) */
  const compute = (opts: { dns: boolean; cdn: boolean; cache: boolean }): Journey => {
    const visited: { hop: Hop; ms: number }[] = [];
    let terminal = hops.length - 1;
    let failed = false;
    for (let i = 0; i < hops.length; i++) {
      const h = hops[i];
      let ms = h.ms;
      if (h.kind === 'dns' && opts.dns) ms = 1;
      if (h.kind === 'net') ms = rtt; // tcp/tls/http el sıkışmaları birer RTT
      // Katmana ulaşmak için ağ gecikmesi: istemciden ilk sıçrama uzun, iç ağ kısa
      const hopNet = i === 0 ? 0 : i === 1 ? rtt / 2 : 1;
      visited.push({ hop: h, ms: ms + hopNet });
      if (injectFail && h.id === failureStage) {
        failed = true;
        terminal = i;
        break;
      }
      if ((h.kind === 'cdn' && opts.cdn) || (h.kind === 'cache' && opts.cache)) {
        terminal = i;
        break;
      }
    }
    const total = visited.reduce((a, v) => a + v.ms, 0) + rtt / 2; // yanıtın dönüşü
    return { visited, terminal, failed, total };
  };

  const send = () => {
    onInteract();
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const j = compute({ dns: dnsCached, cdn: cdnHit, cache: cacheHit });
    setJourney(j);
    if (reduced) {
      setCursor(j.visited.length);
      return;
    }
    setCursor(0);
    let at = 0;
    j.visited.forEach((v, i) => {
      at += 250 + Math.min(600, v.ms * 2);
      timers.current.push(setTimeout(() => setCursor(i + 1), at));
    });
  };

  const sendBatch = () => {
    onInteract();
    const totals = Array.from({ length: 20 }, () =>
      compute({ dns: Math.random() < 0.8, cdn: cdnHit, cache: Math.random() * 100 < hitRate }).total,
    ).sort((a, b) => a - b);
    setBatch({ avg: totals.reduce((a, b) => a + b, 0) / totals.length, p95: totals[Math.floor(totals.length * 0.95) - 1] ?? totals[totals.length - 1] });
  };

  const n = hops.length;
  const boxW = Math.min(90, 580 / n - 8);
  const hx = (i: number) => 10 + (i * (580 - boxW)) / Math.max(1, n - 1);
  const done = journey && cursor >= journey.visited.length;
  const hasKind = (k: HopKind) => hops.some((h) => h.kind === k);
  const kindColor = (k: HopKind) => (k === 'cdn' || k === 'cache' ? 'var(--da-success)' : k === 'db' ? 'var(--da-accent)' : k === 'client' ? 'var(--da-muted)' : 'var(--da-primary)');
  const maxMs = journey ? Math.max(...journey.visited.map((v) => v.ms), 1) : 1;

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button type="button" className="btn-primary" onClick={send}>
            <Send size={14} /> {l.send}
          </button>
          <button type="button" className="btn-ghost" onClick={sendBatch}>
            <Zap size={14} /> {l.send20}
          </button>
        </>
      }
      aside={
        <>
          {hasKind('dns') && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={dnsCached} onChange={(e) => { onInteract(); setDnsCached(e.target.checked); }} /> {l.dnsCached}
            </label>
          )}
          {hasKind('cdn') && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={cdnHit} onChange={(e) => { onInteract(); setCdnHit(e.target.checked); }} /> {l.cdnHit}
            </label>
          )}
          {hasKind('cache') && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={cacheHit} onChange={(e) => { onInteract(); setCacheHit(e.target.checked); }} /> {l.cacheHit}
            </label>
          )}
          {failureStage && hops.some((h) => h.id === failureStage) && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={injectFail} onChange={(e) => { onInteract(); setInjectFail(e.target.checked); }} /> {l.fail(failureStage)}
            </label>
          )}
          <Range label={l.rtt} value={rtt} min={1} max={200} onChange={(v) => { onInteract(); setRtt(v); }} />
          {hasKind('cache') && <Range label={l.hitRate} value={hitRate} min={0} max={100} step={5} format={(v) => `${v}%`} onChange={setHitRate} />}
          <div className="grid grid-cols-2 gap-2" aria-live="polite">
            <Stat label={l.total} value={journey && done ? `${Math.round(journey.total)} ms` : '—'} tone={journey?.failed ? 'danger' : 'primary'} />
            <Stat label={l.hops} value={journey ? `${journey.visited.length}/${n}` : '—'} />
            {batch && <Stat label={l.avg} value={`${Math.round(batch.avg)} ms`} />}
            {batch && <Stat label={l.p95} value={`${Math.round(batch.p95)} ms`} tone="warning" />}
          </div>
          <p className="text-xs text-muted">{l.hint}</p>
        </>
      }
    >
      <svg viewBox="0 0 600 150" className="h-auto w-full" role="img" aria-label={l.title}>
        {hops.map((h, i) => {
          const reached = journey ? i < Math.min(cursor, journey.visited.length) : false;
          const isTerminal = journey && done && i === journey.terminal;
          const skipped = journey && i > journey.terminal;
          return (
            <g key={`${h.id}-${i}`} opacity={skipped ? 0.35 : 1}>
              {i > 0 && <line x1={hx(i - 1) + boxW} y1={60} x2={hx(i)} y2={60} stroke={reached ? kindColor(h.kind) : 'var(--da-border)'} strokeWidth={2} />}
              <rect
                x={hx(i)}
                y={36}
                width={boxW}
                height={48}
                rx={9}
                fill={isTerminal ? `color-mix(in srgb, ${journey?.failed ? 'var(--da-danger)' : kindColor(h.kind)} 20%, var(--da-surface))` : 'var(--da-surface)'}
                stroke={isTerminal && journey?.failed ? 'var(--da-danger)' : reached ? kindColor(h.kind) : 'var(--da-border)'}
                strokeWidth={reached ? 2 : 1.2}
              />
              <text x={hx(i) + boxW / 2} y={57} textAnchor="middle" fontSize={Math.min(11, boxW / 6.5)} fontWeight={600} fill="var(--da-fg)">{h.label.length > 12 ? `${h.label.slice(0, 11)}…` : h.label}</text>
              <text x={hx(i) + boxW / 2} y={73} textAnchor="middle" fontSize={9} fill={h.id === slowService ? 'var(--da-danger)' : 'var(--da-muted)'}>
                {journey && reached ? `${Math.round(journey.visited[i].ms)} ms` : h.id === slowService ? l.slow : h.kind}
              </text>
            </g>
          );
        })}
        {journey && cursor >= 0 && (
          <motion.circle
            r={7}
            fill={journey.failed && done ? 'var(--da-danger)' : 'var(--da-accent)'}
            initial={false}
            animate={{
              cx: done ? hx(0) + boxW / 2 : hx(Math.min(Math.max(cursor - 1, 0), n - 1)) + boxW / 2,
              cy: done ? 110 : 26,
            }}
            transition={{ duration: reduced ? 0 : 0.35 }}
          />
        )}
        {journey && done && (
          <>
            <path d={`M ${hx(journey.terminal) + boxW / 2} 86 Q ${(hx(journey.terminal) + hx(0)) / 2 + boxW / 2} 140 ${hx(0) + boxW / 2} 86`} fill="none" stroke={journey.failed ? 'var(--da-danger)' : 'var(--da-success)'} strokeDasharray="5 4" />
            <text x={300} y={146} textAnchor="middle" fontSize={11} fill={journey.failed ? 'var(--da-danger)' : 'var(--da-success)'}>
              {journey.failed ? l.failed(hops[journey.terminal].label) : l.served(hops[journey.terminal].label)} · {Math.round(journey.total)} ms
            </text>
          </>
        )}
      </svg>

      {journey && (
        <figure className="mt-3">
          <figcaption className="label">{l.waterfall}</figcaption>
          <svg viewBox={`0 0 600 ${journey.visited.length * 22 + 8}`} className="h-auto w-full" role="img" aria-label={l.waterfall}>
            {(() => {
              let offset = 0;
              const scale = 420 / Math.max(1, journey.total);
              return journey.visited.map((v, i) => {
                const x = 130 + offset * scale;
                offset += v.ms;
                return (
                  <g key={i} transform={`translate(0, ${i * 22 + 4})`} opacity={i < cursor ? 1 : 0.3}>
                    <text x={0} y={13} fontSize={10} fill="var(--da-fg)">{v.hop.label}</text>
                    <rect x={x} y={3} width={Math.max(2, v.ms * scale)} height={12} rx={3} fill={kindColor(v.hop.kind)} opacity={0.4 + (0.6 * v.ms) / maxMs} />
                    <text x={x + Math.max(2, v.ms * scale) + 4} y={13} fontSize={9} fill="var(--da-muted)">{v.ms.toFixed(v.ms < 10 ? 1 : 0)} ms</text>
                  </g>
                );
              });
            })()}
          </svg>
        </figure>
      )}
    </SimShell>
  );
}
