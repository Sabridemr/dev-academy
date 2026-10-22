import { describe, expect, it } from 'vitest';
import {
  MAX_PATTERN,
  PRESETS,
  PRESET_IDS,
  RegexSyntaxError,
  detectRedos,
  groupNames,
  runRegex,
  segments,
  tokenizeRegex,
} from './regexPlayground.logic';

describe('regex açıklayıcı', () => {
  it('yaygın token’ları Türkçe açıklar', () => {
    const t = tokenizeRegex('^\\d+ab?c{2,3}[^a-z_]$');
    expect(t.map((x) => x.text)).toEqual([
      '^',
      '\\d',
      '+',
      'a',
      'b',
      '?',
      'c',
      '{2,3}',
      '[^a-z_]',
      '$',
    ]);
    expect(t[1].desc.tr).toBe('bir rakam (0-9)');
    expect(t[2].desc.tr).toBe('önceki öğe bir veya daha fazla');
    // niceleyici yalnızca son harfe uygulanır: düz metin niceleyiciden önce bölünür
    expect(tokenizeRegex('abc?').map((x) => x.text)).toEqual(['ab', 'c', '?']);
    expect(t[7].desc.tr).toBe('önceki öğe 2 ile 3 arası kez');
    expect(t[8].desc.tr).toMatch(/OLMAYAN.*a-z aralığı.*“_”/);
    expect(tokenizeRegex('a*?')[1].desc.tr).toMatch(/tembel/);
  });

  it('gruplar, derinlik ve adlar', () => {
    const t = tokenizeRegex('(?<yil>\\d{4})-(?:x|y)(z)\\1');
    const opens = t.filter((x) => x.kind === 'group-open');
    expect(opens.map((x) => x.group)).toEqual([1, undefined, 2]);
    expect(opens[0].desc.tr).toMatch(/“yil”/);
    expect(t.find((x) => x.text === '\\d')?.depth).toBe(1);
    expect(t.at(-1)?.kind).toBe('backref');
    expect(groupNames('(?<a>x)(y)(?<b>z)')).toEqual({ 1: 'a', 3: 'b' });
  });

  it('sözdizimi hataları ve Python adlı grup ipucu', () => {
    expect(() => tokenizeRegex('(abc')).toThrow(RegexSyntaxError);
    expect(() => tokenizeRegex('abc)')).toThrow(RegexSyntaxError);
    expect(() => tokenizeRegex('[abc')).toThrow(RegexSyntaxError);
    expect(() => tokenizeRegex('*a')).toThrow(RegexSyntaxError);
    expect(() => tokenizeRegex('(?P<ad>x)')).toThrow(/Python/);
  });
});

describe('ReDoS tespiti', () => {
  it('iç içe niceleyici ve örtüşen seçenekleri yakalar', () => {
    for (const p of ['(a+)+$', '(\\w+\\s?)*', '((ab)*)+', '(a\\w+)+', '(x+x+)+y', '(.*a){2,}']) {
      expect(detectRedos(p).length, p).toBeGreaterThan(0);
    }
    expect(detectRedos('(a|a)*')[0].reason).toBe('overlapping-alternation');
    expect(detectRedos('(a|ab)+')[0].reason).toBe('overlapping-alternation');
    expect(detectRedos('(a+)+')[0]).toEqual({ fragment: '(a+)+', reason: 'nested-quantifier' });
  });

  it('güvenli desenlerde uyarmaz (ayırıcıyla başlayan tekrar dahil)', () => {
    for (const p of [
      '\\d+',
      '(ab)+',
      '(a+)?',
      '(a+){2}',
      '(?:\\.[\\w-]+)+',
      '(,\\d+)*',
      '(a|b)*',
      '[a-z]+@',
    ]) {
      expect(detectRedos(p), p).toEqual([]);
    }
    for (const id of PRESET_IDS) expect(detectRedos(PRESETS[id].pattern), id).toEqual([]);
  });
});

describe('eşleştirme ve vurgulama', () => {
  it('global eşleşmeler, grup konumları ve adları', () => {
    const r = runRegex('(?<k>\\w)=(\\d)', 'g', 'a=1 b=2 c=x');
    expect(r.ok).toBe(true);
    expect(r.matches.map((m) => m.text)).toEqual(['a=1', 'b=2']);
    expect(r.matches[1].groups).toEqual([
      { index: 1, name: 'k', start: 4, end: 5, text: 'b' },
      { index: 2, name: undefined, start: 6, end: 7, text: '2' },
    ]);
    expect(runRegex('\\w=', '', 'a= b=').matches).toHaveLength(1);
  });

  it('sıfır uzunluklu eşleşmede sonsuz döngüye girmez; sınırlar uygulanır', () => {
    expect(runRegex('x*', 'g', 'abc').matches).toHaveLength(4);
    const many = runRegex('', 'g', 'a'.repeat(2000));
    expect(many.truncated).toBe(true);
    expect(many.matches).toHaveLength(500);
    expect(runRegex('a'.repeat(MAX_PATTERN + 1), 'g', 'a').ok).toBe(false);
    expect(runRegex('(', 'g', 'a')).toMatchObject({ ok: false, matches: [] });
  });

  it('bayraklar: i, m, s', () => {
    expect(runRegex('abc', 'gi', 'ABC').matches).toHaveLength(1);
    const lines = 'a1\nb2';
    expect(runRegex('^\\w\\d$', 'g', lines).matches).toHaveLength(0);
    expect(runRegex('^\\w\\d$', 'gm', lines).matches).toHaveLength(2);
    expect(runRegex('a.b', 'g', 'a\nb').matches).toHaveLength(0);
    expect(runRegex('a.b', 'gs', 'a\nb').matches).toHaveLength(1);
  });

  it('log preset’i: dört satırdan üçü, adlı gruplarla; m kapalıyken hiç', () => {
    const p = PRESETS.log;
    const r = runRegex(p.pattern, p.flags, p.text);
    expect(r.matches).toHaveLength(3);
    expect(r.matches[2].groups.map((g) => g.name)).toEqual(['tarih', 'saat', 'seviye', 'mesaj']);
    expect(r.matches[2].groups[2].text).toBe('ERROR');
    expect(runRegex(p.pattern, 'g', p.text).matches).toHaveLength(0);
  });

  it('segments en içteki grubu seçer ve parçaları birleştirir', () => {
    const r = runRegex('((a)b)', 'g', 'xab');
    expect(segments('xab', r.matches)).toEqual([
      { text: 'x', match: undefined, group: undefined },
      { text: 'a', match: 0, group: 2 },
      { text: 'b', match: 0, group: 1 },
    ]);
  });
});
