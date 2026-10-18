'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, RotateCcw, Send } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { LogList, Range, SimShell, Stat } from './ui';
import { boolParam, numParam, type SimulatorProps } from './types';

const TICK_MS = 200;
const PROCESS_TICKS = 4;
const MAX_QUEUE = 120;

interface Msg {
  id: number;
  partition: number;
  attempts: number;
}

interface Consumer {
  id: number;
  current: Msg | null;
  remaining: number;
}

interface World {
  queues: Msg[][];
  consumers: Consumer[];
  dlq: Msg[];
  dlqCount: number;
  produced: number;
  processed: number;
  duplicates: number;
  retries: number;
  dropped: number;
  /** Yan etkisi uygulanmış mesaj kimlikleri (idempotency anahtarları) — sınırlı tutulur */
  seen: number[];
  log: { id: number; text: string; tone: 'success' | 'danger' | 'muted' }[];
  seq: number;
  logSeq: number;
}

const L = {
  tr: {
    title: 'Mesaj kuyruğu: retry, DLQ ve idempotency',
    rate: 'Üretici hızı (mesaj/sn)',
    consumers: 'Tüketici sayısı',
    partitions: 'Partition sayısı',
    failure: 'Hata oranı',
    retries: 'Maks. yeniden deneme',
    idempotent: 'Idempotent tüketici (tekrarları ayıkla)',
    produce: '5 mesaj üret',
    producer: 'Üretici',
    consumer: 'Tüketici',
    idle: 'boşta',
    produced: 'Üretilen',
    processed: 'İşlenen',
    duplicates: 'Çift işleme',
    retried: 'Yeniden deneme',
    lag: 'Kuyruk gecikmesi (lag)',
    dropped: 'Düşen (kuyruk dolu)',
    pause: 'Duraklat',
    start: 'Başlat',
    explain: 'At-least-once teslimatta tüketici işi yapıp ACK göndermeden çökerse mesaj tekrar teslim edilir. Idempotency anahtarı olmadan aynı iş iki kez yapılır (ör. çift ödeme).',
    logOk: (id: number, c: number) => `#${id} C${c} tarafından işlendi ✓`,
    logRetry: (id: number, a: number) => `#${id} hata → yeniden kuyruğa (deneme ${a})`,
    logCrash: (id: number) => `#${id} işlendi ama ACK kayboldu → yeniden teslim`,
    logDlq: (id: number) => `#${id} deneme sınırı aşıldı → DLQ`,
    logDup: (id: number, idem: boolean) => (idem ? `#${id} tekrar geldi, idempotency anahtarı ile atlandı` : `#${id} İKİNCİ KEZ işlendi! (çift yan etki)`),
  },
  en: {
    title: 'Message queue: retries, DLQ and idempotency',
    rate: 'Producer rate (msg/s)',
    consumers: 'Consumers',
    partitions: 'Partitions',
    failure: 'Failure rate',
    retries: 'Max retries',
    idempotent: 'Idempotent consumer (dedupe repeats)',
    produce: 'Produce 5 messages',
    producer: 'Producer',
    consumer: 'Consumer',
    idle: 'idle',
    produced: 'Produced',
    processed: 'Processed',
    duplicates: 'Duplicate processing',
    retried: 'Retries',
    lag: 'Queue lag',
    dropped: 'Dropped (queue full)',
    pause: 'Pause',
    start: 'Start',
    explain: 'With at-least-once delivery, if a consumer does the work but crashes before ACKing, the message is redelivered. Without an idempotency key the work runs twice (e.g. double charge).',
    logOk: (id: number, c: number) => `#${id} processed by C${c} ✓`,
    logRetry: (id: number, a: number) => `#${id} failed → requeued (attempt ${a})`,
    logCrash: (id: number) => `#${id} processed but ACK lost → redelivery`,
    logDlq: (id: number) => `#${id} exceeded retries → DLQ`,
    logDup: (id: number, idem: boolean) => (idem ? `#${id} redelivered, skipped via idempotency key` : `#${id} processed TWICE! (duplicate side effect)`),
  },
};

