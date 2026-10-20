import { mulberry32 } from './sorting.logic';

/**
 * Graf gezintisi simülatörünün saf mantığı: seed'li deterministik graf üretimi,
 * BFS / DFS / Dijkstra adım listeleri ve yol çıkarma.
 */

export const GRAPH_ALGORITHMS = ['bfs', 'dfs', 'dijkstra'] as const;
export type GraphAlgorithm = (typeof GRAPH_ALGORITHMS)[number];

export interface GraphEdge {
  a: number;
  b: number;
  w: number;
}

export interface Graph {
  n: number;
  edges: GraphEdge[];
  /** Komşuluk listesi; komşular düğüm numarasına göre sıralı */
  adj: { to: number; w: number }[][];
}

export const nodeLabel = (i: number) => String.fromCharCode(65 + i);

/** Düğüm adı ('A', 'b', '3') → indeks; geçersizse null */
export function parseNode(v: unknown, n: number): number | null {
  let idx: number | null = null;
  if (typeof v === 'number' && Number.isInteger(v)) idx = v;
  else if (typeof v === 'string' && v.trim() !== '') {
    const s = v.trim();
    if (/^\d+$/.test(s)) idx = Number(s);
    else if (/^[a-z]$/i.test(s)) idx = s.toUpperCase().charCodeAt(0) - 65;
  }
  return idx !== null && idx >= 0 && idx < n ? idx : null;
}

/**
 * Bağlantılı graf: önce halka (i, i+1), sonra seed'e göre birkaç kiriş.
 * Ağırlıksızsa tüm ağırlıklar 1'dir.
 */
export function generateGraph(n: number, seed: number, weighted: boolean): Graph {
  const rnd = mulberry32(seed * 7919 + n);
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
  const add = (a: number, b: number) => {
    if (a === b || seen.has(key(a, b))) return;
    seen.add(key(a, b));
    edges.push({
      a: Math.min(a, b),
      b: Math.max(a, b),
      w: weighted ? 1 + Math.floor(rnd() * 9) : 1,
    });
  };
  for (let i = 0; i < n; i++) add(i, (i + 1) % n);
  const chords = Math.max(1, Math.round(n * 0.6));
  for (let k = 0, tries = 0; k < chords && tries < 200; tries++) {
    const a = Math.floor(rnd() * n);
    const b = Math.floor(rnd() * n);
    // Komşu düğümler arasında kiriş eklemeyiz (halkada zaten var)
    const d = Math.abs(a - b);
    if (d <= 1 || d === n - 1 || seen.has(key(a, b))) continue;
    add(a, b);
    k++;
  }
  const adj: Graph['adj'] = Array.from({ length: n }, () => []);
  for (const e of edges) {
    adj[e.a].push({ to: e.b, w: e.w });
    adj[e.b].push({ to: e.a, w: e.w });
  }
  for (const list of adj) list.sort((x, y) => x.to - y.to);
  return { n, edges, adj };
}

export interface FrontierItem {
  node: number;
  /** Dijkstra'da öncelik (geçici uzaklık) */
  priority?: number;
}

export interface TraversalStep {
  /** Bu adımda işlenen düğüm (ilk adımda null) */
  current: number | null;
  /** Ziyaret sırası */
  visited: number[];
  /** Kuyruk (BFS: baş solda) / yığın (DFS: tepe sağda) / öncelik kuyruğu (küçükten büyüğe) */
  frontier: FrontierItem[];
  dist: (number | null)[];
  parent: (number | null)[];
  /** Bu adımda frontier'a eklenen ya da uzaklığı güncellenen düğümler */
  touched: number[];
  found: boolean;
  done: boolean;
}

