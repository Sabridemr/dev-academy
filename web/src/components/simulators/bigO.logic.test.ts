import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FUNCTIONS,
  bigOLog10,
  bigOValue,
  formatDuration,
  maxSolvableN,
  parseFunctions,
} from './bigO.logic';

describe('bigO.logic', () => {
  it('parseFunctions geçerli alt kümeyi kanonik sırada döndürür', () => {
    expect(parseFunctions('n2, 1 ,logn,bogus')).toEqual(['1', 'logn', 'n2']);
    expect(parseFunctions('')).toEqual(DEFAULT_FUNCTIONS);
    expect(parseFunctions(undefined)).toEqual(DEFAULT_FUNCTIONS);
    expect(parseFunctions('nfact,2n')).toEqual(['2n', 'nfact']);
  });

  it('değerler doğru', () => {
    expect(bigOValue('n2', 12)).toBe(144);
    expect(bigOValue('nlogn', 8)).toBe(24);
    expect(bigOValue('2n', 10)).toBe(1024);
    expect(bigOValue('nfact', 5)).toBeCloseTo(120);
    expect(bigOLog10('2n', 4096)).toBeCloseTo(4096 * Math.log10(2));
    expect(Number.isFinite(bigOLog10('nfact', 4096))).toBe(true);
  });

  it('1 ms/işlem, 1 saniye (1000 işlem) içinde çözülebilecek n', () => {
    expect(maxSolvableN('n', 1000)).toBe(1000);
    expect(maxSolvableN('n2', 1000)).toBe(31);
    expect(maxSolvableN('2n', 1000)).toBe(9);
    expect(maxSolvableN('nfact', 1000)).toBe(6);
    expect(maxSolvableN('nlogn', 1000)).toBe(140);
    expect(maxSolvableN('1', 1000)).toBe(Infinity);
    expect(maxSolvableN('logn', 1000)).toBe(Infinity);
  });

  it('formatDuration birim seçer', () => {
    expect(formatDuration(500, 'en')).toBe('500 ms');
    expect(formatDuration(2000, 'tr')).toBe('2 sn');
    expect(formatDuration(90 * 60_000, 'en')).toBe('1.5 h');
  });
});
