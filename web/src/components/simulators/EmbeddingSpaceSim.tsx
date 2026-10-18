'use client';

import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { motion } from 'framer-motion';
import { seededRandom } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { Range, Select, SimShell } from './ui';
import { boolParam, numParam, type SimulatorProps } from './types';

/** Özellik boyutları: [hayvan, taşıt, insan, kraliyet, cinsiyet(+erkek), boyut, yiyecek, hız] */
type Cluster = 'animal' | 'vehicle' | 'person' | 'food';
interface Word {
  id: string;
  tr: string;
  cluster: Cluster;
  base: number[];
}

const WORDS: Word[] = [
  { id: 'cat', tr: 'kedi', cluster: 'animal', base: [1, 0, 0, 0, 0, 0.2, 0, 0.4] },
  { id: 'dog', tr: 'köpek', cluster: 'animal', base: [1, 0, 0, 0, 0, 0.3, 0, 0.5] },
  { id: 'lion', tr: 'aslan', cluster: 'animal', base: [1, 0, 0, 0.3, 0.3, 0.7, 0, 0.6] },
  { id: 'tiger', tr: 'kaplan', cluster: 'animal', base: [1, 0, 0, 0.1, 0, 0.7, 0, 0.7] },
  { id: 'horse', tr: 'at', cluster: 'animal', base: [1, 0.3, 0, 0, 0, 0.8, 0, 0.8] },
  { id: 'elephant', tr: 'fil', cluster: 'animal', base: [1, 0, 0, 0, 0, 1, 0, 0.2] },
  { id: 'mouse', tr: 'fare', cluster: 'animal', base: [1, 0, 0, 0, 0, 0.05, 0, 0.3] },
  { id: 'eagle', tr: 'kartal', cluster: 'animal', base: [1, 0.1, 0, 0.2, 0, 0.4, 0, 0.9] },
  { id: 'car', tr: 'araba', cluster: 'vehicle', base: [0, 1, 0, 0, 0, 0.5, 0, 0.7] },
  { id: 'bus', tr: 'otobüs', cluster: 'vehicle', base: [0, 1, 0, 0, 0, 0.8, 0, 0.5] },
  { id: 'truck', tr: 'kamyon', cluster: 'vehicle', base: [0, 1, 0, 0, 0, 0.9, 0, 0.4] },
  { id: 'bicycle', tr: 'bisiklet', cluster: 'vehicle', base: [0, 1, 0, 0, 0, 0.2, 0, 0.3] },
  { id: 'train', tr: 'tren', cluster: 'vehicle', base: [0, 1, 0, 0, 0, 1, 0, 0.8] },
  { id: 'airplane', tr: 'uçak', cluster: 'vehicle', base: [0, 1, 0, 0, 0, 0.9, 0, 1] },
  { id: 'boat', tr: 'tekne', cluster: 'vehicle', base: [0, 1, 0, 0, 0, 0.5, 0, 0.4] },
  { id: 'motorcycle', tr: 'motosiklet', cluster: 'vehicle', base: [0, 1, 0, 0, 0.1, 0.3, 0, 0.8] },
  { id: 'king', tr: 'kral', cluster: 'person', base: [0, 0, 1, 1, 1, 0.5, 0, 0] },
  { id: 'queen', tr: 'kraliçe', cluster: 'person', base: [0, 0, 1, 1, -1, 0.5, 0, 0] },
  { id: 'man', tr: 'adam', cluster: 'person', base: [0, 0, 1, 0, 1, 0.5, 0, 0] },
  { id: 'woman', tr: 'kadın', cluster: 'person', base: [0, 0, 1, 0, -1, 0.5, 0, 0] },
  { id: 'prince', tr: 'prens', cluster: 'person', base: [0, 0, 1, 0.8, 1, 0.3, 0, 0] },
  { id: 'princess', tr: 'prenses', cluster: 'person', base: [0, 0, 1, 0.8, -1, 0.3, 0, 0] },
  { id: 'boy', tr: 'oğlan', cluster: 'person', base: [0, 0, 1, 0, 1, 0.2, 0, 0.1] },
  { id: 'girl', tr: 'kız', cluster: 'person', base: [0, 0, 1, 0, -1, 0.2, 0, 0.1] },
  { id: 'apple', tr: 'elma', cluster: 'food', base: [0, 0, 0, 0, 0, 0.1, 1, 0] },
  { id: 'banana', tr: 'muz', cluster: 'food', base: [0, 0, 0, 0, 0, 0.1, 1, 0] },
  { id: 'bread', tr: 'ekmek', cluster: 'food', base: [0, 0, 0, 0, 0, 0.2, 1, 0] },
  { id: 'cheese', tr: 'peynir', cluster: 'food', base: [0, 0, 0, 0, 0, 0.15, 1, 0] },
  { id: 'pizza', tr: 'pizza', cluster: 'food', base: [0, 0, 0, 0, 0, 0.3, 1, 0.1] },
  { id: 'cake', tr: 'pasta', cluster: 'food', base: [0, 0, 0, 0.1, 0, 0.25, 1, 0] },
];

