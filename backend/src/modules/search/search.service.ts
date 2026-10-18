import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SearchResponse, SearchResult } from '@devacademy/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { asLocalized } from '../../common/utils/localized';

/**
 * Arama: PostgreSQL full-text (tsvector 'simple' sözlüğü — Türkçe için ek sözlük gerekmez,
 * ekler kelime köküne göre değil tam kelimeye göre eşleşir); sonuç yoksa ILIKE alt dize yedeği.
 * Sonuçlar ders, modül ve kavram (concepts dizisi) düzeyinde döner.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async search(rawQuery: string, limit = 20): Promise<SearchResponse> {
    const started = Date.now();
    const query = rawQuery.trim().slice(0, 100);
    if (query.length < 2) return { query, results: [], tookMs: 0 };

    const cacheKey = `search:${query.toLowerCase()}:${limit}`;
    const cached = await this.redis.getJson<SearchResult[]>(cacheKey);
    if (cached) return { query, results: cached, tookMs: Date.now() - started };

    const like = `%${escapeLike(query)}%`;
    // Önce yalnızca full-text (GIN indeksini kullanır); hiç sonuç yoksa ILIKE alt dize yedeği (tam tarama)
    let rows = await this.lessonRows(
      query,
      limit,
      Prisma.sql`to_tsvector('simple', l."searchText") @@ plainto_tsquery('simple', ${query})`,
    );
    if (rows.length === 0) {
      rows = await this.lessonRows(
        query,
        limit,
        Prisma.sql`(l."searchText" ILIKE ${like}
             OR v."title"::text ILIKE ${like}
             OR EXISTS (SELECT 1 FROM unnest(v."concepts") c WHERE c ILIKE ${like}))`,
      );
    }

    const results: SearchResult[] = [];
    const q = query.toLowerCase();
    for (const r of rows) {
      const title = asLocalized(r.title);
      const titleText = typeof title === 'string' ? title : `${title.tr} ${title.en ?? ''}`;
      const titleHit = titleText.toLowerCase().includes(q);
      const conceptHit = r.concepts.find((c) => c.toLowerCase().includes(q));
      results.push({
        type: conceptHit && !titleHit ? 'concept' : 'lesson',
        id: r.id,
        slug: r.slug,
        moduleId: r.moduleId,
        title,
        snippet:
          conceptHit && !titleHit
            ? `Kavram: ${conceptHit} — ${r.headline}`
            : r.headline || String(asLocalized(r.summary)),
        score: Number(r.rank) + (titleHit ? 1 : 0) + (conceptHit ? 0.5 : 0),
      });
    }

    // Modül başlıkları
    // Modül başlıkları: büyük/küçük harf duyarsız, Türkçe ve İngilizce başlıkta
    const modules = await this.prisma.$queryRaw<
      { id: string; slug: string; title: Prisma.JsonValue; description: Prisma.JsonValue }[]
    >(Prisma.sql`
      SELECT m."id", m."slug", m."title", m."description"
      FROM "Module" m
      WHERE (m."title"->>'tr') ILIKE ${like} OR (m."title"->>'en') ILIKE ${like} OR m."slug" ILIKE ${like}
      ORDER BY m."order"
      LIMIT 5
    `);
    for (const m of modules) {
      results.push({
        type: 'module',
        id: m.id,
        slug: m.slug,
        moduleId: null,
        title: asLocalized(m.title),
        snippet: String(asLocalized(m.description)),
        score: 0.8,
      });
    }

    results.sort((a, b) => b.score - a.score);
    const out = results.slice(0, limit);
    await this.redis.setJson(cacheKey, out, 300);
    return { query, results: out, tookMs: Date.now() - started };
  }

  private lessonRows(query: string, limit: number, where: Prisma.Sql) {
    return this.prisma.$queryRaw<
      {
        id: string;
        slug: string;
        moduleId: string;
        title: Prisma.JsonValue;
        summary: Prisma.JsonValue;
        concepts: string[];
        rank: number;
        headline: string;
      }[]
    >(Prisma.sql`
      SELECT l."id", l."slug", l."moduleId", v."title", v."summary", v."concepts",
             ts_rank(to_tsvector('simple', l."searchText"), plainto_tsquery('simple', ${query})) AS rank,
             ts_headline('simple', left(l."searchText", 4000), plainto_tsquery('simple', ${query}),
                         'MaxWords=24, MinWords=12, ShortWord=2, StartSel=**, StopSel=**') AS headline
      FROM "Lesson" l
      JOIN "LessonVersion" v ON v."id" = l."publishedVersionId"
      WHERE l."publishedVersionId" IS NOT NULL AND ${where}
      ORDER BY rank DESC, l."moduleId", l."order"
      LIMIT ${limit}
    `);
  }

  async invalidate(): Promise<void> {
    await this.redis.delByPattern('search:*');
  }
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}
