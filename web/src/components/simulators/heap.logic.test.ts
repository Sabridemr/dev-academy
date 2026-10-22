import { describe, expect, it } from 'vitest';
import {
  HEAP_KINDS,
  HEAP_MAX_SIZE,
  extractSteps,
  heapifySteps,
  insertSteps,
  isHeap,
  parseNumbers,
  treeLayout,
} from './heap.logic';

const last = <T>(a: T[]) => a[a.length - 1];

describe('heap.logic', () => {
  for (const kind of HEAP_KINDS) {
    it(`${kind}: heapify, ekleme ve çıkarma heap özelliğini korur`, () => {
      const input = [9, 4, 7, 1, 8, 2, 6, 3, 5];
      const built = last(heapifySteps(input, kind)).array;
      expect(isHeap(built, kind)).toBe(true);
      expect([...built].sort()).toEqual([...input].sort());

      const after = last(insertSteps(built, kind === 'min' ? 0 : 10, kind)).array;
      expect(isHeap(after, kind)).toBe(true);
      expect(after[0]).toBe(kind === 'min' ? 0 : 10);

      // Tekrarlı çıkarma sıralı dizi verir (heap sort)
      let h = after;
      const out: number[] = [];
      while (h.length) {
        const steps = extractSteps(h, kind);
        out.push(steps[0].value!);
        h = last(steps).array;
        expect(isHeap(h, kind)).toBe(true);
      }
      const sorted = [...after].sort((a, b) => a - b);
      expect(out).toEqual(kind === 'min' ? sorted : sorted.reverse());
    });
  }

  it('ekleme sift-up adımlarını sırayla üretir', () => {
    const steps = insertSteps([1, 3, 2, 5], 0, 'min');
    expect(steps.map((s) => s.type)).toEqual([
      'append',
      'compare',
      'swap',
      'compare',
      'swap',
      'settle',
      'done',
    ]);
    expect(steps[2]).toMatchObject({ i: 1, j: 4, array: [1, 0, 2, 5, 3] });
    expect(last(steps).array).toEqual([0, 1, 2, 5, 3]);
  });

  it('çıkarma kökü alır, son elemanı köke taşır ve aşağı kaydırır', () => {
    const steps = extractSteps([1, 3, 2, 5, 4], 'min');
    expect(steps[0]).toMatchObject({ type: 'take-root', value: 1 });
    expect(steps[1]).toMatchObject({ type: 'move-last', array: [4, 3, 2, 5] });
    expect(steps[2]).toMatchObject({ type: 'compare', i: 0, j: 2 });
    expect(last(steps).array).toEqual([2, 3, 4, 5]);
  });

  it('boş heap ve dolu heap kenar durumları', () => {
    expect(extractSteps([], 'min')).toEqual([]);
    expect(insertSteps(Array(HEAP_MAX_SIZE).fill(1), 0, 'min')).toEqual([]);
    expect(last(extractSteps([7], 'max')).array).toEqual([]);
  });

  it('parseNumbers geçersizleri atar ve sınırlar', () => {
    expect(parseNumbers('5, x, -3; 1000 2')).toEqual([5, -3, 999, 2]);
    expect(parseNumbers(Array(30).fill('1').join(','))).toHaveLength(HEAP_MAX_SIZE);
  });

  it('treeLayout: kök ortada, çocuklar alt seviyede', () => {
    const pos = treeLayout(3, 400, 60);
    expect(pos[0]).toMatchObject({ x: 200, level: 0 });
    expect(pos[1]).toMatchObject({ x: 100, level: 1 });
    expect(pos[2].x).toBe(300);
  });
});
