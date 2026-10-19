import { create } from 'zustand';
import type { AuthResponse, UserProfile } from '@devacademy/shared';
import { api, isApiError } from '@/lib/api';
import { endpoints, type MeProfile } from '@/lib/endpoints';
import { queryClient } from '@/lib/queryClient';
import { getJson, kv, KV_KEYS, setJson, tokenStorage } from '@/lib/storage';
import { cancelDailyReminder } from '@/notifications/push';
import { clearQueues } from '@/offline/queue';

/**
 * OTURUM DEPOSU (zustand)
 * Token'lar SecureStore'da; kullanıcı profili hızlı açılış için MMKV'de önbelleklenir
 * (çevrimdışı açılışta da kullanıcı oturumlu kalır).
 */
export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';
export type SessionUser = UserProfile & { reminderHour?: number | null; timezone?: string };

const USER_KEY = 'session.user';
/** Bu kurulumda uygulama en az bir kez açıldı mı (MMKV kurulumla silinir) */
const INSTALL_KEY = 'install.initialized';

/**
 * Yerel kullanıcı verisini temizler: profil, kuyruklar, sorgu önbelleği, kayıtlı push token işareti,
 * onboarding bayrağı ve günlük yerel hatırlatma (aynı cihazda açılan sonraki hesaba sızmasın).
 */
function clearLocalSession(): void {
  kv.delete(USER_KEY);
  kv.delete(KV_KEYS.pushToken);
  kv.delete(KV_KEYS.onboarded);
  clearQueues();
  queryClient.clear();
  void cancelDailyReminder();
}

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
    // iOS Keychain uygulama silinince temizlenmez, MMKV temizlenir: yeniden kurulumda eski hesabın
    // token'larıyla profil olmadan açılmasın. Yükseltmelerde önbellekli profil durduğu için dokunulmaz.
    if (!kv.getBoolean(INSTALL_KEY)) {
      if (!kv.getString(USER_KEY)) await tokenStorage.clear();
      kv.set(INSTALL_KEY, true);
    }
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
    await tokenStorage.set({
      accessToken: res.tokens.accessToken,
      refreshToken: res.tokens.refreshToken,
    });
    setJson(USER_KEY, res.user);
    set({ status: 'authenticated', user: res.user });
    void get().refreshProfile();
  },

  signOut: async () => {
    const tokens = await tokenStorage.get();
    const pushToken = kv.getString(KV_KEYS.pushToken);
    try {
      if (tokens && pushToken) await endpoints.unregisterPushToken(pushToken);
    } catch {
      // Token zaten silinmiş olabilir; çıkışı engellemez
    }
    try {
      if (tokens) await endpoints.logout(tokens.refreshToken);
    } catch {
      // Sunucuya ulaşılamasa da yerel oturumu kapat
    }
    await tokenStorage.clear();
    clearLocalSession();
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
        clearLocalSession();
        set({ status: 'anonymous', user: null });
      }
    }
  },
}));

// Refresh token da reddedilirse oturumu kapat
api.setSessionExpiredHandler(() => {
  clearLocalSession();
  useSession.setState({ status: 'anonymous', user: null });
});
