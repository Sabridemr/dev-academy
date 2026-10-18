import { describe, expect, it } from 'vitest';
import { translate, MESSAGES } from '@/i18n';
import { sanitizeSvg } from '@/components/lesson/Diagram';
import { slugify } from '@/components/lesson/Markdown';
import { themeColor, formatDuration } from './utils';

describe('i18n', () => {
  it('anahtarı çözer ve parametreleri yerleştirir', () => {
    expect(translate(MESSAGES.tr, 'player.step', { current: 2, total: 5 })).toBe('Adım 2/5');
    expect(translate(MESSAGES.en, 'player.step', { current: 2, total: 5 })).toBe('Step 2/5');
  });
  it('bilinmeyen anahtar için anahtarın kendisini döner', () => {
    expect(translate(MESSAGES.tr, 'yok.boyle')).toBe('yok.boyle');
  });
  it('tr ve en sözlükleri aynı anahtar yapısına sahip', () => {
    const keys = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(MESSAGES.en).sort()).toEqual(keys(MESSAGES.tr).sort());
  });
});

describe('sanitizeSvg', () => {
  it('script, olay işleyicileri ve javascript: bağlantılarını temizler', () => {
    const dirty = '<svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)"><rect onclick="x()"/></a></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/script|onload|onclick|javascript:/i);
    expect(clean).toContain('<rect');
  });
});

describe('yardımcılar', () => {
  it('slugify Türkçe karakterleri dönüştürür', () => {
    expect(slugify('L4 mü, L7 mi?')).toBe('l4-mu-l7-mi');
    expect(slugify('Kavram: tek kapı, çok sunucu')).toBe('kavram-tek-kapi-cok-sunucu');
  });
  it('themeColor anahtarları CSS değişkenine çevirir', () => {
    expect(themeColor('danger')).toBe('var(--da-danger)');
    expect(themeColor('#fff')).toBe('#fff');
    expect(themeColor(undefined)).toBe('var(--da-primary)');
  });
  it('formatDuration', () => {
    expect(formatDuration(3720, 'tr')).toBe('1 sa 2 dk');
    expect(formatDuration(300, 'en')).toBe('5m');
  });
});
