'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { Range, Select, SimShell, Stat } from './ui';
import { numParam, type SimulatorProps } from './types';

const SYNC_SEC = 15; // HPA senkronizasyon periyodu
const POD_START_TICKS = 2;
const HISTORY = 60;
const TOLERANCE = 0.1;

type Pattern = 'manual' | 'spike' | 'wave';
type PodState = 'pending' | 'running' | 'terminating';
interface Pod {
  id: number;
  state: PodState;
  age: number;
}
interface Sample {
  util: number;
  replicas: number;
  desired: number;
}

const L = {
  tr: {
    title: 'Kubernetes HPA (Horizontal Pod Autoscaler)',
    load: 'Toplam CPU talebi (millicore)',
    target: 'Hedef CPU kullanımı',
    min: 'Min replika',
    max: 'Maks replika',
    window: 'Ölçek küçültme stabilizasyon penceresi',
    pattern: 'Yük deseni',
    patterns: { manual: 'Elle (kaydırıcı)', spike: 'Ani artış', wave: 'Dalga' } satisfies Record<Pattern, string>,
    util: 'Ortalama CPU',
    replicas: 'Hazır pod',
    desired: 'İstenen',
    time: 'Simüle zaman',
    pause: 'Duraklat',
    start: 'Başlat',
    formula: 'desired = ceil(current × currentUtil / target)',
    chart: 'Kullanım (%) ve replika sayısı',
    pending: 'başlıyor',
    terminating: 'sonlanıyor',
    note: 'Ölçek büyütme hemen uygulanır (pod başlatma gecikmesiyle); küçültme, pencere boyunca önerilen en yüksek değeri kullanır (salınımı önler). ±%10 tolerans içinde değişiklik yapılmaz.',
  },
  en: {
    title: 'Kubernetes HPA (Horizontal Pod Autoscaler)',
    load: 'Total CPU demand (millicores)',
    target: 'Target CPU utilization',
    min: 'Min replicas',
    max: 'Max replicas',
    window: 'Scale-down stabilization window',
    pattern: 'Load pattern',
    patterns: { manual: 'Manual (slider)', spike: 'Spike', wave: 'Wave' } satisfies Record<Pattern, string>,
    util: 'Average CPU',
    replicas: 'Ready pods',
    desired: 'Desired',
    time: 'Simulated time',
    pause: 'Pause',
    start: 'Start',
    formula: 'desired = ceil(current × currentUtil / target)',
    chart: 'Utilization (%) and replica count',
    pending: 'starting',
    terminating: 'terminating',
    note: 'Scale-up applies immediately (with pod startup delay); scale-down uses the highest recommendation within the window (prevents flapping). No change within ±10% tolerance.',
  },
};

