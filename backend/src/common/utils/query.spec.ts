import { clampInt } from './query';

describe('clampInt', () => {
  it('aralığa sıkıştırır, geçersiz değerde varsayılanı döner', () => {
    expect(clampInt(undefined, 20, 1, 50)).toBe(20);
    expect(clampInt('abc', 20, 1, 50)).toBe(20);
    expect(clampInt('-5', 20, 1, 50)).toBe(1);
    expect(clampInt('999', 20, 1, 50)).toBe(50);
    expect(clampInt('7', 20, 1, 50)).toBe(7);
  });
});
