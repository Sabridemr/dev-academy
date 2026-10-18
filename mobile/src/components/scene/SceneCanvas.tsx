import { memo, useEffect, useMemo, useRef, useState } from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  computePackets,
  easeInOutCubic,
  edgeGeometry,
  nodeSize,
  packetPosition,
  type AnimationScene,
  type EdgeGeometry,
  type NodeStatus,
  type ResolvedStepView,
  type SceneNode,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { resolveThemeColor, useTheme, type ThemeColors } from '@/theme';
import { NODE_ICON_PATHS, type IconElement } from './nodeIcons';
import { sceneThemeColors, statusColors, type StatusColor } from './sceneColors';

/**
 * MOBİL SAHNE ÇİZİMİ (react-native-svg + Reanimated)
 * ---------------------------------------------------
 * Durum hesaplaması tamamen @devacademy/shared içinde (resolveStepView, computePackets,
 * edgeGeometry); bu bileşen yalnızca görselleştirir — web SceneCanvas ile aynı geometri.
 * - Düğüm durum geçişleri (renk, kenar kalınlığı, opaklık, doluluk) Reanimated animatedProps ile
 * - Paket konumları oynatıcının elapsedMs değerinden her karede hesaplanır
 * - Kamera (step.camera) viewBox'ı yumuşak bir geçişle değiştirir
 * - Ölçek: Svg genişliği ekran genişliği, yükseklik canvas en-boy oranından
 */

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

interface Props {
  scene: AnimationScene;
  view: ResolvedStepView;
  elapsedMs: number;
  reducedMotion: boolean;
  /** Piksel cinsinden çizim genişliği */
  width: number;
}

type ViewBox = { x: number; y: number; w: number; h: number };

function targetViewBox(scene: AnimationScene, view: ResolvedStepView): ViewBox {
  const { width, height } = scene.canvas;
  const cam = view.step.camera;
  if (!cam) return { x: 0, y: 0, w: width, h: height };
  return { x: cam.x - width / (2 * cam.zoom), y: cam.y - height / (2 * cam.zoom), w: width / cam.zoom, h: height / cam.zoom };
}

