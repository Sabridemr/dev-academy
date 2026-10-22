import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLessonMarkdown } from './parser';
import { serializeLesson } from './serializer';
import type { LessonBlock, LessonFrontmatter } from './schema';

/** Ters dönüşüm testi: parse(serialize(parse(x))) == parse(x), depodaki tüm gerçek derslerle */
const CONTENT = resolve(__dirname, '../../../../content/modules');

function lessonFiles(): string[] {
  const out: string[] = [];
  for (const m of readdirSync(CONTENT)) {
    const mDir = join(CONTENT, m);
    if (!statSync(mDir).isDirectory()) continue;
    for (const l of readdirSync(mDir)) {
      const file = join(mDir, l, 'lesson.md');
      try {
        if (statSync(file).isFile()) out.push(file);
      } catch {
        // lesson.md olmayan klasör
      }
    }
  }
  return out.sort();
}

function roundTrip(markdown: string, englishMarkdown?: string) {
  const first = parseLessonMarkdown(markdown, { englishMarkdown });
  const out = serializeLesson(first);
  const second = parseLessonMarkdown(out.markdown, {
    englishMarkdown: out.englishMarkdown ?? undefined,
  });
  return { first, second, out };
}

/**
 * Bilinen içerik sorunları: başlığında `{}` olan callout, açılış satırı directive deseniyle eşleşmediği için
 * ayrıştırıcıda metin bloğu olarak okunuyor (ders dosyasındaki hata; gidiş-dönüş yine birebir).
 */
const KNOWN_WARNINGS: Record<string, string[]> = {
  'k-python/k-06-fonksiyonlar-ve-cagri-yigini/lesson.md': [
    "blok 17 (text): gövdede ':::' satırı var; dosya yeniden okunurken blok bölünür",
  ],
};

describe('serializeLesson — gerçek derslerle gidiş-dönüş', () => {
  const files = lessonFiles();

  it('depoda ders bulunur', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(files.map((f) => [f.slice(CONTENT.length + 1)]))('%s', (rel) => {
    const { first, second, out } = roundTrip(readFileSync(join(CONTENT, rel), 'utf8'));
    expect(second.meta).toEqual(first.meta);
    expect(second.blocks).toEqual(first.blocks);
    expect(out.warnings).toEqual(KNOWN_WARNINGS[rel] ?? []);
    expect(out.englishMarkdown).toBeNull();
    // İkinci tur metni sabit (idempotent) olmalı
    expect(serializeLesson(second).markdown).toBe(out.markdown);
  });
});

const META: LessonFrontmatter = {
  id: 'x-01-deneme',
  slug: 'deneme',
  module: 'x-modul',
  order: 2,
  title: { tr: 'Başlık: iki nokta # ve "tırnak"', en: 'Title: colon' },
  summary: 'true',
  durationMinutes: 12,
  level: 'advanced',
  tags: ['a', '12-factor', '2024-01-01', 'virgül, içeren', 'yes', '1e5'],
  prerequisites: [],
  concepts: ['round-robin'],
  status: 'draft',
};

describe('serializeLesson — zor durumlar', () => {
  it('frontmatter özel karakterleri ve taslak durumu korunur', () => {
    const { markdown } = serializeLesson({ meta: META, blocks: [] });
    const doc = parseLessonMarkdown(markdown);
    expect(doc.meta).toEqual(META);
  });

  it('öznitelik tırnakları, sayılar, mantıksal değerler ve İngilizce metinler', () => {
    const blocks: LessonBlock[] = [
      {
        id: 'text-1',
        order: 0,
        type: 'text',
        markdown: '## Kavram\n\nMetin',
        markdownEn: '## Concept\n\nText',
      },
      {
        id: 'interactive-1',
        order: 1,
        type: 'interactive',
        interactive: 'cache',
        params: { capacity: 4, policy: 'lru', ttlMs: '300', writePolicy: 'say "x"' },
        title: { tr: 'Önbellek', en: 'Cache' },
        instructions: 'Kapasiteyi değiştirin.',
      },
      {
        id: 'code-1',
        order: 2,
        type: 'code',
        language: 'ts',
        title: "Ali'nin örneği",
        code: 'const a = 1;\n\n\nconst b = 2;\n',
        alternatives: [{ language: 'python', code: '' }],
        highlightLines: [1, 3],
      },
      { id: 'text-2', order: 3, type: 'text', markdown: 'Ara metin' },
      {
        id: 'callout-1',
        order: 4,
        type: 'callout',
        tone: 'warning',
        title: 'Dikkat',
        markdown: 'Uyarı',
        markdownEn: 'Warning',
      },
      { id: 'realworld-1', order: 5, type: 'realworld', company: 'Netflix', markdown: 'Örnek' },
      { id: 'next-1', order: 6, type: 'next', lesson: 'x-02-sonraki' },
    ];
    const out = serializeLesson({ meta: { ...META, status: 'published' }, blocks });
    const doc = parseLessonMarkdown(out.markdown, {
      englishMarkdown: out.englishMarkdown ?? undefined,
    });
    expect(doc.blocks).toEqual(blocks);
    // text-2'nin İngilizcesi yok ama sonrasında İngilizce metin bloğu da yok: uyarı gerekmez
    expect(out.warnings).toEqual([]);
  });

  it('taşınamayan bilgi uyarı olarak raporlanır', () => {
    const out = serializeLesson({
      meta: { ...META, status: 'published' },
      blocks: [
        { id: 'a', order: 0, type: 'text', markdown: 'Bir' },
        { id: 'b', order: 1, type: 'text', markdown: 'İki' },
        {
          id: 'c',
          order: 2,
          type: 'interactive',
          interactive: 'cache',
          params: { capacity: { nested: true } },
        },
        { id: 'd', order: 3, type: 'next', lesson: 'x}y' },
      ],
    });
    const all = out.warnings.join('\n');
    expect(all).toMatch(/birleşecek/);
    expect(all).toMatch(/öznitelik olarak yazılamaz/);
    expect(all).toMatch(/'}'/);
    // Uyarılara rağmen çıktı ayrıştırılabilir
    expect(() => parseLessonMarkdown(out.markdown)).not.toThrow();
  });
});
