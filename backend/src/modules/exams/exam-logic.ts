import { createHash } from 'node:crypto';
import { gradeAnswer, type ExamResult } from '@devacademy/shared';
import type { Question } from '@prisma/client';
import { asLocalized } from '../../common/utils/localized';

/** Sınav geçme puanı (yüzde) */
export const EXAM_PASS_SCORE = 70;
/** Ağ gecikmesi için süre aşımı toleransı */
export const EXAM_GRACE_MS = 15_000;

/** Sınav içindeki soru kimliği: `${quizId}:${questionKey}` */
export const examQuestionId = (q: { quizId: string; key: string }) => `${q.quizId}:${q.key}`;

const rank = (seed: string, id: string) =>
  createHash('sha256').update(`${seed}:${id}`).digest('hex');

/**
 * Deterministik-rastgele soru seçimi: aynı tohum aynı seçimi verir (yeniden üretilebilir).
 * Sorular modüllere göre gruplanıp her grup tohumla karıştırılır, ardından modüller arasında sırayla
 * alınır; böylece sınav tek bir modüle yığılmaz.
 */
export function pickQuestions(
  pool: { id: string; moduleId: string }[],
  count: number,
  seed: string,
): string[] {
  const groups = new Map<string, { id: string; r: string }[]>();
  for (const q of pool) {
    const g = groups.get(q.moduleId) ?? [];
    g.push({ id: q.id, r: rank(seed, q.id) });
    groups.set(q.moduleId, g);
  }
  const queues = [...groups.entries()]
    .sort(([a], [b]) => rank(seed, a).localeCompare(rank(seed, b)))
    .map(([, g]) => g.sort((a, b) => a.r.localeCompare(b.r)).map((x) => x.id));
  const out: string[] = [];
  while (out.length < count && queues.some((q) => q.length > 0)) {
    for (const q of queues) {
      const id = q.shift();
      if (id && out.length < count) out.push(id);
    }
  }
  return out;
}

export function isTimedOut(startedAt: Date, durationSec: number, now: Date): boolean {
  if (durationSec <= 0) return false;
  return now.getTime() > startedAt.getTime() + durationSec * 1000 + EXAM_GRACE_MS;
}

export interface ExamQuestionRow {
  question: Question;
  lessonId: string;
  moduleId: string;
}

export type GradedExam = Omit<ExamResult, 'examId' | 'timedOut' | 'xpEarned'> & {
  graded: { row: ExamQuestionRow; correct: boolean }[];
};

/** Sınavı puanlar: soru, kavram ve modül bazında doğru/toplam */
export function gradeExam(
  rows: ExamQuestionRow[],
  answers: Map<string, string[]>,
  passScore = EXAM_PASS_SCORE,
): GradedExam {
  const graded = rows.map((row) => {
    const selected = answers.get(examQuestionId(row.question)) ?? [];
    const correct =
      selected.length > 0 && gradeAnswer(row.question.type, selected, row.question.correct);
    return { row, correct };
  });
  const correctCount = graded.filter((g) => g.correct).length;
  const totalCount = rows.length;
  const score = Math.round((correctCount / Math.max(1, totalCount)) * 100);
  const tally = (key: (g: (typeof graded)[number]) => string[]) => {
    const m = new Map<string, { correct: number; total: number }>();
    for (const g of graded)
      for (const k of key(g)) {
        const t = m.get(k) ?? { correct: 0, total: 0 };
        t.total += 1;
        if (g.correct) t.correct += 1;
        m.set(k, t);
      }
    return [...m.entries()];
  };
  return {
    score,
    passed: totalCount > 0 && score >= passScore,
    correctCount,
    totalCount,
    results: graded.map((g) => ({
      questionId: examQuestionId(g.row.question),
      correct: g.correct,
      correctAnswer: g.row.question.correct,
      explanation: asLocalized(g.row.question.explanation),
    })),
    perConcept: tally((g) => [...new Set(g.row.question.concepts)]).map(([concept, t]) => ({
      concept,
      ...t,
    })),
    perModule: tally((g) => [g.row.moduleId]).map(([moduleId, t]) => ({ moduleId, ...t })),
    graded,
  };
}
