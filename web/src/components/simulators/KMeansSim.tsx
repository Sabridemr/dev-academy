'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Dices, Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { seededRandom } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { Range, Select, SimShell, Stat } from './ui';
import { numParam, strParam, type SimulatorProps } from './types';

type Init = 'random' | 'kmeans++';
type Phase = 'assign' | 'update';
interface P {
  x: number;
  y: number;
}

const PALETTE = [
  'var(--da-primary)',
  'var(--da-accent)',
  'var(--da-success)',
  'var(--da-danger)',
  'color-mix(in srgb, var(--da-primary) 50%, var(--da-success))',
  'color-mix(in srgb, var(--da-accent) 50%, var(--da-danger))',
  'color-mix(in srgb, var(--da-primary) 55%, var(--da-danger))',
  'var(--da-muted)',
];

const L = {
  tr: {
    title: 'K-means kümeleme',
    k: 'Küme sayısı (k)',
    init: 'Başlatma',
    random: 'Rastgele noktalar',
    kpp: 'k-means++',
    newData: 'Yeni veri',
    inertia: 'Inertia (WCSS)',
    phase: 'Sıradaki adım',
    assign: 'Atama: her nokta en yakın merkeze',
    update: 'Güncelleme: merkez = kümenin ortalaması',
    converged: 'Yakınsadı — atamalar değişmiyor.',
    iteration: 'İterasyon',
    pause: 'Duraklat',
    history: 'Inertia geçmişi',
    hint: 'Farklı başlangıçlar farklı yerel minimumlara götürebilir; k-means++ merkezleri birbirinden uzak seçer.',
  },
  en: {
    title: 'K-means clustering',
    k: 'Number of clusters (k)',
    init: 'Initialization',
    random: 'Random points',
    kpp: 'k-means++',
    newData: 'New data',
    inertia: 'Inertia (WCSS)',
    phase: 'Next step',
    assign: 'Assign: each point to nearest centroid',
    update: 'Update: centroid = mean of its cluster',
    converged: 'Converged — assignments no longer change.',
    iteration: 'Iteration',
    pause: 'Pause',
    history: 'Inertia history',
    hint: 'Different starts can reach different local minima; k-means++ picks centroids far apart.',
  },
};

/** Tohumlu, kümelenmiş veri (blob'lar) */
function makeData(seed: number): P[] {
  const rnd = seededRandom(seed);
  const blobs = 3 + Math.floor(rnd() * 3);
  const pts: P[] = [];
  for (let b = 0; b < blobs; b++) {
    const cx = 15 + rnd() * 70;
    const cy = 15 + rnd() * 70;
    const spread = 5 + rnd() * 6;
    for (let i = 0; i < 28; i++) {
      const g1 = (rnd() + rnd() + rnd() - 1.5) * 1.4;
      const g2 = (rnd() + rnd() + rnd() - 1.5) * 1.4;
      pts.push({ x: Math.max(1, Math.min(99, cx + g1 * spread)), y: Math.max(1, Math.min(99, cy + g2 * spread)) });
    }
  }
  return pts;
}

const d2 = (a: P, b: P) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

function initCentroids(points: P[], k: number, init: Init, seed: number): P[] {
  const rnd = seededRandom(seed * 7 + k);
  if (init === 'random') {
    return Array.from({ length: k }, () => ({ ...points[Math.floor(rnd() * points.length)] }));
  }
  // k-means++: her yeni merkez, mevcut merkezlere uzaklığın karesiyle orantılı olasılıkla seçilir
  const cs: P[] = [{ ...points[Math.floor(rnd() * points.length)] }];
  while (cs.length < k) {
    const dists = points.map((p) => Math.min(...cs.map((c) => d2(p, c))));
    const total = dists.reduce((a, b) => a + b, 0);
    let r = rnd() * total;
    let idx = 0;
    for (; idx < dists.length - 1; idx++) {
      r -= dists[idx];
      if (r <= 0) break;
    }
    cs.push({ ...points[idx] });
  }
  return cs;
}

