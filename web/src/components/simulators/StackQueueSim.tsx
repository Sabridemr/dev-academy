'use client';

import { useMemo, useState } from 'react';
import { ChevronsRight, Pause, Play, RotateCcw, StepBack, StepForward } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { Field, Select, SimShell, Stat } from './ui';
import { strParam, type SimulatorProps } from './types';
import {
  BFS_EDGES,
  BFS_NODES,
  BFS_POS,
  DEFAULT_EXPRESSION,
  EXPRESSION_MAX,
  SQ_MODES,
  bfsSteps,
  bracketSteps,
  maxQueue,
  type BfsStep,
  type BracketStep,
  type SqMode,
} from './stackQueue.logic';
import { useStepPlayer } from './useStepPlayer';

const STEP_MS = 650;
const GW = 360;
const GH = 240;
const NODE_R = 16;

const L = {
  tr: {
    title: 'Yığın ve kuyruk',
    modes: {
      brackets: 'Parantez eşleme (yığın)',
      'bfs-queue': 'BFS kuyruğu',
    } satisfies Record<SqMode, string>,
    mode: 'Mod',
    hint: {
      brackets:
        'Her açılış ( [ { yığına itilir (push); her kapanış tepedeki açılışla eşleşirse yığından çekilir (pop). Son giren ilk çıkar (LIFO).',
      'bfs-queue':
        'BFS, keşfettiği komşuları kuyruğun sonuna ekler ve sıradakini baştan alır. İlk giren ilk çıkar (FIFO); bu yüzden düğümler katman katman ziyaret edilir.',
    } satisfies Record<SqMode, string>,
    expression: 'İfade',
    start: 'Başlangıç düğümü',
    play: 'Oynat',
    pause: 'Duraklat',
    step: 'Adım',
    back: 'Geri',
    toEnd: 'Sona git',
    reset: 'Sıfırla',
    stack: 'Yığın (tepe üstte)',
    queue: 'Kuyruk (baş → son)',
    empty: 'boş',
    depth: 'Yığın derinliği',
    maxDepth: 'En büyük derinlik',
    queueLen: 'Kuyruk uzunluğu',
    maxQueue: 'En uzun kuyruk',
    order: 'Ziyaret sırası',
    level: 'Katman',
    idle: '“Adım” ile ilk karakteri işle.',
    idleBfs: '“Adım” ile başlangıç düğümünü kuyruğa koy.',
    bracket: (s: BracketStep) => {
      switch (s.type) {
        case 'push':
          return `'${s.char}' (konum ${s.index}) yığına itildi.`;
        case 'pop':
          return `'${s.char}' (konum ${s.index}) tepedeki açılışla eşleşti, yığından çekildi.`;
        case 'ok':
          return 'İfade dengeli: yığın boş.';
        case 'error':
          if (s.error === 'unexpected-close')
            return `Hata, konum ${s.index}: '${s.char}' kapanışı geldi ama yığın boş.`;
          if (s.error === 'mismatch')
            return `Hata, konum ${s.index}: '${s.char}' geldi, '${s.expected}' bekleniyordu.`;
          return `Hata: konum ${s.index}'deki '${s.char}' hiç kapanmadı ('${s.expected}' eksik).`;
      }
    },
    bfs: (s: BfsStep) => {
      const n = (i?: number) => (i === undefined ? '' : BFS_NODES[i]);
      switch (s.type) {
        case 'enqueue':
          return s.from === undefined
            ? `Başlangıç ${n(s.node)} kuyruğa eklendi.`
            : `${n(s.from)} komşusu ${n(s.node)} keşfedildi, kuyruğun sonuna eklendi.`;
        case 'dequeue':
          return `${n(s.node)} kuyruğun başından alındı ve ziyaret edildi.`;
        case 'skip':
          return `${n(s.from)} komşusu ${n(s.node)} zaten keşfedilmiş, atlandı.`;
        case 'done':
          return 'Kuyruk boşaldı; tüm erişilebilir düğümler ziyaret edildi.';
      }
    },
  },
  en: {
    title: 'Stacks and queues',
    modes: {
      brackets: 'Bracket matching (stack)',
      'bfs-queue': 'BFS queue',
    } satisfies Record<SqMode, string>,
    mode: 'Mode',
    hint: {
      brackets:
        'Each opener ( [ { is pushed onto the stack; each closer pops the top if it matches. Last in, first out (LIFO).',
      'bfs-queue':
        'BFS appends newly discovered neighbours to the back of the queue and takes the next node from the front. First in, first out (FIFO) — so nodes are visited layer by layer.',
    } satisfies Record<SqMode, string>,
    expression: 'Expression',
    start: 'Start node',
    play: 'Play',
    pause: 'Pause',
    step: 'Step',
    back: 'Back',
    toEnd: 'Jump to end',
    reset: 'Reset',
    stack: 'Stack (top first)',
    queue: 'Queue (front → back)',
    empty: 'empty',
    depth: 'Stack depth',
    maxDepth: 'Max depth',
    queueLen: 'Queue length',
    maxQueue: 'Longest queue',
    order: 'Visit order',
    level: 'Layer',
    idle: 'Press “Step” to process the first character.',
    idleBfs: 'Press “Step” to enqueue the start node.',
    bracket: (s: BracketStep) => {
      switch (s.type) {
        case 'push':
          return `'${s.char}' (position ${s.index}) pushed.`;
        case 'pop':
          return `'${s.char}' (position ${s.index}) matches the top; popped.`;
        case 'ok':
          return 'Balanced: the stack is empty.';
        case 'error':
          if (s.error === 'unexpected-close')
            return `Error at ${s.index}: closer '${s.char}' but the stack is empty.`;
          if (s.error === 'mismatch')
            return `Error at ${s.index}: got '${s.char}', expected '${s.expected}'.`;
          return `Error: '${s.char}' at position ${s.index} is never closed ('${s.expected}' missing).`;
      }
    },
    bfs: (s: BfsStep) => {
      const n = (i?: number) => (i === undefined ? '' : BFS_NODES[i]);
      switch (s.type) {
        case 'enqueue':
          return s.from === undefined
            ? `Start ${n(s.node)} enqueued.`
            : `${n(s.node)}, a neighbour of ${n(s.from)}, discovered and enqueued at the back.`;
        case 'dequeue':
          return `${n(s.node)} dequeued from the front and visited.`;
        case 'skip':
          return `${n(s.node)}, a neighbour of ${n(s.from)}, was already discovered; skipped.`;
        case 'done':
          return 'The queue is empty; every reachable node has been visited.';
      }
    },
  },
};

