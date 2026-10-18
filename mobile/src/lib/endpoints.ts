import type {
  AttemptResult,
  AuthResponse,
  BadgeDto,
  BookmarkDto,
  CreateBookmarkDto,
  LearningPathDetail,
  LearningPathSummary,
  LessonDetail,
  LocalizedString,
  LoginDto,
  ModuleDetail,
  ModuleSummary,
  NoteDto,
  OAuthLoginDto,
  OfflineBundle,
  ProgressItem,
  ProgressSummary,
  QuizPublic,
  RegisterDto,
  RegisterPushTokenDto,
  ReviewItem,
  SceneResponse,
  SearchResponse,
  SubmitAttemptDto,
  UpdateProfileDto,
  UpdateProgressDto,
  UpsertNoteDto,
  UserProfile,
} from '@devacademy/shared';
import { api, type RawResponse } from './api';

/**
 * Backend uç noktalarının tipli sarmalayıcıları (backend/src/modules/*.controller.ts ile eşleşir).
 */

export type MeProfile = UserProfile & { reminderHour: number | null; timezone: string };

/** GET /progress/reviews yanıtı: ReviewItem + soru metni ve seçenekleri (doğru cevap yok) */
export type ReviewCard = ReviewItem & {
  prompt: LocalizedString;
  options: { id: string; text: LocalizedString }[];
  type: string;
};

const enc = encodeURIComponent;

export const endpoints = {
  /* ------------------------------ Auth ------------------------------ */
  login: (dto: LoginDto) => api.post<AuthResponse>('/auth/login', dto, { auth: false }),
  register: (dto: RegisterDto) => api.post<AuthResponse>('/auth/register', dto, { auth: false }),
  oauth: (dto: OAuthLoginDto) => api.post<AuthResponse>('/auth/oauth', dto, { auth: false }),
  logout: (refreshToken?: string) =>
    api.post<void>('/auth/logout', { refreshToken, everywhere: false }),

  /* ------------------------------ Kullanıcı ------------------------------ */
  me: () => api.get<MeProfile>('/users/me'),
  updateMe: (dto: UpdateProfileDto) => api.patch<MeProfile>('/users/me', dto),
  registerPushToken: (dto: RegisterPushTokenDto) => api.post<void>('/users/me/push-tokens', dto),
  unregisterPushToken: (token: string) =>
    api.del<void>(`/users/me/push-tokens/${encodeURIComponent(token)}`),

  /* ------------------------------ İçerik ------------------------------ */
  paths: () => api.get<LearningPathSummary[]>('/paths'),
  path: (id: string) => api.get<LearningPathDetail>(`/paths/${enc(id)}`),
  modules: () => api.get<ModuleSummary[]>('/modules'),
  module: (id: string) => api.get<ModuleDetail>(`/modules/${enc(id)}`),
  lesson: (id: string) => api.get<LessonDetail>(`/lessons/${enc(id)}`),
  scene: (id: string) => api.get<SceneResponse>(`/scenes/${enc(id)}`),
  quizByLesson: (lessonId: string) => api.get<QuizPublic>(`/quizzes/by-lesson/${enc(lessonId)}`),
  submitAttempt: (quizId: string, dto: SubmitAttemptDto) =>
    api.post<AttemptResult>(`/quizzes/${enc(quizId)}/attempts`, dto),

  /* ------------------------------ İlerleme ------------------------------ */
  progress: () => api.get<ProgressItem[]>('/progress'),
  progressSummary: () => api.get<ProgressSummary>('/progress/summary'),
  updateProgress: (lessonId: string, dto: UpdateProgressDto) =>
    api.put<ProgressItem>(`/progress/lessons/${enc(lessonId)}`, dto),
  recordInteractive: (dto: {
    interactive: string;
    lessonId?: string;
    params?: Record<string, unknown>;
  }) => api.post<BadgeDto[]>('/progress/interactive', dto),
  reviews: (limit = 20) => api.get<ReviewCard[]>(`/progress/reviews?limit=${limit}`),
  gradeReview: (cardId: string, quality: number) =>
    api.post<ReviewItem>(`/progress/reviews/${enc(cardId)}/grade`, { quality }),

  /* ------------------------------ Kütüphane ------------------------------ */
  bookmarks: () => api.get<BookmarkDto[]>('/bookmarks'),
  addBookmark: (dto: CreateBookmarkDto) => api.post<BookmarkDto>('/bookmarks', dto),
  removeBookmark: (id: string) => api.del(`/bookmarks/${enc(id)}`),
  notes: (lessonId?: string) =>
    api.get<NoteDto[]>(lessonId ? `/notes?lessonId=${enc(lessonId)}` : '/notes'),
  createNote: (dto: UpsertNoteDto) => api.post<NoteDto>('/notes', dto),
  removeNote: (id: string) => api.del(`/notes/${enc(id)}`),

  /* ------------------------------ Arama ------------------------------ */
  search: (q: string, signal?: AbortSignal) =>
    api.get<SearchResponse>(`/search?q=${enc(q)}&limit=30`, { signal }),

  /* ------------------------------ Çevrimdışı ------------------------------ */
  offlineModule: (moduleId: string, etag?: string | null): Promise<RawResponse<OfflineBundle>> =>
    api.requestRaw<OfflineBundle>(`/offline/modules/${enc(moduleId)}`, { etag }),
};
