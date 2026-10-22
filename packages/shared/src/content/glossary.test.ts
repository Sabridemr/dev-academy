import { describe, expect, it } from 'vitest';
import {
  GlossarySchema,
  buildConceptIndex,
  conceptInitial,
  conceptSearchScore,
  normalizeConceptQuery,
  searchConcepts,
} from './glossary';

describe('buildConceptIndex', () => {
  it('frontmatter ve quiz kavramlarını derslere bağlar, soru sayısını sayar', () => {
    const index = buildConceptIndex(
      [
        { id: 'a-05', concepts: ['round-robin', 'least-connections'] },
        { id: 'a-11', concepts: ['round-robin'] },
      ],
      [
        {
          lessonId: 'a-05',
          questions: [
            { concepts: ['round-robin'] },
            { concepts: ['round-robin', 'round-robin'] },
            { concepts: [] },
          ],
        },
        { lessonId: 'a-07', questions: [{ concepts: ['ttl'] }] },
      ],
    );
    expect(index.get('round-robin')).toEqual({ lessons: ['a-05', 'a-11'], questionCount: 2 });
    expect(index.get('least-connections')).toEqual({ lessons: ['a-05'], questionCount: 0 });
    // Yalnızca quizde geçen kavram da dersine bağlanır
    expect(index.get('ttl')).toEqual({ lessons: ['a-07'], questionCount: 1 });
    expect(index.size).toBe(3);
  });

  it('girdi boşsa boş eşleme döner', () => {
    expect(buildConceptIndex([]).size).toBe(0);
  });
});

describe('GlossarySchema', () => {
  it('varsayılanları doldurur, eksik terimi ve geçersiz id’yi reddeder', () => {
    const ok = GlossarySchema.parse({
      ttl: { term: { tr: 'TTL', en: 'TTL' }, definition: { tr: 'Yaşam süresi.' } },
    });
    expect(ok.ttl).toMatchObject({ aliases: [], related: [] });
    expect(
      GlossarySchema.safeParse({ ttl: { term: { tr: 'TTL' }, definition: { tr: 'x' } } }).success,
    ).toBe(false);
    expect(
      GlossarySchema.safeParse({
        'Büyük Harf': { term: { tr: 'a', en: 'a' }, definition: { tr: 'x' } },
      }).success,
    ).toBe(false);
  });
});

describe('kavram arama', () => {
  const concepts = [
    {
      id: 'least-connections',
      term: { tr: 'En az bağlantı', en: 'Least connections' },
      aliases: [],
      definition: { tr: 'Yeni isteği en az açık bağlantısı olan sunucuya yollar.' },
    },
    {
      id: 'load-balancer',
      term: { tr: 'Yük dengeleyici', en: 'Load balancer' },
      aliases: ['LB'],
      definition: { tr: 'İstekleri sunuculara dağıtan bileşen.' },
    },
    {
      id: 'ttl',
      term: { tr: 'TTL (yaşam süresi)', en: 'Time to live' },
      aliases: [],
      definition: { tr: 'Önbellekteki kaydın geçerli kalacağı süre.' },
    },
  ];
  const [leastConn, lb, ttl] = concepts as [
    (typeof concepts)[number],
    (typeof concepts)[number],
    (typeof concepts)[number],
  ];

  it('Türkçe karakterleri ve büyük/küçük harfi yok sayar', () => {
    expect(normalizeConceptQuery('  Yük-Dengeleyİcİ ')).toBe('yuk dengeleyici');
    expect(normalizeConceptQuery('IŞIK')).toBe('isik');
  });

  it('terim ve eş ad eşleşmesini tanım eşleşmesinin önüne koyar', () => {
    expect(conceptSearchScore(lb, 'lb')).toBe(4);
    expect(conceptSearchScore(lb, 'yuk')).toBe(3);
    expect(conceptSearchScore(leastConn, 'sunucu')).toBe(1);
    expect(conceptSearchScore(ttl, 'kafka')).toBe(0);
    expect(searchConcepts(concepts, 'sunucu').map((c) => c.id)).toEqual([
      'least-connections',
      'load-balancer',
    ]);
    expect(searchConcepts(concepts, 'load').map((c) => c.id)).toEqual(['load-balancer']);
  });

  it('boş sorgu her kavramı terime göre sıralı döner', () => {
    expect(searchConcepts(concepts, '', 'en').map((c) => c.id)).toEqual([
      'least-connections',
      'load-balancer',
      'ttl',
    ]);
  });
});

describe('conceptInitial', () => {
  it('Türkçe harfleri ayrı tutar, rakamları # altında toplar', () => {
    expect(conceptInitial('Şema')).toBe('Ş');
    expect(conceptInitial('ölçekleme')).toBe('Ö');
    expect(conceptInitial('1NF')).toBe('#');
    expect(conceptInitial('Şema', 'en')).toBe('S');
  });
});
