import { STREAK_FREEZE_MAX, type XpEventKind } from '@devacademy/shared';

const WEEK_MS = 7 * 86_400_000;

/**
 * Haftalık seri dondurma hakkı yenilemesi. İlk aktivitede sayaç başlar (hak verilmez; varsayılan 1 hak
 * kayıtta gelir); her tam hafta için bir hak eklenir, en fazla STREAK_FREEZE_MAX birikir.
 * Sayaç tam haftalar kadar ilerletilir: yenileme anı kullanıcının aktivite saatine göre kaymaz.
 */
export function refillFreezes(
  streakFreezes: number,
  lastGrantAt: Date | null,
  now: Date,
): { streakFreezes: number; lastFreezeGrantAt: Date } {
  if (!lastGrantAt) return { streakFreezes, lastFreezeGrantAt: now };
  const weeks = Math.floor((now.getTime() - lastGrantAt.getTime()) / WEEK_MS);
  if (weeks < 1) return { streakFreezes, lastFreezeGrantAt: lastGrantAt };
  return {
    streakFreezes: Math.min(STREAK_FREEZE_MAX, streakFreezes + weeks),
    lastFreezeGrantAt: new Date(lastGrantAt.getTime() + weeks * WEEK_MS),
  };
}

export interface XpAward {
  kind: XpEventKind;
  /** (userId, kind, refId) tekil: aynı olay için XP ikinci kez yazılmaz */
  refId: string;
}

export interface XpTriggers {
  lessonCompleted?: string;
  quizPassed?: string;
  perfectQuiz?: boolean;
  reviewGraded?: string;
  examPassed?: string;
  /** Günlük hedef bu eylemle (ya da daha önce) tutturuldu */
  dailyGoalMet?: boolean;
  /** Tamamlanan modüller */
  modulesCompleted?: string[];
}

/** Bir eylemin hak ettirdiği XP olayları (tekillik anahtarlarıyla) */
export function xpAwardsFor(t: XpTriggers, todayKey: string): XpAward[] {
  const out: XpAward[] = [];
  if (t.lessonCompleted) out.push({ kind: 'lessonCompleted', refId: t.lessonCompleted });
  if (t.quizPassed) {
    out.push({ kind: 'quizPassed', refId: t.quizPassed });
    if (t.perfectQuiz) out.push({ kind: 'quizPerfectBonus', refId: t.quizPassed });
  }
  // Aynı kart günde bir kez XP verir (art arda değerlendirmeyle XP kasılamaz)
  if (t.reviewGraded) out.push({ kind: 'reviewGraded', refId: `${t.reviewGraded}:${todayKey}` });
  if (t.examPassed) out.push({ kind: 'examPassed', refId: t.examPassed });
  if (t.dailyGoalMet) out.push({ kind: 'dailyGoalMet', refId: todayKey });
  for (const m of t.modulesCompleted ?? []) out.push({ kind: 'moduleCompleted', refId: m });
  return out;
}