const CLUSTER_COLOR: Record<Cluster, string> = {
  animal: 'var(--da-success)',
  vehicle: 'var(--da-primary)',
  person: 'var(--da-accent)',
  food: 'var(--da-danger)',
};

const L = {
  tr: {
    title: 'Gömme (embedding) uzayı',
    yaw: 'Döndür (yatay)',
    pitch: 'Eğ (dikey)',
    neighbors: 'En yakın komşular (kosinüs)',
    pick: 'Bir kelimeye tıkla',
    analogy: 'Vektör aritmetiği',
    result: 'Sonuç',
    clusters: { animal: 'hayvan', vehicle: 'taşıt', person: 'insan', food: 'yiyecek' } satisfies Record<Cluster, string>,
    hint: 'Sürükleyerek ya da kaydırıcılarla döndür. Vektörler 8 boyutlu; ekranda 3B izdüşümü görünür, benzerlik tam vektörlerle hesaplanır.',
  },
  en: {
    title: 'Embedding space',
    yaw: 'Rotate (yaw)',
    pitch: 'Tilt (pitch)',
    neighbors: 'Nearest neighbors (cosine)',
    pick: 'Click a word',
    analogy: 'Vector arithmetic',
    result: 'Result',
    clusters: { animal: 'animal', vehicle: 'vehicle', person: 'person', food: 'food' } satisfies Record<Cluster, string>,
    hint: 'Drag or use the sliders to rotate. Vectors are 8-dimensional; you see a 3D projection, similarity uses the full vectors.',
  },
};

/** Kelime vektörlerine küçük deterministik gürültü eklenir ki eşit vektörler çakışmasın */
function buildVectors(): Record<string, number[]> {
  const rnd = seededRandom(99);
  return Object.fromEntries(WORDS.map((w) => [w.id, w.base.map((v) => v + (rnd() - 0.5) * 0.12)]));
}

const cosine = (a: number[], b: number[]) => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na * nb) || 1);
};

/** 8B → 3B sabit izdüşüm: kümeleri ayıran el yapımı eksenler */
const project3 = (v: number[]): [number, number, number] => [
  v[0] * 1.1 - v[1] * 1.1 + v[6] * 0.1,
  v[2] * 1.1 - v[6] * 1.1 + v[3] * 0.3,
  v[4] * 0.7 + v[3] * 0.6 + v[5] * 0.5 + v[7] * 0.3 - 0.4,
];

