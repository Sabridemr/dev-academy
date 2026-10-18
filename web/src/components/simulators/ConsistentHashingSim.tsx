'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import {
  RING_SIZE,
  addRingNode,
  createRing,
  generateKeys,
  locateKey,
  modHashMoved,
  movedKeys,
  removeRingNode,
  ringDistribution,
  type HashRing,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { Range, SimShell, Stat } from './ui';
import { numParam, type SimulatorProps } from './types';

/** Düğüm başına renk — yalnızca tema değişkenleri ve karışımları */
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
const ALL_NODES = ['node-A', 'node-B', 'node-C', 'node-D', 'node-E', 'node-F', 'node-G', 'node-H'];
const CX = 200;
const CY = 200;
const R = 150;

const L = {
  tr: {
    title: 'Consistent hashing halkası',
    addNode: 'Düğüm ekle',
    removeNode: 'Son düğümü çıkar',
    keys: 'Anahtar',
    lastChange: 'Son değişiklik',
    consistent: 'Consistent hashing',
    modN: 'mod-N hashing',
    noChange: 'Henüz değişiklik yok — düğüm ekle/çıkar.',
    perNode: 'Düğüm başına anahtar',
    ideal: 'ideal',
    hint: 'Her anahtar halkada saat yönünde ilk düğüme aittir. Düğüm noktasına tıklayarak o düğümü kaldırabilirsin.',
    movedHint: 'Kırmızı halkalı anahtarlar son değişiklikte sahip değiştirdi.',
  },
  en: {
    title: 'Consistent hashing ring',
    addNode: 'Add node',
    removeNode: 'Remove last node',
    keys: 'Keys',
    lastChange: 'Last change',
    consistent: 'Consistent hashing',
    modN: 'mod-N hashing',
    noChange: 'No change yet — add/remove a node.',
    perNode: 'Keys per node',
    ideal: 'ideal',
    hint: 'Each key belongs to the first node clockwise on the ring. Click a node point to remove that node.',
    movedHint: 'Keys with a red ring changed owner in the last change.',
  },
};

const polar = (deg: number, r: number) => {
  const rad = ((deg / RING_SIZE) * 360 - 90) * (Math.PI / 180);
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
};

interface Change {
  label: string;
  consistent: { moved: number; ratio: number };
  mod: { moved: number; ratio: number };
  movedSet: Set<string>;
}