export default function StackQueueSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const [mode, setMode] = useState<SqMode>(() => strParam(params, 'mode', 'brackets', SQ_MODES));
  const [expression, setExpression] = useState(() => {
    const e = params['expression'];
    return typeof e === 'string' && e.trim() ? e.slice(0, EXPRESSION_MAX) : DEFAULT_EXPRESSION;
  });
  const [start, setStart] = useState(0);

  const bSteps = useMemo(() => bracketSteps(expression), [expression]);
  const qSteps = useMemo(() => bfsSteps(start), [start]);
  const total = mode === 'brackets' ? bSteps.length : qSteps.length;
  const player = useStepPlayer(total, STEP_MS, mode === 'brackets' ? bSteps : qSteps);
  const { cursor, finished, playing } = player;
  const touch = () => onInteract();

  const bStep = mode === 'brackets' && cursor > 0 ? bSteps[cursor - 1] : null;
  const qStep = mode === 'bfs-queue' && cursor > 0 ? qSteps[cursor - 1] : null;

  const status =
    mode === 'brackets' ? (bStep ? l.bracket(bStep) : l.idle) : qStep ? l.bfs(qStep) : l.idleBfs;
  const statusTone =
    bStep?.type === 'error' ? 'text-danger' : bStep?.type === 'ok' ? 'text-success' : 'text-fg';

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              touch();
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
              touch();
              player.next();
            }}
            disabled={finished}
          >
            <StepForward size={14} /> {l.step}
          </button>
          <button type="button" className="btn-ghost" onClick={player.end} disabled={finished}>
            <ChevronsRight size={14} /> {l.toEnd}
          </button>
          <button type="button" className="btn-ghost" onClick={player.reset}>
            <RotateCcw size={14} /> {l.reset}
          </button>
        </>
      }
      aside={
        <>
          <div role="group" aria-label={l.mode} className="grid gap-1">
            <span className="label">{l.mode}</span>
            {SQ_MODES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-left text-sm',
                  mode === m
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-elevated',
                )}
                onClick={() => {
                  touch();
                  setMode(m);
                }}
              >
                {l.modes[m]}
              </button>
            ))}
          </div>
          {mode === 'brackets' ? (
            <BracketStats steps={bSteps} cursor={cursor} l={l} />
          ) : (
            <>
              <Select
                label={l.start}
                value={String(start)}
                options={BFS_NODES.map((n, i) => ({ id: String(i), label: n }))}
                onChange={(v) => {
                  touch();
                  setStart(Number(v));
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <Stat label={l.queueLen} value={qStep?.queue.length ?? 0} tone="primary" />
                <Stat label={l.maxQueue} value={maxQueue(qSteps, cursor)} tone="warning" />
              </div>
              <div>
                <p className="label">{l.order}</p>
                <p className="font-mono text-sm">
                  {qStep?.order.length ? qStep.order.map((i) => BFS_NODES[i]).join(' → ') : '—'}
                </p>
              </div>
            </>
          )}
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">{l.hint[mode]}</p>
      {mode === 'brackets' ? (
        <>
          <Field label={l.expression}>
            <input
              className="input font-mono"
              value={expression}
              maxLength={EXPRESSION_MAX}
              spellCheck={false}
              onChange={(e) => {
                touch();
                setExpression(e.target.value);
              }}
            />
          </Field>
          <p
            className="mt-3 flex flex-wrap rounded-xl border border-border bg-bg/60 p-2 font-mono text-base"
            aria-hidden
          >
            {expression.split('').map((ch, i) => {
              const isCur = bStep?.index === i;
              const done = bStep && bStep.index !== undefined && i < bStep.index;
              return (
                <span
                  key={i}
                  className={cn(
                    'inline-block min-w-[1ch] whitespace-pre rounded px-px',
                    isCur && bStep?.type === 'error' && 'bg-danger/25 text-danger underline',
                    isCur && bStep?.type === 'push' && 'bg-accent/25',
                    isCur && bStep?.type === 'pop' && 'bg-success/25',
                    !isCur && done && 'text-muted',
                  )}
                >
                  {ch}
                </span>
              );
            })}
          </p>
          <p className={cn('mt-2 min-h-5 font-mono text-xs', statusTone)} aria-live="polite">
            {status}
          </p>
          <div className="mt-3">
            <p className="label">{l.stack}</p>
            <ol
              className="flex min-h-24 w-40 flex-col-reverse justify-start gap-1 rounded-xl border-x-2 border-b-2 border-border p-2"
              aria-label={l.stack}
            >
              {(bStep?.stack ?? []).map((e, k, all) => (
                <li
                  key={`${e.index}`}
                  className={cn(
                    'rounded-md border px-2 py-1 text-center font-mono text-sm motion-safe:transition-colors',
                    k === all.length - 1 ? 'border-primary bg-primary/10' : 'border-border',
                    k === all.length - 1 && bStep?.type === 'error' && 'border-danger bg-danger/10',
                  )}
                >
                  {e.char} <span className="text-[10px] text-muted">@{e.index}</span>
                </li>
              ))}
              {!bStep?.stack.length && (
                <li className="text-center text-xs text-muted">{l.empty}</li>
              )}
            </ol>
          </div>
        </>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${GW} ${GH}`}
            className="mx-auto h-auto w-full max-w-md rounded-xl border border-border bg-bg/60"
            role="img"
            aria-label={`${l.modes['bfs-queue']}: ${status}`}
          >
            {BFS_EDGES.map(([a, b]) => {
              const pa = BFS_POS[a];
              const pb = BFS_POS[b];
              const tree =
                qStep &&
                ((qStep.type === 'enqueue' && qStep.from === a && qStep.node === b) ||
                  (qStep.type === 'enqueue' && qStep.from === b && qStep.node === a));
              return (
                <line
                  key={`${a}-${b}`}
                  x1={pa.x * GW}
                  y1={pa.y * (GH - 40) + 20}
                  x2={pb.x * GW}
                  y2={pb.y * (GH - 40) + 20}
                  stroke={tree ? 'var(--da-accent)' : 'var(--da-border)'}
                  strokeWidth={tree ? 3 : 2}
                />
              );
            })}
            {BFS_NODES.map((name, i) => {
              const p = BFS_POS[i];
              const visited = qStep?.order.includes(i);
              const queued = qStep?.queue.includes(i);
              const current = qStep?.type === 'dequeue' && qStep.node === i;
              const tone = current
                ? 'var(--da-warning)'
                : visited
                  ? 'var(--da-success)'
                  : queued
                    ? 'var(--da-accent)'
                    : null;
              const lvl = qStep?.level[i];
              return (
                <g key={name}>
                  <circle
                    cx={p.x * GW}
                    cy={p.y * (GH - 40) + 20}
                    r={NODE_R}
                    fill={
                      tone
                        ? `color-mix(in srgb, ${tone} 40%, var(--da-surface))`
                        : 'var(--da-elevated)'
                    }
                    stroke={tone ?? 'var(--da-border)'}
                    strokeWidth={2}
                    className="motion-safe:transition-[fill,stroke] motion-safe:duration-300"
                  />
                  <text
                    x={p.x * GW}
                    y={p.y * (GH - 40) + 25}
                    textAnchor="middle"
                    fontSize={13}
                    fontWeight={600}
                    fill="var(--da-fg)"
                  >
                    {name}
                  </text>
                  {lvl !== null && lvl !== undefined && (
                    <text
                      x={p.x * GW + NODE_R + 2}
                      y={p.y * (GH - 40) + 20 - NODE_R + 4}
                      fontSize={10}
                      fill="var(--da-muted)"
                    >
                      {lvl}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <p className="mt-2 min-h-5 font-mono text-xs text-fg" aria-live="polite">
            {status}
          </p>
          <div className="mt-3">
            <p className="label">{l.queue}</p>
            <ol
              className="flex min-h-11 flex-wrap items-center gap-1 rounded-xl border-y-2 border-border p-2"
              aria-label={l.queue}
            >
              {(qStep?.queue ?? []).map((n, k) => (
                <li
                  key={n}
                  className={cn(
                    'rounded-md border px-2.5 py-1 font-mono text-sm',
                    k === 0 ? 'border-warning bg-warning/10' : 'border-border',
                    qStep?.type === 'enqueue' &&
                      qStep.node === n &&
                      'border-accent bg-accent/15 motion-safe:animate-pulse',
                  )}
                >
                  {BFS_NODES[n]}
                  <span className="ml-1 text-[10px] text-muted">
                    {l.level} {qStep?.level[n]}
                  </span>
                </li>
              ))}
              {!qStep?.queue.length && <li className="text-xs text-muted">{l.empty}</li>}
            </ol>
          </div>
        </>
      )}
    </SimShell>
  );
}

function BracketStats({
  steps,
  cursor,
  l,
}: {
  steps: BracketStep[];
  cursor: number;
  l: (typeof L)['tr'];
}) {
  let max = 0;
  for (let k = 0; k < cursor; k++) max = Math.max(max, steps[k].stack.length);
  const depth = cursor > 0 ? steps[cursor - 1].stack.length : 0;
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat label={l.depth} value={depth} tone="primary" />
      <Stat label={l.maxDepth} value={max} tone="warning" />
    </div>
  );
}
