'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Pause, Play, RotateCcw, Shuffle, StepForward } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Range, Select, SimShell, Stat } from './ui';
import { numParam, strParam, type SimulatorProps } from './types';
import {
  SORT_ALGORITHMS,
  SORT_INFO,
  countSteps,
  randomArray,
  sortSteps,
  type SortAlgorithm,
} from './sorting.logic';

/** Hız 1–4 → adım arası bekleme (ms) */
const DELAYS = [0, 420, 160, 60, 16];
const W = 600;
const H = 260;

const L = {
  tr: {
    title: 'Sıralama görselleştirici',
    algos: {
      bubble: 'Bubble sort',
      insertion: 'Insertion sort',
      selection: 'Selection sort',
      merge: 'Merge sort',
      quick: 'Quick sort',
    } satisfies Record<SortAlgorithm, string>,
    hint: {
      bubble:
        'Komşu çiftleri karşılaştırır, büyük olanı sağa iter; her turda en büyük eleman sona “kabarcıklanır”.',
      insertion:
        'Soldaki kısım hep sıralıdır; her yeni eleman, yerini bulana kadar sola doğru kaydırılır.',
      selection: 'Her turda kalan kısmın en küçüğünü bulur ve başa yerleştirir.',
      merge:
        'Diziyi ikiye böler, parçaları ayrı ayrı sıralar ve yardımcı dizi üzerinden birleştirir (overwrite).',
      quick:
        'Bir pivot seçer (son eleman), küçükleri sola alır, pivotu yerine koyar ve iki tarafı ayrı sıralar.',
    } satisfies Record<SortAlgorithm, string>,
    play: 'Oynat',
    pause: 'Duraklat',
    step: 'Adım',
    reset: 'Sıfırla',
    shuffle: 'Karıştır',
    algorithm: 'Algoritma',
    size: 'Eleman sayısı',
    speed: 'Hız',
    compares: 'Karşılaştırma',
    swaps: 'Takas',
    writes: 'Yazma',
    progress: 'Adım',
    stable: 'Kararlı mı?',
    inPlace: 'Yerinde mi?',
    time: 'Zaman (en iyi / ort. / en kötü)',
    space: 'Ek bellek',
    yes: 'Evet',
    no: 'Hayır',
    legend: {
      compare: 'karşılaştırılan',
      swap: 'yer değiştiren',
      write: 'yazılan',
      done: 'sıralı',
    },
    done: 'Sıralama tamamlandı.',
    idle: 'Oynat ya da adım adım ilerle.',
    stepText: {
      compare: (i: number, j: number, a: number, b: number) =>
        `[${i}]=${a} ile [${j}]=${b} karşılaştırılıyor`,
      swap: (i: number, j: number) => `[${i}] ↔ [${j}] takas`,
      overwrite: (i: number, v: number) => `[${i}] ← ${v} yazıldı`,
    },
  },
  en: {
    title: 'Sorting visualizer',
    algos: {
      bubble: 'Bubble sort',
      insertion: 'Insertion sort',
      selection: 'Selection sort',
      merge: 'Merge sort',
      quick: 'Quick sort',
    } satisfies Record<SortAlgorithm, string>,
    hint: {
      bubble:
        'Compares neighbouring pairs and pushes the larger one right; each pass “bubbles” the largest element to the end.',
      insertion:
        'The left part is always sorted; each new element is shifted left until it finds its place.',
      selection: 'Each pass finds the smallest remaining element and moves it to the front.',
      merge:
        'Splits the array in half, sorts each half and merges them through an auxiliary array (overwrites).',
      quick:
        'Picks a pivot (last element), moves smaller items left, places the pivot and sorts both sides.',
    } satisfies Record<SortAlgorithm, string>,
    play: 'Play',
    pause: 'Pause',
    step: 'Step',
    reset: 'Reset',
    shuffle: 'Shuffle',
    algorithm: 'Algorithm',
    size: 'Array size',
    speed: 'Speed',
    compares: 'Comparisons',
    swaps: 'Swaps',
    writes: 'Writes',
    progress: 'Step',
    stable: 'Stable?',
    inPlace: 'In place?',
    time: 'Time (best / avg / worst)',
    space: 'Extra space',
    yes: 'Yes',
    no: 'No',
    legend: { compare: 'compared', swap: 'swapped', write: 'written', done: 'sorted' },
    done: 'Sorting finished.',
    idle: 'Press play or step through.',
    stepText: {
      compare: (i: number, j: number, a: number, b: number) =>
        `Comparing [${i}]=${a} and [${j}]=${b}`,
      swap: (i: number, j: number) => `Swap [${i}] ↔ [${j}]`,
      overwrite: (i: number, v: number) => `Wrote ${v} to [${i}]`,
    },
  },
};

