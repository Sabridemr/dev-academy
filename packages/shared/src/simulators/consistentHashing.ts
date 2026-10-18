import { hashString } from './loadBalancer';

/**
 * CONSISTENT HASHING HALKASI (saf mantık)
 * ---------------------------------------
 * Sanal düğümlerle halka; anahtar → sorumlu düğüm; düğüm ekleme/çıkarma sonrası
 * kaç anahtarın yer değiştirdiğini hesaplar.
 */

export const RING_SIZE = 360; // derece cinsinden; UI doğrudan açı olarak kullanır

export interface RingPoint {
  /** 0..RING_SIZE arası konum */
  position: number;
  nodeId: string;
  vnodeIndex: number;
}

export interface HashRing {
  nodes: string[];
  virtualNodes: number;
  points: RingPoint[];
}

export function hashToRing(value: string): number {
  return (hashString(value) % 100000) / 100000 * RING_SIZE;
}

export function createRing(nodes: string[], virtualNodes = 3): HashRing {
  const points: RingPoint[] = [];
  for (const nodeId of nodes) {
    for (let v = 0; v < virtualNodes; v++) {
      points.push({ position: hashToRing(`${nodeId}#${v}`), nodeId, vnodeIndex: v });
    }
  }
  points.sort((a, b) => a.position - b.position);
  return { nodes: [...nodes], virtualNodes, points };
}

/** Anahtarın halka üzerindeki konumu ve saat yönünde ilk düğüm */
export function locateKey(ring: HashRing, key: string): { position: number; owner: string | null; point: RingPoint | null } {
  const position = hashToRing(key);
  if (ring.points.length === 0) return { position, owner: null, point: null };
  const point = ring.points.find((p) => p.position >= position) ?? ring.points[0];
  return { position, owner: point.nodeId, point };
}

export function addRingNode(ring: HashRing, nodeId: string): HashRing {
  if (ring.nodes.includes(nodeId)) return ring;
  return createRing([...ring.nodes, nodeId], ring.virtualNodes);
}

export function removeRingNode(ring: HashRing, nodeId: string): HashRing {
  return createRing(ring.nodes.filter((n) => n !== nodeId), ring.virtualNodes);
}

/** Her düğüme düşen anahtar sayısı */
export function ringDistribution(ring: HashRing, keys: string[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(ring.nodes.map((n) => [n, 0]));
  for (const k of keys) {
    const { owner } = locateKey(ring, k);
    if (owner) out[owner] = (out[owner] ?? 0) + 1;
  }
  return out;
}

/** İki halka arasında kaç anahtar sahibini değiştirdi */
export function movedKeys(before: HashRing, after: HashRing, keys: string[]): { moved: number; total: number; ratio: number } {
  let moved = 0;
  for (const k of keys) {
    if (locateKey(before, k).owner !== locateKey(after, k).owner) moved += 1;
  }
  return { moved, total: keys.length, ratio: keys.length ? moved / keys.length : 0 };
}

/** Karşılaştırma için klasik mod-N hashing */
export function modHashOwner(nodes: string[], key: string): string | null {
  if (nodes.length === 0) return null;
  return nodes[hashString(key) % nodes.length];
}

export function modHashMoved(beforeNodes: string[], afterNodes: string[], keys: string[]): { moved: number; total: number; ratio: number } {
  let moved = 0;
  for (const k of keys) if (modHashOwner(beforeNodes, k) !== modHashOwner(afterNodes, k)) moved += 1;
  return { moved, total: keys.length, ratio: keys.length ? moved / keys.length : 0 };
}

export function generateKeys(count: number, prefix = 'user'): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}:${i + 1}`);
}
