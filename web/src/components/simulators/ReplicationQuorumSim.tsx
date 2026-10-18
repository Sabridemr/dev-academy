'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, PenLine, RefreshCw, RotateCcw } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { LogList, Range, SimShell, Stat } from './ui';
import { numParam, type SimulatorProps } from './types';

interface Replica {
  id: number;
  version: number;
  failed: boolean;
  /** Koordinatörden bu replikaya tek yön gecikme (ms) */
  latency: number;
}

const L = {
  tr: {
    title: 'Replikasyon ve quorum (N, W, R)',
    nLabel: 'N (replika)',
    wLabel: 'W (yazma quorum)',
    rLabel: 'R (okuma quorum)',
    write: 'Yaz',
    read: 'Oku',
    repair: 'Anti-entropy onarımı',
    failHint: 'Bir replikaya tıklayarak düşür/geri getir.',
    guaranteed:
      'W + R > N → okuma ve yazma kümeleri kesişir: okuma en güncel sürümü GARANTİ görür.',
    notGuaranteed: 'W + R ≤ N → kümeler kesişmeyebilir: okuma BAYAT veri döndürebilir.',
    writeOk: (v: number, ids: number[], ms: number) =>
      `Yazma v${v} → ${ids.map((i) => `R${i}`).join(', ')} onayladı (${ms} ms)`,
    writeFail: (alive: number, w: number) => `Yazma BAŞARISIZ: ${alive} canlı replika < W=${w}`,
    readOk: (v: number, ids: number[], ms: number) =>
      `Okuma ${ids.map((i) => `R${i}`).join(', ')} → v${v} güncel ✓ (${ms} ms)`,
    readStale: (v: number, latest: number, ids: number[]) =>
      `Okuma ${ids.map((i) => `R${i}`).join(', ')} → v${v} BAYAT (güncel v${latest})`,
    readFail: (alive: number, r: number) => `Okuma BAŞARISIZ: ${alive} canlı replika < R=${r}`,
    repaired: 'Canlı replikalar en güncel sürüme eşitlendi',
    latest: 'Son onaylı sürüm',
    alive: 'Canlı',
    writeLat: 'Yazma gecikmesi',
    readLat: 'Okuma gecikmesi',
    failed: 'DÜŞTÜ',
    lastWrite: 'son yazma',
    lastRead: 'son okuma',
  },
  en: {
    title: 'Replication and quorum (N, W, R)',
    nLabel: 'N (replicas)',
    wLabel: 'W (write quorum)',
    rLabel: 'R (read quorum)',
    write: 'Write',
    read: 'Read',
    repair: 'Anti-entropy repair',
    failHint: 'Click a replica to fail/restore it.',
    guaranteed:
      'W + R > N → read and write sets overlap: a read is GUARANTEED to see the latest version.',
    notGuaranteed: 'W + R ≤ N → sets may not overlap: a read can return STALE data.',
    writeOk: (v: number, ids: number[], ms: number) =>
      `Write v${v} → acked by ${ids.map((i) => `R${i}`).join(', ')} (${ms} ms)`,
    writeFail: (alive: number, w: number) => `Write FAILED: ${alive} alive replicas < W=${w}`,
    readOk: (v: number, ids: number[], ms: number) =>
      `Read ${ids.map((i) => `R${i}`).join(', ')} → v${v} fresh ✓ (${ms} ms)`,
    readStale: (v: number, latest: number, ids: number[]) =>
      `Read ${ids.map((i) => `R${i}`).join(', ')} → v${v} STALE (latest v${latest})`,
    readFail: (alive: number, r: number) => `Read FAILED: ${alive} alive replicas < R=${r}`,
    repaired: 'Alive replicas synced to the latest version',
    latest: 'Last committed version',
    alive: 'Alive',
    writeLat: 'Write latency',
    readLat: 'Read latency',
    failed: 'DOWN',
    lastWrite: 'last write',
    lastRead: 'last read',
  },
};

function makeReplicas(n: number, failed: number, baseLatency: number, regions: number): Replica[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    version: 0,
    failed: i >= n - failed,
    // İkinci bölgedeki replikalar bölgeler arası gecikme kadar uzakta
    latency: 2 + i * 1.5 + (regions > 1 && i >= Math.ceil(n / 2) ? baseLatency : 0),
  }));
}

