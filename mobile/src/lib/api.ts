import type { ApiErrorBody, AuthTokens } from '@devacademy/shared';
import { env } from '@/config/env';
import { tokenStorage, type StoredTokens } from './storage';

/**
 * API İSTEMCİSİ
 * -------------
 * - Taban adres EXPO_PUBLIC_API_URL (…/api/v1)
 * - Bearer token SecureStore'dan okunur
 * - 401 → tek uçuşlu (single-flight) refresh: aynı anda 401 alan tüm istekler TEK bir
 *   /auth/refresh çağrısını bekler, ardından yeni token ile bir kez yeniden denenir
 * - Çevrimdışı farkındalık: NetInfo çevrimdışı diyorsa istek atılmadan ApiError('offline') fırlatılır;
 *   fetch ağ hatası ApiError('network') olur → içerik kancaları SQLite'a düşer
 */

export type ApiErrorCode =
  | 'offline'
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'rate_limited'
  | 'server'
  | 'unknown';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly body?: ApiErrorBody;

  constructor(code: ApiErrorCode, status: number, message: string, body?: ApiErrorBody) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.body = body;
  }

  /** Ağ kaynaklı (çevrimdışı ya da sunucuya ulaşılamadı) mı */
  get isConnectivity(): boolean {
    return this.code === 'offline' || this.code === 'network';
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

function codeForStatus(status: number): ApiErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 400 || status === 422) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server';
  return 'unknown';
}

export interface TokenStore {
  get(): Promise<StoredTokens | null>;
  set(tokens: StoredTokens): Promise<void>;
  clear(): Promise<void>;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** false → Authorization başlığı eklenmez (login/register) */
  auth?: boolean;
  /** If-None-Match için önceki ETag */
  etag?: string | null;
  signal?: AbortSignal;
}

export interface RawResponse<T> {
  status: number;
  /** 304 / 204 yanıtlarında null */
  data: T | null;
  etag: string | null;
  notModified: boolean;
}

export interface ApiClientOptions {
  baseUrl: string;
  tokens: TokenStore;
  fetchImpl?: typeof fetch;
  /** true dönerse istek atılmadan 'offline' hatası verilir */
  isOffline?: () => boolean;
  /** Refresh başarısız olduğunda (oturum düştü) çağrılır */
  onSessionExpired?: () => void;
}

export interface ApiClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
  requestRaw<T>(path: string, options?: RequestOptions): Promise<RawResponse<T>>;
  get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  del<T = void>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  /** Tek uçuşlu token yenileme; yeni access token ya da null döner */
  refreshAccessToken(): Promise<string | null>;
  setSessionExpiredHandler(handler: () => void): void;
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const doFetch: typeof fetch = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  let refreshInFlight: Promise<string | null> | null = null;
  let onSessionExpired = opts.onSessionExpired;

  async function parseBody(res: Response): Promise<unknown> {
    if (res.status === 204 || res.status === 304) return null;
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  function refreshAccessToken(): Promise<string | null> {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      const current = await opts.tokens.get();
      if (!current?.refreshToken) return null;
      try {
        const res = await doFetch(`${opts.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        if (!res.ok) {
          // Yenileme reddedildi → oturum geçersiz
          if (res.status === 401 || res.status === 403 || res.status === 400) {
            await opts.tokens.clear();
            onSessionExpired?.();
          }
          return null;
        }
        const tokens = (await parseBody(res)) as AuthTokens;
        await opts.tokens.set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
        return tokens.accessToken;
      } catch {
        // Ağ hatası: token'ları silme, kullanıcı çevrimiçi olunca tekrar denenir
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }

  async function send(path: string, options: RequestOptions, accessToken: string | null): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (options.etag) headers['If-None-Match'] = options.etag;
    try {
      return await doFetch(`${opts.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
      });
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') throw e;
      throw new ApiError('network', 0, e instanceof Error ? e.message : 'Network request failed');
    }
  }

  async function requestRaw<T>(path: string, options: RequestOptions = {}): Promise<RawResponse<T>> {
    if (opts.isOffline?.()) throw new ApiError('offline', 0, 'Offline');
    const useAuth = options.auth !== false;
    const tokens = useAuth ? await opts.tokens.get() : null;
    const usedToken = tokens?.accessToken ?? null;
    let res = await send(path, options, usedToken);

    if (res.status === 401 && useAuth && usedToken) {
      // Başka bir istek token'ı zaten yenilemiş olabilir
      const latest = await opts.tokens.get();
      const newToken = latest && latest.accessToken !== usedToken ? latest.accessToken : await refreshAccessToken();
      if (newToken) {
        res = await send(path, options, newToken);
      }
    }

    const data = await parseBody(res);
    if (res.status === 304) {
      return { status: 304, data: null, etag: res.headers.get('ETag'), notModified: true };
    }
    if (!res.ok) {
      const body = data && typeof data === 'object' ? (data as ApiErrorBody) : undefined;
      const message = body?.message ?? `HTTP ${res.status}`;
      throw new ApiError(codeForStatus(res.status), res.status, Array.isArray(message) ? message.join(', ') : String(message), body);
    }
    return { status: res.status, data: data as T, etag: res.headers.get('ETag'), notModified: false };
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const res = await requestRaw<T>(path, options);
    return res.data as T;
  }

  return {
    request,
    requestRaw,
    get: (path, o) => request(path, { ...o, method: 'GET' }),
    post: (path, body, o) => request(path, { ...o, method: 'POST', body }),
    put: (path, body, o) => request(path, { ...o, method: 'PUT', body }),
    patch: (path, body, o) => request(path, { ...o, method: 'PATCH', body }),
    del: (path, o) => request(path, { ...o, method: 'DELETE' }),
    refreshAccessToken,
    setSessionExpiredHandler(handler) {
      onSessionExpired = handler;
    },
  };
}

/** Çevrimdışı durum bayrağı — NetInfo dinleyicisi (lib/network.ts) günceller */
let offlineFlag = false;
export function setOfflineFlag(value: boolean): void {
  offlineFlag = value;
}
export function isOfflineNow(): boolean {
  return offlineFlag;
}

/** Uygulama genelinde kullanılan istemci */
export const api = createApiClient({
  baseUrl: env.apiUrl,
  tokens: tokenStorage,
  isOffline: isOfflineNow,
});
