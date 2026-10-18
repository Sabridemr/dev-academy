import { create } from 'zustand';
import type { AuthResponse, UserProfile } from '@devacademy/shared';
import { api, isApiError } from '@/lib/api';
import { endpoints, type MeProfile } from '@/lib/endpoints';
import { getJson, kv, setJson, tokenStorage } from '@/lib/storage';

/**
 * OTURUM DEPOSU (zustand)
 * Token'lar SecureStore'da; kullanıcı profili hızlı açılış için MMKV'de önbelleklenir
 * (çevrimdışı açılışta da kullanıcı oturumlu kalır).
 */
export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';
export type SessionUser = UserProfile & { reminderHour?: number | null; timezone?: string };

const USER_KEY = 'session.user';

interface SessionState {
  status: SessionStatus;
  user: SessionUser | null;
  bootstrap: () => Promise<void>;
  signIn: (res: AuthResponse) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: SessionUser | MeProfile) => void;
  refreshProfile: () => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  user: null,

  bootstrap: async () => {
    const tokens = await tokenStorage.get();
    if (!tokens) {
      set({ status: 'anonymous', user: null });
      return;
    }
    const cached = getJson<SessionUser | null>(USER_KEY, null);
    set({ status: 'authenticated', user: cached });
    // Arka planda profili tazele (çevrimdışıysa önbellekle devam)
    void get().refreshProfile();
  },

  signIn: async (res) => {
    await tokenStorage.set({ accessToken: res.tokens.accessToken, refreshToken: res.tokens.refreshToken });
    setJson(USER_KEY, res.user);
    set({ status: 'authenticated', user: res.user });
    void get().refreshProfile();
  },

  signOut: async () => {
    const tokens = await tokenStorage.get();
    try {
      if (tokens) await endpoints.logout(tokens.refreshToken);
    } catch {
      // Sunucuya ulaşılamasa da yerel oturumu kapat
    }
    await tokenStorage.clear();
    kv.delete(USER_KEY);
    set({ status: 'anonymous', user: null });
  },

  setUser: (user) => {
    setJson(USER_KEY, user);
    set({ user });
  },

  refreshProfile: async () => {
    try {
      const me = await endpoints.me();
      get().setUser(me);
    } catch (e) {
      if (isApiError(e) && e.code === 'unauthorized') {
        await tokenStorage.clear();
        kv.delete(USER_KEY);
        set({ status: 'anonymous', user: null });
      }
    }
  },
}));

// Refresh token da reddedilirse oturumu kapat
api.setSessionExpiredHandler(() => {
  kv.delete(USER_KEY);
  useSession.setState({ status: 'anonymous', user: null });
});
