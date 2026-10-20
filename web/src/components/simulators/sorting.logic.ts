/**
 * Sıralama görselleştiricisinin saf mantığı: deterministik dizi üretimi ve her algoritma için
 * önceden üretilen adım listesi. Her adım, adımdan SONRAKİ dizinin anlık görüntüsünü taşır.
 */

export const SORT_ALGORITHMS = ['bubble', 'insertion', 'selection', 'merge', 'quick'] as const;
export type SortAlgorithm = (typeof SORT_ALGORITHMS)[number];

export interface SortStep {
  /** compare: i ve j karşılaştırıldı · swap: i ve j yer değiştirdi · overwrite: i'ye yeni değer yazıldı (j = kaynak ya da -1) */
  type: 'compare' | 'swap' | 'overwrite';
  i: number;
  j: number;
  array: number[];
}

export interface SortInfo {
  stable: boolean;
  inPlace: boolean;
  best: string;
  average: string;
  worst: string;
  space: string;
}

export const SORT_INFO: Record<SortAlgorithm, SortInfo> = {
  bubble: {
    stable: true,
    inPlace: true,
    best: 'O(n)',
    average: 'O(n²)',
    worst: 'O(n²)',
    space: 'O(1)',
  },
  insertion: {
    stable: true,
    inPlace: true,
    best: 'O(n)',
    average: 'O(n²)',
    worst: 'O(n²)',
    space: 'O(1)',
  },
  selection: {
    stable: false,
    inPlace: true,
    best: 'O(n²)',
    average: 'O(n²)',
    worst: 'O(n²)',
    space: 'O(1)',
  },
  merge: {
    stable: true,
    inPlace: false,
    best: 'O(n log n)',
    average: 'O(n log n)',
    worst: 'O(n log n)',
    space: 'O(n)',
  },
  quick: {
    stable: false,
    inPlace: true,
    best: 'O(n log n)',
    average: 'O(n log n)',
    worst: 'O(n²)',
    space: 'O(log n)',
  },
};

/** Küçük, deterministik PRNG (mulberry32) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 5–100 aralığında `size` elemanlı karışık dizi (aynı seed → aynı dizi) */
export function randomArray(size: number, seed: number): number[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: size }, () => 5 + Math.floor(rnd() * 96));
}

/** Seçilen algoritmanın tüm adımlarını üretir; girdi dizisini değiştirmez */
export function sortSteps(input: readonly number[], algorithm: SortAlgorithm): SortStep[] {
  const a = [...input];
  const steps: SortStep[] = [];
  const compare = (i: number, j: number) => steps.push({ type: 'compare', i, j, array: [...a] });
  const swap = (i: number, j: number) => {
    [a[i], a[j]] = [a[j], a[i]];
    steps.push({ type: 'swap', i, j, array: [...a] });
  };
  const write = (i: number, value: number, from: number) => {
    a[i] = value;
    steps.push({ type: 'overwrite', i, j: from, array: [...a] });
  };
  const n = a.length;

  switch (algorithm) {
    case 'bubble':
      for (let end = n - 1; end > 0; end--) {
        let swapped = false;
        for (let j = 0; j < end; j++) {
          compare(j, j + 1);
          if (a[j] > a[j + 1]) {
            swap(j, j + 1);
            swapped = true;
          }
        }
        if (!swapped) break;
      }
      break;
    case 'insertion':
      for (let i = 1; i < n; i++) {
        for (let j = i; j > 0; j--) {
          compare(j - 1, j);
          if (a[j - 1] > a[j]) swap(j - 1, j);
          else break;
        }
      }
      break;
    case 'selection':
      for (let i = 0; i < n - 1; i++) {
        let min = i;
        for (let j = i + 1; j < n; j++) {
          compare(min, j);
          if (a[j] < a[min]) min = j;
        }
        if (min !== i) swap(i, min);
      }
      break;
    case 'merge': {
      const sort = (lo: number, hi: number) => {
        if (hi - lo < 1) return;
        const mid = (lo + hi) >> 1;
        sort(lo, mid);
        sort(mid + 1, hi);
        const left = a.slice(lo, mid + 1);
        const right = a.slice(mid + 1, hi + 1);
        let p = 0;
        let q = 0;
        let k = lo;
        while (p < left.length && q < right.length) {
          compare(lo + p, mid + 1 + q);
          // <= : eşit elemanlarda soldaki önce gelir → kararlı
          if (left[p] <= right[q]) write(k++, left[p], lo + p++);
          else write(k++, right[q], mid + 1 + q++);
        }
        while (p < left.length) write(k++, left[p], lo + p++);
        while (q < right.length) write(k++, right[q], mid + 1 + q++);
      };
      sort(0, n - 1);
      break;
    }
    case 'quick': {
      // Lomuto bölüntüsü, pivot = son eleman
      const sort = (lo: number, hi: number) => {
        if (lo >= hi) return;
        let store = lo;
        for (let j = lo; j < hi; j++) {
          compare(j, hi);
          if (a[j] < a[hi]) {
            if (store !== j) swap(store, j);
            store++;
          }
        }
        if (store !== hi) swap(store, hi);
        sort(lo, store - 1);
        sort(store + 1, hi);
      };
      sort(0, n - 1);
      break;
    }
  }
  return steps;
}

/** İlk `upto` adımdaki karşılaştırma ve takas/yazma sayıları */
export function countSteps(steps: readonly SortStep[], upto: number) {
  let compares = 0;
  let swaps = 0;
  let writes = 0;
  for (let k = 0; k < Math.min(upto, steps.length); k++) {
    const s = steps[k];
    if (s.type === 'compare') compares++;
    else if (s.type === 'swap') swaps++;
    else writes++;
  }
  return { compares, swaps, writes };
}
