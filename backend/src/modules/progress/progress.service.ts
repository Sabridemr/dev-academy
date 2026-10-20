import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  BadgeDto,
  CertificateDto,
  DailyActivityDto,
  ProgressItem,
  ProgressSummary,
  ReviewCardDto,
  ReviewItem,
  UpdateProgressDto,
  XpEventDto,
} from '@devacademy/shared';
import {
  applyActivityWithFreeze,
  dateKey,
  daysBetween,
  effectiveStreak,
  evaluateBadges,
  levelForXp,
  sm2Review,
  XP_RULES,
  type BadgeContext,
} from '@devacademy/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { asLocalized } from '../../common/utils/localized';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CertificatesService } from '../certificates/certificates.service';
import { publishedLessonIdsForPath } from '../certificates/path-lessons';
import { refillFreezes, xpAwardsFor, type XpAward } from './motivation';

export interface ActivityFlags {
  lessonCompleted?: string;
  quizCompleted?: boolean;
  perfectQuiz?: boolean;
  interactive?: boolean;
  note?: boolean;
  /** Geçilen quiz: ilk geçişte XP (kusursuzsa perfectQuiz ile bonus), günlük quizzesPassed sayacı */
  quizPassed?: string;
  /** Kalite ≥ 3 ile değerlendirilen tekrar kartı */
  reviewGraded?: string;
  /** Geçilen deneme sınavı */
  examPassed?: string;
  /** Bu eylemde harcanan saniye (günlük aktivite ve günlük hedef) */
  secondsSpent?: number;
}

export interface ActivityOutcome {
  badges: BadgeDto[];
  /** Bu eylemle kazanılan XP */
  xpDelta: number;
  certificates: CertificateDto[];
}

