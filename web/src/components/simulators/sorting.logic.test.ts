import { describe, expect, it } from 'vitest';
import { SORT_ALGORITHMS, countSteps, randomArray, sortSteps } from './sorting.logic';

describe('sorting.logic', () => {
  it('randomArray deterministik', () => {
    expect(randomArray(10, 3)).toEqual(randomArray(10, 3));
    expect(randomArray(10, 3)).not.toEqual(randomArray(10, 4));
  });

  for (const algo of SORT_ALGORITHMS) {
    it(`${algo}: son adım sıralı diziyi verir ve girdiyi bozmaz`, () => {
      const input = randomArray(24, 11);
      const copy = [...input];
      const steps = sortSteps(input, algo);
      expect(input).toEqual(copy);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[steps.length - 1].array).toEqual([...input].sort((a, b) => a - b));
      for (const s of steps) expect(['compare', 'swap', 'overwrite']).toContain(s.type);
    });
  }

  it('bubble sıralı girdide n-1 karşılaştırma yapar, takas yapmaz', () => {
    const steps = sortSteps([1, 2, 3, 4, 5], 'bubble');
    expect(countSteps(steps, steps.length)).toEqual({ compares: 4, swaps: 0, writes: 0 });
  });

  it('merge sort yazma (overwrite) kullanır, takas kullanmaz', () => {
    const steps = sortSteps([3, 1, 2], 'merge');
    const c = countSteps(steps, steps.length);
    expect(c.swaps).toBe(0);
    expect(c.writes).toBeGreaterThan(0);
  });

  it('swap adımı i ve j değerlerini yer değiştirir', () => {
    const steps = sortSteps([2, 1], 'bubble');
    expect(steps.map((s) => s.type)).toEqual(['compare', 'swap']);
    expect(steps[1]).toMatchObject({ i: 0, j: 1, array: [1, 2] });
  });
});
