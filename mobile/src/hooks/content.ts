import { useQuery } from '@tanstack/react-query';
import type { ModuleSummary } from '@devacademy/shared';
import { ApiError, isApiError } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { isOnline } from '@/lib/network';
import { queryKeys } from '@/lib/queryClient';
import { listDownloadedModules, readLesson, readModule, readQuizByLesson, readScene } from '@/offline/db';
import { useSession } from '@/stores/session';

/**
 * İÇERİK KANCALARI — "önce ağ, sonra SQLite" stratejisi.
 * Çevrimiçiyken API'den okunur; ağ hatası ya da çevrimdışı durumda indirilmiş içerik döner.
 * Hiçbiri yoksa ApiError('offline') fırlatılır (UI "çevrimdışı kullanılamıyor" gösterir).
 */
export async function networkFirst<T>(remote: () => Promise<T>, local: () => Promise<T | null>): Promise<T> {
  const fallback = async (error: unknown): Promise<T> => {
    let cached: T | null = null;
    try {
      cached = await local();
    } catch {
      cached = null;
    }
    if (cached !== null) return cached;
    throw error;
  };
  if (!isOnline()) return fallback(new ApiError('offline', 0, 'Offline'));
  try {
    return await remote();
  } catch (e) {
    if (isApiError(e) && (e.isConnectivity || e.code === 'server')) return fallback(e);
    throw e;
  }
}

export function usePaths() {
  return useQuery({ queryKey: queryKeys.paths, queryFn: () => endpoints.paths() });
}

export function useModules() {
  return useQuery({
    queryKey: queryKeys.modules,
    queryFn: () =>
      networkFirst<ModuleSummary[]>(
        () => endpoints.modules(),
        async () => {
          const downloaded = await listDownloadedModules();
          const mods = downloaded.flatMap((d) => (d.module ? [d.module] : []));
          return mods.length ? mods.sort((a, b) => a.order - b.order) : null;
        },
      ),
  });
}

export function useModule(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.module(id ?? ''),
    enabled: Boolean(id),
    queryFn: () => networkFirst(() => endpoints.module(id!), () => readModule(id!)),
  });
}

export function useLesson(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.lesson(id ?? ''),
    enabled: Boolean(id),
    queryFn: () => networkFirst(() => endpoints.lesson(id!), () => readLesson(id!)),
  });
}

export function useScene(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.scene(id ?? ''),
    enabled: Boolean(id),
    staleTime: 10 * 60_000,
    queryFn: () => networkFirst(() => endpoints.scene(id!), () => readScene(id!)),
  });
}

export function useQuiz(lessonId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.quiz(lessonId ?? ''),
    enabled: Boolean(lessonId),
    queryFn: () => networkFirst(() => endpoints.quizByLesson(lessonId!), () => readQuizByLesson(lessonId!)),
  });
}

function useAuthed(): boolean {
  return useSession((s) => s.status === 'authenticated');
}

export function useProgressSummary() {
  const authed = useAuthed();
  return useQuery({ queryKey: queryKeys.summary, enabled: authed, queryFn: () => endpoints.progressSummary() });
}

export function useReviews() {
  const authed = useAuthed();
  return useQuery({ queryKey: queryKeys.reviews, enabled: authed, queryFn: () => endpoints.reviews(20), staleTime: 0 });
}

export function useBookmarks() {
  const authed = useAuthed();
  return useQuery({ queryKey: queryKeys.bookmarks, enabled: authed, queryFn: () => endpoints.bookmarks() });
}

export function useNotes(lessonId?: string) {
  const authed = useAuthed();
  return useQuery({ queryKey: queryKeys.notes(lessonId), enabled: authed, queryFn: () => endpoints.notes(lessonId) });
}

export function useDownloads() {
  return useQuery({ queryKey: queryKeys.downloads, queryFn: () => listDownloadedModules(), staleTime: 0, networkMode: 'always' });
}
