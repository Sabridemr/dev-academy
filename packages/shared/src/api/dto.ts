import { z } from 'zod';
import type { LocalizedString } from '../i18n';
import type { LessonBlock, LessonLevel } from '../content/schema';
import type { AnimationScene } from '../scene/schema';

/**
 * API SÖZLEŞMESİ
 * --------------
 * Backend'in döndürdüğü ve istemcilerin tükettiği tipler. Zod şemaları istek gövdeleri için
 * backend'de doğrulama, istemcide form doğrulama olarak paylaşılır.
 */

/* ------------------------------ Hata ------------------------------- */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  /** Alan bazlı doğrulama hataları */
  details?: { path: string; message: string }[];
  requestId?: string;
  timestamp: string;
}

/* ------------------------------ Auth ------------------------------- */
export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(60),
  locale: z.enum(['tr', 'en']).default('tr'),
});
export type RegisterDto = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof LoginSchema>;

export const OAuthLoginSchema = z.object({
  provider: z.enum(['google', 'apple']),
  /** Sağlayıcıdan alınan ID token (JWT) */
  idToken: z.string().min(10),
  /** Apple ilk girişte adı yalnızca bir kez gönderir */
  displayName: z.string().optional(),
});
export type OAuthLoginDto = z.infer<typeof OAuthLoginSchema>;

export const RefreshSchema = z.object({ refreshToken: z.string().min(10) });
export type RefreshDto = z.infer<typeof RefreshSchema>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** saniye */
  expiresIn: number;
  tokenType: 'Bearer';
}

export type UserRole = 'student' | 'editor' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  locale: 'tr' | 'en';
  selectedPathId: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: UserProfile;
  tokens: AuthTokens;
}

/** IANA saat dilimi geçerli mi? (Intl.supportedValuesOf Hermes'te yok; kurucu denemesi her yerde çalışır) */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(2).max(60).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  locale: z.enum(['tr', 'en']).optional(),
  selectedPathId: z.string().nullable().optional(),
  reminderHour: z.number().int().min(0).max(23).nullable().optional(),
  timezone: z
    .string()
    .max(64)
    .refine(isValidTimeZone, { message: 'Geçersiz saat dilimi' })
    .optional(),
});
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;

/* ----------------------------- İçerik ------------------------------ */
export interface LearningPathSummary {
  id: string;
  slug: string;
  title: LocalizedString;
  description: LocalizedString;
  icon: string;
  moduleCount: number;
  lessonCount: number;
}

export interface LearningPathDetail extends LearningPathSummary {
  modules: ModuleSummary[];
}

export interface ModuleSummary {
  id: string;
  slug: string;
  code: string;
  order: number;
  title: LocalizedString;
  description: LocalizedString;
  icon: string;
  color: string;
  lessonCount: number;
  /** Oturum açmış kullanıcı için tamamlanan ders sayısı */
  completedCount?: number;
}

export interface LessonSummary {
  id: string;
  slug: string;
  moduleId: string;
  order: number;
  title: LocalizedString;
  summary: LocalizedString;
  durationMinutes: number;
  level: LessonLevel;
  tags: string[];
  hasAnimation: boolean;
  hasInteractive: boolean;
  hasQuiz: boolean;
  /** Oturum açmış kullanıcı için */
  progress?: { status: ProgressStatus; percent: number };
}

export interface ModuleDetail extends ModuleSummary {
  lessons: LessonSummary[];
}

export interface LessonDetail extends LessonSummary {
  version: number;
  publishedAt: string | null;
  blocks: LessonBlock[];
  prerequisites: string[];
  concepts: string[];
  next: { id: string; slug: string; moduleId: string; title: LocalizedString } | null;
  prev: { id: string; slug: string; moduleId: string; title: LocalizedString } | null;
  module: { id: string; slug: string; code: string; title: LocalizedString };
}

export interface SceneResponse {
  id: string;
  version: number;
  updatedAt: string;
  scene: AnimationScene;
}

/* ------------------------------ Quiz ------------------------------- */
export interface QuizPublic {
  id: string;
  lessonId: string;
  title: LocalizedString;
  passScore: number;
  questions: {
    id: string;
    type: 'single' | 'multiple' | 'truefalse' | 'order';
    prompt: LocalizedString;
    options: { id: string; text: LocalizedString }[];
    difficulty: 'easy' | 'medium' | 'hard';
    concepts: string[];
  }[];
}

export const SubmitAttemptSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      /** Seçilen seçenek id'leri (order tipinde sıralı) */
      selected: z.array(z.string()).min(1),
    }),
  ),
  /** ms cinsinden harcanan süre */
  durationMs: z.number().int().min(0).optional(),
});
export type SubmitAttemptDto = z.infer<typeof SubmitAttemptSchema>;

export interface AttemptResult {
  attemptId: string;
  quizId: string;
  score: number;
  passed: boolean;
  correctCount: number;
  totalCount: number;
  results: {
    questionId: string;
    correct: boolean;
    selected: string[];
    correctAnswer: string[];
    explanation: LocalizedString;
  }[];
  /** Kazanılan rozetler (varsa) */
  newBadges: BadgeDto[];
}

/* ---------------------------- İlerleme ----------------------------- */
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

export const UpdateProgressSchema = z.object({
  /** 0..100 — görüntülenen blok oranı */
  percent: z.number().min(0).max(100),
  lastBlockId: z.string().optional(),
  /** Bu oturumda harcanan saniye */
  secondsSpent: z.number().int().min(0).default(0),
  completed: z.boolean().optional(),
});
export type UpdateProgressDto = z.infer<typeof UpdateProgressSchema>;