function assign(points: P[], cs: P[]): number[] {
  return points.map((p) => {
    let best = 0;
    let bd = Infinity;
    cs.forEach((c, i) => {
      const d = d2(p, c);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  });
}

function inertiaOf(points: P[], cs: P[], labels: number[]): number {
  if (!labels.length) return points.reduce((a, p) => a + Math.min(...cs.map((c) => d2(p, c))), 0);
  return points.reduce((a, p, i) => a + d2(p, cs[labels[i]]), 0);
}

export default function KMeansSim({ params, onInteract }: SimulatorProps) {
  const { t, locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const [seed, setSeed] = useState(3);
  const [k, setK] = useState(() => numParam(params, 'k', 3, 1, 8));
  const [init, setInit] = useState<Init>(() => (strParam<string>(params, 'init', 'random') === 'kmeans++' || strParam<string>(params, 'init', 'random') === 'k-means++' ? 'kmeans++' : 'random'));
  const points = useMemo(() => makeData(seed), [seed]);
  const [centroids, setCentroids] = useState<P[]>(() => initCentroids(points, k, init, seed));
  const [labels, setLabels] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>('assign');
  const [iteration, setIteration] = useState(0);
  const [converged, setConverged] = useState(false);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<number[]>([]);

  const restart = useCallback((nextK = k, nextInit = init, nextSeed = seed) => {
    const pts = makeData(nextSeed);
    setCentroids(initCentroids(pts, nextK, nextInit, nextSeed + Math.floor(Math.random() * 1000)));
    setLabels([]);
    setPhase('assign');
    setIteration(0);
    setConverged(false);
    setRunning(false);
    setHistory([]);
  }, [k, init, seed]);

  const step = useCallback(() => {
    if (converged) return;
    if (phase === 'assign') {
      const next = assign(points, centroids);
      const changed = labels.length === 0 || next.some((v, i) => v !== labels[i]);
      setLabels(next);
      setHistory((h) => [...h, inertiaOf(points, centroids, next)].slice(-60));
      if (!changed) {
        setConverged(true);
        setRunning(false);
        return;
      }
      setPhase('update');
    } else {
      // Boş küme kalırsa merkezi yerinde bırak
      const next = centroids.map((c, ci) => {
        const members = points.filter((_, i) => labels[i] === ci);
        if (!members.length) return c;
        return { x: members.reduce((a, p) => a + p.x, 0) / members.length, y: members.reduce((a, p) => a + p.y, 0) / members.length };
      });
      setCentroids(next);
      setIteration((i) => i + 1);
      setPhase('assign');
    }
  }, [phase, points, centroids, labels, converged]);

  useEffect(() => {
    if (!running) return;
    const id = setTimeout(step, reduced ? 150 : 600);
    return () => clearTimeout(id);
  }, [running, step, reduced]);

  const inertia = inertiaOf(points, centroids, labels);
  const s = (v: number) => v * 4;
  const hMax = Math.max(1, ...history);
  const hPath = history.map((v, i) => `${(i / Math.max(1, history.length - 1)) * 260},${56 - (v / hMax) * 50}`).join(' ');

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button type="button" className="btn-ghost" onClick={() => { onInteract(); step(); }} disabled={converged || running}>
            <StepForward size={14} /> {t('sim.step')}
          </button>
          <button type="button" className="btn-primary" aria-pressed={running} onClick={() => { onInteract(); setRunning((r) => !r); }} disabled={converged}>
            {running ? <Pause size={14} /> : <Play size={14} />} {running ? l.pause : t('sim.run')}
          </button>
          <button type="button" className="btn-ghost" onClick={() => { onInteract(); restart(); }}>
            <RotateCcw size={14} /> {t('sim.reset')}
          </button>
          <button type="button" className="btn-ghost" onClick={() => { onInteract(); const ns = seed + 1; setSeed(ns); restart(k, init, ns); }}>
            <Dices size={14} /> {l.newData}
          </button>
        </>
      }
      aside={
        <>
          <Range label={l.k} value={k} min={1} max={8} onChange={(v) => { onInteract(); setK(v); restart(v); }} />
          <Select label={l.init} value={init} options={[{ id: 'random', label: l.random }, { id: 'kmeans++', label: l.kpp }]} onChange={(v) => { onInteract(); setInit(v); restart(k, v); }} />
          <div className="grid grid-cols-2 gap-2">
            <Stat label={l.iteration} value={iteration} />
            <Stat label={l.inertia} value={Math.round(inertia).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')} tone={converged ? 'success' : 'primary'} />
          </div>
          <p className="text-sm" aria-live="polite">
            {converged ? <span className="text-success">✓ {l.converged}</span> : <><span className="label">{l.phase}</span>{phase === 'assign' ? l.assign : l.update}</>}
          </p>
          <figure>
            <figcaption className="label">{l.history}</figcaption>
            <svg viewBox="0 0 260 60" className="h-auto w-full" role="img" aria-label={l.history}>
              <rect width={260} height={60} fill="var(--da-bg)" stroke="var(--da-border)" />
              <polyline points={hPath} fill="none" stroke="var(--da-primary)" strokeWidth={1.5} />
            </svg>
          </figure>
          <p className="text-xs text-muted">{l.hint}</p>
        </>
      }
    >
      <svg viewBox="0 0 400 400" className="mx-auto h-auto w-full max-w-lg" role="img" aria-label={l.title}>
        <rect width={400} height={400} fill="var(--da-bg)" stroke="var(--da-border)" />
        {/* Nokta → merkez çizgileri (atama sonrası) */}
        {labels.length > 0 &&
          points.map((p, i) => (
            <line key={`l${i}`} x1={s(p.x)} y1={s(p.y)} x2={s(centroids[labels[i]].x)} y2={s(centroids[labels[i]].y)} stroke={PALETTE[labels[i] % PALETTE.length]} strokeWidth={0.5} opacity={0.3} />
          ))}
        {points.map((p, i) => (
          <circle key={i} cx={s(p.x)} cy={s(p.y)} r={4} fill={labels.length ? PALETTE[labels[i] % PALETTE.length] : 'var(--da-muted)'} opacity={0.85} />
        ))}
        {centroids.map((c, i) => (
          <motion.g key={i} initial={false} animate={{ x: s(c.x), y: s(c.y) }} transition={{ duration: reduced ? 0 : 0.5, ease: 'easeInOut' }}>
            <circle r={11} fill="var(--da-surface)" stroke={PALETTE[i % PALETTE.length]} strokeWidth={3} />
            <path d="M -5 -5 L 5 5 M -5 5 L 5 -5" stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.5} />
          </motion.g>
        ))}
      </svg>
    </SimShell>
  );
}
