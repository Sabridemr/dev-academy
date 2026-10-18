import type { ApiErrorBody, AuthTokens } from '@devacademy/shared';
import { useAuthStore } from './auth-store';

/**
 * API istemcisi.
 *  - Access token'ı Authorization başlığına ekler.
 *  - 401'de tek seferlik refresh dener (eş zamanlı istekler aynı refresh promise'ini paylaşır).
 *  - Hata gövdesini ApiError olarak fırlatır (merkezi hata formatı).
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: Partial<ApiErrorBody>,
  ) {
    super(body.message ?? `HTTP ${status}`);
    this.name = 'ApiError';
  }
}

let refreshing: Promise<AuthTokens | null> | null = null;

async function refreshTokens(): Promise<AuthTokens | null> {
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clear();
      return null;
    }
    const tokens = (await res.json()) as AuthTokens;
    setTokens(tokens);
    return tokens;
  } catch {
    return null;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Token eklemeden çağır */
  anonymous?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const { body, anonymous, headers, ...rest } = options;
  const accessToken = anonymous ? null : useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !anonymous && !retried && useAuthStore.getState().refreshToken) {
    refreshing ??= refreshTokens().finally(() => {
      refreshing = null;
    });
    const tokens = await refreshing;
    if (tokens) return api<T>(path, options, true);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) throw new ApiError(res.status, (data ?? {}) as Partial<ApiErrorBody>);
  return data as T;
}

/** Sunucu bileşenleri için: önbellekli, anonim içerik çağrısı */
export async function serverApi<T>(path: string, revalidateSeconds = 60): Promise<T> {
  const base = (process.env.API_URL_INTERNAL ?? API_URL).replace(/\/$/, '');
  const res = await fetch(`${base}${path}`, { next: { revalidate: revalidateSeconds } });
  if (!res.ok) {
    let body: Partial<ApiErrorBody> = {};
    try {
      body = (await res.json()) as Partial<ApiErrorBody>;
    } catch {
      /* gövde yok */
    }
    throw new ApiError(res.status, body);
  }
  return (await res.json()) as T;
}
