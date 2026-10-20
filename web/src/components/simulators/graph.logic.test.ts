import { describe, expect, it } from 'vitest';
import { generateGraph, parseNode, pathTo, traverse, type Graph } from './graph.logic';

/** Elle kurulan graf: A-B(1), B-C(1), A-C(5), C-D(1) */
function small(): Graph {
  const edges = [
    { a: 0, b: 1, w: 1 },
    { a: 1, b: 2, w: 1 },
    { a: 0, b: 2, w: 5 },
    { a: 2, b: 3, w: 1 },
  ];
  const adj: Graph['adj'] = [[], [], [], []];
  for (const e of edges) {
    adj[e.a].push({ to: e.b, w: e.w });
    adj[e.b].push({ to: e.a, w: e.w });
  }
  for (const l of adj) l.sort((x, y) => x.to - y.to);
  return { n: 4, edges, adj };
}

describe('graph.logic', () => {
  it('generateGraph deterministik ve bağlantılı', () => {
    const g = generateGraph(9, 2, true);
    expect(generateGraph(9, 2, true)).toEqual(g);
    const steps = traverse(g, 'bfs', 0);
    expect(steps[steps.length - 1].visited.sort((a, b) => a - b)).toEqual([...Array(9).keys()]);
    expect(g.edges.every((e) => e.w >= 1 && e.w <= 9)).toBe(true);
    expect(generateGraph(9, 2, false).edges.every((e) => e.w === 1)).toBe(true);
  });

  it('BFS seviye sırasıyla gezer', () => {
    const steps = traverse(small(), 'bfs', 0);
    expect(steps[steps.length - 1].visited).toEqual([0, 1, 2, 3]);
    expect(steps[0].frontier).toEqual([{ node: 0 }]);
  });

  it('DFS önce derine iner', () => {
    const steps = traverse(small(), 'dfs', 0);
    expect(steps[steps.length - 1].visited).toEqual([0, 1, 2, 3]);
    // A'dan sonra B, sonra B'nin komşusu C (A-C kenarından önce)
    expect(steps[2].current).toBe(1);
  });

  it('Dijkstra ağırlıklı en kısa yolu bulur', () => {
    const steps = traverse(small(), 'dijkstra', 0, 3);
    const last = steps[steps.length - 1];
    expect(last.found).toBe(true);
    expect(last.dist[3]).toBe(3);
    expect(pathTo(last.parent, 0, 3)).toEqual([0, 1, 2, 3]);
  });

  it('BFS hedefte durur, en az kenarlı yolu verir', () => {
    const steps = traverse(small(), 'bfs', 0, 3);
    const last = steps[steps.length - 1];
    expect(last.found).toBe(true);
    expect(pathTo(last.parent, 0, 3)).toEqual([0, 2, 3]);
  });

  it('parseNode harf ve sayı kabul eder', () => {
    expect(parseNode('C', 5)).toBe(2);
    expect(parseNode('b', 5)).toBe(1);
    expect(parseNode(3, 5)).toBe(3);
    expect(parseNode('4', 5)).toBe(4);
    expect(parseNode('Z', 5)).toBeNull();
    expect(parseNode(undefined, 5)).toBeNull();
  });
});
