/**
 * XP VE SEVİYE
 * ------------
 * Backend her olayda XP yazar (XpEvent), kullanıcıdaki toplam (User.xp) artar.
 * Seviye eşikleri sabittir; istemciler aynı fonksiyonla ilerleme çubuğunu çizer.
 */

export const XP_RULES = {
  /** Ders ilk kez %100 tamamlandı */
  lessonCompleted: 50,
  /** Quiz geçildi (ilk geçiş) */
  quizPassed: 30,
  /** Quizde tüm sorular doğru (geçme puanına ek) */
  quizPerfectBonus: 20,
  /** Tekrar kartı değerlendirildi (kalite ≥ 3) */
  reviewGraded: 5,
  /** Günlük hedef tutturuldu (günde bir kez) */
  dailyGoalMet: 20,
  /** Mülakat/deneme sınavı geçildi */
  examPassed: 100,
  /** Modül bitirildi (sertifika ile birlikte) */
  moduleCompleted: 150,
} as const;

export type XpEventKind = keyof typeof XP_RULES;

export const MAX_LEVEL = 50;

/** Seviyeye ulaşmak için gereken toplam XP: 100, 250, 450, 700, 1000 … (artış her seviyede 50 büyür) */
export function xpThresholdForLevel(level: number): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return 25 * (l - 1) * (l + 2);
}

export interface LevelInfo {
  level: number;
  /** Bu seviyeye girildiğinden beri kazanılan XP */
  xpIntoLevel: number;
  /** Bir sonraki seviyeye kadar gereken toplam XP (bu seviye içinde) */
  xpForNextLevel: number;
  /** 0..1 */
  progress: number;
}

export function levelForXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpThresholdForLevel(level + 1)) level += 1;
  const base = xpThresholdForLevel(level);
  const next = level < MAX_LEVEL ? xpThresholdForLevel(level + 1) : base;
  const span = Math.max(1, next - base);
  return {
    level,
    xpIntoLevel: xp - base,
    xpForNextLevel: span,
    progress: level >= MAX_LEVEL ? 1 : Math.min(1, (xp - base) / span),
  };
}

/* ---------------------------- Seri dondurma --------------------------- */

export interface StreakWithFreeze {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  /** Kullanılabilir dondurma hakkı */
  streakFreezes: number;
}

/**
 * Bir gün atlanmışsa (gap = 2) ve dondurma hakkı varsa seri korunur ve bir hak düşer.
 * daysBetween gamification/index.ts'tendir; burada bağımlılığı kırmak için parametre alınır.
 */
export function applyActivityWithFreeze(
  state: StreakWithFreeze,
  todayKey: string,
  daysBetween: (a: string, b: string) => number,
): StreakWithFreeze & { usedFreeze: boolean } {
  if (!state.lastActivityDate) {
    return {
      ...state,
      currentStreak: 1,
      longestStreak: Math.max(1, state.longestStreak),
      lastActivityDate: todayKey,
      usedFreeze: false,
    };
  }
  const gap = daysBetween(state.lastActivityDate, todayKey);
  if (gap <= 0) return { ...state, usedFreeze: false };
  if (gap === 1) {
    const currentStreak = state.currentStreak + 1;
    return {
      ...state,
      currentStreak,
      longestStreak: Math.max(state.longestStreak, currentStreak),
      lastActivityDate: todayKey,
      usedFreeze: false,
    };
  }
  if (gap === 2 && state.streakFreezes > 0) {
    const currentStreak = state.currentStreak + 1;
    return {
      ...state,
      currentStreak,
      longestStreak: Math.max(state.longestStreak, currentStreak),
      lastActivityDate: todayKey,
      streakFreezes: state.streakFreezes - 1,
      usedFreeze: true,
    };
  }
  return { ...state, currentStreak: 1, lastActivityDate: todayKey, usedFreeze: false };
}

/** Haftada bir dondurma hakkı yenilenir (en fazla 2 birikir) */
export const STREAK_FREEZE_MAX = 2;
