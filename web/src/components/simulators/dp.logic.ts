/**
 * Dinamik programlama tablosu simülatörünün saf mantığı: dört klasik problem için
 * tablonun hücre hücre doldurulma sırası, her hücrenin bağımlı olduğu hücreler,
 * somut formül satırı ve sonda geri izleme (çözüm yolu).
 */

export const DP_PROBLEMS = ['fibonacci', 'knapsack', 'lcs', 'coin-change'] as const;
export type DpProblem = (typeof DP_PROBLEMS)[number];

/** `size` parametresinin probleme göre anlamı ve sınırları (LCS'de dizgi uzunluğu girdiden gelir) */
export const DP_SIZE: Record<DpProblem, { min: number; max: number; fallback: number }> = {
  fibonacci: { min: 2, max: 20, fallback: 8 },
  knapsack: { min: 1, max: 12, fallback: 4 },
  lcs: { min: 1, max: 8, fallback: 6 },
  'coin-change': { min: 1, max: 20, fallback: 11 },
};

export interface DpCell {
  r: number;
  c: number;
}

export interface DpStep extends DpCell {
  value: number;
  /** Değerin hesaplanırken okunduğu hücreler */
  deps: DpCell[];
  /** Kazanan (değeri belirleyen) bağımlılık; taban durumda yok */
  from?: DpCell;
  /** Taban durum mu (bağımlılıksız)? */
  base: boolean;
  /** Bu hücreye özgü somut formül, ör. `dp[3] = dp[2] + dp[1] = 1 + 1 = 2` */
  formula: string;
}

export interface KnapsackItem {
  w: number;
  v: number;
}

export interface DpInput {
  problem: DpProblem;
  size: number;
  items: KnapsackItem[];
  a: string;
  b: string;
  coins: number[];
}

export interface DpTable {
  problem: DpProblem;
  rows: number;
  cols: number;
  rowLabels: string[];
  colLabels: string[];
  /** Hücre doldurma sırası */
  steps: DpStep[];
  /** Cevap hücresi */
  answer: DpCell;
  /** Geri izleme yolu (cevaptan tabana doğru) */
  path: DpCell[];
  /** Çözümün kendisi: seçilen eşyalar, ortak alt dizi ya da kullanılan madeni paralar */
  solution: string[];
  /** Genel yineleme bağıntısı */
  recurrence: string;
}

/** Dersteki örnekle aynı: 1, 3 ve 4 kg; değerler 15, 20, 30 */
export const DEFAULT_ITEMS: KnapsackItem[] = [
  { w: 1, v: 15 },
  { w: 3, v: 20 },
  { w: 4, v: 30 },
];
export const DEFAULT_A = 'ABCBDAB';
export const DEFAULT_B = 'BDCABA';
export const DEFAULT_COINS = [1, 3, 4];

/** Sonsuz değerleri tabloda okunur göster */
export const fmt = (v: number) => (Number.isFinite(v) ? String(v) : '∞');

const clampInt = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(n)));

/** "1:1, 3:4" → eşya listesi (ağırlık:değer); geçersiz parçalar atlanır, en fazla 6 eşya */
export function parseItems(text: string): KnapsackItem[] {
  const out: KnapsackItem[] = [];
  for (const part of text.split(/[,;]/)) {
    const m = /^\s*(\d+)\s*[:/x]\s*(\d+)\s*$/.exec(part);
    if (!m) continue;
    out.push({ w: clampInt(Number(m[1]), 1, 12), v: clampInt(Number(m[2]), 0, 99) });
    if (out.length === 6) break;
  }
  return out;
}

/** "1, 3, 4" → benzersiz, sıralı madeni paralar (1..20, en fazla 5) */
export function parseCoins(text: string): number[] {
  const set = new Set<number>();
  for (const part of text.split(/[,;\s]+/)) {
    if (!/^\d+$/.test(part)) continue;
    const n = Number(part);
    if (n >= 1 && n <= 20) set.add(n);
    if (set.size === 5) break;
  }
  return [...set].sort((x, y) => x - y);
}

