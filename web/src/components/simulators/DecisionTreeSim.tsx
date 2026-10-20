'use client';

import { useMemo, useState, type MouseEvent } from 'react';
import { RotateCcw } from 'lucide-react';
import { seededRandom } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { Range, Select, SimShell, Stat } from './ui';
import { numParam, strParam, type SimulatorProps } from './types';

type Dataset = 'moons' | 'xor' | 'blobs';
type Criterion = 'gini' | 'entropy';
interface Pt {
  x: number;
  y: number;
  c: 0 | 1;
}
interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
interface TreeNode {
  id: number;
  depth: number;
  n: number;
  counts: [number, number];
  impurity: number;
  bounds: Bounds;
  split?: { feature: 'x' | 'y'; threshold: number; gain: number };
  left?: TreeNode;
  right?: TreeNode;
}

const DATASETS: Dataset[] = ['moons', 'xor', 'blobs'];
const CLASS_COLOR = ['var(--da-danger)', 'var(--da-primary)'];

const L = {
  tr: {
    title: 'Karar ağacı (greedy, Gini / entropi)',
    depth: 'Maks. derinlik',
    minLeaf: 'min_samples_leaf',
    dataset: 'Veri seti',
    criterion: 'Bölme ölçütü',
    datasets: { moons: 'Hilal (moons)', xor: 'XOR', blobs: 'Kümeler' } satisfies Record<
      Dataset,
      string
    >,
    addClass: 'Tıklayınca eklenecek sınıf',
    classA: 'Sınıf 0 (kırmızı)',
    classB: 'Sınıf 1 (mavi)',
    accuracy: 'Eğitim doğruluğu',
    valAccuracy: 'Doğrulama doğruluğu',
    leaves: 'Yaprak',
    tree: 'Ağaç',
    samples: 'örnek',
    hint: 'Grafiğe tıklayarak nokta ekle. Her düğüm, safsızlığı en çok azaltan eksen-paralel bölmeyi seçer. Derinlik arttıkça ağaç eğitim verisini ezberler (aşırı öğrenme); doğrulama doğruluğu aynı dağılımdan üretilen, ağacın görmediği 80 noktada ölçülür.',
  },
  en: {
    title: 'Decision tree (greedy, Gini / entropy)',
    depth: 'Max depth',
    minLeaf: 'min_samples_leaf',
    dataset: 'Dataset',
    criterion: 'Split criterion',
    datasets: { moons: 'Moons', xor: 'XOR', blobs: 'Blobs' } satisfies Record<Dataset, string>,
    addClass: 'Class added on click',
    classA: 'Class 0 (red)',
    classB: 'Class 1 (blue)',
    accuracy: 'Training accuracy',
    valAccuracy: 'Validation accuracy',
    leaves: 'Leaves',
    tree: 'Tree',
    samples: 'samples',
    hint: 'Click the plot to add points. Each node picks the axis-aligned split that reduces impurity the most. Deeper trees memorize the training data (overfitting); validation accuracy is measured on 80 unseen points from the same distribution.',
  },
};

const MAX_DEPTH = 8;
const VALIDATION_SEED = 11;

function makeData(kind: Dataset, seed = 5): Pt[] {
  const rnd = seededRandom(seed);
  const pts: Pt[] = [];
  for (let i = 0; i < 80; i++) {
    const c: 0 | 1 = i % 2 === 0 ? 0 : 1;
    if (kind === 'moons') {
      const a = rnd() * Math.PI;
      const x = c === 0 ? 0.32 + 0.25 * Math.cos(a) : 0.57 - 0.25 * Math.cos(a);
      const y = c === 0 ? 0.42 + 0.25 * Math.sin(a) : 0.6 - 0.25 * Math.sin(a);
      pts.push({ x: x + (rnd() - 0.5) * 0.08, y: y + (rnd() - 0.5) * 0.08, c });
    } else if (kind === 'xor') {
      const x = rnd();
      const y = rnd();
      pts.push({ x, y, c: x > 0.5 !== y > 0.5 ? 1 : 0 });
    } else {
      const cx = c === 0 ? 0.35 : 0.65;
      const cy = c === 0 ? 0.6 : 0.4;
      pts.push({ x: cx + (rnd() + rnd() - 1) * 0.22, y: cy + (rnd() + rnd() - 1) * 0.22, c });
    }
  }
  return pts.map((p) => ({
    ...p,
    x: Math.max(0.01, Math.min(0.99, p.x)),
    y: Math.max(0.01, Math.min(0.99, p.y)),
  }));
}