export function traverse(
  g: Graph,
  algorithm: GraphAlgorithm,
  start: number,
  target: number | null = null,
): TraversalStep[] {
  const steps: TraversalStep[] = [];
  const dist: (number | null)[] = Array(g.n).fill(null);
  const parent: (number | null)[] = Array(g.n).fill(null);
  const visited: number[] = [];
  const isVisited = new Set<number>();
  dist[start] = 0;

  const snap = (
    current: number | null,
    frontier: FrontierItem[],
    touched: number[],
    found: boolean,
    done: boolean,
  ) =>
    steps.push({
      current,
      visited: [...visited],
      frontier: frontier.map((f) => ({ ...f })),
      dist: [...dist],
      parent: [...parent],
      touched,
      found,
      done,
    });

  if (algorithm === 'bfs') {
    const queue = [start];
    const seen = new Set([start]);
    snap(null, [{ node: start }], [start], false, false);
    while (queue.length) {
      const u = queue.shift()!;
      visited.push(u);
      isVisited.add(u);
      if (u === target) {
        snap(
          u,
          queue.map((node) => ({ node })),
          [],
          true,
          true,
        );
        return steps;
      }
      const touched: number[] = [];
      for (const { to } of g.adj[u]) {
        if (seen.has(to)) continue;
        seen.add(to);
        parent[to] = u;
        dist[to] = (dist[u] ?? 0) + 1;
        queue.push(to);
        touched.push(to);
      }
      snap(
        u,
        queue.map((node) => ({ node })),
        touched,
        false,
        queue.length === 0,
      );
    }
    return steps;
  }

  if (algorithm === 'dfs') {
    const stack = [start];
    snap(null, [{ node: start }], [start], false, false);
    while (stack.length) {
      const u = stack.pop()!;
      if (isVisited.has(u)) continue;
      visited.push(u);
      isVisited.add(u);
      if (u !== start && parent[u] !== null) dist[u] = (dist[parent[u]!] ?? 0) + 1;
      if (u === target) {
        snap(
          u,
          stack.map((node) => ({ node })),
          [],
          true,
          true,
        );
        return steps;
      }
      const touched: number[] = [];
      // Ters sırada it: en küçük numaralı komşu önce çıksın
      for (let k = g.adj[u].length - 1; k >= 0; k--) {
        const to = g.adj[u][k].to;
        if (isVisited.has(to)) continue;
        parent[to] = u;
        stack.push(to);
        touched.push(to);
      }
      const remaining = stack.filter((x) => !isVisited.has(x));
      snap(
        u,
        stack.map((node) => ({ node })),
        touched,
        false,
        remaining.length === 0,
      );
    }
    return steps;
  }

  // Dijkstra: tembel silmeli öncelik kuyruğu
  let pq: FrontierItem[] = [{ node: start, priority: 0 }];
  const live = () =>
    pq
      .filter((f) => !isVisited.has(f.node) && f.priority === dist[f.node])
      .sort((x, y) => x.priority! - y.priority! || x.node - y.node);
  snap(null, live(), [start], false, false);
  while (pq.length) {
    pq.sort((x, y) => x.priority! - y.priority! || x.node - y.node);
    const { node: u, priority } = pq.shift()!;
    if (isVisited.has(u) || priority !== dist[u]) continue;
    visited.push(u);
    isVisited.add(u);
    if (u === target) {
      snap(u, live(), [], true, true);
      return steps;
    }
    const touched: number[] = [];
    for (const { to, w } of g.adj[u]) {
      if (isVisited.has(to)) continue;
      const nd = dist[u]! + w;
      if (dist[to] === null || nd < dist[to]!) {
        dist[to] = nd;
        parent[to] = u;
        pq.push({ node: to, priority: nd });
        touched.push(to);
      }
    }
    pq = pq.filter((f) => !isVisited.has(f.node));
    const rest = live();
    snap(u, rest, touched, false, rest.length === 0);
  }
  return steps;
}

/** parent dizisinden start → target yolunu çıkarır; ulaşılamıyorsa boş dizi */
export function pathTo(
  parent: readonly (number | null)[],
  start: number,
  target: number,
): number[] {
  const path: number[] = [];
  let cur: number | null = target;
  const guard = parent.length + 1;
  while (cur !== null && path.length <= guard) {
    path.unshift(cur);
    if (cur === start) return path;
    cur = parent[cur];
  }
  return [];
}

/** Düğümleri çember üzerine yerleştirir */
export function circleLayout(n: number, cx: number, cy: number, r: number) {
  return Array.from({ length: n }, (_, i) => {
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
  });
}
