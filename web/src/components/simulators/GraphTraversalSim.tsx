'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Pause, Play, RotateCcw, Shuffle, StepForward } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { Range, Select, SimShell, Stat } from './ui';
import { boolParam, numParam, strParam, type SimulatorProps } from './types';
import {
  GRAPH_ALGORITHMS,
  circleLayout,
  generateGraph,
  nodeLabel,
  parseNode,
  pathTo,
  traverse,
  type GraphAlgorithm,
} from './graph.logic';

const SIZE = 420;
const C = SIZE / 2;
const R = 160;
const NODE_R = 17;
const STEP_MS = 750;

const L = {
  tr: {
    title: 'Graf gezintisi',
    algos: {
      bfs: 'BFS (genişlik öncelikli)',
      dfs: 'DFS (derinlik öncelikli)',
      dijkstra: 'Dijkstra (en kısa yol)',
    } satisfies Record<GraphAlgorithm, string>,
    hint: {
      bfs: 'Kuyruk (FIFO) kullanır: önce tüm komşular, sonra onların komşuları. Ağırlıksız graflarda en az kenarlı yolu bulur.',
      dfs: 'Yığın (LIFO) kullanır: bir daldan olabildiğince derine iner, çıkmaza girince geri döner. En kısa yolu garanti etmez.',
      dijkstra:
        'Öncelik kuyruğu kullanır: her adımda en küçük geçici uzaklığa sahip düğümü kesinleştirir ve komşularını gevşetir.',
    } satisfies Record<GraphAlgorithm, string>,
    frontier: { bfs: 'Kuyruk (baş →)', dfs: 'Yığın (← tepe)', dijkstra: 'Öncelik kuyruğu' },
    play: 'Oynat',
    pause: 'Duraklat',
    step: 'Adım',
    reset: 'Sıfırla',
    newGraph: 'Yeni graf',
    algorithm: 'Algoritma',
    nodes: 'Düğüm sayısı',
    weighted: 'Ağırlıklı kenarlar',
    target: 'Hedef',
    none: 'Yok (tümünü gez)',
    visited: 'Ziyaret',
    order: 'Ziyaret sırası',
    path: 'Yol',
    cost: 'Maliyet',
    empty: 'boş',
    clickHint: 'Başlangıcı değiştirmek için bir düğüme tıkla.',
    legend: {
      current: 'mevcut',
      visited: 'ziyaret edildi',
      frontier: 'sınırda',
      path: 'en kısa yol',
    },
    start: 'başlangıç',
    found: (t: string) => `Hedef ${t} bulundu.`,
    finished: 'Gezinti tamamlandı.',
    processing: (n: string) => `${n} işleniyor`,
    ready: 'Hazır — oynat ya da adım at.',
    dist: 'Uzaklıklar',
  },
  en: {
    title: 'Graph traversal',
    algos: {
      bfs: 'BFS (breadth-first)',
      dfs: 'DFS (depth-first)',
      dijkstra: 'Dijkstra (shortest path)',
    } satisfies Record<GraphAlgorithm, string>,
    hint: {
      bfs: 'Uses a queue (FIFO): all neighbours first, then theirs. Finds the path with fewest edges in unweighted graphs.',
      dfs: 'Uses a stack (LIFO): goes as deep as possible along a branch, backtracking at dead ends. Does not guarantee the shortest path.',
      dijkstra:
        'Uses a priority queue: each step finalizes the node with the smallest tentative distance and relaxes its neighbours.',
    } satisfies Record<GraphAlgorithm, string>,
    frontier: { bfs: 'Queue (head →)', dfs: 'Stack (← top)', dijkstra: 'Priority queue' },
    play: 'Play',
    pause: 'Pause',
    step: 'Step',
    reset: 'Reset',
    newGraph: 'New graph',
    algorithm: 'Algorithm',
    nodes: 'Node count',
    weighted: 'Weighted edges',
    target: 'Target',
    none: 'None (visit all)',
    visited: 'Visited',
    order: 'Visit order',
    path: 'Path',
    cost: 'Cost',
    empty: 'empty',
    clickHint: 'Click a node to change the start.',
    legend: {
      current: 'current',
      visited: 'visited',
      frontier: 'frontier',
      path: 'shortest path',
    },
    start: 'start',
    found: (t: string) => `Target ${t} found.`,
    finished: 'Traversal finished.',
    processing: (n: string) => `Processing ${n}`,
    ready: 'Ready — play or step.',
    dist: 'Distances',
  },
};

