/**
 * Yığın ve kuyruk simülatörünün saf mantığı:
 *  - parantez eşleme: ifadedeki her açılış yığına itilir, her kapanış tepedekiyle eşleşirse çekilir;
 *    ilk hata (beklenmeyen kapanış, uyuşmayan çift, kapanmamış açılış) konumuyla raporlanır.
 *  - BFS kuyruğu: küçük sabit bir grafta kuyruğun büyüyüp küçülmesi ve ziyaret sırası.
 */

export const SQ_MODES = ['brackets', 'bfs-queue'] as const;
export type SqMode = (typeof SQ_MODES)[number];

export const EXPRESSION_MAX = 48;
export const DEFAULT_EXPRESSION = '{ a[i] * (b + c) }';

const OPEN: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const CLOSE: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

export interface StackEntry {
  char: string;
  index: number;
}

export type BracketErrorKind = 'unexpected-close' | 'mismatch' | 'unclosed';

export interface BracketStep {
  type: 'push' | 'pop' | 'error' | 'ok';
  /** İfadede işlenen karakterin konumu (ok adımında yok) */
  index?: number;
  char?: string;
  /** Adımdan sonraki yığın (alttan tepeye) */
  stack: StackEntry[];
  error?: BracketErrorKind;
  /** Uyuşmazlıkta beklenen kapanış karakteri */
  expected?: string;
}

export function bracketSteps(expression: string): BracketStep[] {
  const expr = expression.slice(0, EXPRESSION_MAX);
  const stack: StackEntry[] = [];
  const steps: BracketStep[] = [];
  for (let index = 0; index < expr.length; index++) {
    const char = expr[index];
    if (OPEN[char]) {
      stack.push({ char, index });
      steps.push({ type: 'push', index, char, stack: [...stack] });
    } else if (CLOSE[char]) {
      const top = stack[stack.length - 1];
      if (!top) {
        steps.push({ type: 'error', index, char, stack: [], error: 'unexpected-close' });
        return steps;
      }
      if (top.char !== CLOSE[char]) {
        steps.push({
          type: 'error',
          index,
          char,
          stack: [...stack],
          error: 'mismatch',
          expected: OPEN[top.char],
        });
        return steps;
      }
      stack.pop();
      steps.push({ type: 'pop', index, char, stack: [...stack] });
    }
  }
  if (stack.length) {
    const top = stack[stack.length - 1];
    steps.push({
      type: 'error',
      index: top.index,
      char: top.char,
      stack: [...stack],
      error: 'unclosed',
      expected: OPEN[top.char],
    });
  } else steps.push({ type: 'ok', stack: [] });
  return steps;
}

/** BFS için sabit, küçük graf: A'dan başlayınca üç katman oluşur */
export const BFS_NODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export const BFS_EDGES: readonly [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [1, 4],
  [2, 5],
  [4, 6],
  [5, 6],
];
/** 0–1 aralığında sabit konumlar (bileşen ölçekler) */
export const BFS_POS: readonly { x: number; y: number }[] = [
  { x: 0.5, y: 0.1 },
  { x: 0.25, y: 0.4 },
  { x: 0.75, y: 0.4 },
  { x: 0.1, y: 0.75 },
  { x: 0.4, y: 0.75 },
  { x: 0.85, y: 0.75 },
  { x: 0.62, y: 0.95 },
];

export function adjacency(): number[][] {
  const adj: number[][] = BFS_NODES.map(() => []);
  for (const [a, b] of BFS_EDGES) {
    adj[a].push(b);
    adj[b].push(a);
  }
  for (const l of adj) l.sort((x, y) => x - y);
  return adj;
}

export interface BfsStep {
  type: 'enqueue' | 'dequeue' | 'skip' | 'done';
  node?: number;
  /** enqueue/skip adımında komşuyu keşfeden düğüm */
  from?: number;
  /** Adımdan sonraki kuyruk (baş → son) */
  queue: number[];
  /** Kuyruktan çıkış (ziyaret) sırası */
  order: number[];
  /** Keşfedilmiş (kuyruğa girmiş) düğümler */
  seen: number[];
  /** Başlangıca kenar sayısı cinsinden uzaklık; keşfedilmediyse null */
  level: (number | null)[];
}

export function bfsSteps(start = 0): BfsStep[] {
  const adj = adjacency();
  const n = BFS_NODES.length;
  const s = start >= 0 && start < n ? start : 0;
  const level: (number | null)[] = Array(n).fill(null);
  const queue: number[] = [s];
  const order: number[] = [];
  const seen: number[] = [s];
  level[s] = 0;
  const snap = (type: BfsStep['type'], node?: number, from?: number): BfsStep => ({
    type,
    node,
    from,
    queue: [...queue],
    order: [...order],
    seen: [...seen],
    level: [...level],
  });
  const steps: BfsStep[] = [snap('enqueue', s)];
  while (queue.length) {
    const u = queue.shift()!;
    order.push(u);
    steps.push(snap('dequeue', u));
    for (const v of adj[u]) {
      if (level[v] !== null) {
        steps.push(snap('skip', v, u));
        continue;
      }
      level[v] = level[u]! + 1;
      seen.push(v);
      queue.push(v);
      steps.push(snap('enqueue', v, u));
    }
  }
  steps.push(snap('done'));
  return steps;
}

/** Adımlar boyunca kuyruğun ulaştığı en büyük uzunluk */
export function maxQueue(steps: readonly BfsStep[], upto = steps.length): number {
  let m = 0;
  for (let k = 0; k < Math.min(upto, steps.length); k++) m = Math.max(m, steps[k].queue.length);
  return m;
}
