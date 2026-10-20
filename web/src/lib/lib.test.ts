import { describe, expect, it } from 'vitest';
import { translate, MESSAGES } from '@/i18n';
import { sanitizeSvg } from '@/components/lesson/Diagram';
import { slugify } from '@/components/lesson/Markdown';
import { themeColor, formatDuration, formatPercent, safeNextPath } from './utils';

describe('i18n', () => {
  it('anahtarı çözer ve parametreleri yerleştirir', () => {
    expect(translate(MESSAGES.tr, 'player.step', { current: 2, total: 5 })).toBe('Adım 2/5');
    expect(translate(MESSAGES.en, 'player.step', { current: 2, total: 5 })).toBe('Step 2/5');
  });
  it('bilinmeyen anahtar için anahtarın kendisini döner', () => {
    expect(translate(MESSAGES.tr, 'yok.boyle')).toBe('yok.boyle');
  });
  it('tr ve en sözlükleri aynı anahtar yapısına sahip', () => {
    const keys = (o: object, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`],
      );
    expect(keys(MESSAGES.en).sort()).toEqual(keys(MESSAGES.tr).sort());
  });
});

describe('sanitizeSvg', () => {
  it('script, olay işleyicileri ve javascript: bağlantılarını temizler', () => {
    const dirty =
      '<svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)"><rect onclick="x()"/></a></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/script|onload|onclick|javascript:/i);
    expect(clean).toContain('<rect');
  });

  it('regex sanitizer’ı atlatan saldırı biçimlerini de temizler', () => {
    const payloads = [
      '<svg/onload=alert(1)><rect/></svg>',
      '<svg viewBox="0 0 10 10"><a><animate attributeName="href" to="javascript:alert(1)"/><rect/></a></svg>',
      '<svg viewBox="0 0 10 10"><set attributeName="onmouseover" to="alert(1)"/><rect/></svg>',
      '<svg viewBox="0 0 10 10"><a href="data:text/html,<script>alert(1)</script>"><rect/></a></svg>',
      '<svg viewBox="0 0 10 10"><image href="http://evil.example/x.svg"/><use href="http://evil.example/s.svg#x"/><rect/></svg>',
      '<svg viewBox="0 0 10 10"><foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject><rect/></svg>',
    ];
    for (const p of payloads) {
      const clean = sanitizeSvg(p);
      expect(clean).not.toMatch(
        /onload|onmouseover|<animate|<set|javascript:|data:text|evil\.example|<iframe|foreignObject/i,
      );
      expect(clean).toContain('<rect');
    }
  });

  it('<style> bloğunu temizler (satır içi SVG stilleri tüm sayfaya sızar)', () => {
    const clean = sanitizeSvg(
      '<svg viewBox="0 0 10 10"><style>body{display:none}</style><rect/></svg>',
    );
    expect(clean).not.toMatch(/<style|display:none/);
    expect(clean).toContain('<rect');
  });

  it('tema değişkenli normal diyagram öğelerini korur', () => {
    const clean = sanitizeSvg(
      '<svg viewBox="0 0 100 50" font-family="inherit"><defs><marker id="arr"><path d="M0,0 L5,5"/></marker></defs><rect fill="var(--da-surface)" stroke="var(--da-border)"/><line marker-end="url(#arr)"/><text x="5" y="5">API</text></svg>',
    );
    expect(clean).toContain('viewBox="0 0 100 50"');
    expect(clean).toContain('fill="var(--da-surface)"');
    expect(clean).toContain('marker-end="url(#arr)"');
    expect(clean).toContain('>API</text>');
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
  it('formatPercent yerel biçimi kullanır', () => {
    expect(formatPercent(40, 'tr')).toBe('%40');
    expect(formatPercent(40, 'en')).toBe('40%');
    expect(formatPercent(140, 'en')).toBe('100%');
  });
  it('formatDuration', () => {
    expect(formatDuration(3720, 'tr')).toBe('1 sa 2 dk');
    expect(formatDuration(300, 'en')).toBe('5m');
  });
});

describe('safeNextPath', () => {
  it('site içi yolları korur', () => {
    expect(safeNextPath('/lessons/a-01?tab=quiz#q1', '/dashboard')).toBe(
      '/lessons/a-01?tab=quiz#q1',
    );
  });
  it('başka origin’e çıkan ya da geçersiz değerlerde varsayılana döner', () => {
    for (const bad of [
      null,
      '',
      'https://evil.com',
      '//evil.com',
      '/\\evil.com',
      '/\t/evil.com',
      'javascript:alert(1)',
    ])
      expect(safeNextPath(bad, '/dashboard')).toBe('/dashboard');
  });
});
