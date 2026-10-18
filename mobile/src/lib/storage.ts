import { MMKV } from 'react-native-mmkv';
import * as SecureStore from 'expo-secure-store';

/**
 * DEPOLAMA KATMANI
 * ----------------
 * - MMKV: hızlı anahtar-değer deposu → ayarlar (dil, tema), ETag'ler, senkron zaman damgaları,
 *   çevrimdışı ilerleme/quiz kuyruğu. Token SAKLANMAZ.
 * - SecureStore (Keychain / Keystore): erişim ve yenileme token'ları.
 */
export const kv = new MMKV({ id: 'devacademy' });

export const KV_KEYS = {
  locale: 'settings.locale',
  theme: 'settings.theme',
  onboarded: 'settings.onboarded',
  reminderHour: 'settings.reminderHour',
  progressQueue: 'queue.progress',
  attemptQueue: 'queue.attempts',
  lastSyncAt: 'sync.lastAt',
  pushToken: 'push.token',
  etag: (resource: string) => `etag.${resource}`,
} as const;

export function getJson<T>(key: string, fallback: T): T {
  const raw = kv.getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJson(key: string, value: unknown): void {
  kv.set(key, JSON.stringify(value));
}

/* ------------------------------ Token'lar ------------------------------ */

const ACCESS_KEY = 'da.accessToken';
const REFRESH_KEY = 'da.refreshToken';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

/** Bellek içi önbellek: her istekte Keychain'e gitmemek için */
let memoryTokens: StoredTokens | null | undefined;

export const tokenStorage = {
  async get(): Promise<StoredTokens | null> {
    if (memoryTokens !== undefined) return memoryTokens;
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    memoryTokens = accessToken && refreshToken ? { accessToken, refreshToken } : null;
    return memoryTokens;
  },
  async set(tokens: StoredTokens): Promise<void> {
    memoryTokens = tokens;
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
      SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
    ]);
  },
  async clear(): Promise<void> {
    memoryTokens = null;
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
    ]);
  },
  /** Testler için bellek önbelleğini sıfırlar */
  resetMemory(): void {
    memoryTokens = undefined;
  },
};
