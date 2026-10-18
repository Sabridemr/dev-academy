'use client';

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  annotationBox,
  badgeBox,
  computePackets,
  nodeTextLayout,
  truncateToWidth,
  edgeGeometry,
  easeInOutCubic,
  nodeSize,
  packetPosition,
  type AnimationScene,
  type ResolvedStepView,
  type SceneNode,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { themeColor } from '@/lib/utils';
import { NODE_ICONS, STATUS_COLORS } from './node-icons';

interface Props {
  scene: AnimationScene;
  view: ResolvedStepView;
  elapsedMs: number;
  reducedMotion: boolean;
  /** Editörde düğüm seçimi için */
  onNodeClick?: (id: string) => void;
  selectedNodeId?: string | null;
}

/**
 * Sahnenin SVG çizimi. Durum hesaplaması tamamen shared paketinde; burası yalnızca görselleştirir.
 * viewBox sayesinde kapsayıcı genişliğine göre ölçeklenir; kamera adımları viewBox'ı yumuşakça değiştirir.
 */
export const SceneCanvas = memo(function SceneCanvas({ scene, view, elapsedMs, reducedMotion, onNodeClick, selectedNodeId }: Props) {
  const { tl } = useI18n();
  const { width, height } = scene.canvas;
  const cam = view.step.camera;
  const viewBox = cam ? `${cam.x - width / (2 * cam.zoom)} ${cam.y - height / (2 * cam.zoom)} ${width / cam.zoom} ${height / cam.zoom}` : `0 0 ${width} ${height}`;

  const geometries = useMemo(() => new Map(scene.edges.map((e) => [e.id, edgeGeometry(scene, e)])), [scene]);
  const packets = computePackets(view.step, elapsedMs, reducedMotion);

  // Gruplar önce (arka planda), sonra diğer düğümler
  const groups = scene.nodes.filter((n) => n.kind === 'group' || n.kind === 'region' || n.kind === 'zone');
  const others = scene.nodes.filter((n) => !groups.includes(n));
  const transition = reducedMotion ? { duration: 0 } : { duration: 0.35, ease: 'easeOut' as const };

  return (
    <motion.svg
      viewBox={viewBox}
      animate={{ viewBox }}
      transition={transition}
      className="h-auto w-full select-none"
      role="img"
      aria-label={tl(scene.a11y.description)}
      fontFamily="inherit"
    >
      <defs>
        {(['idle', 'active', 'error'] as const).map((s) => (
          <marker key={s} id={`arrow-${scene.id}-${s}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={s === 'active' ? 'var(--da-primary)' : s === 'error' ? 'var(--da-danger)' : 'var(--da-muted)'} />
          </marker>
        ))}
        <filter id={`glow-${scene.id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {groups.map((n) => (
        <GroupNode key={n.id} node={n} view={view} label={tl(view.nodes[n.id]?.labelOverride ?? n.label)} transition={transition} />
      ))}

      {/* Kenarlar */}
      {scene.edges.map((e) => {
        const g = geometries.get(e.id);
        const ev = view.edges[e.id];
        if (!g || ev?.visible === false) return null;
        const fromVisible = view.nodes[e.from]?.visible !== false;
        const toVisible = view.nodes[e.to]?.visible !== false;
        if (!fromVisible || !toVisible) return null;
        const status = ev?.status ?? 'idle';
        const highlighted = ev?.highlighted;
        const stroke = status === 'error' ? 'var(--da-danger)' : highlighted || status === 'active' ? 'var(--da-primary)' : status === 'muted' ? 'var(--da-border)' : 'var(--da-muted)';
        const markerKey = status === 'error' ? 'error' : highlighted || status === 'active' ? 'active' : 'idle';
        const dash = e.style === 'dashed' ? '8 6' : e.style === 'dotted' ? '2 5' : undefined;
        const label = ev?.labelOverride !== undefined ? tl(ev.labelOverride) : e.label ? tl(e.label) : '';
        return (
          <g key={e.id} opacity={status === 'muted' ? 0.35 : 1}>
            <motion.path
              d={g.path}
              fill="none"
              stroke={stroke}
              strokeDasharray={dash}
              markerEnd={`url(#arrow-${scene.id}-${markerKey})`}
              markerStart={e.bidirectional ? `url(#arrow-${scene.id}-${markerKey})` : undefined}
              animate={{ strokeWidth: highlighted ? 3 : 1.6, stroke }}
              transition={transition}
            />
            {label && (
              <text x={g.mid.x} y={g.mid.y - 8} textAnchor="middle" fontSize={12} fill="var(--da-muted)" paintOrder="stroke" stroke="var(--da-bg)" strokeWidth={4}>
                {label}
              </text>
            )}
          </g>
        );
      })}

      {/* Düğümler */}
      {others.map((n) => (
        <SceneNodeView
          key={n.id}
          node={n}
          view={view}
          label={tl(view.nodes[n.id]?.labelOverride ?? n.label)}
          sublabel={view.nodes[n.id]?.sublabelOverride !== undefined ? tl(view.nodes[n.id]?.sublabelOverride) : n.sublabel ? tl(n.sublabel) : ''}
          glowId={`glow-${scene.id}`}
          transition={transition}
          selected={selectedNodeId === n.id}
          onClick={onNodeClick ? () => onNodeClick(n.id) : undefined}
        />
      ))}

      {/* Paketler */}
      {packets.map((p) => {
        if (p.progress === null) return null;
        const g = geometries.get(p.edgeId);
        if (!g) return null;
        const pos = packetPosition(g, reducedMotion ? p.progress : easeInOutCubic(p.progress), p.direction);
        const color = themeColor(p.color, 'var(--da-accent)');
        return (
          <g key={p.key} transform={`translate(${pos.x} ${pos.y})`} pointerEvents="none">
            <PacketShape shape={p.shape} color={color} />
            {p.label && (
              <text y={-13} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--da-fg)" paintOrder="stroke" stroke="var(--da-bg)" strokeWidth={3}>
                {tl(p.label)}
              </text>
            )}
          </g>
        );
      })}

      {/* Notlar */}
      {view.step.annotations.map((a) => {
        const target = a.target ? scene.nodes.find((n) => n.id === a.target) : undefined;
        const color = a.tone === 'danger' ? 'var(--da-danger)' : a.tone === 'warning' ? 'var(--da-warning)' : a.tone === 'success' ? 'var(--da-success)' : 'var(--da-primary)';
        const text = tl(a.text);
        // Kutu tuval sınırları içinde tutulur; metin kutuya sığacak şekilde kısaltılır
        const box = annotationBox(scene, a, text);
        const shown = truncateToWidth(text, box.w - 16, 12);
        return (
          <motion.g key={a.id} initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
            {target && <line x1={box.x} y1={box.y} x2={target.x} y2={target.y} stroke={color} strokeDasharray="3 3" strokeWidth={1.2} />}
            <rect x={box.x - box.w / 2} y={box.y - box.h / 2} width={box.w} height={box.h} rx={8} fill="var(--da-surface)" stroke={color} strokeWidth={1.5} />
            <title>{text}</title>
            <text x={box.x} y={box.y + 4} textAnchor="middle" fontSize={12} fill={color} fontWeight={600}>
              {shown}
            </text>
          </motion.g>
        );
      })}
    </motion.svg>
  );
});

function PacketShape({ shape, color }: { shape: string; color: string }) {
  switch (shape) {
    case 'envelope':
      return (
        <g>
          <rect x={-10} y={-7} width={20} height={14} rx={2} fill={color} stroke="var(--da-surface)" strokeWidth={1.5} />
          <path d="M -10 -7 L 0 1 L 10 -7" fill="none" stroke="var(--da-surface)" strokeWidth={1.5} />
        </g>
      );
    case 'square':
      return <rect x={-7} y={-7} width={14} height={14} rx={2} fill={color} stroke="var(--da-surface)" strokeWidth={1.5} />;
    case 'diamond':
      return <path d="M 0 -9 L 9 0 L 0 9 L -9 0 z" fill={color} stroke="var(--da-surface)" strokeWidth={1.5} />;
    default:
      return <circle r={7} fill={color} stroke="var(--da-surface)" strokeWidth={2} />;
  }
}

interface NodeProps {
  node: SceneNode;
  view: ResolvedStepView;
  label: string;
  sublabel?: string;
  glowId?: string;
  transition: object;
  selected?: boolean;
  onClick?: () => void;
}

function GroupNode({ node, view, label, transition }: NodeProps) {
  const v = view.nodes[node.id];
  if (v?.visible === false) return null;
  const { w, h } = nodeSize(node);
  const color = themeColor(node.color, 'var(--da-muted)');
  return (
    <motion.g animate={{ opacity: v?.status === 'muted' ? 0.4 : 1 }} transition={transition}>
      <rect x={node.x - w / 2} y={node.y - h / 2} width={w} height={h} rx={18} fill="none" stroke={v?.highlighted ? 'var(--da-primary)' : color} strokeDasharray="6 6" strokeWidth={v?.highlighted ? 2.5 : 1.5} />
      <text x={node.x - w / 2 + 14} y={node.y - h / 2 + 20} fontSize={12} fill={color} fontWeight={600}>
        {label}
      </text>
    </motion.g>
  );
}

function SceneNodeView({ node, view, label, sublabel, glowId, transition, selected, onClick }: NodeProps) {
  const v = view.nodes[node.id];
  const visible = v?.visible !== false;
  const { w, h } = nodeSize(node);
  const status = v?.status ?? node.status;
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.idle;
  const Icon = NODE_ICONS[node.kind] ?? NODE_ICONS.generic;
  const isRound = node.kind === 'neuron' || node.kind === 'user';
  const highlighted = v?.highlighted;
  const accent = node.color ? themeColor(node.color) : undefined;
  const layout = nodeTextLayout(node, label, sublabel ?? '');
  const badgeRaw = v?.badge ? v.badge : v?.counter !== undefined ? String(v.counter) : '';
  const badge = badgeRaw ? badgeBox(node, badgeRaw) : null;

  return (
    <motion.g
      initial={false}
      animate={{ opacity: visible ? (status === 'muted' ? 0.55 : 1) : 0, scale: visible ? 1 : 0.6 }}
      transition={transition}
      style={{ transformOrigin: `${node.x}px ${node.y}px`, cursor: onClick ? 'pointer' : undefined }}
      onClick={onClick}
      aria-label={`${label}${sublabel ? `, ${sublabel}` : ''}${v?.badge ? `, ${v.badge}` : ''}`}
    >
      {isRound ? (
        <motion.circle cx={node.x} cy={node.y} r={Math.min(w, h) / 2} animate={{ fill: colors.fill, stroke: highlighted ? 'var(--da-primary)' : accent ?? colors.stroke, strokeWidth: highlighted || selected ? 3 : 1.6 }} transition={transition} filter={highlighted ? `url(#${glowId})` : undefined} />
      ) : (
        <motion.rect x={node.x - w / 2} y={node.y - h / 2} width={w} height={h} rx={12} animate={{ fill: colors.fill, stroke: highlighted ? 'var(--da-primary)' : accent ?? colors.stroke, strokeWidth: highlighted || selected ? 3 : 1.6 }} transition={transition} filter={highlighted ? `url(#${glowId})` : undefined} />
      )}
      {selected && <rect x={node.x - w / 2 - 6} y={node.y - h / 2 - 6} width={w + 12} height={h + 12} rx={16} fill="none" stroke="var(--da-accent)" strokeDasharray="4 3" />}

      {layout.showIcon && (
        <Icon x={node.x - layout.iconSize / 2} y={layout.iconCentered ? node.y - layout.iconSize / 2 : node.y - h / 2 + 7} width={layout.iconSize} height={layout.iconSize} color={status === 'down' || status === 'error' ? 'var(--da-danger)' : accent ?? 'var(--da-primary)'} strokeWidth={1.8} />
      )}
      {(layout.label !== label || layout.sublabel !== (sublabel ?? '')) && <title>{`${label}${sublabel ? ` — ${sublabel}` : ''}`}</title>}
      <text x={node.x} y={node.y + layout.labelDy} textAnchor="middle" fontSize={layout.labelFontSize} fontWeight={600} fill="var(--da-fg)">
        {layout.label}
      </text>
      {layout.sublabel && (
        <text x={node.x} y={node.y + layout.sublabelDy} textAnchor="middle" fontSize={layout.sublabelFontSize} fill="var(--da-muted)">
          {layout.sublabel}
        </text>
      )}

      {/* Doluluk çubuğu (CPU, kuyruk ...) */}
      {v?.progress !== undefined && !isRound && (
        <g>
          <rect x={node.x - w / 2 + 8} y={node.y + h / 2 + 6} width={w - 16} height={6} rx={3} fill="var(--da-elevated)" />
          <motion.rect x={node.x - w / 2 + 8} y={node.y + h / 2 + 6} height={6} rx={3} animate={{ width: (w - 16) * v.progress, fill: v.progress > 0.85 ? 'var(--da-danger)' : v.progress > 0.6 ? 'var(--da-warning)' : 'var(--da-success)' }} transition={transition} />
        </g>
      )}

      {/* Rozet / sayaç: kısa metin daire, uzun metin hap */}
      {badge && (
        <g>
          <rect x={badge.cx - badge.w / 2} y={badge.cy - badge.h / 2} width={badge.w} height={badge.h} rx={badge.h / 2} fill={status === 'down' || status === 'error' ? 'var(--da-danger)' : 'var(--da-accent)'} stroke="var(--da-surface)" strokeWidth={1.5} />
          <text x={badge.cx} y={badge.cy + 4} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#fff">
            {badge.text}
          </text>
        </g>
      )}
    </motion.g>
  );
}
