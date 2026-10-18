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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hydrated: false,
      setSession: (user, tokens) => set({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
      setTokens: (tokens) => set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'da-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken, user: s.user }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
        useAuthStore.setState({ hydrated: true });
      },
    },
  ),
);

export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => Boolean(s.accessToken && s.user));
}

export function useIsEditor(): boolean {
  return useAuthStore((s) => s.user?.role === 'admin' || s.user?.role === 'editor');
}
