import { buildSearchText, LessonBlockSchema, type LessonBlock } from '@devacademy/shared';

describe('buildSearchText', () => {
  it('başlık, özet, kavramlar ve metin bloklarını birleştirir; markdown işaretlerini temizler', () => {
    const text = buildSearchText(
      [
        { id: 't1', order: 0, type: 'text', markdown: '## **Yük** dengeleme' },
        {
          id: 'c1',
          order: 1,
          type: 'code',
          language: 'ts',
          code: 'const x = 1',
          alternatives: [],
          highlightLines: [],
          title: 'Round robin',
        },
        { id: 'i1', order: 2, type: 'interactive', interactive: 'load-balancer', params: {} },
        { id: 'q1', order: 3, type: 'quiz', src: 'quiz.json' },
      ],
      { tr: 'Load Balancer', en: 'Load Balancer EN' },
      'Özet',
      ['round-robin'],
      ['altyapi'],
    );
    expect(text).toContain('altyapi');
    expect(text).toContain('Load Balancer EN');
    expect(text).toContain('Yük dengeleme');
    expect(text).toContain('round-robin');
    expect(text).toContain('load-balancer');
    expect(text).toContain('Round robin');
    expect(text).not.toContain('**');
    expect(text).not.toContain('##');
  });
});

describe('tahmin ve kaynakça blokları (seed / admin taslağı)', () => {
  const predict: LessonBlock = {
    id: 'lb-tahmin',
    order: 0,
    type: 'predict',
    prompt: { tr: 'Dördüncü sunucu eklenince ne olur?', en: 'What happens?' },
    options: [
      { id: 'a', text: { tr: 'Hiçbir şey' } },
      { id: 'b', text: { tr: 'Sıraya katılır' } },
    ],
    correct: 'b',
    explanation: { tr: 'Round robin sırayı korur.' },
  };
  const resources: LessonBlock = {
    id: 'resources-1',
    order: 1,
    type: 'resources',
    items: [{ title: 'NGINX', url: 'https://nginx.org/en/docs/', kind: 'docs' }],
  };

  it('upsertDraft ile aynı şema geçerli blokları olduğu gibi kabul eder', () => {
    expect(LessonBlockSchema.parse(predict)).toEqual(predict);
    expect(LessonBlockSchema.parse(resources)).toEqual(resources);
  });

  it('bilinmeyen doğru seçeneği ve https olmayan kaynağı reddeder', () => {
    expect(LessonBlockSchema.safeParse({ ...predict, correct: 'z' }).success).toBe(false);
    expect(
      LessonBlockSchema.safeParse({ ...resources, items: [{ title: 'X', url: 'http://x.org' }] })
        .success,
    ).toBe(false);
  });

  it('arama metnine tahmin sorusunu ekler, kaynakçayı eklemez', () => {
    const text = buildSearchText([predict, resources], 'LB', 'Özet', []);
    expect(text).toContain('Dördüncü sunucu');
    expect(text).not.toContain('NGINX');
  });
});