/** Dizgiyi büyük harfe çevirip harf/rakam dışını atar, en fazla 8 karakter */
export function cleanSeq(text: string): string {
  return text
    .toLocaleUpperCase('en')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

const cell = (r: number, c: number): DpCell => ({ r, c });

function fibonacci(n: number): DpTable {
  const dp: number[] = [];
  const steps: DpStep[] = [];
  for (let i = 0; i <= n; i++) {
    if (i < 2) {
      dp[i] = i;
      steps.push({ r: 0, c: i, value: i, deps: [], base: true, formula: `dp[${i}] = ${i}` });
      continue;
    }
    dp[i] = dp[i - 1] + dp[i - 2];
    steps.push({
      r: 0,
      c: i,
      value: dp[i],
      deps: [cell(0, i - 1), cell(0, i - 2)],
      base: false,
      formula: `dp[${i}] = dp[${i - 1}] + dp[${i - 2}] = ${dp[i - 1]} + ${dp[i - 2]} = ${dp[i]}`,
    });
  }
  // Fibonacci'de "çözüm yolu": cevabın dayandığı zincir (n, n-1, …, 0)
  const path = Array.from({ length: n + 1 }, (_, k) => cell(0, n - k));
  return {
    problem: 'fibonacci',
    rows: 1,
    cols: n + 1,
    rowLabels: ['dp'],
    colLabels: Array.from({ length: n + 1 }, (_, i) => String(i)),
    steps,
    answer: cell(0, n),
    path,
    solution: [`fib(${n}) = ${dp[n]}`],
    recurrence: 'dp[i] = dp[i-1] + dp[i-2]',
  };
}

function knapsack(items: KnapsackItem[], cap: number): DpTable {
  const n = items.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array<number>(cap + 1).fill(0));
  const steps: DpStep[] = [];
  for (let i = 0; i <= n; i++) {
    for (let w = 0; w <= cap; w++) {
      if (i === 0 || w === 0) {
        steps.push({ r: i, c: w, value: 0, deps: [], base: true, formula: `dp[${i}][${w}] = 0` });
        continue;
      }
      const { w: wi, v: vi } = items[i - 1];
      const skip = dp[i - 1][w];
      if (wi > w) {
        dp[i][w] = skip;
        steps.push({
          r: i,
          c: w,
          value: skip,
          deps: [cell(i - 1, w)],
          from: cell(i - 1, w),
          base: false,
          formula: `dp[${i}][${w}] = dp[${i - 1}][${w}] = ${skip}   (w${i}=${wi} > ${w})`,
        });
        continue;
      }
      const take = dp[i - 1][w - wi] + vi;
      dp[i][w] = Math.max(skip, take);
      steps.push({
        r: i,
        c: w,
        value: dp[i][w],
        deps: [cell(i - 1, w), cell(i - 1, w - wi)],
        from: take > skip ? cell(i - 1, w - wi) : cell(i - 1, w),
        base: false,
        formula: `dp[${i}][${w}] = max(dp[${i - 1}][${w}], dp[${i - 1}][${w - wi}] + ${vi}) = max(${skip}, ${take}) = ${dp[i][w]}`,
      });
    }
  }
  // Geri izleme: değer üst satırdan farklıysa eşya alınmıştır
  const path: DpCell[] = [];
  const chosen: string[] = [];
  let w = cap;
  for (let i = n; i >= 0; i--) {
    path.push(cell(i, w));
    if (i > 0 && dp[i][w] !== dp[i - 1][w]) {
      chosen.unshift(`#${i} (w=${items[i - 1].w}, v=${items[i - 1].v})`);
      w -= items[i - 1].w;
    }
  }
  return {
    problem: 'knapsack',
    rows: n + 1,
    cols: cap + 1,
    rowLabels: ['0', ...items.map((it, k) => `${k + 1} (${it.w}/${it.v})`)],
    colLabels: Array.from({ length: cap + 1 }, (_, i) => String(i)),
    steps,
    answer: cell(n, cap),
    path,
    solution: chosen,
    recurrence: 'dp[i][w] = max(dp[i-1][w], dp[i-1][w-wᵢ] + vᵢ)',
  };
}

