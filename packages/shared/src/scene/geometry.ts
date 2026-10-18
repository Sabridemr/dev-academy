import type { AnimationScene, SceneEdge, SceneNode } from './schema';

/**
 * Düğüm boyutları ve kenar geometrisi; her iki platform da aynı hesaplamayı kullanır
 * böylece paketler aynı yolda hareket eder.
 */

export const DEFAULT_NODE_SIZE: Record<string, { w: number; h: number }> = {
  group: { w: 300, h: 200 },
  region: { w: 320, h: 220 },
  zone: { w: 220, h: 160 },
  user: { w: 72, h: 72 },
  client: { w: 90, h: 60 },
  browser: { w: 100, h: 64 },
  mobile: { w: 56, h: 88 },
  neuron: { w: 44, h: 44 },
  generic: { w: 110, h: 60 },
};

export function nodeSize(node: SceneNode): { w: number; h: number } {
  const def = DEFAULT_NODE_SIZE[node.kind] ?? DEFAULT_NODE_SIZE.generic;
  return { w: node.w ?? def.w, h: node.h ?? def.h };
}

export interface Point {
  x: number;
  y: number;
}

/** Düğüm merkezinden hedefe doğru sınır üzerindeki kesişim noktası (dikdörtgen kabulüyle) */
export function boundaryPoint(node: SceneNode, toward: Point): Point {
  const { w, h } = nodeSize(node);
  const dx = toward.x - node.x;
  const dy = toward.y - node.y;
  if (dx === 0 && dy === 0) return { x: node.x, y: node.y };
  const hw = w / 2;
  const hh = h / 2;
  const scaleX = dx !== 0 ? hw / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const scaleY = dy !== 0 ? hh / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const s = Math.min(scaleX, scaleY);
  return { x: node.x + dx * s, y: node.y + dy * s };
}

export interface EdgeGeometry {
  start: Point;
  end: Point;
  control: Point;
  /** SVG path verisi (quadratic Bézier) */
  path: string;
  /** Etiket konumu */
  mid: Point;
}

export function edgeGeometry(scene: AnimationScene, edge: SceneEdge): EdgeGeometry | null {
  const from = scene.nodes.find((n) => n.id === edge.from);
  const to = scene.nodes.find((n) => n.id === edge.to);
  if (!from || !to) return null;
  const start = boundaryPoint(from, to);
  const end = boundaryPoint(to, from);
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  // Normal vektör yönünde eğrilik uygula
  const nx = -dy / len;
  const ny = dx / len;
  const offset = edge.curvature * len * 0.35;
  const control = { x: mx + nx * offset, y: my + ny * offset };
  const mid = pointOnQuadratic(start, control, end, 0.5);
  const path = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
  return { start, end, control, path, mid };
}

export function pointOnQuadratic(p0: Point, p1: Point, p2: Point, tt: number): Point {
  const mt = 1 - tt;
  return {
    x: mt * mt * p0.x + 2 * mt * tt * p1.x + tt * tt * p2.x,
    y: mt * mt * p0.y + 2 * mt * tt * p1.y + tt * tt * p2.y,
  };
}

/** Paketin kenar üzerindeki konumu; backward yönünde t tersine çevrilir */
export function packetPosition(
  geom: EdgeGeometry,
  progress: number,
  direction: 'forward' | 'backward',
): Point {
  const tt = direction === 'forward' ? progress : 1 - progress;
  return pointOnQuadratic(geom.start, geom.control, geom.end, Math.max(0, Math.min(1, tt)));
}

/** Kolay ease-in-out; paket hareketini yumuşatmak için */
export function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/* ------------------------------------------------------------------ */
/* Yerleşim yardımcıları: iki platform da aynı kuralları kullanır      */
/* ------------------------------------------------------------------ */

/** Yaklaşık karakter genişliği (px) — Inter/system font, verilen punto için */
export function approxCharWidth(fontSize: number): number {
  return fontSize * 0.56;
}

