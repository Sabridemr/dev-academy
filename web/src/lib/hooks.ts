'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AttemptResult,
  BadgeDto,
  BookmarkDto,
  LessonDetail,
  ModuleDetail,
  ModuleSummary,
  NoteDto,
  ProgressSummary,
  QuizPublic,
  SceneResponse,
  SearchResponse,
  SubmitAttemptDto,
  UpdateProgressDto,
  LearningPathSummary,
  LearningPathDetail,
  UserProfile,
  UpdateProfileDto,
  ReviewCardDto,
  LocalizedString,
  DailyActivityDto,
  XpEventDto,
  CertificateDto,
  LessonFeedbackDto,
  LessonFeedbackSummary,
  CreateExamDto,
  ExamDto,
  ExamResult,
  SubmitExamDto,
  AdminLessonAnalytics,
} from '@devacademy/shared';
import { api } from './api';
import { useAuthStore, useIsAuthenticated } from './auth-store';

/** Kullanıcının "hareketi azalt" tercihini izler */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

/* ------------------------------ İçerik ------------------------------ */

export function usePaths() {
  return useQuery({
    queryKey: ['paths'],
    queryFn: () => api<LearningPathSummary[]>('/paths', { anonymous: true }),
  });
}

export function useModules() {
  const authed = useIsAuthenticated();
  return useQuery({
    queryKey: ['modules', authed],
    queryFn: () => api<ModuleSummary[]>('/modules'),
  });
}

export function useModule(id: string) {
  const authed = useIsAuthenticated();
  return useQuery({
    queryKey: ['module', id, authed],
    queryFn: () => api<ModuleDetail>(`/modules/${id}`),
    enabled: Boolean(id),
  });
}

export function useLesson(id: string, initial?: LessonDetail) {
  const authed = useIsAuthenticated();
  return useQuery({
    queryKey: ['lesson', id, authed],
    queryFn: () => api<LessonDetail>(`/lessons/${id}`),
    initialData: authed ? undefined : initial,
    enabled: Boolean(id),
  });
}

export function useScene(id: string | undefined) {
  return useQuery({
    queryKey: ['scene', id],
    queryFn: () => api<SceneResponse>(`/scenes/${id}`, { anonymous: true }),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  });
}

export function useQuiz(lessonId: string) {
  return useQuery({
    queryKey: ['quiz', lessonId],
    queryFn: () => api<QuizPublic>(`/quizzes/by-lesson/${lessonId}`, { anonymous: true }),
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => api<SearchResponse>(`/search?q=${encodeURIComponent(q)}`, { anonymous: true }),
    enabled: q.trim().length >= 2,
    placeholderData: (prev) => prev,
  });
}

/* ---------------------------- Kullanıcı ----------------------------- */

/**
 * /users/me yanıtı. `dailyGoalMinutes` ve `emailVerifiedAt` paylaşılan UserProfile'da yok; backend
 * eklediğinde dolar (yoksa undefined gelir ve arayüz varsayılanı kullanır).
 */
export type MeProfile = UserProfile & {
  reminderHour: number | null;
  timezone: string;
  dailyGoalMinutes?: number | null;
  emailVerifiedAt?: string | null;
};

export function useMe() {
  const authed = useIsAuthenticated();
  const setUser = useAuthStore((s) => s.setUser);
  return useQuery({
    queryKey: ['me'],
    enabled: authed,
    queryFn: async () => {
      const me = await api<MeProfile>('/users/me');
      setUser(me);
      return me;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateProfileDto) =>
      api<UserProfile>('/users/me', { method: 'PATCH', body: dto }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me'] });
      // Günlük hedef özet kartında da görünür
      void qc.invalidateQueries({ queryKey: ['progress-summary'] });
    },
  });
}

export function useProgressSummary() {
  const authed = useIsAuthenticated();
  return useQuery({
    queryKey: ['progress-summary'],
    queryFn: () => api<ProgressSummary>('/progress/summary'),
    enabled: authed,
  });
}

export function useUpdateProgress(lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateProgressDto) =>
      api<{ status: string; percent: number; newBadges: { title: LocalizedString }[] }>(
        `/progress/lessons/${lessonId}`,
        { method: 'PUT', body: dto },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['progress-summary'] });
      void qc.invalidateQueries({ queryKey: ['module'] });
    },
  });
}

export function useSubmitAttempt(quizId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: SubmitAttemptDto) =>
      api<AttemptResult>(`/quizzes/${quizId}/attempts`, { method: 'POST', body: dto }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['progress-summary'] });
      void qc.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}

export interface AttemptSummaryDto {
  id: string;
  quizId: string;
  lessonId: string;
  quizTitle: LocalizedString;
  score: number;
  passed: boolean;
  correctCount: number;
  totalCount: number;
  durationMs: number;
  createdAt: string;
}

export function useAttempts() {
  const authed = useIsAuthenticated();
  return useQuery({
    queryKey: ['attempts'],
    queryFn: () => api<AttemptSummaryDto[]>('/quizzes/attempts'),
    enabled: authed,
  });
}

export function usePath(id: string) {
  const authed = useIsAuthenticated();
  return useQuery({
    queryKey: ['path', id, authed],
    queryFn: () => api<LearningPathDetail>(`/paths/${id}`),
    enabled: Boolean(id),
  });
}

