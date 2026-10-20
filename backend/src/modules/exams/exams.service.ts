import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Exam, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import type {
  CreateExamDto,
  ExamDto,
  ExamResult,
  LocalizedString,
  SubmitExamDto,
} from '@devacademy/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { asLocalized } from '../../common/utils/localized';
import { publishedLessonIdsForPath } from '../certificates/path-lessons';
import { ProgressService } from '../progress/progress.service';
import { PUBLIC_QUIZ } from '../quizzes/quizzes.service';
import { upsertReviewCards } from '../quizzes/review-cards';
import {
  EXAM_PASS_SCORE,
  examQuestionId,
  gradeExam,
  isTimedOut,
  pickQuestions,
  type ExamQuestionRow,
} from './exam-logic';

export interface ExamListItem {
  id: string;
  startedAt: string;
  durationSec: number;
  questionCount: number;
  submittedAt: string | null;
  score: number | null;
  passed: boolean | null;
}

/** GET /exams/:id: sorular + (gönderildiyse) sonuç */
export type ExamDetail = ExamDto & { submittedAt: string | null; result: ExamResult | null };

const QUESTION_INCLUDE = {
  quiz: { select: { lessonId: true, lesson: { select: { moduleId: true } } } },
} satisfies Prisma.QuestionInclude;

/**
 * Deneme/mülakat sınavı: yayındaki quizlerin arşivlenmemiş sorularından deterministik-rastgele seçim,
 * süre sınırı, kavram/modül kırılımlı sonuç, yanlışlar için aralıklı tekrar kartı ve XP.
 */
@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
  ) {}

  async create(userId: string, dto: CreateExamDto): Promise<ExamDto> {
    const lessonWhere = await this.poolLessonFilter(dto);
    const pool = await this.prisma.question.findMany({
      where: { archived: false, quiz: { ...PUBLIC_QUIZ, lesson: lessonWhere } },
      select: { id: true, quiz: { select: { lesson: { select: { moduleId: true } } } } },
    });
    if (pool.length === 0) throw new BadRequestException('Seçilen kapsamda soru yok');
    const startedAt = new Date();
    const seed = createHash('sha256').update(`${userId}:${startedAt.toISOString()}`).digest('hex');
    const questionIds = pickQuestions(
      pool.map((q) => ({ id: q.id, moduleId: q.quiz.lesson.moduleId })),
      dto.count,
      seed,
    );
    const exam = await this.prisma.exam.create({
      data: { userId, questionIds, startedAt, durationSec: dto.durationSec },
    });
    return this.toDto(exam, await this.loadRows(questionIds));
  }

  async get(userId: string, examId: string): Promise<ExamDetail> {
    const exam = await this.findOwned(userId, examId);
    const dto = this.toDto(exam, await this.loadRows(exam.questionIds));
    return {
      ...dto,
      submittedAt: exam.submittedAt?.toISOString() ?? null,
      result: (exam.result as unknown as ExamResult | null) ?? null,
    };
  }

  async list(userId: string): Promise<ExamListItem[]> {
    const rows = await this.prisma.exam.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
    return rows.map((e) => ({
      id: e.id,
      startedAt: e.startedAt.toISOString(),
      durationSec: e.durationSec,
      questionCount: e.questionIds.length,
      submittedAt: e.submittedAt?.toISOString() ?? null,
      score: e.score,
      passed: e.passed,
    }));
  }

  async submit(userId: string, examId: string, dto: SubmitExamDto): Promise<ExamResult> {
    const exam = await this.findOwned(userId, examId);
    if (exam.submittedAt) throw new ConflictException('Sınav zaten gönderildi');
    const rows = await this.loadRows(exam.questionIds);
    const known = new Set(rows.map((r) => examQuestionId(r.question)));
    const answers = new Map<string, string[]>();
    for (const a of dto.answers) {
      if (!known.has(a.questionId))
        throw new BadRequestException(`Bilinmeyen soru: ${a.questionId}`);
      answers.set(a.questionId, a.selected);
    }
    const now = new Date();
    const timedOut = isTimedOut(exam.startedAt, exam.durationSec, now);
    // Süre aşılsa da puanlanır; istemci timedOut ile uyarı gösterir
    const { graded, ...grade } = gradeExam(rows, answers);

    // Koşullu gönderim + tekrar kartları tek transaction: eş zamanlı iki gönderimden yalnızca biri geçer
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.exam.updateMany({
        where: { id: exam.id, submittedAt: null },
        data: { submittedAt: now, score: grade.score, passed: grade.passed },
      });
      if (count === 0) throw new ConflictException('Sınav zaten gönderildi');
      await upsertReviewCards(
        tx,
        userId,
        graded.map((g) => ({
          question: g.row.question,
          lessonId: g.row.lessonId,
          correct: g.correct,
        })),
      );
    });

    const outcome = await this.progress.recordActivityDetailed(userId, {
      examPassed: grade.passed ? exam.id : undefined,
    });
    const result: ExamResult = { examId: exam.id, ...grade, timedOut, xpEarned: outcome.xpDelta };
    await this.prisma.exam.update({
      where: { id: exam.id },
      data: { result: result as unknown as Prisma.InputJsonValue },
    });
    return result;
  }

  /* ----------------------------- yardımcılar ----------------------------- */

  /** Soru havuzunun ders filtresi: yol ve/veya modül listesi; ikisi de yoksa tüm yayındaki dersler */
  private async poolLessonFilter(dto: CreateExamDto): Promise<Prisma.LessonWhereInput> {
    const or: Prisma.LessonWhereInput[] = [];
    if (dto.pathId) {
      const ids = await publishedLessonIdsForPath(this.prisma, dto.pathId);
      if (!ids) throw new NotFoundException('Öğrenme yolu bulunamadı');
      or.push({ id: { in: ids } });
    }
    if (dto.moduleIds?.length) or.push({ moduleId: { in: dto.moduleIds } });
    return or.length > 0
      ? { publishedVersionId: { not: null }, OR: or }
      : { publishedVersionId: { not: null } };
  }

  private async findOwned(userId: string, examId: string): Promise<Exam> {
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, userId } });
    if (!exam) throw new NotFoundException('Sınav bulunamadı');
    return exam;
  }

  /** Sorular sınav sırasıyla; sınavdan sonra arşivlenen sorular da (anlık görüntü) dahildir */
  private async loadRows(questionIds: string[]): Promise<ExamQuestionRow[]> {
    const questions = await this.prisma.question.findMany({
      where: { id: { in: questionIds } },
      include: QUESTION_INCLUDE,
    });
    const byId = new Map(questions.map((q) => [q.id, q]));
    return questionIds.flatMap((id) => {
      const q = byId.get(id);
      if (!q) return []; // quiz silinmişse soru da gider
      const { quiz, ...question } = q;
      return [{ question, lessonId: quiz.lessonId, moduleId: quiz.lesson.moduleId }];
    });
  }

  private toDto(exam: Exam, rows: ExamQuestionRow[]): ExamDto {
    return {
      id: exam.id,
      startedAt: exam.startedAt.toISOString(),
      durationSec: exam.durationSec,
      passScore: EXAM_PASS_SCORE,
      // Doğru cevap ve açıklama gönderilmez
      questions: rows.map(({ question: q, lessonId, moduleId }) => ({
        id: examQuestionId(q),
        lessonId,
        moduleId,
        type: q.type,
        prompt: asLocalized(q.prompt),
        options: (q.options as { id: string; text: LocalizedString }[]).map((o) => ({
          id: o.id,
          text: o.text,
        })),
        concepts: q.concepts,
      })),
    };
  }
}