/** Rozet koşullarını değiştirebilen eylemler (süre/tekrar/sınav yalnızca XP ve günlük aktiviteyi etkiler) */
const BADGE_FLAGS = [
  'lessonCompleted',
  'quizCompleted',
  'perfectQuiz',
  'interactive',
  'note',
] as const;

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
    private readonly certificates: CertificatesService,
  ) {}

  async list(userId: string): Promise<ProgressItem[]> {
    const rows = await this.prisma.progress.findMany({
      where: { userId },
      include: { lesson: { select: { moduleId: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((p) => toItem(p));
  }

  async update(
    userId: string,
    lessonId: string,
    dto: UpdateProgressDto,
  ): Promise<ProgressItem & { newBadges: BadgeDto[] }> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, publishedVersionId: { not: null } },
      select: { id: true, moduleId: true },
    });
    if (!lesson) throw new NotFoundException('Ders bulunamadı');
    const existing = await this.prisma.progress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
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
        completedAt: completed ? (existing?.completedAt ?? new Date()) : null,
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

    const newBadges = await this.recordActivity(userId, {
      lessonCompleted: completed && !wasCompleted ? lessonId : undefined,
      secondsSpent: dto.secondsSpent,
    });
    const item = toItem(row);
    this.realtime.emitToUser(userId, { type: 'progress.updated', payload: item });
    return { ...item, newBadges };
  }

  async summary(userId: string): Promise<ProgressSummary> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const today = dateKey(new Date(), user.timezone);
    const [
      totalLessons,
      progress,
      badges,
      perModuleTotals,
      dueReviews,
      timeAgg,
      nextReview,
      todayActivity,
    ] = await Promise.all([
      this.prisma.lesson.count({ where: { publishedVersionId: { not: null } } }),
      // Yalnızca yayındaki dersler: yayından kalkan dersler oranı %100'ün üstüne taşımasın
      this.prisma.progress.findMany({
        where: { userId, lesson: { publishedVersionId: { not: null } } },
        include: {
          lesson: {
            select: { moduleId: true, slug: true, publishedVersion: { select: { title: true } } },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.userBadge.findMany({
        where: { userId },
        include: { badge: true },
        orderBy: { earnedAt: 'desc' },
      }),
      this.prisma.lesson.groupBy({
        by: ['moduleId'],
        where: { publishedVersionId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.reviewCard.count({ where: { userId, dueAt: { lte: new Date() } } }),
      this.prisma.progress.aggregate({ where: { userId }, _sum: { secondsSpent: true } }),
      this.prisma.reviewCard.findFirst({
        where: { userId, dueAt: { gt: new Date() } },
        orderBy: { dueAt: 'asc' },
        select: { dueAt: true },
      }),
      this.prisma.dailyActivity.findUnique({
        where: { userId_date: { userId, date: today } },
        select: { seconds: true },
      }),
    ]);
    const completed = progress.filter((p) => p.status === 'completed');
    const completedPerModule = new Map<string, number>();
    for (const p of completed)
      completedPerModule.set(
        p.lesson.moduleId,
        (completedPerModule.get(p.lesson.moduleId) ?? 0) + 1,
      );
    const continueLesson = progress.find((p) => p.status === 'in_progress') ?? null;

    return {
      totalLessons,
      completedLessons: completed.length,
      completionPercent: totalLessons ? Math.round((completed.length / totalLessons) * 100) : 0,
      currentStreak: streakWithFreeze(user, today),
      longestStreak: user.longestStreak,
      lastActivityDate: user.lastActivityDate,
      activeToday: user.lastActivityDate === today,
      totalSecondsSpent: timeAgg._sum.secondsSpent ?? 0,
      badges: badges.map((ub) => toBadgeDto(ub.badge, ub.earnedAt)),
      perModule: perModuleTotals.map((m) => ({
        moduleId: m.moduleId,
        total: m._count._all,
        completed: completedPerModule.get(m.moduleId) ?? 0,
      })),
      continueLesson: continueLesson
        ? {
            id: continueLesson.lessonId,
            slug: continueLesson.lesson.slug,
            moduleId: continueLesson.lesson.moduleId,
            title: asLocalized(continueLesson.lesson.publishedVersion?.title),
            percent: continueLesson.percent,
          }
        : null,
      dueReviews,
      nextReviewAt: nextReview?.dueAt.toISOString() ?? null,
      xp: user.xp,
      level: levelForXp(user.xp),
      dailyGoalMinutes: user.dailyGoalMinutes,
      todaySeconds: todayActivity?.seconds ?? 0,
      streakFreezes: user.streakFreezes,
    };
  }

  /* ------------------------------ Aktivite & XP ------------------------------ */

  /** Son `days` günün aktivitesi (yalnızca kaydı olan günler; eksik günleri istemci doldurur) */
  async activity(userId: string, days: number): Promise<DailyActivityDto[]> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    const from = dateKey(new Date(Date.now() - (days - 1) * 86_400_000), user.timezone);
    const rows = await this.prisma.dailyActivity.findMany({
      where: { userId, date: { gte: from } },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => ({
      date: r.date,
      seconds: r.seconds,
      lessonsCompleted: r.lessonsCompleted,
      quizzesPassed: r.quizzesPassed,
      xp: r.xp,
    }));
  }

  /** Son 50 XP olayı (yeniden eskiye) */
  async xpHistory(userId: string): Promise<XpEventDto[]> {
    const rows = await this.prisma.xpEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      amount: r.amount,
      refId: r.refId,
      createdAt: r.createdAt.toISOString(),
    }));
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
    const card = await this.prisma.reviewCard.findFirst({
      where: { id: cardId, userId },
      include: { question: true },
    });
    if (!card) throw new NotFoundException('Tekrar kartı bulunamadı');
    const next = sm2Review(card, quality);
    const updated = await this.prisma.reviewCard.update({
      where: { id: card.id },
      data: {
        intervalDays: next.intervalDays,
        easeFactor: next.easeFactor,
        repetitions: next.repetitions,
        dueAt: new Date(Date.now() + next.intervalDays * 86_400_000),
        lastReviewed: new Date(),
      },
    });
    await this.recordActivity(userId, { reviewGraded: quality >= 3 ? card.id : undefined });
    return {
      id: updated.id,
      concept: updated.concept,
      questionId: card.question.key,
      lessonId: updated.lessonId,
      dueAt: updated.dueAt.toISOString(),
      intervalDays: updated.intervalDays,
      easeFactor: updated.easeFactor,
      repetitions: updated.repetitions,
    };
  }

  async recordInteractive(
    userId: string,
    interactive: string,
    lessonId?: string,
    params?: Record<string, unknown>,
  ): Promise<BadgeDto[]> {
    await this.prisma.interactiveSession.create({
      data: { userId, interactive, lessonId: lessonId ?? null, params: (params ?? {}) as never },
    });
    return this.recordActivity(userId, { interactive: true });
  }

  /* ---------------------------- Seri & rozet ----------------------------- */

  async recordActivity(userId: string, flags: ActivityFlags): Promise<BadgeDto[]> {
    return (await this.recordActivityDetailed(userId, flags)).badges;
  }

  /**
   * Seri (dondurma hakkıyla), günlük aktivite, XP, modül/yol sertifikası ve rozetler.
   * XP olayları (userId, kind, refId) ile tekildir: aynı ders/quiz/gün için ikinci kez verilmez.
   */
  async recordActivityDetailed(userId: string, flags: ActivityFlags): Promise<ActivityOutcome> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const now = new Date();
    const today = dateKey(now, user.timezone);
    const refill = refillFreezes(user.streakFreezes, user.lastFreezeGrantAt, now);
    const next = applyActivityWithFreeze(
      {
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        lastActivityDate: user.lastActivityDate,
        streakFreezes: refill.streakFreezes,
      },
      today,
      daysBetween,
    );
    const streak = {
      currentStreak: next.currentStreak,
      longestStreak: next.longestStreak,
      lastActivityDate: next.lastActivityDate,
      streakFreezes: next.streakFreezes,
    };
    const streakChanged =
      streak.lastActivityDate !== user.lastActivityDate ||
      streak.currentStreak !== user.currentStreak;
    const userChanged =
      streakChanged ||
      streak.streakFreezes !== user.streakFreezes ||
      refill.lastFreezeGrantAt.getTime() !== user.lastFreezeGrantAt?.getTime();
    if (userChanged) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { ...streak, lastFreezeGrantAt: refill.lastFreezeGrantAt },
      });
    }
    if (streakChanged) {
      this.realtime.emitToUser(userId, {
        type: 'streak.updated',
        payload: { currentStreak: streak.currentStreak },
      });
    }

    // Günlük aktivite (ısı haritası + günlük hedef)
    const seconds = flags.secondsSpent ?? 0;
    const lessonsCompleted = flags.lessonCompleted ? 1 : 0;
    const quizzesPassed = flags.quizPassed ? 1 : 0;
    const daily = await this.prisma.dailyActivity.upsert({
      where: { userId_date: { userId, date: today } },
      update: {
        seconds: { increment: seconds },
        lessonsCompleted: { increment: lessonsCompleted },
        quizzesPassed: { increment: quizzesPassed },
      },
      create: { userId, date: today, seconds, lessonsCompleted, quizzesPassed },
    });
    const goalSeconds = (user.dailyGoalMinutes ?? 0) * 60;

    // Modül / yol tamamlama yalnızca yeni tamamlanan derste değişebilir
    const completedTargets = flags.lessonCompleted
      ? await this.completedTargets(userId, flags.lessonCompleted)
      : { modules: [], paths: [] };

    const awards = xpAwardsFor(
      {
        lessonCompleted: flags.lessonCompleted,
        quizPassed: flags.quizPassed,
        perfectQuiz: flags.perfectQuiz,
        reviewGraded: flags.reviewGraded,
        examPassed: flags.examPassed,
        dailyGoalMet: goalSeconds > 0 && seconds > 0 && daily.seconds >= goalSeconds,
        modulesCompleted: completedTargets.modules,
      },
      today,
    );
    const xpDelta = await this.grantXp(userId, today, awards);

    const certificates: CertificateDto[] = [];
    for (const [type, ids] of [
      ['module', completedTargets.modules],
      ['path', completedTargets.paths],
    ] as const) {
      for (const id of ids) {
        const cert = await this.certificates.issue(userId, type, id);
        if (!cert) continue;
        certificates.push(cert);
        this.realtime.emitToUser(userId, { type: 'certificate.issued', payload: cert });
      }
    }

    const badges = await this.evaluateNewBadges(userId, streak.currentStreak, flags, streakChanged);
    return { badges, xpDelta, certificates };
  }

  /**
   * XP olaylarını yazar; daha önce verilmiş olanlar (unique) atlanır. Toplam, kullanıcıya ve günlük
   * aktiviteye aynı transaction'da eklenir. Kazanılan XP döner.
   */
  private async grantXp(userId: string, today: string, awards: XpAward[]): Promise<number> {
    if (awards.length === 0) return 0;
    const result = await this.prisma.$transaction(async (tx) => {
      let delta = 0;
      for (const a of awards) {
        // createMany + skipDuplicates → INSERT ... ON CONFLICT DO NOTHING: eş zamanlı isteklerde de tek kayıt
        const { count } = await tx.xpEvent.createMany({
          data: [{ userId, kind: a.kind, amount: XP_RULES[a.kind], refId: a.refId }],
          skipDuplicates: true,
        });
        if (count > 0) delta += XP_RULES[a.kind];
      }
      if (delta === 0) return null;
      const updated = await tx.user.update({
        where: { id: userId },
        data: { xp: { increment: delta } },
        select: { xp: true },
      });
      await tx.dailyActivity.upsert({
        where: { userId_date: { userId, date: today } },
        update: { xp: { increment: delta } },
        create: { userId, date: today, xp: delta },
      });
      return { delta, xp: updated.xp };
    });
    if (!result) return 0;
    this.realtime.emitToUser(userId, {
      type: 'xp.updated',
      payload: { xp: result.xp, level: levelForXp(result.xp).level, delta: result.delta },
    });
    return result.delta;
  }

  /** Ders tamamlanınca bitmiş olan modül ve öğrenme yolları */
  private async completedTargets(
    userId: string,
    lessonId: string,
  ): Promise<{ modules: string[]; paths: string[] }> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { moduleId: true },
    });
    if (!lesson) return { modules: [], paths: [] };
    const published = { publishedVersionId: { not: null } } as const;
    const [moduleTotal, moduleDone, pathItems] = await Promise.all([
      this.prisma.lesson.count({ where: { moduleId: lesson.moduleId, ...published } }),
      this.prisma.progress.count({
        where: { userId, status: 'completed', lesson: { moduleId: lesson.moduleId, ...published } },
      }),
      this.prisma.learningPathItem.findMany({
        where: { OR: [{ moduleId: lesson.moduleId }, { lessonId }] },
        select: { pathId: true },
        distinct: ['pathId'],
      }),
    ]);
    const modules = moduleTotal > 0 && moduleDone >= moduleTotal ? [lesson.moduleId] : [];
    const paths: string[] = [];
    for (const { pathId } of pathItems) {
      const ids = await publishedLessonIdsForPath(this.prisma, pathId);
      if (!ids?.length || !ids.includes(lessonId)) continue;
      const done = await this.prisma.progress.count({
        where: { userId, status: 'completed', lessonId: { in: ids } },
      });
      if (done >= ids.length) paths.push(pathId);
    }
    return { modules, paths };
  }

  private async evaluateNewBadges(
    userId: string,
    currentStreak: number,
    flags: ActivityFlags,
    streakChanged: boolean,
  ): Promise<BadgeDto[]> {
    // Rozet koşulları yalnızca bir tamamlama/etkileşim ya da seri değişince değişebilir; kaydırma sırasındaki
    // sıradan ilerleme güncellemelerinde rozet sorgularına (≈8 sorgu) gerek yok
    if (!streakChanged && !BADGE_FLAGS.some((k) => Boolean(flags[k]))) return [];

    const ctx = await this.badgeContext(userId, currentStreak, flags);
    const earnedSlugs = (
      await this.prisma.userBadge.findMany({
        where: { userId },
        include: { badge: { select: { slug: true } } },
      })
    ).map((b) => b.badge.slug);
    const newly = evaluateBadges(ctx, earnedSlugs);
    if (newly.length === 0) return [];

    const badges = await this.prisma.badge.findMany({
      where: { slug: { in: newly.map((b) => b.slug) } },
    });
    const out: BadgeDto[] = [];
    for (const b of badges) {
      // Eş zamanlı iki aktivite aynı rozeti kazandırabilir; unique ihlali "zaten kazanılmış" demektir
      let earnedAt: Date;
      try {
        earnedAt = (await this.prisma.userBadge.create({ data: { userId, badgeId: b.id } }))
          .earnedAt;
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

  private async badgeContext(
    userId: string,
    currentStreak: number,
    flags: ActivityFlags,
  ): Promise<BadgeContext> {
    const [
      completedLessons,
      attempts,
      perfect,
      interactiveSessions,
      notesCount,
      moduleTotals,
      completedByModule,
    ] = await Promise.all([
      this.prisma.progress.count({ where: { userId, status: 'completed' } }),
      this.prisma.attempt.count({ where: { userId } }),
      this.prisma.attempt.count({
        where: { userId, correctCount: { gt: 0 }, AND: [{ score: 100 }] },
      }),
      this.prisma.interactiveSession.count({ where: { userId } }),
      this.prisma.note.count({ where: { userId } }),
      this.prisma.lesson.groupBy({
        by: ['moduleId'],
        where: { publishedVersionId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.progress.findMany({
        where: { userId, status: 'completed' },
        select: { lesson: { select: { moduleId: true } } },
      }),
    ]);
    const perModule = new Map<string, number>();
    for (const p of completedByModule)
      perModule.set(p.lesson.moduleId, (perModule.get(p.lesson.moduleId) ?? 0) + 1);
    const completedModuleIds = moduleTotals
      .filter((m) => (perModule.get(m.moduleId) ?? 0) >= m._count._all && m._count._all > 0)
      .map((m) => m.moduleId);
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

/**
 * Okuma sırasında seri: bir gün atlanmış ama dondurma hakkı varsa seri bugün aktivite yapılırsa
 * korunacağı için sıfır gösterilmez (applyActivityWithFreeze ile tutarlı).
 */
export function streakWithFreeze(
  user: {
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: string | null;
    streakFreezes: number;
  },
  today: string,
): number {
  const effective = effectiveStreak(user, today);
  if (effective > 0 || !user.lastActivityDate) return effective;
  return daysBetween(user.lastActivityDate, today) === 2 && user.streakFreezes > 0
    ? user.currentStreak
    : 0;
}

function toItem(p: {
  lessonId: string;
  status: string;
  percent: number;
  lastBlockId: string | null;
  secondsSpent: number;
  completedAt: Date | null;
  updatedAt: Date;
  lesson: { moduleId: string };
}): ProgressItem {
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

export function toBadgeDto(
  b: { id: string; slug: string; title: unknown; description: unknown; icon: string },
  earnedAt?: Date,
): BadgeDto {
  return {
    id: b.id,
    slug: b.slug,
    title: asLocalized(b.title as never),
    description: asLocalized(b.description as never),
    icon: b.icon,
    earnedAt: earnedAt?.toISOString(),
  };
}
