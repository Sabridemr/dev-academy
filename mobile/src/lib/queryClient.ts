import { QueryClient } from '@tanstack/react-query';
import { isApiError } from './api';

/**
 * React Query istemcisi. Ağ hatalarında tekrar denemeyiz (içerik kancaları zaten SQLite'a düşer);
 * 4xx hatalarında da tekrar denemek anlamsızdır.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      networkMode: 'offlineFirst',
      retry: (failureCount, error) => {
        if (
          isApiError(error) &&
          (error.isConnectivity || (error.status >= 400 && error.status < 500))
        )
          return false;
        return failureCount < 2;
      },
    },
    mutations: {
      networkMode: 'always',
      retry: false,
    },
  },
});

export const queryKeys = {
  paths: ['paths'] as const,
  modules: ['modules'] as const,
  module: (id: string) => ['module', id] as const,
  lesson: (id: string) => ['lesson', id] as const,
  scene: (id: string) => ['scene', id] as const,
  quiz: (lessonId: string) => ['quiz', lessonId] as const,
  summary: ['progress', 'summary'] as const,
  reviews: ['progress', 'reviews'] as const,
  bookmarks: ['bookmarks'] as const,
  notes: (lessonId?: string) => ['notes', lessonId ?? 'all'] as const,
  search: (q: string) => ['search', q] as const,
  downloads: ['offline', 'downloads'] as const,
};
