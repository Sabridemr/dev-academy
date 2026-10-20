import type { Prisma, Question } from '@prisma/client';
import { qualityFromAnswer, sm2Review, SM2_INITIAL } from '@devacademy/shared';

export interface GradedQuestion {
  question: Question;
  /** Sorunun ait olduğu ders (sınavda sorular farklı derslerden gelir) */
  lessonId: string;
  correct: boolean;
}

/**
 * Aralıklı tekrar kartları: yanlışlar yeni/sıfırlanmış kart, doğrular mevcut kartı ilerletir.
 * Quiz denemesi ve deneme sınavı aynı kuralı kullanır; çağıran transaction içinde çalıştırır.
 */
export async function upsertReviewCards(
  tx: Prisma.TransactionClient,
  userId: string,
  results: GradedQuestion[],
  perQuestionMs?: number,
): Promise<void> {
  if (results.length === 0) return;
  const now = new Date();
  // Mevcut kartlar tek sorguda okunur (soru başına ayrı sorgu yerine)
  const existingCards = await tx.reviewCard.findMany({
    where: { userId, questionId: { in: results.map((r) => r.question.id) } },
  });
  const byQuestion = new Map(existingCards.map((c) => [c.questionId, c]));
  const creates: Prisma.ReviewCardCreateManyInput[] = [];
  for (const r of results) {
    const existing = byQuestion.get(r.question.id);
    if (!existing && r.correct) continue; // doğru bilinen ve kartı olmayan soru için kart açma
    const quality = qualityFromAnswer(r.correct, perQuestionMs);
    const card = sm2Review(existing ?? SM2_INITIAL, quality);
    const dueAt = new Date(now.getTime() + card.intervalDays * 86_400_000);
    const concept = r.question.concepts[0] ?? r.lessonId;
    if (existing) {
      await tx.reviewCard.update({
        where: { id: existing.id },
        data: {
          intervalDays: card.intervalDays,
          easeFactor: card.easeFactor,
          repetitions: card.repetitions,
          dueAt,
          lastReviewed: now,
        },
      });
    } else {
      creates.push({
        userId,
        questionId: r.question.id,
        lessonId: r.lessonId,
        concept,
        intervalDays: card.intervalDays,
        easeFactor: card.easeFactor,
        repetitions: card.repetitions,
        dueAt,
        lastReviewed: now,
      });
    }
  }
  if (creates.length > 0) await tx.reviewCard.createMany({ data: creates, skipDuplicates: true });
}
