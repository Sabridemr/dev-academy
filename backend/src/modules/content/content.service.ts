import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  LearningPathDetail,
  LearningPathSummary,
  LessonDetail,
  LessonSummary,
  ModuleDetail,
  ModuleSummary,
  SceneResponse,
  ProgressStatus,
} from '@devacademy/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { blocksOf, toLessonDetail, toLessonSummary, toModuleSummary, toPathSummary, toSceneResponse, type LessonWithVersion } from './content.mapper';

/** Yayınlanmış içerik için cache TTL (saniye). Yayınlama anında anahtarlar temizlenir. */
const CONTENT_TTL = 60 * 60 * 6;

/** Yayındaki sahne; derse bağlıysa ders de yayında olmalı (bağımsız sahneler her zaman açık) */
const PUBLIC_SCENE = {
  status: 'published',
  OR: [{ lessonId: null }, { lesson: { publishedVersionId: { not: null } } }],
} satisfies Prisma.AnimationSceneWhereInput;

export const CacheKeys = {
  paths: 'content:paths',
  path: (id: string) => `content:path:${id}`,
  modules: 'content:modules',
  module: (id: string) => `content:module:${id}`,
  lesson: (id: string) => `content:lesson:${id}`,
  scene: (id: string) => `content:scene:${id}`,
  lessonScenes: (lessonId: string) => `content:lesson-scenes:${lessonId}`,
};

/**
 * Yayınlanmış içerik okuma servisi. Yalnızca publishedVersion'ı olan dersleri döner.
 * Kullanıcı varsa modül/ders listelerine ilerleme bilgisi eklenir (cache'lenmeyen kısım).
 */