export default function SortingVisualizerSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const [algorithm, setAlgorithm] = useState<SortAlgorithm>(() =>
    strParam(params, 'algorithm', 'bubble', SORT_ALGORITHMS),
  );
  const [size, setSize] = useState(() => Math.round(numParam(params, 'size', 16, 8, 64)));
  const [speed, setSpeed] = useState(() => Math.round(numParam(params, 'speed', 2, 1, 4)));
  const [seed, setSeed] = useState(7);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  const initial = useMemo(() => randomArray(size, seed), [size, seed]);
  const steps = useMemo(() => sortSteps(initial, algorithm), [initial, algorithm]);
  const finished = cursor >= steps.length;
  const current = cursor === 0 ? initial : steps[cursor - 1].array;
  const active = cursor > 0 && !finished ? steps[cursor - 1] : null;
  const counts = useMemo(() => countSteps(steps, cursor), [steps, cursor]);
  const info = SORT_INFO[algorithm];

  // Girdi değişince baştan başla
  useEffect(() => {
    setCursor(0);
    setPlaying(false);
  }, [steps]);

  useEffect(() => {
    if (!playing) return;
    if (finished) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setCursor((c) => Math.min(steps.length, c + 1)), DELAYS[speed]);
    return () => clearTimeout(id);
  }, [playing, finished, cursor, speed, steps.length]);

  const togglePlay = () => {
    onInteract();
    if (finished) {
      setCursor(0);
      setPlaying(!reduced);
      return;
    }
    // Azaltılmış harekette animasyon yerine sonuç anında uygulanır
    if (reduced) setCursor(steps.length);
    else setPlaying((p) => !p);
  };
  const step = () => {
    onInteract();
    setPlaying(false);
    setCursor((c) => Math.min(steps.length, c + 1));
  };
  const reset = () => {
    setPlaying(false);
    setCursor(0);
  };
  const shuffle = () => {
    onInteract();
    setSeed((s) => s + 1);
  };

  const max = 100;
  const barW = W / current.length;
  const colorOf = (idx: number) => {
    if (finished) return 'var(--da-success)';
    if (active && (active.i === idx || active.j === idx)) {
      if (active.type === 'compare') return 'var(--da-warning)';
      if (active.type === 'swap') return 'var(--da-danger)';
      return active.i === idx ? 'var(--da-accent)' : 'var(--da-warning)';
    }
    return 'var(--da-primary)';
  };

  const status = finished
    ? l.done
    : active
      ? active.type === 'compare'
        ? l.stepText.compare(active.i, active.j, current[active.i], current[active.j])
        : active.type === 'swap'
          ? l.stepText.swap(active.i, active.j)
          : l.stepText.overwrite(active.i, current[active.i])
      : l.idle;

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button type="button" className="btn-primary" onClick={togglePlay}>
            {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? l.pause : l.play}
          </button>
          <button type="button" className="btn-ghost" onClick={step} disabled={finished}>
            <StepForward size={14} /> {l.step}
          </button>
          <button type="button" className="btn-ghost" onClick={reset}>
            <RotateCcw size={14} /> {l.reset}
          </button>
          <button type="button" className="btn-ghost" onClick={shuffle}>
            <Shuffle size={14} /> {l.shuffle}
          </button>
        </>
      }
      aside={
        <>
          <Select
            label={l.algorithm}
            value={algorithm}
            options={SORT_ALGORITHMS.map((id) => ({ id, label: l.algos[id] }))}
            onChange={(v) => {
              onInteract();
              setAlgorithm(v);
            }}
          />
          <Range
            label={l.size}
            value={size}
            min={8}
            max={64}
            onChange={(v) => {
              onInteract();
              setSize(v);
            }}
          />
          <Range
            label={l.speed}
            value={speed}
            min={1}
            max={4}
            onChange={setSpeed}
            format={(v) => `${v}×`}
          />
          <div className="grid grid-cols-2 gap-2">
            <Stat label={l.compares} value={counts.compares} tone="warning" />
            {info.inPlace ? (
              <Stat label={l.swaps} value={counts.swaps} tone="danger" />
            ) : (
              <Stat label={l.writes} value={counts.writes} tone="primary" />
            )}
          </div>
          <div className="rounded-xl border border-border bg-elevated/40 p-3 text-sm">
            <p className="mb-2 font-semibold">{l.algos[algorithm]}</p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted">{l.stable}</dt>
              <dd className={cn('font-medium', info.stable ? 'text-success' : 'text-danger')}>
                {info.stable ? l.yes : l.no}
              </dd>
              <dt className="text-muted">{l.inPlace}</dt>
              <dd className={cn('font-medium', info.inPlace ? 'text-success' : 'text-danger')}>
                {info.inPlace ? l.yes : l.no}
              </dd>
              <dt className="text-muted">{l.space}</dt>
              <dd className="font-mono">{info.space}</dd>
            </dl>
            <p className="mt-2 text-xs text-muted">{l.time}</p>
            <p className="font-mono text-xs">
              {info.best} / {info.average} / {info.worst}
            </p>
          </div>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">{l.hint[algorithm]}</p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full rounded-xl border border-border bg-bg/60"
        role="img"
        aria-label={`${l.algos[algorithm]}: ${current.join(', ')}`}
      >
        {current.map((v, idx) => {
          const h = (v / max) * (H - 16);
          return (
            <motion.rect
              key={idx}
              x={idx * barW + barW * 0.1}
              width={Math.max(1, barW * 0.8)}
              rx={Math.min(4, barW * 0.2)}
              initial={false}
              animate={{ y: H - h, height: h }}
              transition={{ duration: reduced ? 0 : 0.12 }}
              fill={colorOf(idx)}
            />
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="font-mono text-fg" aria-live="polite">
          {status}
        </p>
        <p className="tabular-nums text-muted">
          {l.progress} {cursor} / {steps.length}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        {(
          [
            ['var(--da-warning)', l.legend.compare],
            ['var(--da-danger)', l.legend.swap],
            ['var(--da-accent)', l.legend.write],
            ['var(--da-success)', l.legend.done],
          ] as const
        ).map(([c, label]) => (
          <span key={label} className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm" style={{ background: c }} /> {label}
          </span>
        ))}
      </div>
    </SimShell>
  );
}