function makeWorld(partitions: number, consumers: number): World {
  return {
    queues: Array.from({ length: partitions }, () => []),
    consumers: Array.from({ length: consumers }, (_, i) => ({ id: i + 1, current: null, remaining: 0 })),
    dlq: [],
    dlqCount: 0,
    produced: 0,
    processed: 0,
    duplicates: 0,
    retries: 0,
    dropped: 0,
    seen: [],
    log: [],
    seq: 0,
    logSeq: 0,
  };
}

/** Partition → tüketici ataması (Kafka tüketici grubu gibi: her partition'ı tek tüketici okur) */
const ownerOf = (partition: number, consumers: number) => partition % consumers;

export default function MessageQueueSim({ params, onInteract }: SimulatorProps) {
  const { t, locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const [partitions, setPartitions] = useState(() => numParam(params, 'partitions', 3, 1, 6));
  const [consumerCount, setConsumerCount] = useState(() => numParam(params, 'consumers', 2, 1, 6));
  const [rate, setRate] = useState(() => numParam(params, 'producers', 2, 1, 6) * 2);
  const [failureRate, setFailureRate] = useState(() => numParam(params, 'failureRate', 0.15, 0, 0.9));
  const [maxRetries, setMaxRetries] = useState(() => numParam(params, 'maxRetries', 3, 0, 6));
  const [idempotent, setIdempotent] = useState(() => boolParam(params, 'idempotent', false));
  const [running, setRunning] = useState(false);
  const [world, setWorld] = useState<World>(() => makeWorld(partitions, consumerCount));
  const carry = useRef(0);
  const cfg = useRef({ failureRate, maxRetries, idempotent, rate, l });
  cfg.current = { failureRate, maxRetries, idempotent, rate, l };

  useEffect(() => {
    setWorld(makeWorld(partitions, consumerCount));
  }, [partitions, consumerCount]);

  /** Tek simülasyon adımı: üret → tüketicilere ver → işlemeyi ilerlet */
  const step = useCallback((produceExtra: number, auto: boolean) => {
    // Üretim miktarı updater dışında hesaplanır (StrictMode updater'ı iki kez çağırabilir)
    let toProduce = produceExtra;
    if (auto) {
      carry.current += (cfg.current.rate * TICK_MS) / 1000;
      const k = Math.floor(carry.current);
      carry.current -= k;
      toProduce += k;
    }
    setWorld((prev) => {
      const c = cfg.current;
      const w: World = {
        ...prev,
        queues: prev.queues.map((q) => [...q]),
        consumers: prev.consumers.map((x) => ({ ...x })),
        dlq: [...prev.dlq],
        seen: [...prev.seen],
        log: [...prev.log],
      };
      const log = (text: string, tone: 'success' | 'danger' | 'muted') => {
        w.logSeq += 1;
        w.log.push({ id: w.logSeq, text, tone });
      };
      // Üretim
      for (let i = 0; i < toProduce; i++) {
        w.seq += 1;
        const p = w.seq % w.queues.length;
        if (w.queues[p].length >= MAX_QUEUE) {
          w.dropped += 1;
          continue;
        }
        w.queues[p].push({ id: w.seq, partition: p, attempts: 0 });
        w.produced += 1;
      }
      // Tüketim
      for (const con of w.consumers) {
        if (!con.current) {
          const owned = w.queues.map((_, p) => p).filter((p) => ownerOf(p, w.consumers.length) === con.id - 1);
          const p = owned.find((pp) => w.queues[pp].length > 0);
          if (p !== undefined) {
            con.current = w.queues[p].shift()!;
            con.remaining = PROCESS_TICKS;
          }
          continue;
        }
        con.remaining -= 1;
        if (con.remaining > 0) continue;
        const m = con.current;
        con.current = null;
        const already = w.seen.includes(m.id);
        if (Math.random() < c.failureRate) {
          // Hatanın yarısı "iş yapıldı ama ACK kayboldu" senaryosu → yan etki uygulanır, mesaj yeniden teslim edilir
          const crashAfterWork = Math.random() < 0.5;
          if (crashAfterWork) {
            if (already) {
              if (!c.idempotent) w.duplicates += 1;
              log(c.l.logDup(m.id, c.idempotent), c.idempotent ? 'muted' : 'danger');
            } else {
              w.seen.push(m.id);
              w.processed += 1;
            }
            log(c.l.logCrash(m.id), 'danger');
          }
          const attempts = m.attempts + 1;
          if (attempts > c.maxRetries) {
            w.dlq.push({ ...m, attempts });
            w.dlqCount += 1;
            log(c.l.logDlq(m.id), 'danger');
          } else {
            w.retries += 1;
            w.queues[m.partition].push({ ...m, attempts });
            if (!crashAfterWork) log(c.l.logRetry(m.id, attempts), 'muted');
          }
        } else if (already) {
          if (!c.idempotent) w.duplicates += 1;
          log(c.l.logDup(m.id, c.idempotent), c.idempotent ? 'muted' : 'danger');
        } else {
          w.seen.push(m.id);
          w.processed += 1;
          log(c.l.logOk(m.id, con.id), 'success');
        }
      }
      // Sınırlı bellek
      if (w.seen.length > 500) w.seen.splice(0, w.seen.length - 500);
      if (w.log.length > 40) w.log.splice(0, w.log.length - 40);
      if (w.dlq.length > 16) w.dlq.splice(0, w.dlq.length - 16);
      return w;
    });
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => step(0, true), TICK_MS);
    return () => clearInterval(id);
  }, [running, step]);

  const lag = world.queues.reduce((a, q) => a + q.length, 0);
  const rowH = 44;
  const qTop = 30;
  const svgH = Math.max(qTop + partitions * rowH, 30 + consumerCount * 54) + 90;
  const conY = (i: number) => 30 + i * 54;

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button type="button" className="btn-primary" aria-pressed={running} onClick={() => { onInteract(); setRunning((r) => !r); }}>
            {running ? <Pause size={14} /> : <Play size={14} />} {running ? l.pause : l.start}
          </button>
          <button type="button" className="btn-ghost" onClick={() => { onInteract(); step(5, false); }}>
            <Send size={14} /> {l.produce}
          </button>
          <button type="button" className="btn-ghost" onClick={() => { setRunning(false); setWorld(makeWorld(partitions, consumerCount)); }}>
            <RotateCcw size={14} /> {t('sim.reset')}
          </button>
        </>
      }
      aside={
        <>
          <Range label={l.rate} value={rate} min={1} max={20} onChange={(v) => { onInteract(); setRate(v); }} />
          <Range label={l.partitions} value={partitions} min={1} max={6} onChange={(v) => { onInteract(); setPartitions(v); }} />
          <Range label={l.consumers} value={consumerCount} min={1} max={6} onChange={(v) => { onInteract(); setConsumerCount(v); }} />
          <Range label={l.failure} value={failureRate} min={0} max={0.9} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => { onInteract(); setFailureRate(v); }} />
          <Range label={l.retries} value={maxRetries} min={0} max={6} onChange={(v) => { onInteract(); setMaxRetries(v); }} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={idempotent} onChange={(e) => { onInteract(); setIdempotent(e.target.checked); }} />
            {l.idempotent}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={l.produced} value={world.produced} />
            <Stat label={l.processed} value={world.processed} tone="success" />
            <Stat label={l.lag} value={lag} tone={lag > 30 ? 'warning' : undefined} />
            <Stat label={l.retried} value={world.retries} />
            <Stat label="DLQ" value={world.dlqCount} tone={world.dlqCount ? 'danger' : undefined} />
            <Stat label={l.duplicates} value={world.duplicates} tone={world.duplicates ? 'danger' : 'success'} />
          </div>
          {world.dropped > 0 && <p className="text-xs text-danger">{l.dropped}: {world.dropped}</p>}
        </>
      }
    >
      <svg viewBox={`0 0 600 ${svgH}`} className="h-auto w-full" role="img" aria-label={l.title}>
        {/* Üretici */}
        <rect x={6} y={qTop + (partitions * rowH) / 2 - 26} width={84} height={52} rx={10} fill="color-mix(in srgb, var(--da-accent) 15%, var(--da-surface))" stroke="var(--da-accent)" />
        <text x={48} y={qTop + (partitions * rowH) / 2 - 2} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--da-fg)">{l.producer}</text>
        <text x={48} y={qTop + (partitions * rowH) / 2 + 14} textAnchor="middle" fontSize={10} fill="var(--da-muted)">{rate}/s</text>
        {/* Partition'lar */}
        {world.queues.map((q, p) => {
          const y = qTop + p * rowH;
          const owner = ownerOf(p, consumerCount);
          return (
            <g key={p}>
              <line x1={90} y1={qTop + (partitions * rowH) / 2} x2={120} y2={y + 17} stroke="var(--da-border)" />
              <rect x={120} y={y} width={300} height={34} rx={8} fill="var(--da-elevated)" stroke="var(--da-border)" />
              <text x={126} y={y + 12} fontSize={9} fill="var(--da-muted)">P{p}</text>
              <AnimatePresence initial={false}>
                {q.slice(0, 11).map((m, i) => (
                  <motion.g
                    key={`${m.id}-${m.attempts}`}
                    initial={reduced ? false : { opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduced ? undefined : { opacity: 0, x: 20 }}
                    transition={{ duration: reduced ? 0 : 0.25 }}
                  >
                    <rect x={396 - i * 24} y={y + 6} width={20} height={22} rx={4} fill={m.attempts ? 'color-mix(in srgb, var(--da-warning) 50%, var(--da-surface))' : 'color-mix(in srgb, var(--da-primary) 35%, var(--da-surface))'} stroke={m.attempts ? 'var(--da-warning)' : 'var(--da-primary)'} />
                    <text x={406 - i * 24} y={y + 21} textAnchor="middle" fontSize={8} fill="var(--da-fg)">{m.id % 100}</text>
                  </motion.g>
                ))}
              </AnimatePresence>
              {q.length > 11 && <text x={140} y={y + 28} fontSize={10} fill="var(--da-danger)">+{q.length - 11}</text>}
              <line x1={420} y1={y + 17} x2={470} y2={conY(owner) + 22} stroke="var(--da-border)" strokeDasharray="3 3" />
            </g>
          );
        })}
        {/* Tüketiciler */}
        {world.consumers.map((c, i) => {
          const y = conY(i);
          const prog = c.current ? 1 - c.remaining / PROCESS_TICKS : 0;
          return (
            <g key={c.id}>
              <rect x={470} y={y} width={124} height={44} rx={8} fill="var(--da-surface)" stroke={c.current ? 'var(--da-primary)' : 'var(--da-border)'} strokeWidth={1.5} />
              <text x={480} y={y + 16} fontSize={11} fontWeight={600} fill="var(--da-fg)">C{c.id}</text>
              <text x={584} y={y + 16} textAnchor="end" fontSize={10} fill="var(--da-muted)">{c.current ? `#${c.current.id}${c.current.attempts ? ` ↻${c.current.attempts}` : ''}` : l.idle}</text>
              <rect x={480} y={y + 26} width={104} height={6} rx={3} fill="var(--da-elevated)" />
              <rect x={480} y={y + 26} width={104 * prog} height={6} rx={3} fill="var(--da-primary)" />
            </g>
          );
        })}
        {/* DLQ */}
        <g transform={`translate(120, ${svgH - 70})`}>
          <rect width={474} height={60} rx={10} fill="color-mix(in srgb, var(--da-danger) 8%, var(--da-surface))" stroke="var(--da-danger)" strokeDasharray="5 4" />
          <text x={10} y={18} fontSize={11} fontWeight={600} fill="var(--da-danger)">Dead Letter Queue ({world.dlqCount})</text>
          {world.dlq.map((m, i) => (
            <g key={m.id}>
              <rect x={10 + i * 28} y={26} width={24} height={24} rx={4} fill="color-mix(in srgb, var(--da-danger) 40%, var(--da-surface))" />
              <text x={22 + i * 28} y={42} textAnchor="middle" fontSize={8} fill="var(--da-fg)">{m.id % 100}</text>
            </g>
          ))}
        </g>
      </svg>
      <p className="mt-2 text-xs text-muted">{l.explain}</p>
      <div className="mt-3">
        <p className="label">{t('sim.log')}</p>
        <LogList items={world.log.slice(-12).reverse().map((x) => ({ key: x.id, text: x.text, tone: x.tone }))} />
      </div>
    </SimShell>
  );
}