@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /* ------------------------------- Yollar ------------------------------- */

  async listPaths(): Promise<LearningPathSummary[]> {
    const cached = await this.redis.getJson<LearningPathSummary[]>(CacheKeys.paths);
    if (cached) return cached;
    const paths = await this.prisma.learningPath.findMany({ orderBy: { order: 'asc' }, include: { items: { include: { module: { include: { _count: { select: { lessons: { where: { publishedVersionId: { not: null } } } } } } } } } } });
    const out = paths.map((p) => {
      const moduleIds = new Set(p.items.map((i) => i.moduleId));
      const lessonCount = p.items.reduce((acc, i) => acc + (i.lessonId ? 1 : i.module._count.lessons), 0);
      return toPathSummary(p, moduleIds.size, lessonCount);
    });
    await this.redis.setJson(CacheKeys.paths, out, CONTENT_TTL);
    return out;
  }

  async getPath(idOrSlug: string, userId?: string): Promise<LearningPathDetail> {
    const key = CacheKeys.path(idOrSlug);
    let detail = await this.redis.getJson<LearningPathDetail>(key);
    if (!detail) {
      const path = await this.prisma.learningPath.findFirst({
        where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
        include: { items: { orderBy: { order: 'asc' }, include: { module: { include: { _count: { select: { lessons: { where: { publishedVersionId: { not: null } } } } } } } } } },
      });
      if (!path) throw new NotFoundException('Öğrenme yolu bulunamadı');
      const seen = new Set<string>();
      const modules: ModuleSummary[] = [];
      for (const item of path.items) {
        if (seen.has(item.moduleId)) continue;
        seen.add(item.moduleId);
        modules.push(toModuleSummary(item.module));
      }
      const lessonCount = path.items.reduce((acc, i) => acc + (i.lessonId ? 1 : i.module._count.lessons), 0);
      detail = { ...toPathSummary(path, seen.size, lessonCount), modules };
      await this.redis.setJson(key, detail, CONTENT_TTL);
    }
    if (userId) detail = { ...detail, modules: await this.attachModuleProgress(detail.modules, userId) };
    return detail;
  }

  /* ------------------------------ Modüller ------------------------------ */

  async listModules(userId?: string): Promise<ModuleSummary[]> {
    let modules = await this.redis.getJson<ModuleSummary[]>(CacheKeys.modules);
    if (!modules) {
      const [rows, published] = await Promise.all([
        this.prisma.module.findMany({
          orderBy: { order: 'asc' },
          include: { _count: { select: { lessons: { where: { publishedVersionId: { not: null } } } } } },
        }),
        this.prisma.lesson.findMany({
          where: { publishedVersionId: { not: null } },
          select: { moduleId: true, publishedVersion: { select: { durationMinutes: true } } },
        }),
      ]);
      const minutes = new Map<string, number>();
      for (const l of published) minutes.set(l.moduleId, (minutes.get(l.moduleId) ?? 0) + (l.publishedVersion?.durationMinutes ?? 0));
      modules = rows.map((m) => toModuleSummary(m, undefined, minutes.get(m.id) ?? 0));
      await this.redis.setJson(CacheKeys.modules, modules, CONTENT_TTL);
    }
    return userId ? this.attachModuleProgress(modules, userId) : modules;
  }

  async getModule(idOrSlug: string, userId?: string): Promise<ModuleDetail> {
    const key = CacheKeys.module(idOrSlug);
    let detail = await this.redis.getJson<ModuleDetail>(key);
    if (!detail) {
      const module = await this.prisma.module.findFirst({
        where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
        include: {
          lessons: { where: { publishedVersionId: { not: null } }, orderBy: { order: 'asc' }, include: { publishedVersion: true } },
        },
      });
      if (!module) throw new NotFoundException('Modül bulunamadı');
      const totalMinutes = module.lessons.reduce((sum, l) => sum + (l.publishedVersion?.durationMinutes ?? 0), 0);
      detail = { ...toModuleSummary(module, module.lessons.length, totalMinutes), lessons: module.lessons.map(toLessonSummary) };
      await this.redis.setJson(key, detail, CONTENT_TTL);
    }
    if (userId) {
      const progress = await this.prisma.progress.findMany({ where: { userId, lessonId: { in: detail.lessons.map((l) => l.id) } } });
      const byLesson = new Map(progress.map((p) => [p.lessonId, p]));
      detail = {
        ...detail,
        completedCount: progress.filter((p) => p.status === 'completed').length,
        lessons: detail.lessons.map((l) => {
          const p = byLesson.get(l.id);
          return p ? { ...l, progress: { status: p.status as ProgressStatus, percent: p.percent } } : { ...l, progress: { status: 'not_started', percent: 0 } };
        }),
      };
    }
    return detail;
  }

  /* ------------------------------- Dersler ------------------------------ */

  async listLessons(moduleId?: string): Promise<LessonSummary[]> {
    const rows = await this.prisma.lesson.findMany({
      where: { publishedVersionId: { not: null }, ...(moduleId ? { moduleId } : {}) },
      orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
      include: { publishedVersion: true },
    });
    return rows.map(toLessonSummary);
  }

  async getLesson(idOrSlug: string, userId?: string): Promise<LessonDetail> {
    const key = CacheKeys.lesson(idOrSlug);
    let detail = await this.redis.getJson<LessonDetail>(key);
    if (!detail) {
      // Slug yalnızca modül içinde benzersiz: önce kimlikle, yoksa slug'la müfredat sırasındaki ilk ders
      const include = { publishedVersion: true, module: true } as const;
      const lesson =
        (await this.prisma.lesson.findFirst({ where: { id: idOrSlug, publishedVersionId: { not: null } }, include })) ??
        (await this.prisma.lesson.findFirst({
          where: { slug: idOrSlug, publishedVersionId: { not: null } },
          orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
          include,
        }));
      if (!lesson || !lesson.publishedVersion) throw new NotFoundException('Ders bulunamadı');
      const neighbors = await this.findNeighbors(lesson);
      detail = toLessonDetail(lesson, neighbors);
      await this.redis.setJson(key, detail, CONTENT_TTL);
      if (idOrSlug !== lesson.id) await this.redis.setJson(CacheKeys.lesson(lesson.id), detail, CONTENT_TTL);
    }
    if (userId) {
      const p = await this.prisma.progress.findUnique({ where: { userId_lessonId: { userId, lessonId: detail.id } } });
      detail = { ...detail, progress: p ? { status: p.status as ProgressStatus, percent: p.percent } : { status: 'not_started', percent: 0 } };
    }
    return detail;
  }

  /**
   * Yayındaki dersin bir kodlama alıştırmasının örnek çözümü. Ders detayı çözümü içermez; istemci
   * "Çözümü göster" düğmesini birkaç başarısız denemeden sonra açar ve bu uç noktayı (oturumla) çağırır.
   */
  async getExerciseSolution(lessonId: string, exerciseId: string): Promise<{ solution: string }> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, publishedVersionId: { not: null } },
      include: { publishedVersion: true },
    });
    const block = blocksOf(lesson?.publishedVersion ?? null).find(
      (b) => b.type === 'exercise' && b.exercise?.id === exerciseId,
    );
    if (!block || block.type !== 'exercise' || !block.solution) throw new NotFoundException('Alıştırma bulunamadı');
    return { solution: block.solution };
  }

  /** Müfredat sırasına göre önceki/sonraki yayınlanmış ders (modül sınırını aşar) */
  private async findNeighbors(lesson: LessonWithVersion & { module: { order: number } }) {
    const ordered = await this.prisma.lesson.findMany({
      where: { publishedVersionId: { not: null } },
      orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
      select: { id: true, slug: true, moduleId: true, publishedVersion: { select: { title: true } } },
    });
    const idx = ordered.findIndex((l) => l.id === lesson.id);
    return { prev: idx > 0 ? ordered[idx - 1] : null, next: idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null };
  }

  /* ------------------------------- Sahneler ----------------------------- */

  async getScene(id: string): Promise<SceneResponse> {
    const key = CacheKeys.scene(id);
    const cached = await this.redis.getJson<SceneResponse>(key);
    if (cached) return cached;
    const row = await this.prisma.animationScene.findFirst({ where: { id, ...PUBLIC_SCENE } });
    if (!row) throw new NotFoundException('Sahne bulunamadı');
    const out = toSceneResponse(row);
    await this.redis.setJson(key, out, CONTENT_TTL);
    return out;
  }

  async listLessonScenes(lessonId: string): Promise<SceneResponse[]> {
    const key = CacheKeys.lessonScenes(lessonId);
    const cached = await this.redis.getJson<SceneResponse[]>(key);
    if (cached) return cached;
    const rows = await this.prisma.animationScene.findMany({ where: { lessonId, ...PUBLIC_SCENE }, orderBy: { createdAt: 'asc' } });
    const out = rows.map(toSceneResponse);
    await this.redis.setJson(key, out, CONTENT_TTL);
    return out;
  }

  /* ------------------------------ Yardımcı ------------------------------ */

  private async attachModuleProgress(modules: ModuleSummary[], userId: string): Promise<ModuleSummary[]> {
    // Tamamlanan ve hâlâ yayında olan dersler (yayından kalkan ders sayıyı toplamın üstüne çıkarmasın)
    const lessons = await this.prisma.lesson.findMany({
      where: { publishedVersionId: { not: null }, progress: { some: { userId, status: 'completed' } } },
      select: { moduleId: true },
    });
    const perModule = new Map<string, number>();
    for (const l of lessons) perModule.set(l.moduleId, (perModule.get(l.moduleId) ?? 0) + 1);
    return modules.map((m) => ({ ...m, completedCount: perModule.get(m.id) ?? 0 }));
  }

  /** Yayınlama/güncelleme sonrası cache temizliği */
  async invalidateAll(): Promise<void> {
    await this.redis.delByPattern('content:*');
  }

  async invalidateLesson(lessonId: string, slug?: string): Promise<void> {
    await this.redis.del(CacheKeys.lesson(lessonId), CacheKeys.lessonScenes(lessonId), CacheKeys.modules, CacheKeys.paths);
    if (slug) await this.redis.del(CacheKeys.lesson(slug));
    await this.redis.delByPattern('content:module:*');
    await this.redis.delByPattern('content:path:*');
  }
}