export interface ProgressItem {
  lessonId: string;
  moduleId: string;
  status: ProgressStatus;
  percent: number;
  lastBlockId: string | null;
  secondsSpent: number;
  completedAt: string | null;
  updatedAt: string;
}

export interface BadgeDto {
  id: string;
  slug: string;
  title: LocalizedString;
  description: LocalizedString;
  icon: string;
  earnedAt?: string;
}

export interface ProgressSummary {
  totalLessons: number;
  completedLessons: number;
  completionPercent: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  /** Bugün aktif mi */
  activeToday: boolean;
  totalSecondsSpent: number;
  badges: BadgeDto[];
  perModule: { moduleId: string; total: number; completed: number }[];
  /** Devam edilecek ders */
  continueLesson: {
    id: string;
    slug: string;
    moduleId: string;
    title: LocalizedString;
    percent: number;
  } | null;
  /** Bugün tekrar edilmesi gereken kavram sayısı */
  dueReviews: number;
}

export interface ReviewItem {
  id: string;
  concept: string;
  questionId: string;
  lessonId: string;
  dueAt: string;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
}

/** Tekrar ekranı için kart: soru metni, şıklar ve (yalnızca sahibine) doğru cevap + açıklama */
export interface ReviewCardDto extends ReviewItem {
  prompt: LocalizedString;
  options: { id: string; text: LocalizedString }[];
  type: QuizPublic['questions'][number]['type'];
  correctAnswer: string[];
  explanation: LocalizedString;
}

export const ReviewGradeSchema = z.object({
  /** 0-5 SM-2 kalite notu (0: hiç hatırlamadım, 5: mükemmel) */
  quality: z.number().int().min(0).max(5),
});
export type ReviewGradeDto = z.infer<typeof ReviewGradeSchema>;

/* -------------------------- Yer imi / Not -------------------------- */
export interface BookmarkDto {
  id: string;
  lessonId: string;
  blockId: string | null;
  createdAt: string;
  lesson: { id: string; slug: string; moduleId: string; title: LocalizedString };
}

export const CreateBookmarkSchema = z.object({
  lessonId: z.string().min(1),
  blockId: z.string().optional(),
});
export type CreateBookmarkDto = z.infer<typeof CreateBookmarkSchema>;

export interface NoteDto {
  id: string;
  lessonId: string;
  blockId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export const UpsertNoteSchema = z.object({
  lessonId: z.string().min(1),
  blockId: z.string().optional(),
  body: z.string().min(1).max(5000),
});
export type UpsertNoteDto = z.infer<typeof UpsertNoteSchema>;

/* ------------------------------ Arama ------------------------------ */
export interface SearchResult {
  type: 'lesson' | 'concept' | 'pattern' | 'module';
  id: string;
  slug: string;
  moduleId: string | null;
  title: LocalizedString;
  snippet: string;
  score: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  tookMs: number;
}

/* ----------------------------- Admin ------------------------------- */
export const AdminLessonUpsertSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  moduleId: z.string().min(1),
  order: z.number().int().min(1),
  title: z.union([z.string(), z.object({ tr: z.string(), en: z.string().optional() })]),
  summary: z.union([z.string(), z.object({ tr: z.string(), en: z.string().optional() })]),
  durationMinutes: z.number().int().min(1).max(240),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  tags: z.array(z.string()).default([]),
  prerequisites: z.array(z.string()).default([]),
  concepts: z.array(z.string()).default([]),
  /** Taslak sürümün blokları */
  blocks: z.array(z.any()),
});
export type AdminLessonUpsertDto = z.infer<typeof AdminLessonUpsertSchema>;

export const AdminSceneUpsertSchema = z.object({
  lessonId: z.string().optional(),
  scene: z.any(),
});
export type AdminSceneUpsertDto = z.infer<typeof AdminSceneUpsertSchema>;

export const AdminQuizUpsertSchema = z.object({
  lessonId: z.string().min(1),
  quiz: z.any(),
});
export type AdminQuizUpsertDto = z.infer<typeof AdminQuizUpsertSchema>;

export interface AdminLessonVersion {
  id: string;
  lessonId: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  publishedAt: string | null;
  authorId: string | null;
}

/* --------------------------- Bildirimler --------------------------- */
export const RegisterPushTokenSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(['ios', 'android', 'web']),
  deviceName: z.string().max(100).optional(),
});
export type RegisterPushTokenDto = z.infer<typeof RegisterPushTokenSchema>;

/* ------------------------------ Offline ---------------------------- */
/** Mobil offline senkron: tek istekte modül içeriği paketi */
export interface OfflineBundle {
  generatedAt: string;
  moduleId: string;
  lessons: LessonDetail[];
  scenes: SceneResponse[];
  quizzes: QuizPublic[];
}

/* ------------------------------ Genel ------------------------------ */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/* -------------------------- WebSocket olayları ---------------------- */
export type WsServerEvent =
  | { type: 'progress.updated'; payload: ProgressItem }
  | { type: 'badge.earned'; payload: BadgeDto }
  | { type: 'streak.updated'; payload: { currentStreak: number } }
  | { type: 'content.published'; payload: { lessonId: string; version: number } }
  | { type: 'simulation.tick'; payload: { simulationId: string; data: unknown } };

export type WsClientEvent =
  | { type: 'subscribe.lesson'; lessonId: string }
  | { type: 'simulation.join'; simulationId: string }
  | { type: 'simulation.input'; simulationId: string; data: unknown };
