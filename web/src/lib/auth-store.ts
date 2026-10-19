'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthTokens, UserProfile } from '@devacademy/shared';

/**
 * Oturum durumu. Token'lar localStorage'da tutulur (SPA tarzı istemci kimlik doğrulaması).
 * Not: üretimde refresh token'ı httpOnly çerezde tutan bir BFF katmanı daha güvenlidir;
 * README'de bu tercih ve alternatifi açıklanmıştır.
 */
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  hydrated: boolean;
  setSession: (user: UserProfile, tokens: AuthTokens) => void;
  setTokens: (tokens: AuthTokens) => void;
  setUser: (user: UserProfile) => void;
  clear: () => void;
}

const STORAGE_KEY = 'da-auth';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hydrated: false,
      setSession: (user, tokens) =>
        set({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
      setTokens: (tokens) =>
        set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
      }),
      // Sunucu ve ilk istemci render'ı aynı (oturumsuz) çıktıyı üretsin diye otomatik okunmaz;
      // AuthHydrator mount olunca localStorage'dan okur (hydration uyumsuzluğu olmaz).
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hydrated: true });
      },
    },
  ),
);

/**
 * Oturumu localStorage'dan yükler ve diğer sekmelerdeki değişiklikleri izler: bir sekme refresh
 * token'ı döndürdüğünde ya da çıkış yaptığında diğerleri eski (iptal edilmiş) token'la kalmaz.
 * Aksi halde eski token'la yapılan refresh, sunucuda yeniden kullanım tespitini tetikleyip tüm oturum
 * ailesini kapatırdı.
 */
export function startAuthSync(): () => void {
  void useAuthStore.persist.rehydrate();
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) void useAuthStore.persist.rehydrate();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => Boolean(s.accessToken && s.user));
}

export function useIsEditor(): boolean {
  return useAuthStore((s) => s.user?.role === 'admin' || s.user?.role === 'editor');
}