/** Metni verilen piksel genişliğine sığacak şekilde '…' ile kısaltır */
export function truncateToWidth(text: string, maxWidth: number, fontSize: number): string {
  const maxChars = Math.max(3, Math.floor(maxWidth / approxCharWidth(fontSize)));
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

export interface NodeTextLayout {
  showIcon: boolean;
  /** true ise ikon düğümün dikey ortasında (metin altta) */
  iconCentered: boolean;
  iconSize: number;
  label: string;
  sublabel: string;
  labelFontSize: number;
  sublabelFontSize: number;
  /** Düğüm merkezine göre dikey ofsetler */
  labelDy: number;
  sublabelDy: number;
}

/**
 * Düğüm içi metin/ikon yerleşimi. Küçük düğümlerde ikon gizlenir ki etiketin üstüne binmesin;
 * etiketler kutu genişliğine göre kısaltılır. Yuvarlak düğümlerde (user, neuron) metin kutunun altındadır.
 */
export function nodeTextLayout(node: SceneNode, label: string, sublabel: string): NodeTextLayout {
  const { w, h } = nodeSize(node);
  const isRound = node.kind === 'neuron' || node.kind === 'user';
  const labelFontSize = node.kind === 'neuron' ? 11 : 13;
  const sublabelFontSize = 10.5;
  // Dar düğümlerde (telefon simgesi gibi) metin kutunun altına yazılır, kısaltılmaz
  const labelBelow = isRound || w < 80;
  if (labelBelow) {
    return {
      showIcon: node.kind !== 'neuron',
      iconCentered: true,
      iconSize: Math.min(24, h * 0.42, w * 0.5),
      label: node.kind === 'neuron' ? truncateToWidth(label, w - 6, labelFontSize) : label,
      sublabel,
      labelFontSize,
      sublabelFontSize,
      labelDy: node.kind === 'neuron' ? 4 : h / 2 + 16,
      sublabelDy: h / 2 + 30,
    };
  }
  const hasSub = sublabel.length > 0;
  // İkon (7 + boyut) + etiket satırı (16) + alt etiket (14) için gereken yükseklik
  const iconSize = Math.min(24, Math.max(14, h * 0.42));
  const needed = 7 + iconSize + 16 + (hasSub ? 14 : 0) + 4;
  const showIcon = h >= needed;
  const labelDy = showIcon ? h / 2 - (hasSub ? 22 : 10) : hasSub ? -2 : 5;
  const sublabelDy = showIcon ? h / 2 - 8 : 12;
  return {
    showIcon,
    iconCentered: false,
    iconSize,
    label: truncateToWidth(label, w - 14, labelFontSize),
    sublabel: truncateToWidth(sublabel, w - 12, sublabelFontSize),
    labelFontSize,
    sublabelFontSize,
    labelDy,
    sublabelDy,
  };
}

export interface AnnotationBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Not kutusunu tuval sınırları içinde tutar (kenarda kesilmesin) */
export function annotationBox(
  scene: AnimationScene,
  a: { x: number; y: number },
  text: string,
): AnnotationBox {
  const h = 28;
  const w = Math.min(scene.canvas.width - 16, Math.max(80, text.length * approxCharWidth(12) + 24));
  const x = Math.min(scene.canvas.width - w / 2 - 8, Math.max(w / 2 + 8, a.x));
  const y = Math.min(scene.canvas.height - h / 2 - 4, Math.max(h / 2 + 4, a.y));
  return { x, y, w, h };
}

export interface BadgeBox {
  text: string;
  w: number;
  h: number;
  /** Düğümün sağ üst köşesine göre merkez */
  cx: number;
  cy: number;
}

/** Rozet: 1–2 karakter daire, daha uzunu hap biçiminde; en fazla 12 karakter */
export function badgeBox(node: SceneNode, raw: string): BadgeBox {
  const { w, h } = nodeSize(node);
  const text = raw.length > 12 ? `${raw.slice(0, 11)}…` : raw;
  const bw = text.length <= 2 ? 26 : Math.ceil(text.length * approxCharWidth(10.5)) + 14;
  return {
    text,
    w: bw,
    h: 22,
    cx: node.x + w / 2 - Math.max(4, bw / 2 - 9),
    cy: node.y - h / 2 + 4,
  };
}
