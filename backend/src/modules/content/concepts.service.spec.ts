import { NotFoundException } from '@nestjs/common';
import { ConceptCacheKeys, ConceptsService } from './concepts.service';

const concept = (id: string, tr: string, en: string, extra: Record<string, unknown> = {}) => ({
  id,
  term: { tr, en },
  definition: { tr: `${tr} tanımı.` },
  aliases: [],
  related: [],
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...extra,
});

const CONCEPTS = [
  concept('round-robin', 'Round-robin', 'Round-robin', {
    aliases: ['RR'],
    related: ['least-connections', 'silinmis-kavram'],
  }),
  concept('least-connections', 'En az bağlantı', 'Least connections'),
  concept('ttl', 'TTL (yaşam süresi)', 'Time to live'),
];

/** Müfredat sırasıyla yayındaki dersler */
const LESSONS = [
  {
    id: 'a-05',
    slug: 'load-balancing',
    moduleId: 'a',
    module: { code: 'A' },
    publishedVersion: { title: { tr: 'Yük Dengeleme', en: 'Load Balancing' }, concepts: ['least-connections'] },
  },
  {
    id: 'a-07',
    slug: 'caching',
    moduleId: 'a',
    module: { code: 'A' },
    publishedVersion: { title: { tr: 'Önbellek' }, concepts: ['ttl', 'round-robin'] },
  },
];

function createService() {
  const store = new Map<string, unknown>();
  const redis = {
    getJson: jest.fn(async (k: string) => (store.get(k) as never) ?? null),
    setJson: jest.fn(async (k: string, v: unknown) => void store.set(k, v)),
  };
  const prisma = {
    concept: {
      findMany: jest.fn(async (args?: { where?: { id?: { in: string[] } } }) => {
        const ids = args?.where?.id?.in;
        return ids ? CONCEPTS.filter((c) => ids.includes(c.id)) : CONCEPTS;
      }),
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }) => CONCEPTS.find((c) => c.id === where.id) ?? null,
      ),
    },
    lesson: { findMany: jest.fn(async () => LESSONS) },
    question: {
      findMany: jest.fn(async () => [
        // Quiz a-07'de ama kavram a-05'in de sorusunda geçiyor
        { concepts: ['round-robin'], quiz: { lessonId: 'a-07' } },
        { concepts: ['round-robin'], quiz: { lessonId: 'a-05' } },
      ]),
    },
  };
  return { service: new ConceptsService(prisma as never, redis as never), prisma, redis };
}

describe('ConceptsService', () => {
  it('listeyi Türkçe terime göre sıralar, geçtiği ders sayısını ekler ve cache’ler', async () => {
    const { service, prisma, redis } = createService();
    const list = await service.list();
    expect(list.map((c) => [c.id, c.lessonCount])).toEqual([
      ['least-connections', 1],
      ['round-robin', 2],
      ['ttl', 1],
    ]);
    expect(redis.setJson).toHaveBeenCalledWith(ConceptCacheKeys.list, list, expect.any(Number));
    await service.list();
    expect(prisma.concept.findMany).toHaveBeenCalledTimes(1);
  });

  it('q ile terim, eş ad ve tanımda Türkçe karakter duyarsız arar', async () => {
    const { service } = createService();
    expect((await service.list('rr')).map((c) => c.id)).toEqual(['round-robin']);
    expect((await service.list('baglanti')).map((c) => c.id)).toEqual(['least-connections']);
    expect((await service.list('yasam')).map((c) => c.id)).toEqual(['ttl']);
    expect(await service.list('kafka')).toEqual([]);
  });

  it('detayda dersleri müfredat sırasıyla, soru sayısını ve var olan ilgili kavramları döner', async () => {
    const { service, prisma } = createService();
    const detail = await service.get('round-robin');
    expect(detail).toMatchObject({
      id: 'round-robin',
      term: { tr: 'Round-robin', en: 'Round-robin' },
      aliases: ['RR'],
      lessonCount: 2,
      questionCount: 2,
      related: [{ id: 'least-connections', term: { tr: 'En az bağlantı', en: 'Least connections' } }],
    });
    expect(detail.lessons.map((l) => l.id)).toEqual(['a-05', 'a-07']);
    expect(detail.lessons[0]).toEqual({
      id: 'a-05',
      slug: 'load-balancing',
      moduleId: 'a',
      moduleCode: 'A',
      title: { tr: 'Yük Dengeleme', en: 'Load Balancing' },
    });
    // Yalnızca yayındaki dersler ve arşivlenmemiş, yayındaki quiz soruları sayılır
    expect(prisma.lesson.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publishedVersionId: { not: null } } }),
    );
    expect(prisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          archived: false,
          quiz: { status: 'published', lesson: { publishedVersionId: { not: null } } },
        },
      }),
    );
  });

  it('detayı cache’ten döner, bilinmeyen kavramda 404 verir', async () => {
    const { service, prisma } = createService();
    await service.get('ttl');
    await service.get('ttl');
    expect(prisma.concept.findUnique).toHaveBeenCalledTimes(1);
    await expect(service.get('yok')).rejects.toBeInstanceOf(NotFoundException);
  });
});
