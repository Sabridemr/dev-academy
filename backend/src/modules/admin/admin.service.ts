import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminLessonUpsertDto,
  AdminLessonVersion,
  AdminQuizUpsertDto,
  AdminSceneUpsertDto,
  LessonBlock,
  Paginated,
} from '@devacademy/shared';
import {
  buildSearchText,
  dateKey,
  LessonBlockSchema,
  QuizSchema,
  validateScene,
} from '@devacademy/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toJsonLocalized } from '../../common/utils/localized';
import { ContentService } from '../content/content.service';
import { SearchService } from '../search/search.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { jsonInput } from '../content/content.mapper';

/**
 * Admin / editör işlemleri: taslak oluşturma, sahne & quiz düzenleme, yayınlama akışı.
 * Yayınlama: taslak sürüm "published" olur, önceki yayın "archived"a düşer, cache temizlenir,
 * WebSocket üzerinden "content.published" olayı yayınlanır.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly content: ContentService,
    private readonly search: SearchService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /* ------------------------------- Dersler ------------------------------ */

  async listLessons(
    page = 1,
    pageSize = 50,
  ): Promise<
    Paginated<{
      id: string;
      slug: string;
      moduleId: string;
      order: number;
      title: unknown;
      publishedVersion: number | null;
      draftVersion: number | null;
      updatedAt: string;
    }>
  > {
    const [rows, total] = await Promise.all([
      this.prisma.lesson.findMany({
        orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          publishedVersion: true,
          versions: { where: { status: 'draft' }, orderBy: { version: 'desc' }, take: 1 },
        },
      }),
      this.prisma.lesson.count(),
    ]);
    return {
      items: rows.map((l) => ({
        id: l.id,
        slug: l.slug,
        moduleId: l.moduleId,
        order: l.order,
        title: (l.versions[0] ?? l.publishedVersion)?.title ?? '',
        publishedVersion: l.publishedVersion?.version ?? null,
        draftVersion: l.versions[0]?.version ?? null,
        updatedAt: l.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async getLessonVersions(lessonId: string): Promise<AdminLessonVersion[]> {
    const rows = await this.prisma.lessonVersion.findMany({
      where: { lessonId },
      orderBy: { version: 'desc' },
    });
    if (rows.length === 0) throw new NotFoundException('Ders bulunamadı');
    return rows.map((v) => ({
      id: v.id,
      lessonId: v.lessonId,
      version: v.version,
      status: v.status,
      createdAt: v.createdAt.toISOString(),
      publishedAt: v.publishedAt?.toISOString() ?? null,
      authorId: v.authorId,
    }));
  }

  async getVersion(versionId: string) {
    const v = await this.prisma.lessonVersion.findUnique({
      where: { id: versionId },
      include: { lesson: true },
    });
    if (!v) throw new NotFoundException('Sürüm bulunamadı');
    return v;
  }

  /** Dersin taslağını oluşturur ya da günceller (ders yoksa dersi de oluşturur) */
  async upsertDraft(dto: AdminLessonUpsertDto, authorId: string) {
    const blocks = dto.blocks.map((b, i) => {
      const parsed = LessonBlockSchema.safeParse({ ...b, order: i });
      if (!parsed.success)
        throw new BadRequestException({
          message: `Blok ${i} geçersiz`,
          details: parsed.error.issues.map((is) => ({
            path: `blocks.${i}.${is.path.join('.')}`,
            message: is.message,
          })),
        });
      return parsed.data;
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const module = await tx.module.findUnique({ where: { id: dto.moduleId } });
      if (!module) throw new NotFoundException('Modül bulunamadı');
      const before = await tx.lesson.findUnique({ where: { id: dto.id } });
      const lesson = await tx.lesson.upsert({
        where: { id: dto.id },
        update: { slug: dto.slug, moduleId: dto.moduleId, order: dto.order },
        create: { id: dto.id, slug: dto.slug, moduleId: dto.moduleId, order: dto.order },
      });
      const draft = await tx.lessonVersion.findFirst({
        where: { lessonId: lesson.id, status: 'draft' },
        orderBy: { version: 'desc' },
      });
      const data = {
        title: toJsonLocalized(dto.title),
        summary: toJsonLocalized(dto.summary),
        durationMinutes: dto.durationMinutes,
        level: dto.level,
        tags: dto.tags,
        prerequisites: dto.prerequisites,
        concepts: dto.concepts,
        blocks: jsonInput(blocks),
        authorId,
      };
      let version;
      if (draft) version = await tx.lessonVersion.update({ where: { id: draft.id }, data });
      else {
        const last = await tx.lessonVersion.findFirst({
          where: { lessonId: lesson.id },
          orderBy: { version: 'desc' },
        });
        version = await tx.lessonVersion.create({
          data: {
            ...data,
            lessonId: lesson.id,
            version: (last?.version ?? 0) + 1,
            status: 'draft',
          },
        });
      }
      return { version, before, lesson };
    });

    // slug/modül/sıra ders kimliğinin parçası ve hemen canlıya yansır: yayındaysa cache'ler eskimesin
    // (komşu derslerin önceki/sonraki bağlantıları da değiştiği için tüm içerik cache'i temizlenir)
    const { before, lesson } = result;
    if (
      before?.publishedVersionId &&
      (before.slug !== lesson.slug ||
        before.moduleId !== lesson.moduleId ||
        before.order !== lesson.order)
    ) {
      await this.content.invalidateAll();
      await this.search.invalidate();
    }
    return result.version;
  }

  async publish(lessonId: string, versionId?: string) {
    const version = versionId
      ? await this.prisma.lessonVersion.findFirst({ where: { id: versionId, lessonId } })
      : await this.prisma.lessonVersion.findFirst({
          where: { lessonId, status: 'draft' },
          orderBy: { version: 'desc' },
        });
    if (!version) throw new NotFoundException('Yayınlanacak taslak bulunamadı');
    const blocks = (version.blocks as unknown as LessonBlock[]) ?? [];
    const searchText = buildSearchText(
      blocks,
      version.title,
      version.summary,
      version.concepts,
      version.tags,
    );

    const lesson = await this.prisma.$transaction(async (tx) => {
      await tx.lessonVersion.updateMany({
        where: { lessonId, status: 'published' },
        data: { status: 'archived' },
      });
      await tx.lessonVersion.update({
        where: { id: version.id },
        data: { status: 'published', publishedAt: new Date() },
      });
      return tx.lesson.update({
        where: { id: lessonId },
        data: { publishedVersionId: version.id, searchText },
      });
    });
    await this.content.invalidateLesson(lessonId, lesson.slug);
    await this.content.invalidateAll();
    await this.search.invalidate();
    this.realtime.broadcast({
      type: 'content.published',
      payload: { lessonId, version: version.version },
    });
    return { lessonId, version: version.version, publishedAt: new Date().toISOString() };
  }

  async unpublish(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Ders bulunamadı');
    await this.prisma.$transaction([
      this.prisma.lessonVersion.updateMany({
        where: { lessonId, status: 'published' },
        data: { status: 'archived' },
      }),
      this.prisma.lesson.update({ where: { id: lessonId }, data: { publishedVersionId: null } }),
    ]);
    await this.content.invalidateAll();
    await this.search.invalidate();
    // İstemciler ders/modül önbelleğini tazelesin (yayınlamadaki gibi)
    this.realtime.broadcast({ type: 'content.unpublished', payload: { lessonId } });
    return { lessonId, published: false };
  }

  /** Yayındaki sürümden yeni bir taslak türet (düzenlemeye başlamak için) */
  async forkDraft(lessonId: string, authorId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        publishedVersion: true,
        versions: { where: { status: 'draft' }, orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!lesson) throw new NotFoundException('Ders bulunamadı');
    if (lesson.versions.length > 0) return lesson.versions[0];
    const base = lesson.publishedVersion;
    if (!base)
      throw new BadRequestException('Dersin yayınlanmış sürümü yok; doğrudan taslak oluşturun');
    const last = await this.prisma.lessonVersion.findFirst({
      where: { lessonId },
      orderBy: { version: 'desc' },
    });
    return this.prisma.lessonVersion.create({
      data: {
        lessonId,
        version: (last?.version ?? 0) + 1,
        status: 'draft',
        title: base.title as never,
        summary: base.summary as never,
        durationMinutes: base.durationMinutes,
        level: base.level,
        tags: base.tags,
        prerequisites: base.prerequisites,
        concepts: base.concepts,
        blocks: base.blocks as never,
        authorId,
      },
    });
  }

  /* ------------------------------- Sahneler ----------------------------- */

  async listScenes(lessonId?: string) {
    const rows = await this.prisma.animationScene.findMany({
      where: lessonId ? { lessonId } : {},
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        lessonId: true,
        version: true,
        status: true,
        title: true,
        updatedAt: true,
      },
    });
    return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
  }

  async getScene(id: string) {
    const row = await this.prisma.animationScene.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Sahne bulunamadı');
    return row;
  }

  async upsertScene(dto: AdminSceneUpsertDto, authorId: string, publish = false) {
    const result = validateScene(dto.scene);
    if (!result.ok || !result.scene) {
      throw new BadRequestException({
        message: 'Sahne geçersiz',
        details: result.issues
          .filter((i) => i.severity === 'error')
          .map((i) => ({ path: i.path, message: i.message })),
      });
    }
    const scene = result.scene;
    if (dto.lessonId) {
      const exists = await this.prisma.lesson.count({ where: { id: dto.lessonId } });
      if (!exists) throw new NotFoundException('Ders bulunamadı');
    }
    const existing = await this.prisma.animationScene.findUnique({ where: { id: scene.id } });
    const row = await this.prisma.animationScene.upsert({
      where: { id: scene.id },
      update: {
        data: jsonInput(scene),
        title: toJsonLocalized(scene.title),
        lessonId: dto.lessonId ?? existing?.lessonId ?? null,
        version: (existing?.version ?? 0) + 1,
        status: publish ? 'published' : (existing?.status ?? 'draft'),
        authorId,
      },
      create: {
        id: scene.id,
        data: jsonInput(scene),
        title: toJsonLocalized(scene.title),
        lessonId: dto.lessonId ?? null,
        version: 1,
        status: publish ? 'published' : 'draft',
        authorId,
      },
    });
    await this.content.invalidateAll();
    return { ...row, warnings: result.issues.filter((i) => i.severity === 'warning') };
  }

  async publishScene(id: string) {
    const row = await this.prisma.animationScene.update({
      where: { id },
      data: { status: 'published' },
    });
    await this.content.invalidateAll();
    return row;
  }

  async deleteScene(id: string) {
    await this.prisma.animationScene.delete({ where: { id } });
    await this.content.invalidateAll();
  }

  /* -------------------------------- Quiz -------------------------------- */

  async upsertQuiz(dto: AdminQuizUpsertDto) {
    const parsed = QuizSchema.safeParse(dto.quiz);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Quiz geçersiz',
        details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const quiz = parsed.data;
    const exists = await this.prisma.lesson.count({ where: { id: dto.lessonId } });
    if (!exists) throw new NotFoundException('Ders bulunamadı');
    return this.prisma.$transaction(async (tx) => {
      await tx.quiz.upsert({
        where: { id: quiz.id },
        update: {
          lessonId: dto.lessonId,
          title: toJsonLocalized(quiz.title),
          passScore: quiz.passScore,
        },
        create: {
          id: quiz.id,
          lessonId: dto.lessonId,
          title: toJsonLocalized(quiz.title),
          passScore: quiz.passScore,
        },
      });
      const keys = quiz.questions.map((q) => q.id);
      // Silmek yerine arşivle: cascade ile öğrencilerin deneme cevapları ve tekrar kartları silinmesin
      await tx.question.updateMany({
        where: { quizId: quiz.id, key: { notIn: keys } },
        data: { archived: true },
      });
      for (const [i, q] of quiz.questions.entries()) {
        const data = {
          archived: false,
          order: i,
          type: q.type,
          prompt: toJsonLocalized(q.prompt),
          options: jsonInput(q.options),
          correct: q.correct,
          explanation: toJsonLocalized(q.explanation),
          difficulty: q.difficulty,
          concepts: q.concepts,
        };
        await tx.question.upsert({
          where: { quizId_key: { quizId: quiz.id, key: q.id } },
          update: data,
          create: { ...data, quizId: quiz.id, key: q.id },
        });
      }
      return tx.quiz.findUniqueOrThrow({
        where: { id: quiz.id },
        include: { questions: { orderBy: { order: 'asc' } } },
      });
    });
  }

  async getQuizFull(quizId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!quiz) throw new NotFoundException('Quiz bulunamadı');
    return quiz;
  }

  /* ------------------------------- Modüller ----------------------------- */

  async upsertModule(dto: {
    id: string;
    slug: string;
    code: string;
    order: number;
    title: unknown;
    description: unknown;
    icon?: string;
    color?: string;
    group?: string;
  }) {
    const row = await this.prisma.module.upsert({
      where: { id: dto.id },
      update: {
        slug: dto.slug,
        code: dto.code,
        order: dto.order,
        title: jsonInput(dto.title),
        description: jsonInput(dto.description),
        icon: dto.icon,
        color: dto.color,
        group: dto.group,
      },
      create: {
        id: dto.id,
        slug: dto.slug,
        code: dto.code,
        order: dto.order,
        title: jsonInput(dto.title),
        description: jsonInput(dto.description),
        icon: dto.icon ?? 'book',
        color: dto.color ?? '#6366f1',
        group: dto.group,
      },
    });
    await this.content.invalidateAll();
    return row;
  }

  /* ------------------------------ İstatistik ---------------------------- */

  async stats() {
    const [users, lessons, published, scenes, quizzes, attempts, activeToday] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.lesson.count(),
      this.prisma.lesson.count({ where: { publishedVersionId: { not: null } } }),
      this.prisma.animationScene.count(),
      this.prisma.quiz.count(),
      this.prisma.attempt.count(),
      this.countActiveToday(),
    ]);
    return { users, lessons, published, scenes, quizzes, attempts, activeToday };
  }

  /** lastActivityDate kullanıcının kendi saat dilimindeki gündür; "bugün" her dilim için ayrı hesaplanır */
  private async countActiveToday(): Promise<number> {
    const now = new Date();
    const zones = await this.prisma.user.groupBy({
      by: ['timezone'],
      where: { deletedAt: null, lastActivityDate: { not: null } },
    });
    const conditions = zones.flatMap(({ timezone }) => {
      try {
        return [{ timezone, lastActivityDate: dateKey(now, timezone) }];
      } catch {
        return []; // geçersiz saat dilimi kaydı
      }
    });
    if (conditions.length === 0) return 0;
    return this.prisma.user.count({ where: { deletedAt: null, OR: conditions } });
  }
}