function impurity(counts: [number, number], criterion: Criterion): number {
  const n = counts[0] + counts[1];
  if (!n) return 0;
  const p = counts.map((c) => c / n);
  if (criterion === 'gini') return 1 - p[0] * p[0] - p[1] * p[1];
  return -p.reduce((a, q) => a + (q > 0 ? q * Math.log2(q) : 0), 0);
}

const countOf = (pts: Pt[]): [number, number] => [
  pts.filter((p) => p.c === 0).length,
  pts.filter((p) => p.c === 1).length,
];

/** Greedy, özyinelemeli ağaç kurulumu; minLeaf: bir yaprakta kalması gereken en az örnek (budama) */
function buildTree(pts: Pt[], maxDepth: number, criterion: Criterion, minLeaf = 1): TreeNode {
  let nextId = 0;
  const grow = (subset: Pt[], depth: number, bounds: Bounds): TreeNode => {
    const counts = countOf(subset);
    const imp = impurity(counts, criterion);
    const node: TreeNode = { id: nextId++, depth, n: subset.length, counts, impurity: imp, bounds };
    if (depth >= maxDepth || imp === 0 || subset.length < 2 * minLeaf) return node;
    let best: { feature: 'x' | 'y'; threshold: number; gain: number } | null = null;
    for (const feature of ['x', 'y'] as const) {
      const values = [...new Set(subset.map((p) => p[feature]))].sort((a, b) => a - b);
      for (let i = 0; i < values.length - 1; i++) {
        const threshold = (values[i] + values[i + 1]) / 2;
        const left = subset.filter((p) => p[feature] < threshold);
        const right = subset.filter((p) => p[feature] >= threshold);
        if (left.length < minLeaf || right.length < minLeaf) continue;
        const weighted =
          (left.length * impurity(countOf(left), criterion) +
            right.length * impurity(countOf(right), criterion)) /
          subset.length;
        const gain = imp - weighted;
        if (!best || gain > best.gain + 1e-12) best = { feature, threshold, gain };
      }
    }
    if (!best || best.gain <= 1e-9) return node;
    node.split = best;
    const { feature, threshold } = best;
    node.left = grow(
      subset.filter((p) => p[feature] < threshold),
      depth + 1,
      feature === 'x' ? { ...bounds, x1: threshold } : { ...bounds, y1: threshold },
    );
    node.right = grow(
      subset.filter((p) => p[feature] >= threshold),
      depth + 1,
      feature === 'x' ? { ...bounds, x0: threshold } : { ...bounds, y0: threshold },
    );
    return node;
  };
  return grow(pts, 0, { x0: 0, x1: 1, y0: 0, y1: 1 });
}

function collect(node: TreeNode, out: TreeNode[] = []): TreeNode[] {
  out.push(node);
  if (node.left) collect(node.left, out);
  if (node.right) collect(node.right, out);
  return out;
}

function predict(node: TreeNode, p: Pt): 0 | 1 {
  if (!node.split || !node.left || !node.right) return node.counts[1] > node.counts[0] ? 1 : 0;
  return p[node.split.feature] < node.split.threshold
    ? predict(node.left, p)
    : predict(node.right, p);
}

