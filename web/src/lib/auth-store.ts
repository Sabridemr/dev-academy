'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthTokens, UserProfile } from '@devacademy/shared';

/**
 * Oturum durumu.
 *  - Refresh token httpOnly çerezdedir (JavaScript, dolayısıyla olası bir XSS okuyamaz).
 *  - Access token yalnızca bellekte tutulur; sayfa yüklenince çerezle yenilenir (api.ts → startAuthSession).
 *  - localStorage'da yalnızca kullanıcı profili durur (hızlı ilk boyama ve sekmeler arası giriş/çıkış sinyali).
 */
interface AuthState {
  accessToken: string | null;
  user: UserProfile | null;
  /** Oturum açılışta yüklendi mi (profil okundu ve ilk yenileme denendi) */
  hydrated: boolean;
  setSession: (user: UserProfile, tokens: AuthTokens) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: UserProfile) => void;
  clear: () => void;
}

export const AUTH_STORAGE_KEY = 'da-auth';

/** Eski sürümün localStorage'da bıraktığı refresh token; bir kez çereze taşınır sonra unutulur */
let legacyRefreshToken: string | null = null;
export function takeLegacyRefreshToken(): string | null {
  const t = legacyRefreshToken;
  legacyRefreshToken = null;
  return t;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      hydrated: false,
      setSession: (user, tokens) => set({ user, accessToken: tokens.accessToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, accessToken: null }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ user: s.user }),
      // v0: token'lar localStorage'daydı → refresh token'ı taşınmak üzere al, token'ları depodan sil
      migrate: (persisted, version) => {
        const old = (persisted ?? {}) as {
          user?: UserProfile | null;
          refreshToken?: string | null;
        };
        if (version === 0 && old.refreshToken) legacyRefreshToken = old.refreshToken;
        return { user: old.user ?? null } as AuthState;
      },
      // Sunucu ve ilk istemci render'ı aynı (oturumsuz) çıktıyı üretsin diye otomatik okunmaz
      skipHydration: true,
    },
  ),
);

export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => Boolean(s.accessToken && s.user));
}

export function useIsEditor(): boolean {
  return useAuthStore((s) => s.user?.role === 'admin' || s.user?.role === 'editor');
}
