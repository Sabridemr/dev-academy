'use client';

import { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ChevronsRight,
  Hammer,
  Pause,
  Play,
  Plus,
  StepBack,
  StepForward,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { Field, Select, SimShell, Stat } from './ui';
import { strParam, type SimulatorProps } from './types';
import {
  HEAP_KINDS,
  HEAP_MAX_SIZE,
  extractSteps,
  heapifySteps,
  insertSteps,
  isHeap,
  parent,
  parseNumbers,
  treeLayout,
  type HeapKind,
  type HeapStep,
} from './heap.logic';
import { useStepPlayer } from './useStepPlayer';

const STEP_MS = 700;
const W = 520;
const LEVEL_H = 62;
const NODE_R = 17;
const DEFAULT_INITIAL = '9, 4, 7, 1, 8, 2, 6, 3';

type Op = 'heapify' | 'insert' | 'extract';

const L = {
  tr: {
    title: 'Heap / öncelik kuyruğu',
    kinds: { min: 'Min-heap (en küçük üstte)', max: 'Max-heap (en büyük üstte)' } satisfies Record<
      HeapKind,
      string
    >,
    kind: 'Heap türü',
    hint: 'Ağaç ve dizi aynı veridir: i indeksindeki düğümün çocukları 2i+1 ve 2i+2, ebeveyni ⌊(i−1)/2⌋ indeksindedir. Bir düğümün üzerine gel ya da sekmeyle odaklan; iki görünümde birlikte vurgulanır.',
    initial: 'Dizi (virgülle)',
    build: 'Diziden kur (heapify)',
    value: 'Değer',
    insert: 'Ekle',
    extract: 'Çıkar',
    play: 'Oynat',
    pause: 'Duraklat',
    step: 'Adım',
    back: 'Geri',
    toEnd: 'Sona git',
    size: 'Boyut',
    top: 'Tepe',
    swaps: 'Takas',
    valid: 'Heap özelliği',
    ok: 'sağlanıyor',
    broken: 'bozuk',
    tree: 'Ağaç görünümü',
    array: 'Dizi görünümü',
    full: `Heap dolu (en fazla ${HEAP_MAX_SIZE} eleman).`,
    empty: 'Heap boş, çıkarılacak eleman yok.',
    idle: '“Oynat” ya da “Adım” ile sıradaki işlemi izle; yeni işlem için ekle, çıkar ya da diziden kur.',
    ops: { heapify: 'Heapify', insert: 'Ekleme', extract: 'Çıkarma' } satisfies Record<Op, string>,
    text: (s: HeapStep, kind: HeapKind) => {
      const a = s.array;
      const word = kind === 'min' ? 'küçük' : 'büyük';
      switch (s.type) {
        case 'append':
          return `${a[s.i!]} dizinin sonuna ([${s.i}]) eklendi.`;
        case 'compare':
          return `[${s.i}]=${a[s.i!]} ile [${s.j}]=${a[s.j!]} karşılaştırılıyor.`;
        case 'swap':
          return `[${s.i}] ↔ [${s.j}] takas: daha ${word} olan yukarı çıktı.`;
        case 'settle':
          return `[${s.i}]=${a[s.i!]} yerine oturdu.`;
        case 'take-root':
          return `Kök ${s.value} çıkarıldı (en ${word}).`;
        case 'move-last':
          return `Son eleman ${s.value} köke taşındı; şimdi aşağı kaydırılacak.`;
        case 'heapify-node':
          return `İç düğüm [${s.i}]=${a[s.i!]} için sift-down başlıyor.`;
        case 'done':
          return 'İşlem tamamlandı.';
      }
    },
  },
  en: {
    title: 'Heap / priority queue',
    kinds: { min: 'Min-heap (smallest on top)', max: 'Max-heap (largest on top)' } satisfies Record<
      HeapKind,
      string
    >,
    kind: 'Heap kind',
    hint: 'The tree and the array are the same data: the children of index i are at 2i+1 and 2i+2, its parent at ⌊(i−1)/2⌋. Hover or tab to a node; it is highlighted in both views.',
    initial: 'Array (comma separated)',
    build: 'Build from array (heapify)',
    value: 'Value',
    insert: 'Insert',
    extract: 'Extract',
    play: 'Play',
    pause: 'Pause',
    step: 'Step',
    back: 'Back',
    toEnd: 'Jump to end',
    size: 'Size',
    top: 'Top',
    swaps: 'Swaps',
    valid: 'Heap property',
    ok: 'holds',
    broken: 'broken',
    tree: 'Tree view',
    array: 'Array view',
    full: `Heap is full (at most ${HEAP_MAX_SIZE} elements).`,
    empty: 'Heap is empty, nothing to extract.',
    idle: 'Use “Play” or “Step” to watch the pending operation; or insert, extract or build from an array.',
    ops: { heapify: 'Heapify', insert: 'Insert', extract: 'Extract' } satisfies Record<Op, string>,
    text: (s: HeapStep, kind: HeapKind) => {
      const a = s.array;
      const word = kind === 'min' ? 'smaller' : 'larger';
      switch (s.type) {
        case 'append':
          return `${a[s.i!]} appended at the end ([${s.i}]).`;
        case 'compare':
          return `Comparing [${s.i}]=${a[s.i!]} with [${s.j}]=${a[s.j!]}.`;
        case 'swap':
          return `Swap [${s.i}] ↔ [${s.j}]: the ${word} value moves up.`;
        case 'settle':
          return `[${s.i}]=${a[s.i!]} is in place.`;
        case 'take-root':
          return `Root ${s.value} extracted (the ${kind === 'min' ? 'smallest' : 'largest'}).`;
        case 'move-last':
          return `Last element ${s.value} moved to the root; now it sifts down.`;
        case 'heapify-node':
          return `Starting sift-down at internal node [${s.i}]=${a[s.i!]}.`;
        case 'done':
          return 'Operation finished.';
      }
    },
  },
};

interface Run {
  op: Op;
  base: number[];
  steps: HeapStep[];
}

export default function HeapSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const [kind, setKind] = useState<HeapKind>(() => strParam(params, 'kind', 'min', HEAP_KINDS));
  const [initialText, setInitialText] = useState(() => {
    const p = params['initial'];
    const parsed = typeof p === 'string' ? parseNumbers(p) : [];
    return parsed.length ? parsed.join(', ') : DEFAULT_INITIAL;
  });
  const [valueText, setValueText] = useState('0');
  const [notice, setNotice] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [run, setRun] = useState<Run>(() => {
    const base = parseNumbers(initialText);
    return { op: 'heapify', base, steps: heapifySteps(base, kind) };
  });
  const player = useStepPlayer(run.steps.length, STEP_MS, run);
  const { cursor, finished, playing } = player;

  const step = cursor > 0 ? run.steps[cursor - 1] : null;
  const array = step ? step.array : run.base;
  const committed = run.steps.length ? run.steps[run.steps.length - 1].array : run.base;
  const pos = useMemo(() => treeLayout(array.length, W, LEVEL_H), [array.length]);
  const levels = array.length ? Math.floor(Math.log2(array.length)) + 1 : 1;
  const H = 28 + (levels - 1) * LEVEL_H + NODE_R + 12;
  const swaps = run.steps.slice(0, cursor).filter((s) => s.type === 'swap').length;

  const active = new Set<number>();
  if (step && step.type !== 'done') {
    if (step.i !== undefined) active.add(step.i);
    if (step.j !== undefined) active.add(step.j);
  }

  const startRun = (op: Op, steps: HeapStep[]) => {
    onInteract();
    setNotice(null);
    player.autoplayNext();
    setRun({ op, base: committed, steps });
  };
  const doInsert = () => {
    const v = parseNumbers(valueText)[0];
    if (v === undefined) return;
    if (committed.length >= HEAP_MAX_SIZE) {
      onInteract();
      setNotice(l.full);
      return;
    }
    startRun('insert', insertSteps(committed, v, kind));
  };
  const doExtract = () => {
    if (committed.length === 0) {
      onInteract();
      setNotice(l.empty);
      return;
    }
    startRun('extract', extractSteps(committed, kind));
  };
  const doBuild = (values: number[], k: HeapKind) => {
    onInteract();
    setNotice(null);
    player.autoplayNext();
    setRun({ op: 'heapify', base: values, steps: heapifySteps(values, k) });
  };

  const tone = (i: number) => {
    if (step?.type === 'take-root' && i === 0) return 'var(--da-danger)';
    if (step?.type === 'swap' && active.has(i)) return 'var(--da-danger)';
    if (step?.type === 'settle' && active.has(i)) return 'var(--da-success)';
    if (active.has(i)) return 'var(--da-warning)';
    return null;
  };
  const fillOf = (i: number) => {
    const t = tone(i);
    if (t) return `color-mix(in srgb, ${t} 40%, var(--da-surface))`;
    return hover === i
      ? 'color-mix(in srgb, var(--da-primary) 30%, var(--da-surface))'
      : 'var(--da-elevated)';
  };
  const focusProps = (i: number) => ({
    tabIndex: 0,
    onMouseEnter: () => setHover(i),
    onMouseLeave: () => setHover((h) => (h === i ? null : h)),
    onFocus: () => setHover(i),
    onBlur: () => setHover((h) => (h === i ? null : h)),
  });
  const nodeLabel = (i: number) =>
    `[${i}] = ${array[i]}${i > 0 ? `, parent [${parent(i)}] = ${array[parent(i)]}` : ''}`;

  const status = notice ?? (step ? l.text(step, kind) : l.idle);
  const valid = isHeap(array, kind);

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              onInteract();
              player.togglePlay();
            }}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? l.pause : l.play}
          </button>
          <button type="button" className="btn-ghost" onClick={player.prev} disabled={cursor === 0}>
            <StepBack size={14} /> {l.back}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              onInteract();
              player.next();
            }}
            disabled={finished}
          >
            <StepForward size={14} /> {l.step}
          </button>
          <button type="button" className="btn-ghost" onClick={player.end} disabled={finished}>
            <ChevronsRight size={14} /> {l.toEnd}
          </button>
        </>
      }
      aside={
        <>
          <Select
            label={l.kind}
            value={kind}
            options={HEAP_KINDS.map((id) => ({ id, label: l.kinds[id] }))}
            onChange={(v) => {
              setKind(v);
              // Tür değişince mevcut elemanlardan yeni türde heap kurulur
              doBuild(committed, v);
            }}
          />
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              doBuild(parseNumbers(initialText), kind);
            }}
          >
            <Field label={l.initial}>
              <input
                className="input font-mono"
                value={initialText}
                maxLength={80}
                onChange={(e) => setInitialText(e.target.value)}
              />
            </Field>
            <button type="submit" className="btn-ghost w-full justify-center">
              <Hammer size={14} /> {l.build}
            </button>
          </form>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={l.size} value={array.length} tone="primary" />
            <Stat label={l.top} value={array.length ? array[0] : '—'} tone="success" />
            <Stat label={l.swaps} value={swaps} tone="danger" />
            <Stat
              label={l.valid}
              value={valid ? l.ok : l.broken}
              tone={valid ? 'success' : 'warning'}
            />
          </div>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">{l.hint}</p>
      <form
        className="mb-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          doInsert();
        }}
      >
        <label className="w-28">
          <span className="label">{l.value}</span>
          <input
            className="input font-mono"
            inputMode="numeric"
            value={valueText}
            maxLength={4}
            onChange={(e) => setValueText(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="btn-primary"
          disabled={parseNumbers(valueText).length === 0}
        >
          <Plus size={14} /> {l.insert}
        </button>
        <button type="button" className="btn-ghost" onClick={doExtract}>
          <ArrowDownToLine size={14} /> {l.extract}
        </button>
        <span className="chip ml-auto">
          {l.ops[run.op]} · {cursor}/{run.steps.length}
        </span>
      </form>

      <p className="mb-2 min-h-5 font-mono text-xs text-fg" aria-live="polite">
        {status}
      </p>

      <div className="grid gap-3">
        <div>
          <p className="label">{l.tree}</p>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full rounded-xl border border-border bg-bg/60"
            role="group"
            aria-label={`${l.tree}: ${array.join(', ')}`}
          >
            {pos.map((p, i) =>
              i === 0 ? null : (
                <line
                  key={`e${i}`}
                  x1={pos[parent(i)].x}
                  y1={pos[parent(i)].y}
                  x2={p.x}
                  y2={p.y}
                  stroke={
                    active.has(i) && active.has(parent(i))
                      ? 'var(--da-warning)'
                      : 'var(--da-border)'
                  }
                  strokeWidth={active.has(i) && active.has(parent(i)) ? 3 : 2}
                />
              ),
            )}
            {pos.map((p, i) => (
              <g key={i} role="img" aria-label={nodeLabel(i)} {...focusProps(i)}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={NODE_R}
                  fill={fillOf(i)}
                  stroke={tone(i) ?? (hover === i ? 'var(--da-primary)' : 'var(--da-border)')}
                  strokeWidth={tone(i) || hover === i ? 3 : 1.5}
                  className="motion-safe:transition-[fill,stroke] motion-safe:duration-300"
                />
                <text
                  x={p.x}
                  y={p.y + 4}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={600}
                  fill="var(--da-fg)"
                >
                  {array[i]}
                </text>
                <text
                  x={p.x}
                  y={p.y - NODE_R - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--da-muted)"
                >
                  {i}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div>
          <p className="label">{l.array}</p>
          <ol className="flex flex-wrap gap-1" aria-label={l.array}>
            {array.map((v, i) => (
              <li
                key={i}
                {...focusProps(i)}
                aria-label={nodeLabel(i)}
                className={cn(
                  'flex w-10 flex-col items-center rounded-lg border px-1 py-1 font-mono text-sm focus:outline-none motion-safe:transition-colors',
                  hover === i ? 'border-primary' : 'border-border',
                )}
                style={{ background: fillOf(i) }}
              >
                <span className="text-[10px] text-muted">{i}</span>
                <span className="font-semibold">{v}</span>
              </li>
            ))}
            {array.length === 0 && <li className="text-xs text-muted">—</li>}
          </ol>
        </div>
      </div>
    </SimShell>
  );
}