export default function GraphTraversalSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const [algorithm, setAlgorithm] = useState<GraphAlgorithm>(() =>
    strParam(params, 'algorithm', 'bfs', GRAPH_ALGORITHMS),
  );
  const [n, setN] = useState(() => Math.round(numParam(params, 'nodes', 8, 5, 14)));
  const [weighted, setWeighted] = useState(() =>
    boolParam(params, 'weighted', strParam<string>(params, 'algorithm', 'bfs') === 'dijkstra'),
  );
  const [start, setStart] = useState(() => parseNode(params.start, n) ?? 0);
  const [target, setTarget] = useState<number | null>(() => parseNode(params.target, n));
  const [seed, setSeed] = useState(1);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  const graph = useMemo(() => generateGraph(n, seed, weighted), [n, seed, weighted]);
  const pos = useMemo(() => circleLayout(n, C, C, R), [n]);
  const safeStart = start < n ? start : 0;
  const safeTarget = target !== null && target < n && target !== safeStart ? target : null;
  const steps = useMemo(
    () => traverse(graph, algorithm, safeStart, safeTarget),
    [graph, algorithm, safeStart, safeTarget],
  );
  const step = steps[Math.min(cursor, steps.length - 1)];
  const finished = cursor >= steps.length - 1;

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
    const id = setTimeout(() => setCursor((c) => c + 1), STEP_MS);
    return () => clearTimeout(id);
  }, [playing, finished, cursor]);

  // En kısa yol: BFS/Dijkstra hedefe ulaşınca
  const path =
    step.found && safeTarget !== null && algorithm !== 'dfs'
      ? pathTo(step.parent, safeStart, safeTarget)
      : [];
  const pathEdges = new Set(
    path.slice(1).map((v, i) => {
      const u = path[i];
      return u < v ? `${u}-${v}` : `${v}-${u}`;
    }),
  );
  const visitedSet = new Set(step.visited);
  const frontierSet = new Set(step.frontier.map((f) => f.node));

  /** Düğüm durumu rengi; dolgu yüzeyle karıştırılır ki etiket (fg) okunur kalsın */
  const toneOf = (i: number) => {
    if (i === step.current) return 'var(--da-warning)';
    if (path.includes(i)) return 'var(--da-primary)';
    if (visitedSet.has(i)) return 'var(--da-success)';
    if (frontierSet.has(i)) return 'var(--da-accent)';
    return null;
  };
  const fillOf = (i: number) => {
    const tone = toneOf(i);
    return tone ? `color-mix(in srgb, ${tone} 40%, var(--da-surface))` : 'var(--da-elevated)';
  };

  const interact = () => onInteract();
  const togglePlay = () => {
    interact();
    if (finished) {
      setCursor(0);
      setPlaying(!reduced);
      return;
    }
    if (reduced) setCursor(steps.length - 1);
    else setPlaying((p) => !p);
  };
  const next = () => {
    interact();
    setPlaying(false);
    setCursor((c) => Math.min(steps.length - 1, c + 1));
  };
  const pickStart = (i: number) => {
    interact();
    setStart(i);
    if (target === i) setTarget(null);
  };

  const status = step.found
    ? l.found(nodeLabel(safeTarget!))
    : step.done && cursor > 0
      ? l.finished
      : step.current !== null
        ? l.processing(nodeLabel(step.current))
        : l.ready;

  const cost = path.length ? step.dist[path[path.length - 1]] : null;

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button type="button" className="btn-primary" onClick={togglePlay}>
            {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? l.pause : l.play}
          </button>
          <button type="button" className="btn-ghost" onClick={next} disabled={finished}>
            <StepForward size={14} /> {l.step}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setPlaying(false);
              setCursor(0);
            }}
          >
            <RotateCcw size={14} /> {l.reset}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              interact();
              setSeed((s) => s + 1);
            }}
          >
            <Shuffle size={14} /> {l.newGraph}
          </button>
        </>
      }
      aside={
        <>
          <Select
            label={l.algorithm}
            value={algorithm}
            options={GRAPH_ALGORITHMS.map((id) => ({ id, label: l.algos[id] }))}
            onChange={(v) => {
              interact();
              setAlgorithm(v);
            }}
          />
          <Range
            label={l.nodes}
            value={n}
            min={5}
            max={14}
            onChange={(v) => {
              interact();
              setN(v);
            }}
          />
          <Select
            label={l.target}
            value={safeTarget === null ? '' : String(safeTarget)}
            options={[
              { id: '', label: l.none },
              ...Array.from({ length: n }, (_, i) => i)
                .filter((i) => i !== safeStart)
                .map((i) => ({ id: String(i), label: nodeLabel(i) })),
            ]}
            onChange={(v) => {
              interact();
              setTarget(v === '' ? null : Number(v));
            }}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--da-primary)]"
              checked={weighted}
              onChange={(e) => {
                interact();
                setWeighted(e.target.checked);
              }}
            />
            {l.weighted}
          </label>
          <div>
            <p className="label">{l.frontier[algorithm]}</p>
            <div
              className="flex min-h-10 flex-wrap items-center gap-1 rounded-xl border border-border bg-bg/60 p-2"
              aria-live="polite"
            >
              {step.frontier.length === 0 && <span className="text-xs text-muted">{l.empty}</span>}
              {step.frontier.map((f, k) => (
                <span key={`${f.node}-${k}`} className="chip chip-accent font-mono">
                  {nodeLabel(f.node)}
                  {f.priority !== undefined && `:${f.priority}`}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={l.visited} value={`${step.visited.length}/${n}`} tone="success" />
            <Stat label={l.cost} value={cost ?? '—'} tone={cost !== null ? 'primary' : undefined} />
          </div>
          <div>
            <p className="label">{l.order}</p>
            <p className="font-mono text-sm">
              {step.visited.length ? step.visited.map(nodeLabel).join(' → ') : '—'}
            </p>
          </div>
          {path.length > 0 && (
            <div>
              <p className="label">{l.path}</p>
              <p className="font-mono text-sm text-primary">{path.map(nodeLabel).join(' → ')}</p>
            </div>
          )}
          {algorithm === 'dijkstra' && (
            <div>
              <p className="label">{l.dist}</p>
              <p className="font-mono text-xs leading-5">
                {step.dist.map((d, i) => `${nodeLabel(i)}=${d ?? '∞'}`).join('  ')}
              </p>
            </div>
          )}
        </>
      }
    >
      <p className="mb-2 text-sm text-muted">{l.hint[algorithm]}</p>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto h-auto w-full max-w-md"
        role="img"
        aria-label={`${l.algos[algorithm]} · ${status}`}
      >
        {graph.edges.map((e) => {
          const a = pos[e.a];
          const b = pos[e.b];
          const onPath = pathEdges.has(`${e.a}-${e.b}`);
          const tree =
            !onPath &&
            ((step.parent[e.b] === e.a && visitedSet.has(e.b)) ||
              (step.parent[e.a] === e.b && visitedSet.has(e.a)));
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          return (
            <g key={`${e.a}-${e.b}`}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={
                  onPath ? 'var(--da-primary)' : tree ? 'var(--da-success)' : 'var(--da-border)'
                }
                strokeWidth={onPath ? 5 : tree ? 3 : 2}
                style={{ transition: reduced ? 'none' : 'stroke 0.3s, stroke-width 0.3s' }}
              />
              {weighted && (
                <g>
                  <circle
                    cx={mx}
                    cy={my}
                    r={10}
                    fill="var(--da-surface)"
                    stroke="var(--da-border)"
                  />
                  <text
                    x={mx}
                    y={my + 4}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={600}
                    fill="var(--da-fg)"
                  >
                    {e.w}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        {pos.map((p, i) => (
          <g
            key={i}
            role="button"
            tabIndex={0}
            aria-label={`${nodeLabel(i)}${i === safeStart ? ` (${l.start})` : ''}`}
            className="cursor-pointer"
            onClick={() => pickStart(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                pickStart(i);
              }
            }}
          >
            {i === step.current && (
              <motion.circle
                cx={p.x}
                cy={p.y}
                r={NODE_R + 6}
                fill="none"
                stroke="var(--da-warning)"
                strokeWidth={2}
                initial={reduced ? false : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: reduced ? 0 : 0.3 }}
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
              />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={NODE_R}
              fill={fillOf(i)}
              stroke={
                i === safeStart
                  ? 'var(--da-primary)'
                  : i === safeTarget
                    ? 'var(--da-danger)'
                    : (toneOf(i) ?? 'var(--da-border)')
              }
              strokeWidth={i === safeStart || i === safeTarget ? 3 : 1.5}
              strokeDasharray={i === safeTarget ? '4 3' : undefined}
              style={{ transition: reduced ? 'none' : 'fill 0.3s' }}
            />
            <text
              x={p.x}
              y={p.y + 5}
              textAnchor="middle"
              fontSize={14}
              fontWeight={700}
              fill="var(--da-fg)"
              pointerEvents="none"
            >
              {nodeLabel(i)}
            </text>
            {algorithm === 'dijkstra' && step.dist[i] !== null && (
              <text
                x={p.x + (p.x - C) * 0.22}
                y={p.y + (p.y - C) * 0.22 + 4}
                textAnchor="middle"
                fontSize={12}
                fill="var(--da-muted)"
                pointerEvents="none"
              >
                {step.dist[i]}
              </text>
            )}
          </g>
        ))}
      </svg>
      <p className="mt-2 font-mono text-xs text-fg" aria-live="polite">
        {status}
      </p>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        {(
          [
            ['var(--da-warning)', l.legend.current],
            ['var(--da-success)', l.legend.visited],
            ['var(--da-accent)', l.legend.frontier],
            ['var(--da-primary)', l.legend.path],
          ] as const
        ).map(([c, label]) => (
          <span key={label} className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full" style={{ background: c }} /> {label}
          </span>
        ))}
        <span>· {l.clickHint}</span>
      </div>
    </SimShell>
  );
}