/** Rastgele k eleman seç (Fisher–Yates) */
function sample<T>(arr: T[], k: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

export default function ReplicationQuorumSim({ params, onInteract }: SimulatorProps) {
  const { t, locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const baseLatency = numParam(params, 'latencyMs', 40, 0, 300);
  const regions = numParam(params, 'regions', 1, 1, 3);
  const [n, setN] = useState(() => numParam(params, 'nodes', 3, 1, 7));
  const [w, setW] = useState(() => numParam(params, 'writeQuorum', 2, 1, 7));
  const [r, setR] = useState(() => numParam(params, 'readQuorum', 2, 1, 7));
  const [replicas, setReplicas] = useState<Replica[]>(() =>
    makeReplicas(n, numParam(params, 'failedNodes', 0, 0, 7), baseLatency, regions),
  );
  const [latest, setLatest] = useState(0);
  const [lastWrite, setLastWrite] = useState<number[]>([]);
  const [lastRead, setLastRead] = useState<number[]>([]);
  const [log, setLog] = useState<
    { id: number; text: string; tone: 'success' | 'danger' | 'muted' }[]
  >([]);
  const [stats, setStats] = useState({ writeMs: 0, readMs: 0, fresh: 0, stale: 0, failed: 0 });
  const seq = useRef(0);

  const W = Math.min(w, n);
  const R = Math.min(r, n);
  const guaranteed = W + R > n;
  const alive = replicas.filter((x) => !x.failed);

  const push = (text: string, tone: 'success' | 'danger' | 'muted') =>
    setLog((lg) => [...lg, { id: ++seq.current, text, tone }].slice(-30));

  const changeN = (v: number) => {
    onInteract();
    setN(v);
    setReplicas(makeReplicas(v, 0, baseLatency, regions));
    setLatest(0);
    setLastRead([]);
    setLastWrite([]);
  };

  /** Yazma: W canlı replika onaylayınca başarılı; yalnızca o W replika yeni sürümü alır (diğerleri gecikmeli) */
  const write = () => {
    onInteract();
    if (alive.length < W) {
      push(l.writeFail(alive.length, W), 'danger');
      setStats((s) => ({ ...s, failed: s.failed + 1 }));
      setLastWrite([]);
      return;
    }
    const v = latest + 1;
    const chosen = sample(alive, W);
    const ids = chosen.map((c) => c.id).sort((a, b) => a - b);
    // Gecikme: en yavaş onaylayan replikanın gidiş-dönüşü
    const ms = Math.round(Math.max(...chosen.map((c) => c.latency)) * 2);
    setReplicas((rs) => rs.map((x) => (ids.includes(x.id) ? { ...x, version: v } : x)));
    setLatest(v);
    setLastWrite(ids);
    push(l.writeOk(v, ids, ms), 'success');
    setStats((s) => ({ ...s, writeMs: ms }));
  };

  /** Okuma: rastgele R canlı replikaya sor, en yüksek sürümü döndür */
  const read = () => {
    onInteract();
    if (alive.length < R) {
      push(l.readFail(alive.length, R), 'danger');
      setStats((s) => ({ ...s, failed: s.failed + 1 }));
      setLastRead([]);
      return;
    }
    const chosen = sample(alive, R);
    const ids = chosen.map((c) => c.id).sort((a, b) => a - b);
    const best = Math.max(...chosen.map((c) => c.version));
    const ms = Math.round(Math.max(...chosen.map((c) => c.latency)) * 2);
    setLastRead(ids);
    if (best >= latest) {
      push(l.readOk(best, ids, ms), 'success');
      setStats((s) => ({ ...s, readMs: ms, fresh: s.fresh + 1 }));
    } else {
      push(l.readStale(best, latest, ids), 'danger');
      setStats((s) => ({ ...s, readMs: ms, stale: s.stale + 1 }));
    }
  };

  const repair = () => {
    onInteract();
    setReplicas((rs) => rs.map((x) => (x.failed ? x : { ...x, version: latest })));
    push(l.repaired, 'muted');
  };

  const toggleFail = (id: number) => {
    onInteract();
    setReplicas((rs) => rs.map((x) => (x.id === id ? { ...x, failed: !x.failed } : x)));
  };

  const pos = (i: number) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: 300 + Math.cos(a) * 190, y: 170 + Math.sin(a) * 120 };
  };

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button type="button" className="btn-primary" onClick={write}>
            <PenLine size={14} /> {l.write}
          </button>
          <button type="button" className="btn-ghost" onClick={read}>
            <BookOpen size={14} /> {l.read}
          </button>
          <button type="button" className="btn-ghost" onClick={repair}>
            <RefreshCw size={14} /> {l.repair}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              changeN(n);
              setLog([]);
              setStats({ writeMs: 0, readMs: 0, fresh: 0, stale: 0, failed: 0 });
            }}
          >
            <RotateCcw size={14} /> {t('sim.reset')}
          </button>
        </>
      }
      aside={
        <>
          <Range label={l.nLabel} value={n} min={1} max={7} onChange={changeN} />
          <Range
            label={l.wLabel}
            value={W}
            min={1}
            max={n}
            onChange={(v) => {
              onInteract();
              setW(v);
            }}
          />
          <Range
            label={l.rLabel}
            value={R}
            min={1}
            max={n}
            onChange={(v) => {
              onInteract();
              setR(v);
            }}
          />
          <p
            className={`rounded-xl border p-2 text-xs ${guaranteed ? 'border-success/40 bg-success/10 text-success' : 'border-warning/40 bg-warning/10 text-warning'}`}
            aria-live="polite"
          >
            W + R = {W + R} {guaranteed ? '>' : '≤'} N = {n}.{' '}
            {guaranteed ? l.guaranteed : l.notGuaranteed}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={l.latest} value={`v${latest}`} tone="primary" />
            <Stat
              label={l.alive}
              value={`${alive.length}/${n}`}
              tone={alive.length < Math.max(W, R) ? 'danger' : 'success'}
            />
            <Stat label={l.writeLat} value={`${stats.writeMs} ms`} />
            <Stat label={l.readLat} value={`${stats.readMs} ms`} />
            <Stat label="✓ fresh" value={stats.fresh} tone="success" />
            <Stat label="⚠ stale" value={stats.stale} tone={stats.stale ? 'warning' : undefined} />
          </div>
          <LogList
            items={log
              .slice()
              .reverse()
              .map((x) => ({ key: x.id, text: x.text, tone: x.tone }))}
          />
        </>
      }
    >
      <p className="mb-2 text-sm text-muted">{l.failHint}</p>
      <svg viewBox="0 0 600 340" className="h-auto w-full" role="img" aria-label={l.title}>
        <circle
          cx={300}
          cy={170}
          r={34}
          fill="color-mix(in srgb, var(--da-primary) 12%, var(--da-surface))"
          stroke="var(--da-primary)"
        />
        <text
          x={300}
          y={168}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill="var(--da-primary)"
        >
          Coord.
        </text>
        <text x={300} y={182} textAnchor="middle" fontSize={10} fill="var(--da-muted)">
          v{latest}
        </text>
        {replicas.map((x, i) => {
          const p = pos(i);
          const inW = lastWrite.includes(x.id);
          const inR = lastRead.includes(x.id);
          const stale = !x.failed && x.version < latest;
          return (
            <g
              key={x.id}
              role="button"
              tabIndex={0}
              aria-pressed={x.failed}
              aria-label={`R${x.id} v${x.version}${x.failed ? ` ${l.failed}` : ''}`}
              className="cursor-pointer"
              onClick={() => toggleFail(x.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') toggleFail(x.id);
              }}
            >
              <line
                x1={300}
                y1={170}
                x2={p.x}
                y2={p.y}
                stroke={inW ? 'var(--da-accent)' : inR ? 'var(--da-success)' : 'var(--da-border)'}
                strokeWidth={inW || inR ? 3 : 1.5}
                strokeDasharray={x.failed ? '4 4' : undefined}
              />
              {(inW || inR) && !reduced && (
                <motion.circle
                  key={`${x.id}-${latest}-${lastRead.join()}`}
                  r={5}
                  fill={inW ? 'var(--da-accent)' : 'var(--da-success)'}
                  initial={{ cx: 300, cy: 170 }}
                  animate={{ cx: p.x, cy: p.y }}
                  transition={{ duration: 0.5 }}
                />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={32}
                fill={
                  x.failed
                    ? 'color-mix(in srgb, var(--da-danger) 15%, var(--da-surface))'
                    : 'var(--da-surface)'
                }
                stroke={
                  x.failed ? 'var(--da-danger)' : stale ? 'var(--da-warning)' : 'var(--da-success)'
                }
                strokeWidth={2}
              />
              <text
                x={p.x}
                y={p.y - 6}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                fill="var(--da-fg)"
              >
                R{x.id}
              </text>
              <text
                x={p.x}
                y={p.y + 10}
                textAnchor="middle"
                fontSize={11}
                fill={
                  x.failed ? 'var(--da-danger)' : stale ? 'var(--da-warning)' : 'var(--da-muted)'
                }
              >
                {x.failed ? l.failed : `v${x.version}`}
              </text>
              <text x={p.x} y={p.y + 46} textAnchor="middle" fontSize={9} fill="var(--da-muted)">
                {Math.round(x.latency)} ms{inW ? ` · ${l.lastWrite}` : ''}
                {inR ? ` · ${l.lastRead}` : ''}
              </text>
            </g>
          );
        })}
      </svg>
    </SimShell>
  );
}