export default function DecisionTreeSim({ params, onInteract }: SimulatorProps) {
  const { t, locale } = useI18n();
  const l = L[locale];
  const [dataset, setDataset] = useState<Dataset>(() =>
    strParam(params, 'dataset', 'moons', DATASETS),
  );
  const [criterion, setCriterion] = useState<Criterion>(() =>
    strParam(params, 'criterion', 'gini', ['gini', 'entropy'] as const),
  );
  const [maxDepth, setMaxDepth] = useState(() => numParam(params, 'maxDepth', 3, 1, MAX_DEPTH));
  const [minLeaf, setMinLeaf] = useState(() => numParam(params, 'minSamplesLeaf', 1, 1, 10));
  const [points, setPoints] = useState<Pt[]>(() => makeData(dataset));
  const [addClass, setAddClass] = useState<0 | 1>(0);
  // Doğrulama kümesi: aynı dağılımdan, ağacın hiç görmediği noktalar
  const valPoints = useMemo(() => makeData(dataset, VALIDATION_SEED), [dataset]);

  const tree = useMemo(
    () => buildTree(points, maxDepth, criterion, minLeaf),
    [points, maxDepth, criterion, minLeaf],
  );
  const nodes = useMemo(() => collect(tree), [tree]);
  const leaves = nodes.filter((n) => !n.split);
  const accuracy = points.length
    ? points.filter((p) => predict(tree, p) === p.c).length / points.length
    : 0;
  const valAccuracy = valPoints.filter((p) => predict(tree, p) === p.c).length / valPoints.length;

  const S = 320;
  const sx = (x: number) => x * S;
  const sy = (y: number) => S - y * S;

  const addPoint = (e: MouseEvent<SVGRectElement>) => {
    onInteract();
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = 1 - (e.clientY - r.top) / r.height;
    setPoints((ps) => [...ps, { x, y, c: addClass }].slice(-200));
  };

  // Ağaç diyagramı yerleşimi: her derinlikte düğümler soldan sağa, yapraklar eşit aralıklı
  const layout = new Map<number, { x: number; y: number }>();
  let leafIdx = 0;
  const place = (n: TreeNode): number => {
    let x: number;
    if (!n.left || !n.right) {
      x = leafIdx++;
    } else {
      x = (place(n.left) + place(n.right)) / 2;
    }
    layout.set(n.id, { x, y: n.depth });
    return x;
  };
  place(tree);
  const treeW = Math.max(400, leafIdx * 62);
  const treeH = (maxDepth + 1) * 70 + 20;
  const tx = (v: number) => 31 + (v / Math.max(1, leafIdx - 1)) * (treeW - 62);
  const ty = (d: number) => 30 + d * 70;

  return (
    <SimShell
      title={l.title}
      toolbar={
        <button type="button" className="btn-ghost" onClick={() => setPoints(makeData(dataset))}>
          <RotateCcw size={14} /> {t('sim.reset')}
        </button>
      }
      aside={
        <>
          <Range
            label={l.depth}
            value={maxDepth}
            min={1}
            max={MAX_DEPTH}
            onChange={(v) => {
              onInteract();
              setMaxDepth(v);
            }}
          />
          <Range
            label={l.minLeaf}
            value={minLeaf}
            min={1}
            max={10}
            onChange={(v) => {
              onInteract();
              setMinLeaf(v);
            }}
          />
          <Select
            label={l.dataset}
            value={dataset}
            options={DATASETS.map((d) => ({ id: d, label: l.datasets[d] }))}
            onChange={(v) => {
              onInteract();
              setDataset(v);
              setPoints(makeData(v));
            }}
          />
          <Select
            label={l.criterion}
            value={criterion}
            options={[
              { id: 'gini', label: 'Gini' },
              { id: 'entropy', label: 'Entropy' },
            ]}
            onChange={(v) => {
              onInteract();
              setCriterion(v);
            }}
          />
          <div role="radiogroup" aria-label={l.addClass}>
            <p className="label">{l.addClass}</p>
            <div className="flex gap-1">
              {([0, 1] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={addClass === c}
                  className={
                    addClass === c ? 'btn-primary px-2 py-1 text-xs' : 'btn-ghost px-2 py-1 text-xs'
                  }
                  onClick={() => setAddClass(c)}
                >
                  {c === 0 ? l.classA : l.classB}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2" aria-live="polite">
            <Stat
              label={l.accuracy}
              value={`${(accuracy * 100).toFixed(0)}%`}
              tone={accuracy > 0.95 ? 'success' : 'primary'}
            />
            <Stat
              label={l.valAccuracy}
              value={`${(valAccuracy * 100).toFixed(0)}%`}
              tone={accuracy - valAccuracy > 0.1 ? 'warning' : 'success'}
            />
            <Stat label={l.leaves} value={leaves.length} />
          </div>
          <p className="text-xs text-muted">{l.hint}</p>
        </>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <svg
          viewBox={`0 0 ${S} ${S}`}
          className="mx-auto h-auto w-full max-w-sm"
          role="img"
          aria-label={l.title}
        >
          {leaves.map((lf) => {
            const cls = lf.counts[1] > lf.counts[0] ? 1 : 0;
            const purity = lf.n ? Math.max(...lf.counts) / lf.n : 0.5;
            return (
              <rect
                key={lf.id}
                x={sx(lf.bounds.x0)}
                y={sy(lf.bounds.y1)}
                width={sx(lf.bounds.x1) - sx(lf.bounds.x0)}
                height={sy(lf.bounds.y0) - sy(lf.bounds.y1)}
                fill={`color-mix(in srgb, ${CLASS_COLOR[cls]} ${Math.round(10 + purity * 20)}%, var(--da-surface))`}
              />
            );
          })}
          {nodes
            .filter((n) => n.split)
            .map((n) => {
              const { feature, threshold } = n.split!;
              const b = n.bounds;
              return feature === 'x' ? (
                <line
                  key={n.id}
                  x1={sx(threshold)}
                  x2={sx(threshold)}
                  y1={sy(b.y0)}
                  y2={sy(b.y1)}
                  stroke="var(--da-fg)"
                  strokeWidth={Math.max(0.8, 2.5 - n.depth * 0.4)}
                />
              ) : (
                <line
                  key={n.id}
                  y1={sy(threshold)}
                  y2={sy(threshold)}
                  x1={sx(b.x0)}
                  x2={sx(b.x1)}
                  stroke="var(--da-fg)"
                  strokeWidth={Math.max(0.8, 2.5 - n.depth * 0.4)}
                />
              );
            })}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={4}
              fill={CLASS_COLOR[p.c]}
              stroke="var(--da-surface)"
              strokeWidth={1}
              pointerEvents="none"
            />
          ))}
          <rect
            width={S}
            height={S}
            fill="transparent"
            stroke="var(--da-border)"
            className="cursor-crosshair"
            onClick={addPoint}
          />
        </svg>
        <div className="overflow-x-auto">
          <p className="label">{l.tree}</p>
          <svg
            viewBox={`0 0 ${treeW} ${treeH}`}
            className="h-auto w-full"
            style={{ minWidth: Math.min(treeW, 520) }}
            role="img"
            aria-label={l.tree}
          >
            {nodes.map((n) =>
              [n.left, n.right].map(
                (ch) =>
                  ch && (
                    <line
                      key={`${n.id}-${ch.id}`}
                      x1={tx(layout.get(n.id)!.x)}
                      y1={ty(n.depth) + 18}
                      x2={tx(layout.get(ch.id)!.x)}
                      y2={ty(ch.depth) - 18}
                      stroke="var(--da-border)"
                      strokeWidth={1.5}
                    />
                  ),
              ),
            )}
            {nodes.map((n) => {
              const pos = layout.get(n.id)!;
              const x = tx(pos.x);
              const y = ty(n.depth);
              const cls = n.counts[1] > n.counts[0] ? 1 : 0;
              return (
                <g key={n.id}>
                  <rect
                    x={x - 29}
                    y={y - 18}
                    width={58}
                    height={36}
                    rx={7}
                    fill={
                      n.split
                        ? 'var(--da-surface)'
                        : `color-mix(in srgb, ${CLASS_COLOR[cls]} 25%, var(--da-surface))`
                    }
                    stroke={n.split ? 'var(--da-fg)' : CLASS_COLOR[cls]}
                  />
                  <text
                    x={x}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={600}
                    fill="var(--da-fg)"
                  >
                    {n.split ? `${n.split.feature} < ${n.split.threshold.toFixed(2)}` : `→ ${cls}`}
                  </text>
                  <text x={x} y={y + 9} textAnchor="middle" fontSize={8} fill="var(--da-muted)">
                    {n.counts[0]}/{n.counts[1]} · {n.impurity.toFixed(2)}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="text-xs text-muted">
            {locale === 'tr'
              ? 'Düğüm: sınıf0/sınıf1 · safsızlık'
              : 'Node: class0/class1 · impurity'}{' '}
            · {points.length} {l.samples}
          </p>
        </div>
      </div>
    </SimShell>
  );
}
