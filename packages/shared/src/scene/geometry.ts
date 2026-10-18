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
export function packetPosition(geom: EdgeGeometry, progress: number, direction: 'forward' | 'backward'): Point {
  const tt = direction === 'forward' ? progress : 1 - progress;
  return pointOnQuadratic(geom.start, geom.control, geom.end, Math.max(0, Math.min(1, tt)));
}

/** Kolay ease-in-out; paket hareketini yumuşatmak için */
export function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