export default function KubernetesHpaSim({ params, onInteract }: SimulatorProps) {
  const { t, locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const request = numParam(params, 'cpuRequestMillicores', 250, 50, 4000);
  const [minR, setMinR] = useState(() => numParam(params, 'minReplicas', 2, 1, 20));
  const [maxR, setMaxR] = useState(() => numParam(params, 'maxReplicas', 10, 1, 30));
  const [target, setTarget] = useState(() => numParam(params, 'targetCpuPercent', 50, 10, 95));
  const [windowSec, setWindowSec] = useState(() => numParam(params, 'stabilizationWindowSec', 300, 0, 600));
  const [load, setLoad] = useState(() => request * 1.2);
  const [pattern, setPattern] = useState<Pattern>('manual');
  const [running, setRunning] = useState(false);
  const [pods, setPods] = useState<Pod[]>(() => Array.from({ length: minR }, (_, i) => ({ id: i + 1, state: 'running', age: 10 })));
  const [history, setHistory] = useState<Sample[]>([]);
  const [tick, setTick] = useState(0);
  const recs = useRef<number[]>([]);
  const podSeq = useRef(minR);
  const cfg = useRef({ minR, maxR, target, windowSec, load, pattern });
  cfg.current = { minR, maxR, target, windowSec, load, pattern };

  const ready = pods.filter((p) => p.state === 'running').length;
  const util = ready > 0 ? Math.min(300, (load / (ready * request)) * 100) : 300;

  // Pod listesi ref'te de tutulur: simülasyon adımı saf olmayan updater'lar olmadan hesaplanır
  const podsRef = useRef(pods);
  const tickRef = useRef(0);
  const commitPods = (ps: Pod[]) => {
    podsRef.current = ps;
    setPods(ps);
  };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      tickRef.current += 1;
      const next = tickRef.current;
      setTick(next);
      const c = cfg.current;
      // Yük deseni
      let curLoad = c.load;
      if (c.pattern === 'spike') curLoad = next % 40 < 12 ? request * 6 : request * 1.2;
      if (c.pattern === 'wave') curLoad = Math.round(request * (3 + 2.6 * Math.sin(next / 7)));
      if (curLoad !== c.load) setLoad(curLoad);

      // Yaşlandır: pending → running, terminating → sil
      let ps = podsRef.current
        .filter((p) => p.state !== 'terminating')
        .map((p) => ({ ...p, age: p.age + 1, state: (p.state === 'pending' && p.age + 1 >= POD_START_TICKS ? 'running' : p.state) as PodState }));
      const readyNow = ps.filter((p) => p.state === 'running').length;
      const current = ps.length; // pending'ler de sayılır (HPA mevcut replikayı spec'ten alır)
      const u = readyNow > 0 ? (curLoad / (readyNow * request)) * 100 : 300;
      const ratio = u / c.target;
      let desired = Math.abs(ratio - 1) <= TOLERANCE ? current : Math.ceil(current * ratio);
      desired = Math.max(c.minR, Math.min(c.maxR, desired));
      // Stabilizasyon: küçültmede penceredeki en yüksek öneri kullanılır
      recs.current.push(desired);
      const windowTicks = Math.max(1, Math.round(c.windowSec / SYNC_SEC));
      if (recs.current.length > windowTicks) recs.current.splice(0, recs.current.length - windowTicks);
      const final = desired < current ? Math.min(current, Math.max(...recs.current)) : desired;
      if (final > current) {
        for (let i = 0; i < final - current; i++) ps.push({ id: ++podSeq.current, state: 'pending', age: 0 });
      } else if (final < current) {
        // En yeni pod'lar önce sonlandırılır
        let toKill = current - final;
        ps = [...ps].reverse().map((p) => (toKill-- > 0 ? { ...p, state: 'terminating' as PodState } : p)).reverse();
      }
      commitPods(ps);
      setHistory((h) => [...h, { util: Math.min(300, u), replicas: readyNow, desired: final }].slice(-HISTORY));
    }, reduced ? 700 : 450);
    return () => clearInterval(id);
  }, [running, reduced, request]);

  const reset = () => {
    setRunning(false);
    recs.current = [];
    podSeq.current = minR;
    commitPods(Array.from({ length: minR }, (_, i) => ({ id: i + 1, state: 'running' as PodState, age: 10 })));
    setHistory([]);
    setTick(0);
    tickRef.current = 0;
  };

  const desiredNow = history.length ? history[history.length - 1].desired : pods.length;
  const chartMaxR = Math.max(maxR, 1);
  const hx = (i: number) => (i / (HISTORY - 1)) * 560 + 20;
  const utilPath = history.map((s, i) => `${hx(i)},${130 - (Math.min(200, s.util) / 200) * 110}`).join(' ');
  const repPath = history.map((s, i) => `${hx(i)},${130 - (s.replicas / chartMaxR) * 110}`).join(' ');

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button type="button" className="btn-primary" aria-pressed={running} onClick={() => { onInteract(); setRunning((r) => !r); }}>
            {running ? <Pause size={14} /> : <Play size={14} />} {running ? l.pause : l.start}
          </button>
          <button type="button" className="btn-ghost" onClick={reset}>
            <RotateCcw size={14} /> {t('sim.reset')}
          </button>
        </>
      }
      aside={
        <>
          <Select label={l.pattern} value={pattern} options={(['manual', 'spike', 'wave'] as const).map((p) => ({ id: p, label: l.patterns[p] }))} onChange={(v) => { onInteract(); setPattern(v); }} />
          <Range label={l.load} value={Math.round(load)} min={0} max={request * 12} step={25} onChange={(v) => { onInteract(); setPattern('manual'); setLoad(v); }} />
          <Range label={l.target} value={target} min={10} max={95} step={5} format={(v) => `${v}%`} onChange={(v) => { onInteract(); setTarget(v); }} />
          <Range label={l.min} value={minR} min={1} max={Math.min(maxR, 10)} onChange={(v) => { onInteract(); setMinR(v); }} />
          <Range label={l.max} value={maxR} min={Math.max(minR, 2)} max={30} onChange={(v) => { onInteract(); setMaxR(v); }} />
          <Range label={l.window} value={windowSec} min={0} max={600} step={15} format={(v) => `${v}s`} onChange={(v) => { onInteract(); setWindowSec(v); }} />
          <div className="grid grid-cols-2 gap-2" aria-live="polite">
            <Stat label={l.util} value={`${Math.round(util)}%`} tone={util > target * 1.1 ? 'danger' : util < target * 0.9 ? 'warning' : 'success'} />
            <Stat label={l.replicas} value={`${ready}/${pods.filter((p) => p.state !== 'terminating').length}`} />
            <Stat label={l.desired} value={desiredNow} tone="primary" />
            <Stat label={l.time} value={`${Math.floor((tick * SYNC_SEC) / 60)}m ${(tick * SYNC_SEC) % 60}s`} />
          </div>
          <p className="font-mono text-[11px] text-muted">{l.formula}</p>
          <p className="text-xs text-muted">{l.note}</p>
        </>
      }
    >
      {/* Pod'lar */}
      <div className="flex min-h-[96px] flex-wrap content-start gap-2 rounded-xl border border-border bg-bg/50 p-3">
        <AnimatePresence initial={false}>
          {pods.map((p) => {
            const podUtil = p.state === 'running' ? util : 0;
            return (
              <motion.div
                key={p.id}
                layout={!reduced}
                initial={reduced ? false : { opacity: 0, scale: 0.5 }}
                animate={{ opacity: p.state === 'terminating' ? 0.35 : 1, scale: 1 }}
                exit={reduced ? undefined : { opacity: 0, scale: 0.5 }}
                transition={{ duration: reduced ? 0 : 0.3 }}
                className={`w-16 rounded-lg border px-1.5 py-1 text-center text-[10px] ${p.state === 'pending' ? 'border-dashed border-warning' : p.state === 'terminating' ? 'border-danger' : 'border-border'} bg-surface`}
                aria-label={`pod-${p.id} ${p.state}`}
              >
                <p className="font-mono font-semibold">pod-{p.id}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-elevated">
                  <div className="h-full" style={{ width: `${Math.min(100, podUtil)}%`, background: podUtil > target * 1.1 ? 'var(--da-danger)' : 'var(--da-success)' }} />
                </div>
                <p className="mt-0.5 text-muted">{p.state === 'running' ? `${Math.round(podUtil)}%` : p.state === 'pending' ? l.pending : l.terminating}</p>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <figure className="mt-3">
        <figcaption className="label">{l.chart}</figcaption>
        <svg viewBox="0 0 600 150" className="h-auto w-full" role="img" aria-label={l.chart}>
          <rect x={20} y={20} width={560} height={110} fill="var(--da-bg)" stroke="var(--da-border)" />
          {/* Hedef çizgisi */}
          <line x1={20} x2={580} y1={130 - (target / 200) * 110} y2={130 - (target / 200) * 110} stroke="var(--da-success)" strokeDasharray="5 4" />
          <text x={576} y={126 - (target / 200) * 110} textAnchor="end" fontSize={9} fill="var(--da-success)">target {target}%</text>
          <polyline points={utilPath} fill="none" stroke="var(--da-danger)" strokeWidth={2} />
          <polyline points={repPath} fill="none" stroke="var(--da-primary)" strokeWidth={2} strokeDasharray="1 0" />
          <text x={24} y={14} fontSize={10} fill="var(--da-danger)">— CPU % (0–200)</text>
          <text x={140} y={14} fontSize={10} fill="var(--da-primary)">— replicas (0–{chartMaxR})</text>
        </svg>
      </figure>
    </SimShell>
  );
}