function lcs(a: string, b: string): DpTable {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
  const steps: DpStep[] = [];
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      if (i === 0 || j === 0) {
        steps.push({ r: i, c: j, value: 0, deps: [], base: true, formula: `dp[${i}][${j}] = 0` });
        continue;
      }
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        steps.push({
          r: i,
          c: j,
          value: dp[i][j],
          deps: [cell(i - 1, j - 1)],
          from: cell(i - 1, j - 1),
          base: false,
          formula: `A[${i}] = B[${j}] = ${a[i - 1]} → dp[${i}][${j}] = dp[${i - 1}][${j - 1}] + 1 = ${dp[i][j]}`,
        });
        continue;
      }
      const up = dp[i - 1][j];
      const left = dp[i][j - 1];
      dp[i][j] = Math.max(up, left);
      steps.push({
        r: i,
        c: j,
        value: dp[i][j],
        deps: [cell(i - 1, j), cell(i, j - 1)],
        from: up >= left ? cell(i - 1, j) : cell(i, j - 1),
        base: false,
        formula: `${a[i - 1]} ≠ ${b[j - 1]} → dp[${i}][${j}] = max(dp[${i - 1}][${j}], dp[${i}][${j - 1}]) = max(${up}, ${left}) = ${dp[i][j]}`,
      });
    }
  }
  const path: DpCell[] = [];
  const chars: string[] = [];
  let i = m;
  let j = n;
  path.push(cell(i, j));
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      chars.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
    path.push(cell(i, j));
  }
  return {
    problem: 'lcs',
    rows: m + 1,
    cols: n + 1,
    rowLabels: ['∅', ...a.split('')],
    colLabels: ['∅', ...b.split('')],
    steps,
    answer: cell(m, n),
    path,
    solution: chars.length ? [chars.join('')] : [],
    recurrence: 'dp[i][j] = A[i]=B[j] ? dp[i-1][j-1] + 1 : max(dp[i-1][j], dp[i][j-1])',
  };
}

function coinChange(coins: number[], amount: number): DpTable {
  const dp: number[] = [0];
  const pick: (number | null)[] = [null];
  const steps: DpStep[] = [{ r: 0, c: 0, value: 0, deps: [], base: true, formula: 'dp[0] = 0' }];
  for (let a = 1; a <= amount; a++) {
    const usable = coins.filter((c) => c <= a);
    let best = Infinity;
    let bestCoin: number | null = null;
    for (const c of usable) {
      const cand = dp[a - c] + 1;
      if (cand < best) {
        best = cand;
        bestCoin = c;
      }
    }
    dp[a] = best;
    pick[a] = bestCoin;
    const terms = usable.map((c) => `dp[${a - c}]+1`);
    const vals = usable.map((c) => fmt(dp[a - c] + 1));
    steps.push({
      r: 0,
      c: a,
      value: best,
      deps: usable.map((c) => cell(0, a - c)),
      from: bestCoin !== null && Number.isFinite(best) ? cell(0, a - bestCoin) : undefined,
      base: false,
      formula: usable.length
        ? `dp[${a}] = min(${terms.join(', ')}) = min(${vals.join(', ')}) = ${fmt(best)}`
        : `dp[${a}] = ∞`,
    });
  }
  const path: DpCell[] = [];
  const used: string[] = [];
  if (Number.isFinite(dp[amount])) {
    let a = amount;
    path.push(cell(0, a));
    while (a > 0 && pick[a] !== null) {
      used.push(String(pick[a]));
      a -= pick[a]!;
      path.push(cell(0, a));
    }
  }
  return {
    problem: 'coin-change',
    rows: 1,
    cols: amount + 1,
    rowLabels: ['dp'],
    colLabels: Array.from({ length: amount + 1 }, (_, i) => String(i)),
    steps,
    answer: cell(0, amount),
    path,
    solution: used,
    recurrence: 'dp[a] = min over c ≤ a of (dp[a-c] + 1)',
  };
}

export function buildDpTable(input: DpInput): DpTable {
  const { min, max } = DP_SIZE[input.problem];
  const size = clampInt(input.size, min, max);
  switch (input.problem) {
    case 'fibonacci':
      return fibonacci(size);
    case 'knapsack':
      return knapsack(input.items.length ? input.items : DEFAULT_ITEMS, size);
    case 'lcs':
      return lcs(cleanSeq(input.a) || DEFAULT_A, cleanSeq(input.b) || DEFAULT_B);
    case 'coin-change':
      return coinChange(input.coins.length ? input.coins : DEFAULT_COINS, size);
  }
}

export const cellKey = (c: DpCell) => `${c.r}:${c.c}`;
