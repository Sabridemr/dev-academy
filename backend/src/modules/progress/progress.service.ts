import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { BadgeDto, ProgressItem, ProgressSummary, ReviewCardDto, ReviewItem, UpdateProgressDto } from '@devacademy/shared';
import { applyActivity, dateKey, effectiveStreak, evaluateBadges, sm2Review, type BadgeContext } from '@devacademy/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { asLocalized } from '../../common/utils/localized';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface ActivityFlags {
  lessonCompleted?: string;
  quizCompleted?: boolean;
  perfectQuiz?: boolean;
  interactive?: boolean;
  note?: boolean;
}

/**
 * İlerleme, seri, rozet ve aralıklı tekrar servisi.
 * recordActivity() her anlamlı eylemde çağrılır: seri güncellenir, rozet koşulları değerlendirilir,
 * WebSocket ile istemciye bildirilir.
 */
@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(userId: string): Promise<ProgressItem[]> {
    const rows = await this.prisma.progress.findMany({ where: { userId }, include: { lesson: { select: { moduleId: true } } }, orderBy: { updatedAt: 'desc' } });
    return rows.map((p) => toItem(p));
  }

  async update(userId: string, lessonId: string, dto: UpdateProgressDto): Promise<ProgressItem & { newBadges: BadgeDto[] }> {
    const lesson = await this.prisma.lesson.findFirst({ where: { id: lessonId, publishedVersionId: { not: null } }, select: { id: true, moduleId: true } });
    if (!lesson) throw new NotFoundException('Ders bulunamadı');
    const existing = await this.prisma.progress.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
    const wasCompleted = existing?.status === 'completed';
    const percent = Math.max(existing?.percent ?? 0, Math.round(dto.percent));
    const completed = wasCompleted || dto.completed === true || percent >= 100;

    // include kullanılmaz: Prisma ancak öyle yerel INSERT ... ON CONFLICT kullanır (eş zamanlı isteklerde unique ihlali olmaz)
    const upserted = await this.prisma.progress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: {
        percent: completed ? 100 : percent,
        status: completed ? 'completed' : 'in_progress',
        lastBlockId: dto.lastBlockId ?? existing?.lastBlockId,
        secondsSpent: { increment: dto.secondsSpent },
        completedAt: completed ? existing?.completedAt ?? new Date() : null,
      },
      create: {
        userId,
        lessonId,
        percent: completed ? 100 : percent,
        status: completed ? 'completed' : 'in_progress',
        lastBlockId: dto.lastBlockId,
        secondsSpent: dto.secondsSpent,
        completedAt: completed ? new Date() : null,
      },
    });
    const row = { ...upserted, lesson: { moduleId: lesson.moduleId } };

    const newBadges = await this.recordActivity(userId, { lessonCompleted: completed && !wasCompleted ? lessonId : undefined });
    const item = toItem(row);
    this.realtime.emitToUser(userId, { type: 'progress.updated', payload: item });
    return { ...item, newBadges };
  }

  async summary(userId: string): Promise<ProgressSummary> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const today = dateKey(new Date(), user.timezone);
    const [totalLessons, progress, badges, perModuleTotals, dueReviews, timeAgg] = await Promise.all([
      this.prisma.lesson.count({ where: { publishedVersionId: { not: null } } }),
      this.prisma.progress.findMany({ where: { userId }, include: { lesson: { select: { moduleId: true, slug: true, publishedVersion: { select: { title: true } } } } }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.userBadge.findMany({ where: { userId }, include: { badge: true }, orderBy: { earnedAt: 'desc' } }),
      this.prisma.lesson.groupBy({ by: ['moduleId'], where: { publishedVersionId: { not: null } }, _count: { _all: true } }),
      this.prisma.reviewCard.count({ where: { userId, dueAt: { lte: new Date() } } }),
      this.prisma.progress.aggregate({ where: { userId }, _sum: { secondsSpent: true } }),
    ]);
    const completed = progress.filter((p) => p.status === 'completed');
    const completedPerModule = new Map<string, number>();
    for (const p of completed) completedPerModule.set(p.lesson.moduleId, (completedPerModule.get(p.lesson.moduleId) ?? 0) + 1);
    const continueLesson = progress.find((p) => p.status === 'in_progress') ?? null;

    return {
      totalLessons,
      completedLessons: completed.length,
      completionPercent: totalLessons ? Math.round((completed.length / totalLessons) * 100) : 0,
      currentStreak: effectiveStreak({ currentStreak: user.currentStreak, longestStreak: user.longestStreak, lastActivityDate: user.lastActivityDate }, today),
      longestStreak: user.longestStreak,
      lastActivityDate: user.lastActivityDate,
      activeToday: user.lastActivityDate === today,
      totalSecondsSpent: timeAgg._sum.secondsSpent ?? 0,
      badges: badges.map((ub) => toBadgeDto(ub.badge, ub.earnedAt)),
      perModule: perModuleTotals.map((m) => ({ moduleId: m.moduleId, total: m._count._all, completed: completedPerModule.get(m.moduleId) ?? 0 })),
      continueLesson: continueLesson
        ? { id: continueLesson.lessonId, slug: continueLesson.lesson.slug, moduleId: continueLesson.lesson.moduleId, title: asLocalized(continueLesson.lesson.publishedVersion?.title), percent: continueLesson.percent }
        : null,
      dueReviews,
    };
  }

  async listBadges(): Promise<BadgeDto[]> {
    const rows = await this.prisma.badge.findMany();
    return rows.map((b) => toBadgeDto(b));
  }

  /* --------------------------- Aralıklı tekrar --------------------------- */

  /** Vadesi gelen kartlar. Doğru cevap ve açıklama yalnızca kart sahibine döner (soruyu zaten quizde görmüştür). */
  async dueReviews(userId: string, limit = 20): Promise<ReviewCardDto[]> {
    const cards = await this.prisma.reviewCard.findMany({
      where: { userId, dueAt: { lte: new Date() }, question: { archived: false } },
      orderBy: { dueAt: 'asc' },
      take: limit,
      include: { question: true },
    });
    return cards.map((c) => ({
      id: c.id,
      concept: c.concept,
      questionId: c.question.key,
      lessonId: c.lessonId,
      dueAt: c.dueAt.toISOString(),
      intervalDays: c.intervalDays,
      easeFactor: c.easeFactor,
      repetitions: c.repetitions,
      prompt: asLocalized(c.question.prompt),
      options: c.question.options as unknown as ReviewCardDto['options'],
      type: c.question.type,
      correctAnswer: c.question.correct,
      explanation: asLocalized(c.question.explanation),
    }));
  }

  async gradeReview(userId: string, cardId: string, quality: number): Promise<ReviewItem> {
    const card = await this.prisma.reviewCard.findFirst({ where: { id: cardId, userId }, include: { question: true } });
    if (!card) throw new NotFoundException('Tekrar kartı bulunamadı');
    const next = sm2Review(card, quality);
    const updated = await this.prisma.reviewCard.update({
      where: { id: card.id },
      data: { intervalDays: next.intervalDays, easeFactor: next.easeFactor, repetitions: next.repetitions, dueAt: new Date(Date.now() + next.intervalDays * 86_400_000), lastReviewed: new Date() },
    });
    await this.recordActivity(userId, {});
    return { id: updated.id, concept: updated.concept, questionId: card.question.key, lessonId: updated.lessonId, dueAt: updated.dueAt.toISOString(), intervalDays: updated.intervalDays, easeFactor: updated.easeFactor, repetitions: updated.repetitions };
  }

  async recordInteractive(userId: string, interactive: string, lessonId?: string, params?: Record<string, unknown>): Promise<BadgeDto[]> {
    await this.prisma.interactiveSession.create({ data: { userId, interactive, lessonId: lessonId ?? null, params: (params ?? {}) as never } });
    return this.recordActivity(userId, { interactive: true });
  }

  /* ---------------------------- Seri & rozet ----------------------------- */

  async recordActivity(userId: string, flags: ActivityFlags): Promise<BadgeDto[]> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const today = dateKey(new Date(), user.timezone);
    const streak = applyActivity({ currentStreak: user.currentStreak, longestStreak: user.longestStreak, lastActivityDate: user.lastActivityDate }, today);
    if (streak.lastActivityDate !== user.lastActivityDate || streak.currentStreak !== user.currentStreak) {
      await this.prisma.user.update({ where: { id: userId }, data: streak });
      this.realtime.emitToUser(userId, { type: 'streak.updated', payload: { currentStreak: streak.currentStreak } });
    }

    const ctx = await this.badgeContext(userId, streak.currentStreak, flags);
    const earnedSlugs = (await this.prisma.userBadge.findMany({ where: { userId }, include: { badge: { select: { slug: true } } } })).map((b) => b.badge.slug);
    const newly = evaluateBadges(ctx, earnedSlugs);
    if (newly.length === 0) return [];

    const badges = await this.prisma.badge.findMany({ where: { slug: { in: newly.map((b) => b.slug) } } });
    const out: BadgeDto[] = [];
    for (const b of badges) {
      // Eş zamanlı iki aktivite aynı rozeti kazandırabilir; unique ihlali "zaten kazanılmış" demektir
      let earnedAt: Date;
      try {
        earnedAt = (await this.prisma.userBadge.create({ data: { userId, badgeId: b.id } })).earnedAt;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
        throw err;
      }
      const dto = toBadgeDto(b, earnedAt);
      out.push(dto);
      this.realtime.emitToUser(userId, { type: 'badge.earned', payload: dto });
    }
    return out;
  }

  private async badgeContext(userId: string, currentStreak: number, flags: ActivityFlags): Promise<BadgeContext> {
    const [completedLessons, attempts, perfect, interactiveSessions, notesCount, moduleTotals, completedByModule] = await Promise.all([
      this.prisma.progress.count({ where: { userId, status: 'completed' } }),
      this.prisma.attempt.count({ where: { userId } }),
      this.prisma.attempt.count({ where: { userId, correctCount: { gt: 0 }, AND: [{ score: 100 }] } }),
      this.prisma.interactiveSession.count({ where: { userId } }),
      this.prisma.note.count({ where: { userId } }),
      this.prisma.lesson.groupBy({ by: ['moduleId'], where: { publishedVersionId: { not: null } }, _count: { _all: true } }),
      this.prisma.progress.findMany({ where: { userId, status: 'completed' }, select: { lesson: { select: { moduleId: true } } } }),
    ]);
    const perModule = new Map<string, number>();
    for (const p of completedByModule) perModule.set(p.lesson.moduleId, (perModule.get(p.lesson.moduleId) ?? 0) + 1);
    const completedModuleIds = moduleTotals.filter((m) => (perModule.get(m.moduleId) ?? 0) >= m._count._all && m._count._all > 0).map((m) => m.moduleId);
    return {
      completedLessons,
      completedModuleIds,
      currentStreak,
      perfectQuizzes: perfect,
      totalQuizzes: attempts,
      interactiveSessions,
      notesCount,
      lessonIdJustCompleted: flags.lessonCompleted,
    };
  }
}

function toItem(p: { lessonId: string; status: string; percent: number; lastBlockId: string | null; secondsSpent: number; completedAt: Date | null; updatedAt: Date; lesson: { moduleId: string } }): ProgressItem {
  return {
    lessonId: p.lessonId,
    moduleId: p.lesson.moduleId,
    status: p.status as ProgressItem['status'],
    percent: p.percent,
    lastBlockId: p.lastBlockId,
    secondsSpent: p.secondsSpent,
    completedAt: p.completedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toBadgeDto(b: { id: string; slug: string; title: unknown; description: unknown; icon: string }, earnedAt?: Date): BadgeDto {
  return { id: b.id, slug: b.slug, title: asLocalized(b.title as never), description: asLocalized(b.description as never), icon: b.icon, earnedAt: earnedAt?.toISOString() };
}