export default function ConsistentHashingSim({ params, onInteract }: SimulatorProps) {
  const { t, locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const keyCount = numParam(params, 'keys', 60, 8, 200);
  const keys = useMemo(() => generateKeys(keyCount), [keyCount]);
  const [ring, setRing] = useState<HashRing>(() =>
    createRing(
      ALL_NODES.slice(0, numParam(params, 'nodes', 3, 1, 8)),
      numParam(params, 'virtualNodes', 3, 1, 100),
    ),
  );
  const [change, setChange] = useState<Change | null>(null);

  const colorOf = (nodeId: string | null) =>
    nodeId ? PALETTE[ALL_NODES.indexOf(nodeId) % PALETTE.length] : 'var(--da-muted)';

  /** Halka değişikliğini uygular ve iki yöntemle taşınan anahtarları karşılaştırır */
  const apply = (next: HashRing, label: string) => {
    onInteract();
    const c = movedKeys(ring, next, keys);
    const m = modHashMoved(ring.nodes, next.nodes, keys);
    const movedSet = new Set(
      keys.filter((k) => locateKey(ring, k).owner !== locateKey(next, k).owner),
    );
    setChange({ label, consistent: c, mod: m, movedSet });
    setRing(next);
  };

  const addNode = () => {
    const id = ALL_NODES.find((n) => !ring.nodes.includes(n));
    if (id) apply(addRingNode(ring, id), `+ ${id}`);
  };
  const removeNode = (id: string) => {
    if (ring.nodes.length <= 1) return;
    apply(removeRingNode(ring, id), `− ${id}`);
  };

  const dist = ringDistribution(ring, keys);
  const ideal = keys.length / Math.max(1, ring.nodes.length);
  const maxCount = Math.max(1, ...Object.values(dist));
  // Çok fazla sanal düğümde görsel sadeleştirme: noktalar küçülür
  const pointR = ring.points.length > 120 ? 2.5 : ring.points.length > 40 ? 4 : 6;

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button
            type="button"
            className="btn-primary"
            onClick={addNode}
            disabled={ring.nodes.length >= ALL_NODES.length}
          >
            <Plus size={14} /> {l.addNode}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => removeNode(ring.nodes[ring.nodes.length - 1])}
            disabled={ring.nodes.length <= 1}
          >
            <Minus size={14} /> {l.removeNode}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setChange(null);
              setRing(createRing(ALL_NODES.slice(0, 3), ring.virtualNodes));
            }}
          >
            <RotateCcw size={14} /> {t('sim.reset')}
          </button>
        </>
      }
      aside={
        <>
          <Range
            label={t('sim.vnodes')}
            value={ring.virtualNodes}
            min={1}
            max={100}
            onChange={(v) => {
              onInteract();
              setChange(null);
              setRing(createRing(ring.nodes, v));
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t('sim.nodes')} value={ring.nodes.length} />
            <Stat label={l.keys} value={keys.length} />
          </div>
          <div
            aria-live="polite"
            className="rounded-xl border border-border bg-elevated/40 p-3 text-sm"
          >
            <p className="label">
              {l.lastChange}
              {change ? ` (${change.label})` : ''}
            </p>
            {change ? (
              <div className="space-y-2">
                {[
                  { name: l.consistent, v: change.consistent, tone: 'var(--da-success)' },
                  { name: l.modN, v: change.mod, tone: 'var(--da-danger)' },
                ].map((row) => (
                  <div key={row.name}>
                    <div className="flex justify-between text-xs">
                      <span>{row.name}</span>
                      <span className="tabular-nums">
                        {row.v.moved}/{keys.length} ({(row.v.ratio * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <svg viewBox="0 0 100 6" className="h-2 w-full" aria-hidden>
                      <rect width={100} height={6} rx={3} fill="var(--da-elevated)" />
                      <rect width={100 * row.v.ratio} height={6} rx={3} fill={row.tone} />
                    </svg>
                  </div>
                ))}
                <p className="text-xs text-muted">{l.movedHint}</p>
              </div>
            ) : (
              <p className="text-xs text-muted">{l.noChange}</p>
            )}
          </div>
          <div>
            <p className="label">{l.perNode}</p>
            <svg
              viewBox={`0 0 260 ${ring.nodes.length * 22 + 6}`}
              className="h-auto w-full"
              role="img"
              aria-label={l.perNode}
            >
              {ring.nodes.map((n, i) => (
                <g key={n} transform={`translate(0, ${i * 22})`}>
                  <text x={0} y={14} fontSize={10} fill="var(--da-fg)">
                    {n}
                  </text>
                  <rect x={56} y={4} width={170} height={12} rx={4} fill="var(--da-elevated)" />
                  <motion.rect
                    x={56}
                    y={4}
                    height={12}
                    rx={4}
                    fill={colorOf(n)}
                    animate={{ width: (170 * (dist[n] ?? 0)) / maxCount }}
                    transition={{ duration: reduced ? 0 : 0.4 }}
                  />
                  <text x={230} y={14} fontSize={10} fill="var(--da-muted)">
                    {dist[n] ?? 0}
                  </text>
                </g>
              ))}
              {/* İdeal pay çizgisi */}
              <line
                x1={56 + (170 * ideal) / maxCount}
                x2={56 + (170 * ideal) / maxCount}
                y1={0}
                y2={ring.nodes.length * 22}
                stroke="var(--da-fg)"
                strokeDasharray="2 2"
                opacity={0.5}
              />
            </svg>
            <p className="text-[11px] text-muted">
              ┆ {l.ideal} ≈ {ideal.toFixed(1)}
            </p>
          </div>
        </>
      }
    >
      <p className="mb-2 text-sm text-muted">{l.hint}</p>
      <svg
        viewBox="0 0 400 400"
        className="mx-auto h-auto w-full max-w-md"
        role="img"
        aria-label={l.title}
      >
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--da-border)" strokeWidth={10} />
        {/* Sahiplik yayları: her noktadan önceki noktaya kadar */}
        {ring.points.map((p, i) => {
          const prev = ring.points[(i - 1 + ring.points.length) % ring.points.length];
          const start = polar(prev.position, R);
          const end = polar(p.position, R);
          let span = p.position - prev.position;
          if (span <= 0) span += RING_SIZE;
          const large = span > RING_SIZE / 2 ? 1 : 0;
          if (ring.points.length === 1)
            return (
              <circle
                key={`${p.nodeId}-${p.vnodeIndex}`}
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke={colorOf(p.nodeId)}
                strokeWidth={10}
                opacity={0.35}
              />
            );
          return (
            <path
              key={`${p.nodeId}-${p.vnodeIndex}`}
              d={`M ${start.x} ${start.y} A ${R} ${R} 0 ${large} 1 ${end.x} ${end.y}`}
              fill="none"
              stroke={colorOf(p.nodeId)}
              strokeWidth={10}
              opacity={0.35}
            />
          );
        })}
        {/* Anahtarlar */}
        {keys.map((k) => {
          const loc = locateKey(ring, k);
          const pos = polar(loc.position, R - 26);
          const moved = change?.movedSet.has(k);
          return (
            <g key={k}>
              <title>{`${k} → ${loc.owner}`}</title>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={3.5}
                fill={colorOf(loc.owner)}
                style={{ transition: reduced ? 'none' : 'fill 0.5s' }}
              />
              {moved && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={6}
                  fill="none"
                  stroke="var(--da-danger)"
                  strokeWidth={1.2}
                />
              )}
            </g>
          );
        })}
        {/* Düğüm noktaları (sanal düğümler dahil) */}
        {ring.points.map((p) => {
          const pos = polar(p.position, R);
          return (
            <g key={`pt-${p.nodeId}-${p.vnodeIndex}`}>
              <title>{`${p.nodeId}#${p.vnodeIndex} @ ${p.position.toFixed(1)}°`}</title>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={pointR}
                fill={colorOf(p.nodeId)}
                stroke="var(--da-surface)"
                strokeWidth={1.5}
                className="cursor-pointer"
                role="button"
                tabIndex={ring.points.length <= 40 ? 0 : -1}
                aria-label={`${l.removeNode}: ${p.nodeId}`}
                onClick={() => removeNode(p.nodeId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') removeNode(p.nodeId);
                }}
              />
            </g>
          );
        })}
        <text
          x={CX}
          y={CY - 6}
          textAnchor="middle"
          fontSize={14}
          fontWeight={600}
          fill="var(--da-fg)"
        >
          {ring.nodes.length} {t('sim.nodes').toLowerCase()}
        </text>
        <text x={CX} y={CY + 14} textAnchor="middle" fontSize={11} fill="var(--da-muted)">
          {ring.points.length} vnode · {keys.length} key
        </text>
        {/* Lejant */}
        {ring.nodes.map((n, i) => (
          <g
            key={n}
            transform={`translate(${8 + (i % 4) * 98}, ${378 + Math.floor(i / 4) * -372})`}
          >
            <circle cx={5} cy={5} r={5} fill={colorOf(n)} />
            <text x={14} y={9} fontSize={10} fill="var(--da-fg)">
              {n}
            </text>
          </g>
        ))}
      </svg>
    </SimShell>
  );
}