/** Kamera geçişi: viewBox değerlerini 350 ms boyunca enterpole eder (reduced-motion'da anında) */
function useCameraTween(target: ViewBox, reducedMotion: boolean): ViewBox {
  const [current, setCurrent] = useState(target);
  const currentRef = useRef(target);
  const key = `${target.x}|${target.y}|${target.w}|${target.h}`;
  useEffect(() => {
    const from = currentRef.current;
    if (reducedMotion) {
      currentRef.current = target;
      setCurrent(target);
      return;
    }
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / 350);
      const e = easeInOutCubic(p);
      const next = {
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        w: from.w + (target.w - from.w) * e,
        h: from.h + (target.h - from.h) * e,
      };
      currentRef.current = next;
      setCurrent(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // target nesnesi her render'da yeniden oluşur; anahtar üzerinden izlenir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reducedMotion]);
  return current;
}

/** Ok başı: kenarın uç noktasında teğet yönünde küçük üçgen (Marker yerine — platformlar arası tutarlı) */
function arrowHead(tip: { x: number; y: number }, from: { x: number; y: number }, size = 9): string {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const a1 = angle + Math.PI - 0.45;
  const a2 = angle + Math.PI + 0.45;
  return `M ${tip.x} ${tip.y} L ${tip.x + size * Math.cos(a1)} ${tip.y + size * Math.sin(a1)} L ${tip.x + size * Math.cos(a2)} ${tip.y + size * Math.sin(a2)} Z`;
}

export const SceneCanvas = memo(function SceneCanvas({ scene, view, elapsedMs, reducedMotion, width }: Props) {
  const { tl } = useI18n();
  const theme = useTheme();
  const colors = useMemo(
    () => sceneThemeColors(theme.colors, theme.scheme === 'dark' ? scene.theme?.dark : scene.theme?.light),
    [theme, scene.theme],
  );
  const statusPalette = useMemo(() => statusColors(colors), [colors]);
  const vb = useCameraTween(targetViewBox(scene, view), reducedMotion);
  const height = (width * scene.canvas.height) / scene.canvas.width;
  const duration = reducedMotion ? 0 : 350;

  const geometries = useMemo(() => new Map<string, EdgeGeometry | null>(scene.edges.map((e) => [e.id, edgeGeometry(scene, e)])), [scene]);
  const packets = computePackets(view.step, elapsedMs, reducedMotion);
  const groups = scene.nodes.filter((n) => n.kind === 'group' || n.kind === 'region' || n.kind === 'zone');
  const others = scene.nodes.filter((n) => !groups.includes(n));

  if (width <= 0) return null;

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={tl(scene.a11y.description)}
      testID="scene-canvas"
    >
      {groups.map((n) => {
        const v = view.nodes[n.id];
        if (v?.visible === false) return null;
        const { w, h } = nodeSize(n);
        const color = resolveThemeColor(n.color, colors, colors.muted);
        return (
          <G key={n.id} opacity={v?.status === 'muted' ? 0.4 : 1}>
            <Rect x={n.x - w / 2} y={n.y - h / 2} width={w} height={h} rx={18} fill="none" stroke={v?.highlighted ? colors.primary : color} strokeDasharray="6 6" strokeWidth={v?.highlighted ? 2.5 : 1.5} />
            <SvgText x={n.x - w / 2 + 14} y={n.y - h / 2 + 20} fontSize={12} fill={color} fontWeight="600">
              {tl(v?.labelOverride ?? n.label)}
            </SvgText>
          </G>
        );
      })}

      {/* Kenarlar */}
      {scene.edges.map((e) => {
        const g = geometries.get(e.id);
        const ev = view.edges[e.id];
        if (!g || ev?.visible === false) return null;
        if (view.nodes[e.from]?.visible === false || view.nodes[e.to]?.visible === false) return null;
        const status = ev?.status ?? 'idle';
        const highlighted = Boolean(ev?.highlighted);
        const stroke = status === 'error' ? colors.danger : highlighted || status === 'active' ? colors.primary : status === 'muted' ? colors.border : colors.muted;
        const dash = e.style === 'dashed' ? '8 6' : e.style === 'dotted' ? '2 5' : undefined;
        const label = ev?.labelOverride !== undefined ? tl(ev.labelOverride) : e.label ? tl(e.label) : '';
        return (
          <G key={e.id} opacity={status === 'muted' ? 0.35 : 1}>
            <Path d={g.path} fill="none" stroke={stroke} strokeWidth={highlighted ? 3 : 1.6} strokeDasharray={dash} />
            <Path d={arrowHead(g.end, g.control)} fill={stroke} />
            {e.bidirectional ? <Path d={arrowHead(g.start, g.control)} fill={stroke} /> : null}
            {label ? <HaloText x={g.mid.x} y={g.mid.y - 8} size={12} color={colors.muted} halo={colors.bg} text={label} /> : null}
          </G>
        );
      })}

      {/* Düğümler */}
      {others.map((n) => {
        const v = view.nodes[n.id];
        const sub = v?.sublabelOverride !== undefined ? tl(v.sublabelOverride) : n.sublabel ? tl(n.sublabel) : '';
        return (
          <SceneNodeView
            key={n.id}
            node={n}
            status={v?.status ?? n.status}
            visible={v?.visible !== false}
            highlighted={Boolean(v?.highlighted)}
            badge={v?.badge ?? (v?.counter !== undefined ? String(v.counter) : undefined)}
            progress={v?.progress}
            label={tl(v?.labelOverride ?? n.label)}
            sublabel={sub}
            colors={colors}
            palette={statusPalette}
            duration={duration}
          />
        );
      })}

      {/* Paketler */}
      {packets.map((p) => {
        if (p.progress === null) return null;
        const g = geometries.get(p.edgeId);
        if (!g) return null;
        const pos = packetPosition(g, reducedMotion ? p.progress : easeInOutCubic(p.progress), p.direction);
        const color = resolveThemeColor(p.color, colors, colors.accent);
        return (
          <G key={p.key} x={pos.x} y={pos.y} testID="scene-packet">
            <PacketShape shape={p.shape} color={color} border={colors.surface} />
            {p.label ? <HaloText x={0} y={-13} size={11} weight="600" color={colors.fg} halo={colors.bg} text={tl(p.label)} /> : null}
          </G>
        );
      })}

      {/* Notlar */}
      {view.step.annotations.map((a) => {
        const target = a.target ? scene.nodes.find((n) => n.id === a.target) : undefined;
        const color = a.tone === 'danger' ? colors.danger : a.tone === 'warning' ? colors.warning : a.tone === 'success' ? colors.success : colors.primary;
        const text = tl(a.text);
        const w = Math.max(80, text.length * 7 + 24);
        return (
          <G key={a.id}>
            {target ? <Line x1={a.x} y1={a.y} x2={target.x} y2={target.y} stroke={color} strokeDasharray="3 3" strokeWidth={1.2} /> : null}
            <Rect x={a.x - w / 2} y={a.y - 14} width={w} height={28} rx={8} fill={colors.surface} stroke={color} strokeWidth={1.5} />
            <SvgText x={a.x} y={a.y + 4} textAnchor="middle" fontSize={12} fill={color} fontWeight="600">
              {text}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
});

/** paint-order desteklenmediği için önce arka plan renginde kalın kontur, sonra metin çizilir */
function HaloText({ x, y, size, color, halo, text, weight }: { x: number; y: number; size: number; color: string; halo: string; text: string; weight?: '600' | '700' }) {
  return (
    <G>
      <SvgText x={x} y={y} textAnchor="middle" fontSize={size} fontWeight={weight} fill={halo} stroke={halo} strokeWidth={4} strokeLinejoin="round">
        {text}
      </SvgText>
      <SvgText x={x} y={y} textAnchor="middle" fontSize={size} fontWeight={weight} fill={color}>
        {text}
      </SvgText>
    </G>
  );
}

function PacketShape({ shape, color, border }: { shape: string; color: string; border: string }) {
  switch (shape) {
    case 'envelope':
      return (
        <G>
          <Rect x={-10} y={-7} width={20} height={14} rx={2} fill={color} stroke={border} strokeWidth={1.5} />
          <Path d="M -10 -7 L 0 1 L 10 -7" fill="none" stroke={border} strokeWidth={1.5} />
        </G>
      );
    case 'square':
      return <Rect x={-7} y={-7} width={14} height={14} rx={2} fill={color} stroke={border} strokeWidth={1.5} />;
    case 'diamond':
      return <Path d="M 0 -9 L 9 0 L 0 9 L -9 0 z" fill={color} stroke={border} strokeWidth={1.5} />;
    default:
      return <Circle r={7} fill={color} stroke={border} strokeWidth={2} />;
  }
}

function NodeIcon({ elements, x, y, size, color }: { elements: IconElement[]; x: number; y: number; size: number; color: string }) {
  const s = size / 24;
  const common = { stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      {elements.map((el, i) => {
        switch (el[0]) {
          case 'path':
            return <Path key={i} d={el[1].d} {...common} />;
          case 'circle':
            return <Circle key={i} cx={el[1].cx} cy={el[1].cy} r={el[1].r} {...common} />;
          case 'rect':
            return <Rect key={i} x={el[1].x} y={el[1].y} width={el[1].width} height={el[1].height} rx={el[1].rx} ry={el[1].ry} {...common} />;
          case 'line':
            return <Line key={i} x1={el[1].x1} y1={el[1].y1} x2={el[1].x2} y2={el[1].y2} {...common} />;
          case 'ellipse':
            return <Ellipse key={i} cx={el[1].cx} cy={el[1].cy} rx={el[1].rx} ry={el[1].ry} {...common} />;
          default:
            return null;
        }
      })}
    </G>
  );
}

interface NodeViewProps {
  node: SceneNode;
  status: NodeStatus;
  visible: boolean;
  highlighted: boolean;
  badge?: string;
  progress?: number;
  label: string;
  sublabel: string;
  colors: ThemeColors & Record<string, string>;
  palette: Record<NodeStatus, StatusColor>;
  duration: number;
}

/**
 * Tek bir düğüm. Durum değiştiğinde dolgu/kontur rengi, kenar kalınlığı, opaklık ve doluluk
 * çubuğu Reanimated withTiming ile UI thread'de canlandırılır (paket karelerinde yeniden çizilmez — memo).
 */
const SceneNodeView = memo(function SceneNodeView({ node, status, visible, highlighted, badge, progress, label, sublabel, colors, palette, duration }: NodeViewProps) {
  const { w, h } = nodeSize(node);
  const sc = palette[status] ?? palette.idle;
  const isRound = node.kind === 'neuron' || node.kind === 'user';
  const accent = node.color ? resolveThemeColor(node.color, colors) : undefined;
  const strokeTarget = highlighted ? colors.primary : accent ?? sc.stroke;
  const iconSize = Math.min(24, h * 0.42);
  const barWidth = w - 16;
  const barTarget = progress !== undefined ? barWidth * progress : 0;
  const barColor = progress !== undefined ? (progress > 0.85 ? colors.danger : progress > 0.6 ? colors.warning : colors.success) : colors.success;

  const fill = useSharedValue(sc.fill);
  const stroke = useSharedValue(strokeTarget);
  const strokeWidth = useSharedValue(highlighted ? 3 : 1.6);
  const opacity = useSharedValue(visible ? (status === 'muted' ? 0.55 : 1) : 0);
  const barW = useSharedValue(barTarget);
  const barFill = useSharedValue(barColor);

  useEffect(() => {
    const cfg = { duration };
    fill.value = withTiming(sc.fill, cfg);
    stroke.value = withTiming(strokeTarget, cfg);
    strokeWidth.value = withTiming(highlighted ? 3 : 1.6, cfg);
    opacity.value = withTiming(visible ? (status === 'muted' ? 0.55 : 1) : 0, cfg);
    barW.value = withTiming(barTarget, cfg);
    barFill.value = withTiming(barColor, cfg);
  }, [sc.fill, strokeTarget, highlighted, visible, status, barTarget, barColor, duration, fill, stroke, strokeWidth, opacity, barW, barFill]);

  const shapeProps = useAnimatedProps(() => ({ fill: fill.value, stroke: stroke.value, strokeWidth: strokeWidth.value }));
  const groupProps = useAnimatedProps(() => ({ opacity: opacity.value }));
  const barProps = useAnimatedProps(() => ({ width: barW.value, fill: barFill.value }));

  const iconColor = status === 'down' || status === 'error' ? colors.danger : accent ?? colors.primary;
  const a11y = `${label}${sublabel ? `, ${sublabel}` : ''}${badge ? `, ${badge}` : ''}`;

  return (
    <AnimatedG animatedProps={groupProps} accessibilityLabel={a11y}>
      {highlighted ? (
        isRound ? (
          <Circle cx={node.x} cy={node.y} r={Math.min(w, h) / 2 + 6} fill="none" stroke={colors.primary} strokeOpacity={0.25} strokeWidth={8} />
        ) : (
          <Rect x={node.x - w / 2 - 4} y={node.y - h / 2 - 4} width={w + 8} height={h + 8} rx={15} fill="none" stroke={colors.primary} strokeOpacity={0.25} strokeWidth={8} />
        )
      ) : null}
      {isRound ? (
        <AnimatedCircle cx={node.x} cy={node.y} r={Math.min(w, h) / 2} animatedProps={shapeProps} />
      ) : (
        <AnimatedRect x={node.x - w / 2} y={node.y - h / 2} width={w} height={h} rx={12} animatedProps={shapeProps} />
      )}

      {node.kind !== 'neuron' ? (
        <NodeIcon elements={NODE_ICON_PATHS[node.kind] ?? NODE_ICON_PATHS.generic} x={node.x - iconSize / 2} y={isRound ? node.y - iconSize / 2 : node.y - h / 2 + 7} size={iconSize} color={iconColor} />
      ) : null}

      <SvgText
        x={node.x}
        y={isRound ? node.y + h / 2 + 16 : node.y + (node.kind === 'neuron' ? 4 : h / 2 - (sublabel ? 22 : 10))}
        textAnchor="middle"
        fontSize={node.kind === 'neuron' ? 11 : 13}
        fontWeight="600"
        fill={colors.fg}
      >
        {label}
      </SvgText>
      {sublabel ? (
        <SvgText x={node.x} y={isRound ? node.y + h / 2 + 30 : node.y + h / 2 - 8} textAnchor="middle" fontSize={10.5} fill={colors.muted}>
          {sublabel}
        </SvgText>
      ) : null}

      {progress !== undefined && !isRound ? (
        <G>
          <Rect x={node.x - w / 2 + 8} y={node.y + h / 2 + 6} width={barWidth} height={6} rx={3} fill={colors.elevated} />
          <AnimatedRect x={node.x - w / 2 + 8} y={node.y + h / 2 + 6} height={6} rx={3} animatedProps={barProps} />
        </G>
      ) : null}

      {badge ? (
        <G>
          <Circle cx={node.x + w / 2 - 4} cy={node.y - h / 2 + 4} r={13} fill={status === 'down' || status === 'error' ? colors.danger : colors.accent} />
          <SvgText x={node.x + w / 2 - 4} y={node.y - h / 2 + 8} textAnchor="middle" fontSize={10.5} fontWeight="700" fill="#FFFFFF">
            {badge.slice(0, 4)}
          </SvgText>
        </G>
      ) : null}
    </AnimatedG>
  );
});
