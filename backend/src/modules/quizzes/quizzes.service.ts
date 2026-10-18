import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AttemptResult, QuizPublic, SubmitAttemptDto, LocalizedString } from '@devacademy/shared';
import { gradeAnswer, qualityFromAnswer, sm2Review, SM2_INITIAL } from '@devacademy/shared';
import type { Prisma, Question, Quiz } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { asLocalized } from '../../common/utils/localized';
import { ProgressService } from '../progress/progress.service';

/**
 * Quiz motoru: soruları doğru cevapsız sunar, denemeleri puanlar, yanlışları
 * aralıklı tekrar (SM-2) kartlarına dönüştürür, rozet/aktivite tetikler.
 */
@Injectable()
export class QuizzesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
  ) {}

  async getQuiz(quizId: string): Promise<QuizPublic> {
    const quiz = await this.prisma.quiz.findFirst({ where: { id: quizId, status: 'published' }, include: { questions: { where: { archived: false }, orderBy: { order: 'asc' } } } });
    if (!quiz) throw new NotFoundException('Quiz bulunamadı');
    return toPublic(quiz);
  }

  async getLessonQuiz(lessonId: string): Promise<QuizPublic> {
    const quiz = await this.prisma.quiz.findFirst({ where: { lessonId, status: 'published' }, include: { questions: { where: { archived: false }, orderBy: { order: 'asc' } } } });
    if (!quiz) throw new NotFoundException('Bu dersin quizi yok');
    return toPublic(quiz);
  }

  async submit(userId: string, quizId: string, dto: SubmitAttemptDto): Promise<AttemptResult> {
    const quiz = await this.prisma.quiz.findFirst({ where: { id: quizId, status: 'published' }, include: { questions: { where: { archived: false } } } });
    if (!quiz) throw new NotFoundException('Quiz bulunamadı');
    const byKey = new Map(quiz.questions.map((q) => [q.key, q]));
    const answered = new Map(dto.answers.map((a) => [a.questionId, a.selected]));
    for (const id of answered.keys()) {
      if (!byKey.has(id)) throw new BadRequestException(`Bilinmeyen soru: ${id}`);
    }

    const results = quiz.questions.map((q) => {
      const selected = answered.get(q.key) ?? [];
      const correct = selected.length > 0 && gradeAnswer(q.type, selected, q.correct);
      return { question: q, selected, correct };
    });
    const correctCount = results.filter((r) => r.correct).length;
    const totalCount = quiz.questions.length;
    const score = Math.round((correctCount / Math.max(1, totalCount)) * 100);
    const passed = score >= quiz.passScore;

    // Deneme ve tekrar kartları birlikte yazılır: yarıda kalırsa ikisi de geri alınır
    const perQuestionMs = dto.durationMs ? dto.durationMs / Math.max(1, totalCount) : undefined;
    const attempt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.attempt.create({
        data: {
          userId,
          quizId,
          score,
          passed,
          correctCount,
          totalCount,
          durationMs: dto.durationMs,
          answers: { create: results.map((r) => ({ questionId: r.question.id, selected: r.selected, correct: r.correct })) },
        },
      });
      // Aralıklı tekrar kartları: yanlışlar yeni/sıfırlanmış kart, doğrular mevcut kartı ilerletir
      await this.upsertReviewCards(tx, userId, quiz.lessonId, results.map((r) => ({ question: r.question, correct: r.correct })), perQuestionMs);
      return created;
    });

    const newBadges = await this.progress.recordActivity(userId, { quizCompleted: true, perfectQuiz: correctCount === totalCount });

    return {
      attemptId: attempt.id,
      quizId,
      score,
      passed,
      correctCount,
      totalCount,
      results: results.map((r) => ({
        questionId: r.question.key,
        correct: r.correct,
        selected: r.selected,
        correctAnswer: r.question.correct,
        explanation: asLocalized(r.question.explanation),
      })),
      newBadges,
    };
  }

  async listAttempts(userId: string, quizId?: string) {
    const attempts = await this.prisma.attempt.findMany({
      where: { userId, ...(quizId ? { quizId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { quiz: { select: { id: true, lessonId: true, title: true } } },
    });
    return attempts.map((a) => ({
      id: a.id,
      quizId: a.quizId,
      lessonId: a.quiz.lessonId,
      quizTitle: asLocalized(a.quiz.title),
      score: a.score,
      passed: a.passed,
      correctCount: a.correctCount,
      totalCount: a.totalCount,
      durationMs: a.durationMs,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  private async upsertReviewCards(
    tx: Prisma.TransactionClient,
    userId: string,
    lessonId: string,
    results: { question: Question; correct: boolean }[],
    perQuestionMs?: number,
  ): Promise<void> {
    const now = new Date();
    // Mevcut kartlar tek sorguda okunur (soru başına ayrı sorgu yerine)
    const existingCards = await tx.reviewCard.findMany({ where: { userId, questionId: { in: results.map((r) => r.question.id) } } });
    const byQuestion = new Map(existingCards.map((c) => [c.questionId, c]));
    const creates: Prisma.ReviewCardCreateManyInput[] = [];
    for (const r of results) {
      const existing = byQuestion.get(r.question.id);
      if (!existing && r.correct) continue; // doğru bilinen ve kartı olmayan soru için kart açma
      const quality = qualityFromAnswer(r.correct, perQuestionMs);
      const card = sm2Review(existing ?? SM2_INITIAL, quality);
      const dueAt = new Date(now.getTime() + card.intervalDays * 86_400_000);
      const concept = r.question.concepts[0] ?? lessonId;
      if (existing) {
        await tx.reviewCard.update({
          where: { id: existing.id },
          data: { intervalDays: card.intervalDays, easeFactor: card.easeFactor, repetitions: card.repetitions, dueAt, lastReviewed: now },
        });
      } else {
        creates.push({ userId, questionId: r.question.id, lessonId, concept, intervalDays: card.intervalDays, easeFactor: card.easeFactor, repetitions: card.repetitions, dueAt, lastReviewed: now });
      }
    }
    if (creates.length > 0) await tx.reviewCard.createMany({ data: creates, skipDuplicates: true });
  }
}

export function toPublic(quiz: Quiz & { questions: Question[] }): QuizPublic {
  return {
    id: quiz.id,
    lessonId: quiz.lessonId,
    title: asLocalized(quiz.title),
    passScore: quiz.passScore,
    questions: quiz.questions.map((q) => ({
      id: q.key,
      type: q.type,
      prompt: asLocalized(q.prompt),
      options: (q.options as { id: string; text: LocalizedString }[]).map((o) => ({ id: o.id, text: o.text })),
      difficulty: q.difficulty,
      concepts: q.concepts,
    })),
  };
}
