import { Injectable, NotFoundException } from '@nestjs/common';
import {
  buildConceptIndex,
  searchConcepts,
  type ConceptDetail,
  type ConceptLessonRef,
  type ConceptSummary,
  type ConceptUsage,
  type Locale,
} from '@devacademy/shared';
import type { Concept, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { asLocalized } from '../../common/utils/localized';

/** Sözlük nadiren değişir; seed ve yayınlama `content:*` anahtarlarını temizler */
const CONCEPT_TTL = 60 * 60 * 6;

export const ConceptCacheKeys = {
  list: 'content:concepts',
  concept: (id: string) => `content:concept:${id}`,
};

type Term = ConceptSummary['term'];

function asTerm(value: Prisma.JsonValue): Term {
  const v = asLocalized(value);
  return typeof v === 'string' ? { tr: v, en: v } : { tr: v.tr, en: v.en ?? v.tr };
}

function asDefinition(value: Prisma.JsonValue): ConceptSummary['definition'] {
  const v = asLocalized(value);
  if (typeof v === 'string') return { tr: v };
  return v.en ? { tr: v.tr, en: v.en } : { tr: v.tr };
}

export function toConceptSummary(row: Concept, lessonCount: number): ConceptSummary {
  return {
    id: row.id,
    term: asTerm(row.term),
    definition: asDefinition(row.definition),
    aliases: row.aliases,
    lessonCount,
  };
}

/**
 * Kavram sözlüğü. Kavramın geçtiği dersler veritabanında tutulmaz: yayındaki ders sürümlerinin
 * `concepts` dizisi ve yayındaki quiz sorularından shared `buildConceptIndex` ile hesaplanır,
 * böylece yeni yayınlanan ders sözlüğe kendiliğinden yansır.
 */
@Injectable()
export class ConceptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async list(q?: string, locale: Locale = 'tr'): Promise<ConceptSummary[]> {
    let all = await this.redis.getJson<ConceptSummary[]>(ConceptCacheKeys.list);
    if (!all) {
      const [rows, { index }] = await Promise.all([
        this.prisma.concept.findMany({ orderBy: { id: 'asc' } }),
        this.usage(),
      ]);
      all = rows
        .map((r) => toConceptSummary(r, index.get(r.id)?.lessons.length ?? 0))
        .sort((a, b) => a.term.tr.localeCompare(b.term.tr, 'tr'));
      await this.redis.setJson(ConceptCacheKeys.list, all, CONCEPT_TTL);
    }
    const query = q?.trim();
    return query ? searchConcepts(all, query, locale) : all;
  }

  async get(id: string): Promise<ConceptDetail> {
    const key = ConceptCacheKeys.concept(id);
    const cached = await this.redis.getJson<ConceptDetail>(key);
    if (cached) return cached;
    const row = await this.prisma.concept.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Kavram bulunamadı');
    const [{ index, lessons }, related] = await Promise.all([
      this.usage(),
      row.related.length
        ? this.prisma.concept.findMany({
            where: { id: { in: row.related } },
            select: { id: true, term: true },
          })
        : Promise.resolve([]),
    ]);
    const usage: ConceptUsage = index.get(row.id) ?? { lessons: [], questionCount: 0 };
    // İlgili kavramlar sözlükteki sırayla; silinmiş olanlar atlanır
    const relatedById = new Map(related.map((r) => [r.id, r]));
    const detail: ConceptDetail = {
      ...toConceptSummary(row, usage.lessons.length),
      questionCount: usage.questionCount,
      lessons: usage.lessons.flatMap((lessonId) => {
        const lesson = lessons.get(lessonId);
        return lesson ? [lesson] : [];
      }),
      related: row.related.flatMap((rid) => {
        const r = relatedById.get(rid);
        return r ? [{ id: r.id, term: asTerm(r.term) }] : [];
      }),
    };
    await this.redis.setJson(key, detail, CONCEPT_TTL);
    return detail;
  }

  /** Yayındaki ders sürümleri ve quiz sorularından kavram → ders eşlemesi (müfredat sırasıyla) */
  private async usage(): Promise<{
    index: Map<string, ConceptUsage>;
    lessons: Map<string, ConceptLessonRef>;
  }> {
    const [lessonRows, questions] = await Promise.all([
      this.prisma.lesson.findMany({
        where: { publishedVersionId: { not: null } },
        orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
        select: {
          id: true,
          slug: true,
          moduleId: true,
          module: { select: { code: true } },
          publishedVersion: { select: { title: true, concepts: true } },
        },
      }),
      this.prisma.question.findMany({
        where: {
          archived: false,
          quiz: { status: 'published', lesson: { publishedVersionId: { not: null } } },
        },
        select: { concepts: true, quiz: { select: { lessonId: true } } },
      }),
    ]);
    const order = new Map(lessonRows.map((l, i) => [l.id, i]));
    const byLesson = new Map<string, { concepts: string[] }[]>();
    for (const q of questions) {
      const list = byLesson.get(q.quiz.lessonId) ?? [];
      list.push({ concepts: q.concepts });
      byLesson.set(q.quiz.lessonId, list);
    }
    const index = buildConceptIndex(
      lessonRows.map((l) => ({ id: l.id, concepts: l.publishedVersion?.concepts ?? [] })),
      [...byLesson].map(([lessonId, qs]) => ({ lessonId, questions: qs })),
    );
    // Quizden gelen ders frontmatter'dakinden sonra eklenir; müfredat sırasına diz
    for (const u of index.values())
      u.lessons.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    const lessons = new Map<string, ConceptLessonRef>(
      lessonRows.map((l) => [
        l.id,
        {
          id: l.id,
          slug: l.slug,
          moduleId: l.moduleId,
          moduleCode: l.module.code,
          title: asLocalized(l.publishedVersion?.title ?? null),
        },
      ]),
    );
    return { index, lessons };
  }
}
