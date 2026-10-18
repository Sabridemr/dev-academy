import type { LocalizedString } from '../i18n';

/**
 * OYUNLAŞTIRMA MANTIĞI
 * --------------------
 * Seri (streak), SM-2 tabanlı aralıklı tekrar ve rozet koşulları.
 * Backend bu fonksiyonları çağırır; mobil offline modda da aynı kuralları uygular.
 */

/* ------------------------------ Streak ----------------------------- */

/** YYYY-MM-DD biçiminde yerel tarih anahtarı */
export function dateKey(date: Date, timezone = 'UTC'): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(date);
}

export function daysBetween(a: string, b: string): number {
  const da = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)));
  const db = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  return Math.round((db - da) / 86_400_000);
}

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
}

/** Yeni aktivite kaydedildiğinde seri durumunu günceller */
export function applyActivity(state: StreakState, todayKey: string): StreakState {
  if (!state.lastActivityDate) {
    return { currentStreak: 1, longestStreak: Math.max(1, state.longestStreak), lastActivityDate: todayKey };
  }
  const gap = daysBetween(state.lastActivityDate, todayKey);
  if (gap <= 0) return state; // aynı gün
  const currentStreak = gap === 1 ? state.currentStreak + 1 : 1;
  return { currentStreak, longestStreak: Math.max(state.longestStreak, currentStreak), lastActivityDate: todayKey };
}

/** Okuma sırasında (aktivite olmadan) seri hâlâ geçerli mi */
export function effectiveStreak(state: StreakState, todayKey: string): number {
  if (!state.lastActivityDate) return 0;
  const gap = daysBetween(state.lastActivityDate, todayKey);
  return gap <= 1 ? state.currentStreak : 0;
}

/* --------------------------- Spaced repetition --------------------- */

export interface Sm2Card {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
}

export const SM2_INITIAL: Sm2Card = { intervalDays: 0, easeFactor: 2.5, repetitions: 0 };

/**
 * SM-2 algoritması (SuperMemo). quality 0..5.
 * < 3: tekrar sıfırdan; ≥ 3: aralık büyür. Ease factor 1.3 altına inmez.
 */
export function sm2Review(card: Sm2Card, quality: number): Sm2Card & { nextIntervalDays: number } {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { intervalDays, easeFactor, repetitions } = card;
  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor);
    repetitions += 1;
  }
  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  return { intervalDays, easeFactor, repetitions, nextIntervalDays: intervalDays };
}

/** Yanlış cevap → kart oluştur/sıfırla; doğru cevap → kaliteyi 4 kabul et */
export function qualityFromAnswer(correct: boolean, durationMs?: number): number {
  if (!correct) return 1;
  if (durationMs !== undefined && durationMs < 8_000) return 5;
  return 4;
}

/* ------------------------------ Rozetler --------------------------- */

export interface BadgeDefinition {
  slug: string;
  title: LocalizedString;
  description: LocalizedString;
  icon: string;
  condition: (ctx: BadgeContext) => boolean;
}

export interface BadgeContext {
  completedLessons: number;
  completedModuleIds: string[];
  currentStreak: number;
  perfectQuizzes: number;
  totalQuizzes: number;
  interactiveSessions: number;
  notesCount: number;
  lessonIdJustCompleted?: string;
}

export const BADGES: BadgeDefinition[] = [
  {
    slug: 'first-steps',
    title: { tr: 'İlk Adım', en: 'First Steps' },
    description: { tr: 'İlk dersini tamamladın.', en: 'You completed your first lesson.' },
    icon: 'footprints',
    condition: (c) => c.completedLessons >= 1,
  },
  {
    slug: 'ten-lessons',
    title: { tr: 'On Ders', en: 'Ten Lessons' },
    description: { tr: '10 ders tamamladın.', en: 'You completed 10 lessons.' },
    icon: 'medal',
    condition: (c) => c.completedLessons >= 10,
  },
  {
    slug: 'module-master',
    title: { tr: 'Modül Ustası', en: 'Module Master' },
    description: { tr: 'Bir modülün tüm derslerini bitirdin.', en: 'You finished every lesson in a module.' },
    icon: 'trophy',
    condition: (c) => c.completedModuleIds.length >= 1,
  },
  {
    slug: 'streak-7',
    title: { tr: '7 Günlük Seri', en: '7-Day Streak' },
    description: { tr: 'Yedi gün üst üste çalıştın.', en: 'You studied seven days in a row.' },
    icon: 'flame',
    condition: (c) => c.currentStreak >= 7,
  },
  {
    slug: 'streak-30',
    title: { tr: '30 Günlük Seri', en: '30-Day Streak' },
    description: { tr: 'Otuz gün üst üste çalıştın.', en: 'You studied thirty days in a row.' },
    icon: 'sun',
    condition: (c) => c.currentStreak >= 30,
  },
  {
    slug: 'perfect-quiz',
    title: { tr: 'Kusursuz', en: 'Flawless' },
    description: { tr: 'Bir quizde tüm soruları doğru yanıtladın.', en: 'You answered every question in a quiz correctly.' },
    icon: 'sparkles',
    condition: (c) => c.perfectQuizzes >= 1,
  },
  {
    slug: 'quiz-marathon',
    title: { tr: 'Quiz Maratonu', en: 'Quiz Marathon' },
    description: { tr: '25 quiz tamamladın.', en: 'You completed 25 quizzes.' },
    icon: 'timer',
    condition: (c) => c.totalQuizzes >= 25,
  },
  {
    slug: 'experimenter',
    title: { tr: 'Deneyci', en: 'Experimenter' },
    description: { tr: '10 interaktif simülasyonla oynadın.', en: 'You played with 10 interactive simulations.' },
    icon: 'flask-conical',
    condition: (c) => c.interactiveSessions >= 10,
  },
  {
    slug: 'note-taker',
    title: { tr: 'Not Alan', en: 'Note Taker' },
    description: { tr: '5 not yazdın.', en: 'You wrote 5 notes.' },
    icon: 'notebook-pen',
    condition: (c) => c.notesCount >= 5,
  },
  {
    slug: 'system-designer',
    title: { tr: 'Sistem Tasarımcısı', en: 'System Designer' },
    description: { tr: 'Sistem Tasarımı Temelleri modülünü bitirdin.', en: 'You finished the System Design Fundamentals module.' },
    icon: 'network',
    condition: (c) => c.completedModuleIds.includes('a-system-design-fundamentals'),
  },
  {
    slug: 'ai-explorer',
    title: { tr: 'AI Kâşifi', en: 'AI Explorer' },
    description: { tr: 'Yapay Zekâ modülünü bitirdin.', en: 'You finished the Artificial Intelligence module.' },
    icon: 'brain',
    condition: (c) => c.completedModuleIds.includes('g-artificial-intelligence'),
  },
];

/** Henüz kazanılmamış rozetlerden koşulu sağlananları döner */
export function evaluateBadges(ctx: BadgeContext, alreadyEarned: string[]): BadgeDefinition[] {
  const earned = new Set(alreadyEarned);
  return BADGES.filter((b) => !earned.has(b.slug) && b.condition(ctx));
}

/* ----------------------------- Quiz puanı -------------------------- */

export function gradeAnswer(type: 'single' | 'multiple' | 'truefalse' | 'order', selected: string[], correct: string[]): boolean {
  if (type === 'order') {
    return selected.length === correct.length && selected.every((v, i) => v === correct[i]);
  }
  const a = [...selected].sort();
  const b = [...correct].sort();
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
