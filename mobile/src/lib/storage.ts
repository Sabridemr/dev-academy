import { SQLiteStorage } from 'expo-sqlite/kv-store';
import * as SecureStore from 'expo-secure-store';

/**
 * DEPOLAMA KATMANI
 * ----------------
 * - kv: senkron anahtar-değer deposu (expo-sqlite/kv-store; Expo Go'da da çalışır) → ayarlar (dil, tema),
 *   ETag'ler, senkron zaman damgaları, çevrimdışı ilerleme/quiz kuyruğu. Token SAKLANMAZ.
 * - SecureStore (Keychain / Keystore): erişim ve yenileme token'ları.
 */
const store = new SQLiteStorage('devacademy-kv.db');

/** Değerler metin olarak saklanır; sayı/boolean okurken türüne göre çözülür */
export const kv = {
  getString(key: string): string | undefined {
    return store.getItemSync(key) ?? undefined;
  },
  getBoolean(key: string): boolean | undefined {
    const raw = store.getItemSync(key);
    return raw === null ? undefined : raw === 'true';
  },
  getNumber(key: string): number | undefined {
    const raw = store.getItemSync(key);
    if (raw === null) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  },
  set(key: string, value: string | number | boolean): void {
    store.setItemSync(key, String(value));
  },
  delete(key: string): void {
    store.removeItemSync(key);
  },
  contains(key: string): boolean {
    return store.getItemSync(key) !== null;
  },
  clearAll(): void {
    store.clearSync();
  },
};

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
