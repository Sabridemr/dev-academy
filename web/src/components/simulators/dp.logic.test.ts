import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ITEMS,
  DP_PROBLEMS,
  DP_SIZE,
  buildDpTable,
  cellKey,
  cleanSeq,
  fmt,
  parseCoins,
  parseItems,
  type DpInput,
} from './dp.logic';

const base: Omit<DpInput, 'problem' | 'size'> = {
  items: DEFAULT_ITEMS,
  a: 'ABCBDAB',
  b: 'BDCABA',
  coins: [1, 3, 4],
};
const valueAt = (t: ReturnType<typeof buildDpTable>, r: number, c: number) =>
  t.steps.find((s) => s.r === r && s.c === c)!.value;

describe('dp.logic', () => {
  for (const problem of DP_PROBLEMS) {
    it(`${problem}: her hücre bir kez doldurulur, bağımlılıklar önceden doldurulmuştur`, () => {
      const t = buildDpTable({ ...base, problem, size: DP_SIZE[problem].fallback });
      expect(t.steps.length).toBe(t.rows * t.cols);
      const filled = new Set<string>();
      for (const s of t.steps) {
        expect(filled.has(cellKey(s))).toBe(false);
        for (const d of s.deps) expect(filled.has(cellKey(d))).toBe(true);
        if (s.from) expect(s.deps.map(cellKey)).toContain(cellKey(s.from));
        expect(s.base).toBe(s.deps.length === 0);
        filled.add(cellKey(s));
      }
      expect(t.path[0]).toEqual(t.answer);
    });
  }

  it('fibonacci: dp[10] = 55', () => {
    const t = buildDpTable({ ...base, problem: 'fibonacci', size: 10 });
    expect(valueAt(t, 0, 10)).toBe(55);
    expect(t.steps[5].formula).toBe('dp[5] = dp[4] + dp[3] = 3 + 2 = 5');
  });

  it('sırt çantası: kapasite 4 → 35 (1 ve 3 kg); açgözlü 30 değil', () => {
    const t = buildDpTable({ ...base, problem: 'knapsack', size: 4 });
    expect(valueAt(t, 3, 4)).toBe(35);
    expect(t.solution).toEqual(['#1 (w=1, v=15)', '#2 (w=3, v=20)']);
    expect(t.path.map((c) => `${c.r}:${c.c}`)).toEqual(['3:4', '2:4', '1:1', '0:0']);
  });

  it('LCS: ABCBDAB / BDCABA → uzunluk 4, geri izleme geçerli bir ortak alt dizi verir', () => {
    const t = buildDpTable({ ...base, problem: 'lcs', size: 0 });
    expect(valueAt(t, 7, 6)).toBe(4);
    const [s] = t.solution;
    expect(s).toHaveLength(4);
    const isSub = (sub: string, str: string) => {
      let k = 0;
      for (const ch of str) if (ch === sub[k]) k++;
      return k === sub.length;
    };
    expect(isSub(s, 'ABCBDAB') && isSub(s, 'BDCABA')).toBe(true);
    expect(t.path[t.path.length - 1].r === 0 || t.path[t.path.length - 1].c === 0).toBe(true);
  });

  it('madeni para: {1,3,4} ile 6 → 2 para (3+3); açgözlü 4+1+1 değil', () => {
    const t = buildDpTable({ ...base, problem: 'coin-change', size: 6 });
    expect(valueAt(t, 0, 6)).toBe(2);
    expect(t.solution).toEqual(['3', '3']);
    expect(t.path.map((c) => c.c)).toEqual([6, 3, 0]);
  });

  it('madeni para: ulaşılamayan tutar ∞ olur ve yol boştur', () => {
    const t = buildDpTable({ ...base, coins: [4, 6], problem: 'coin-change', size: 7 });
    expect(valueAt(t, 0, 7)).toBe(Infinity);
    expect(fmt(Infinity)).toBe('∞');
    expect(t.path).toEqual([]);
  });

  it('girdi ayrıştırıcıları geçersizleri atar ve sınırlar', () => {
    expect(parseItems('2:3, x, 4:5,99:1')).toEqual([
      { w: 2, v: 3 },
      { w: 4, v: 5 },
      { w: 12, v: 1 },
    ]);
    expect(parseCoins('5, 1, 1, 0, 30, abc, 2')).toEqual([1, 2, 5]);
    expect(cleanSeq('ab-cd efghijk')).toBe('ABCDEFGH');
  });

  it('boyut sınırlanır', () => {
    const t = buildDpTable({ ...base, problem: 'fibonacci', size: 999 });
    expect(t.cols).toBe(DP_SIZE.fibonacci.max + 1);
  });
});
