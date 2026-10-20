import type { ExamDto, SubmitExamDto } from '@devacademy/shared';

export type ExamAnswers = Record<string, string[]>;

/** Sınav bitiş anı (ms); süresiz sınavda null. Sunucu başlangıç zamanı okunamazsa `fallbackNow` kullanılır. */
export function examDeadline(
  exam: Pick<ExamDto, 'startedAt' | 'durationSec'>,
  fallbackNow: number,
) {
  if (!exam.durationSec) return null;
  const started = Date.parse(exam.startedAt);
  return (Number.isFinite(started) ? started : fallbackNow) + exam.durationSec * 1000;
}

/** Kalan saniye (0'ın altına inmez) */
export function remainingSeconds(deadline: number | null, now: number): number | null {
  if (deadline === null) return null;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** 75 → "01:15", 3725 → "1:02:05" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Bir soru cevaplandı mı? Sıralama soruları kullanıcı dokunduğunda cevaplanmış sayılır. */
export function isAnswered(answers: ExamAnswers, questionId: string): boolean {
  return (answers[questionId]?.length ?? 0) > 0;
}

/**
 * Gönderim gövdesi: her soru için bir kayıt. Dokunulmamış sıralama sorusu varsayılan sırayla,
 * cevapsız diğer sorular boş dizi olarak gider (sunucu yanlış sayar).
 */
export function buildSubmission(
  exam: Pick<ExamDto, 'questions'>,
  answers: ExamAnswers,
): SubmitExamDto {
  return {
    answers: exam.questions.map((q) => ({
      questionId: q.id,
      selected: answers[q.id] ?? (q.type === 'order' ? q.options.map((o) => o.id) : []),
    })),
  };
}

/** Oran → renk tonu: güçlü / orta / zayıf */
export function ratioTone(correct: number, total: number): 'success' | 'warning' | 'danger' {
  const r = total ? correct / total : 0;
  if (r >= 0.7) return 'success';
  if (r >= 0.4) return 'warning';
  return 'danger';
}