export default function EmbeddingSpaceSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const vectors = useMemo(buildVectors, []);
  const flat = numParam(params, 'dimensions', 3, 2, 3) === 2;
  const showNeighbors = boolParam(params, 'showNeighbors', true);
  const [yaw, setYaw] = useState(flat ? 0 : 30);
  const [pitch, setPitch] = useState(flat ? 0 : 20);
  const [selected, setSelected] = useState<string | null>(null);
  const [a, setA] = useState('king');
  const [b, setB] = useState('man');
  const [c, setC] = useState('woman');
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);

  const label = (id: string) => (locale === 'tr' ? WORDS.find((w) => w.id === id)?.tr ?? id : id);

  // Döndürme + perspektif
  const toScreen3 = ([x0, y0, z0]: [number, number, number]) => {
    const ry = (yaw * Math.PI) / 180;
    const rp = (pitch * Math.PI) / 180;
    const x1 = x0 * Math.cos(ry) + z0 * Math.sin(ry);
    const z1 = -x0 * Math.sin(ry) + z0 * Math.cos(ry);
    const y2 = y0 * Math.cos(rp) - z1 * Math.sin(rp);
    const z2 = y0 * Math.sin(rp) + z1 * Math.cos(rp);
    const persp = 3 / (3 + z2);
    return { x: 300 + x1 * 190 * persp, y: 200 - y2 * 150 * persp, z: z2, s: persp };
  };
  const toScreen = (v: number[]) => toScreen3(project3(v));

  const neighbors = useMemo(() => {
    if (!selected) return [];
    return WORDS.filter((w) => w.id !== selected)
      .map((w) => ({ id: w.id, sim: cosine(vectors[selected], vectors[w.id]) }))
      .sort((x, y) => y.sim - x.sim)
      .slice(0, 5);
  }, [selected, vectors]);

  const analogy = useMemo(() => {
    const v = vectors[a].map((x, i) => x - vectors[b][i] + vectors[c][i]);
    const best = WORDS.filter((w) => ![a, b, c].includes(w.id))
      .map((w) => ({ id: w.id, sim: cosine(v, vectors[w.id]) }))
      .sort((x, y) => y.sim - x.sim)[0];
    return { v, best };
  }, [a, b, c, vectors]);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, yaw, pitch };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    onInteract();
    setYaw(Math.round((drag.current.yaw + (e.clientX - drag.current.x) * 0.5 + 360) % 360));
    setPitch(Math.max(-80, Math.min(80, Math.round(drag.current.pitch + (e.clientY - drag.current.y) * 0.4))));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const projected = WORDS.map((w) => ({ w, p: toScreen(vectors[w.id]) })).sort((x, y) => y.p.z - x.p.z);
  const sel = selected ? toScreen(vectors[selected]) : null;
  const ana = toScreen(analogy.v);
  const options = WORDS.map((w) => ({ id: w.id, label: label(w.id) }));

  return (
    <SimShell
      title={l.title}
      aside={
        <>
          <Range label={l.yaw} value={yaw} min={0} max={359} format={(v) => `${v}°`} onChange={(v) => { onInteract(); setYaw(v); }} />
          <Range label={l.pitch} value={pitch} min={-80} max={80} format={(v) => `${v}°`} onChange={(v) => { onInteract(); setPitch(v); }} />
          {showNeighbors && (
            <div aria-live="polite">
              <p className="label">{l.neighbors}</p>
              {selected ? (
                <ol className="space-y-1 text-sm">
                  {neighbors.map((nb) => (
                    <li key={nb.id} className="flex items-center gap-2">
                      <span className="w-24 truncate">{label(nb.id)}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded bg-elevated">
                        <span className="block h-full bg-primary" style={{ width: `${Math.max(0, nb.sim) * 100}%` }} />
                      </span>
                      <span className="w-10 text-right text-xs tabular-nums">{nb.sim.toFixed(2)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-muted">{l.pick}</p>
              )}
            </div>
          )}
          <div className="space-y-2 rounded-xl border border-border p-2">
            <p className="label">{l.analogy}</p>
            <Select label="A" value={a} options={options} onChange={(v) => { onInteract(); setA(v); }} />
            <Select label="− B" value={b} options={options} onChange={(v) => { onInteract(); setB(v); }} />
            <Select label="+ C" value={c} options={options} onChange={(v) => { onInteract(); setC(v); }} />
            <p className="text-sm" aria-live="polite">
              {label(a)} − {label(b)} + {label(c)} ≈ <strong className="text-primary">{label(analogy.best.id)}</strong> <span className="text-xs text-muted">({analogy.best.sim.toFixed(2)})</span>
            </p>
          </div>
        </>
      }
    >
      <p className="mb-2 text-xs text-muted">{l.hint}</p>
      <svg
        viewBox="0 0 600 400"
        className="h-auto w-full cursor-grab touch-none select-none active:cursor-grabbing"
        role="img"
        aria-label={l.title}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <rect width={600} height={400} fill="var(--da-bg)" />
        {/* Eksenler */}
        {([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as [number, number, number][]).map((axis, i) => {
          const e = toScreen3(axis);
          const nE = toScreen3([-axis[0], -axis[1], -axis[2]]);
          return <line key={i} x1={nE.x} y1={nE.y} x2={e.x} y2={e.y} stroke="var(--da-border)" strokeDasharray="3 3" />;
        })}
        {showNeighbors && sel &&
          neighbors.map((nb) => {
            const p = toScreen(vectors[nb.id]);
            return <line key={nb.id} x1={sel.x} y1={sel.y} x2={p.x} y2={p.y} stroke="var(--da-primary)" strokeWidth={1 + nb.sim * 2} opacity={0.6} />;
          })}
        {/* Analoji vektörü */}
        <line x1={toScreen(vectors[analogy.best.id]).x} y1={toScreen(vectors[analogy.best.id]).y} x2={ana.x} y2={ana.y} stroke="var(--da-accent)" strokeDasharray="4 3" />
        <motion.path
          d="M 0 -9 L 2.6 -2.8 L 9 -2.8 L 3.9 1.2 L 5.6 7.6 L 0 3.8 L -5.6 7.6 L -3.9 1.2 L -9 -2.8 L -2.6 -2.8 Z"
          fill="var(--da-accent)"
          initial={false}
          animate={{ x: ana.x, y: ana.y }}
          transition={{ duration: reduced ? 0 : 0.3 }}
        />
        {projected.map(({ w, p }) => {
          const isSel = w.id === selected;
          const isNb = neighbors.some((nb) => nb.id === w.id);
          return (
            <g
              key={w.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSel}
              aria-label={label(w.id)}
              className="cursor-pointer"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => { onInteract(); setSelected(isSel ? null : w.id); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { onInteract(); setSelected(isSel ? null : w.id); } }}
            >
              <circle cx={p.x} cy={p.y} r={(isSel ? 8 : 5.5) * p.s} fill={CLUSTER_COLOR[w.cluster]} stroke={isSel || isNb ? 'var(--da-fg)' : 'var(--da-surface)'} strokeWidth={isSel ? 2 : 1} opacity={0.5 + 0.5 * Math.min(1, p.s)} />
              <text x={p.x + 8} y={p.y + 4} fontSize={11 * Math.min(1.2, p.s)} fill={isSel ? 'var(--da-fg)' : 'var(--da-muted)'} fontWeight={isSel ? 600 : 400}>
                {label(w.id)}
              </text>
            </g>
          );
        })}
        {(Object.keys(CLUSTER_COLOR) as Cluster[]).map((cl, i) => (
          <g key={cl} transform={`translate(${12 + i * 90}, 384)`}>
            <circle cx={5} cy={0} r={5} fill={CLUSTER_COLOR[cl]} />
            <text x={14} y={4} fontSize={10} fill="var(--da-fg)">{l.clusters[cl]}</text>
          </g>
        ))}
      </svg>
    </SimShell>
  );
}
