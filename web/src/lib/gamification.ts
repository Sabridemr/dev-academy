import { levelForXp, type LevelInfo, type ProgressSummary } from '@devacademy/shared';

/**
 * Özetten seviye bilgisi: sunucu `level` döndürdüyse o, yalnızca `xp` döndürdüyse aynı kuralla
 * (shared levelForXp) istemcide hesaplanır. XP alanı hiç yoksa (eski backend) null.
 */
export function summaryLevel(
  s: Pick<ProgressSummary, 'xp' | 'level'> | undefined | null,
): (LevelInfo & { xp: number }) | null {
  if (!s || typeof s.xp !== 'number') return null;
  return { ...(s.level ?? levelForXp(s.xp)), xp: s.xp };
}

/** Bugün çalışılan dakika ve hedef yüzdesi (hedef yoksa null) */
export function dailyGoalProgress(
  s: Pick<ProgressSummary, 'dailyGoalMinutes' | 'todaySeconds'> | undefined | null,
): { minutes: number; goal: number | null; percent: number } {
  const minutes = Math.floor((s?.todaySeconds ?? 0) / 60);
  const goal = s?.dailyGoalMinutes ?? null;
  return { minutes, goal, percent: goal ? Math.min(100, (minutes / goal) * 100) : 0 };
}
