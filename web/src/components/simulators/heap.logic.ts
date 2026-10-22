/**
 * Heap / öncelik kuyruğu simülatörünün saf mantığı: dizi üzerinde ikili heap,
 * ekleme (sift-up), en üsttekini çıkarma (sift-down) ve diziden heap kurma (heapify)
 * işlemlerinin adım adım anlık görüntüleri.
 */

export const HEAP_KINDS = ['min', 'max'] as const;
export type HeapKind = (typeof HEAP_KINDS)[number];

/** Ağacın okunur kalması için en fazla 4 seviye */
export const HEAP_MAX_SIZE = 15;

export type HeapStepType =
  | 'append' // yeni eleman dizinin sonuna kondu
  | 'compare' // i ile j karşılaştırılıyor
  | 'swap' // i ile j yer değiştirdi
  | 'settle' // eleman yerine oturdu, sift bitti
  | 'take-root' // kök (en küçük/büyük) çıkarıldı
  | 'move-last' // son eleman köke taşındı
  | 'heapify-node' // heapify bu iç düğümden sift-down başlatıyor
  | 'done';

export interface HeapStep {
  type: HeapStepType;
  array: number[];
  /** Vurgulanan birinci indeks */
  i?: number;
  /** Vurgulanan ikinci indeks (ebeveyn/çocuk) */
  j?: number;
  /** take-root adımında çıkarılan değer */
  value?: number;
}

export const parent = (i: number) => Math.floor((i - 1) / 2);
export const left = (i: number) => 2 * i + 1;
export const right = (i: number) => 2 * i + 2;

/** a, b'den heap sırasına göre önce mi gelmeli? (min: küçük, max: büyük) */
export const before = (kind: HeapKind, a: number, b: number) => (kind === 'min' ? a < b : a > b);

export function isHeap(arr: readonly number[], kind: HeapKind): boolean {
  for (let i = 1; i < arr.length; i++) if (before(kind, arr[i], arr[parent(i)])) return false;
  return true;
}

/** "5, 3, 8" → sayılar (tam sayı, -99..999), en fazla HEAP_MAX_SIZE */
export function parseNumbers(text: string): number[] {
  const out: number[] = [];
  for (const part of text.split(/[,;\s]+/)) {
    if (!/^-?\d+$/.test(part)) continue;
    out.push(Math.max(-99, Math.min(999, Number(part))));
    if (out.length === HEAP_MAX_SIZE) break;
  }
  return out;
}

function siftDown(a: number[], start: number, kind: HeapKind, steps: HeapStep[]) {
  let i = start;
  for (;;) {
    const l = left(i);
    const r = right(i);
    if (l >= a.length) {
      steps.push({ type: 'settle', array: [...a], i });
      return;
    }
    const best = r < a.length && before(kind, a[r], a[l]) ? r : l;
    steps.push({ type: 'compare', array: [...a], i, j: best });
    if (!before(kind, a[best], a[i])) {
      steps.push({ type: 'settle', array: [...a], i });
      return;
    }
    [a[i], a[best]] = [a[best], a[i]];
    steps.push({ type: 'swap', array: [...a], i, j: best });
    i = best;
  }
}

/** Ekle: sona koy, ebeveyninden "daha öncelikli" olduğu sürece yukarı kaydır */
export function insertSteps(heap: readonly number[], value: number, kind: HeapKind): HeapStep[] {
  if (heap.length >= HEAP_MAX_SIZE) return [];
  const a = [...heap, value];
  let i = a.length - 1;
  const steps: HeapStep[] = [{ type: 'append', array: [...a], i }];
  while (i > 0) {
    const p = parent(i);
    steps.push({ type: 'compare', array: [...a], i, j: p });
    if (!before(kind, a[i], a[p])) break;
    [a[i], a[p]] = [a[p], a[i]];
    steps.push({ type: 'swap', array: [...a], i: p, j: i });
    i = p;
  }
  steps.push({ type: 'settle', array: [...a], i });
  steps.push({ type: 'done', array: [...a] });
  return steps;
}

/** Çıkar: kökü al, son elemanı köke taşı, aşağı kaydır */
export function extractSteps(heap: readonly number[], kind: HeapKind): HeapStep[] {
  if (heap.length === 0) return [];
  const a = [...heap];
  const steps: HeapStep[] = [{ type: 'take-root', array: [...a], i: 0, value: a[0] }];
  const last = a.pop()!;
  if (a.length === 0) {
    steps.push({ type: 'done', array: [] });
    return steps;
  }
  a[0] = last;
  steps.push({ type: 'move-last', array: [...a], i: 0, value: last });
  siftDown(a, 0, kind, steps);
  steps.push({ type: 'done', array: [...a] });
  return steps;
}

/** Heapify: son iç düğümden köke doğru her düğüm için sift-down (O(n)) */
export function heapifySteps(values: readonly number[], kind: HeapKind): HeapStep[] {
  const a = values.slice(0, HEAP_MAX_SIZE);
  const steps: HeapStep[] = [];
  for (let i = Math.floor(a.length / 2) - 1; i >= 0; i--) {
    steps.push({ type: 'heapify-node', array: [...a], i });
    siftDown(a, i, kind, steps);
  }
  steps.push({ type: 'done', array: [...a] });
  return steps;
}

/** Tam ikili ağaç yerleşimi: seviye seviye, her seviye genişliği eşit bölünür */
export function treeLayout(n: number, width: number, levelH: number, top = 28) {
  return Array.from({ length: n }, (_, i) => {
    const level = Math.floor(Math.log2(i + 1));
    const first = 2 ** level - 1;
    const slots = 2 ** level;
    return { x: ((i - first + 0.5) / slots) * width, y: top + level * levelH, level };
  });
}