export function useBadgeCatalog() {
  return useQuery({
    queryKey: ['badge-catalog'],
    queryFn: () => api<BadgeDto[]>('/progress/badges', { anonymous: true }),
    staleTime: 60 * 60 * 1000,
  });
}

export function useReviews() {
  const authed = useIsAuthenticated();
  return useQuery({
    queryKey: ['reviews'],
    queryFn: () => api<ReviewCardDto[]>('/progress/reviews'),
    enabled: authed,
  });
}

export function useBookmarks() {
  const authed = useIsAuthenticated();
  return useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => api<BookmarkDto[]>('/bookmarks'),
    enabled: authed,
  });
}

export function useNotes(lessonId?: string) {
  const authed = useIsAuthenticated();
  return useQuery({
    queryKey: ['notes', lessonId ?? 'all'],
    queryFn: () => api<NoteDto[]>(`/notes${lessonId ? `?lessonId=${lessonId}` : ''}`),
    enabled: authed,
  });
}

/** İnteraktif simülatör kullanımını (rozetler için) bir kez kaydeder */
export function useTrackInteractive(interactive: string, lessonId?: string) {
  const authed = useIsAuthenticated();
  const [tracked, setTracked] = useState(false);
  return () => {
    if (!authed || tracked) return;
    setTracked(true);
    void api('/progress/interactive', { method: 'POST', body: { interactive, lessonId } }).catch(
      () => undefined,
    );
  };
}

/* ------------------------- Motivasyon (Faz 8) ------------------------- */

/** Son `days` günün günlük aktivitesi (ısı haritası). Eksik günler istemcide sıfırla doldurulur. */
export function useActivity(days = 365) {
  const authed = useIsAuthenticated();
  return useQuery({
    queryKey: ['activity', days],
    queryFn: () => api<DailyActivityDto[]>(`/progress/activity?days=${days}`),
    enabled: authed,
    staleTime: 5 * 60_000,
  });
}

export function useXpEvents() {
  const authed = useIsAuthenticated();
  return useQuery({
    queryKey: ['xp-events'],
    queryFn: () => api<XpEventDto[]>('/progress/xp'),
    enabled: authed,
  });
}

export function useCertificates() {
  const authed = useIsAuthenticated();
  return useQuery({
    queryKey: ['certificates'],
    queryFn: () => api<CertificateDto[]>('/certificates'),
    enabled: authed,
  });
}

export function useLessonFeedback(lessonId: string) {
  const authed = useIsAuthenticated();
  return useQuery({
    queryKey: ['lesson-feedback', lessonId],
    queryFn: () => api<LessonFeedbackSummary>(`/lessons/${lessonId}/feedback`),
    enabled: authed && Boolean(lessonId),
  });
}

export function useSubmitLessonFeedback(lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: LessonFeedbackDto) =>
      api<LessonFeedbackSummary | undefined>(`/lessons/${lessonId}/feedback`, {
        method: 'POST',
        body: dto,
      }),
    onSuccess: (res, dto) => {
      qc.setQueryData<LessonFeedbackSummary>(['lesson-feedback', lessonId], (prev) =>
        res && typeof res === 'object' && 'lessonId' in res
          ? { ...res, mine: res.mine ?? dto }
          : prev
            ? { ...prev, mine: dto }
            : {
                lessonId,
                up: 0,
                down: 0,
                difficulty: { easy: 0, ok: 0, hard: 0 },
                mine: dto,
              },
      );
    },
  });
}

/**
 * GET /exams liste öğesi. Paylaşılan sözleşmede liste tipi tanımlı değil; alanlar ExamDto/ExamResult
 * ile uyumlu, sunulmayanlar opsiyonel tutuldu.
 */
export interface ExamSummaryDto {
  id: string;
  startedAt: string;
  submittedAt?: string | null;
  durationSec: number;
  score?: number | null;
  passed?: boolean | null;
  correctCount?: number | null;
  totalCount: number;
  timedOut?: boolean;
  xpEarned?: number;
}

export function useExams() {
  const authed = useIsAuthenticated();
  return useQuery({
    queryKey: ['exams'],
    queryFn: () => api<ExamSummaryDto[]>('/exams'),
    enabled: authed,
  });
}

export function useExam(id: string | null) {
  const authed = useIsAuthenticated();
  return useQuery({
    queryKey: ['exam', id],
    queryFn: () => api<ExamDto>(`/exams/${id}`),
    enabled: authed && Boolean(id),
    staleTime: Infinity,
  });
}

export function useCreateExam() {
  return useMutation({
    mutationFn: (dto: CreateExamDto) => api<ExamDto>('/exams', { method: 'POST', body: dto }),
  });
}

export function useSubmitExam(examId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: SubmitExamDto) =>
      api<ExamResult>(`/exams/${examId}/submit`, { method: 'POST', body: dto }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['exams'] });
      void qc.invalidateQueries({ queryKey: ['progress-summary'] });
      void qc.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}

export function useAdminAnalytics() {
  return useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => api<AdminLessonAnalytics[]>('/admin/analytics'),
  });
}
