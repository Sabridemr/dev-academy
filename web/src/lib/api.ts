import { AUTH_MODE_HEADER, type ApiErrorBody, type AuthTokens } from '@devacademy/shared';
import { AUTH_STORAGE_KEY, takeLegacyRefreshToken, useAuthStore } from './auth-store';

/**
 * API istemcisi.
 *  - Access token'ı (bellekte) Authorization başlığına ekler.
 *  - /auth/* çağrıları çerez modundadır: refresh token httpOnly çerezde taşınır (credentials: include).
 *  - 401'de tek seferlik refresh dener (eş zamanlı istekler aynı refresh promise'ini paylaşır).
 *  - Hata gövdesini ApiError olarak fırlatır (merkezi hata formatı).
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').replace(
  /\/$/,
  '',
);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: Partial<ApiErrorBody>,
  ) {
    super(body.message ?? `HTTP ${status}`);
    this.name = 'ApiError';
  }
}

let refreshing: Promise<string | null> | null = null;

const AUTH_HEADERS = { [AUTH_MODE_HEADER]: 'cookie' } as const;

/**
 * Refresh çereziyle yeni access token alır; yenilenemezse null. Sekmeler aynı çerezi paylaştığından
 * Web Locks ile aynı anda yalnızca bir sekme yeniler: aynı (döndürülmüş) token'ın iki kez gönderilmesi
 * sunucuda yeniden kullanım tespitini tetikleyip tüm oturumu kapatırdı.
 */
async function refreshTokens(): Promise<string | null> {
  const run = async (): Promise<string | null> => {
    // Eski sürümden kalan localStorage token'ı varsa bir kez gövdede gönderilir, sunucu çereze yazar
    const legacy = takeLegacyRefreshToken();
    let res: Response;
    try {
      res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
        body: JSON.stringify(legacy ? { refreshToken: legacy } : {}),
      });
    } catch {
      return null; // ağ hatası: oturum korunur
    }
    if (!res.ok) {
      // Yalnızca sunucu token'ı reddettiyse çıkış yap; 5xx/429 geçicidir
      if (res.status === 400 || res.status === 401 || res.status === 403)
        useAuthStore.getState().clear();
      return null;
    }
    const tokens = (await res.json()) as AuthTokens;
    useAuthStore.getState().setAccessToken(tokens.accessToken);
    return tokens.accessToken;
  };
  if (typeof navigator !== 'undefined' && navigator.locks)
    return navigator.locks.request('da-auth-refresh', run);
  return run();
}

function sharedRefresh(): Promise<string | null> {
  refreshing ??= refreshTokens().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/**
 * Açılışta oturumu kurar: profil localStorage'dan okunur, varsa access token çerezle alınır; ardından
 * `hydrated` işaretlenir (RequireAuth bunu bekler). Diğer sekmede giriş/çıkış yapılınca bu sekme de uyar.
 */
export function startAuthSession(): () => void {
  const store = useAuthStore;
  const bootstrap = async () => {
    await store.persist.rehydrate();
    if (store.getState().user && !store.getState().accessToken) await sharedRefresh();
    store.setState({ hydrated: true });
  };
  void bootstrap();
  const onStorage = (e: StorageEvent) => {
    if (e.key !== AUTH_STORAGE_KEY && e.key !== null) return;
    void (async () => {
      const hadUser = Boolean(store.getState().user);
      await store.persist.rehydrate();
      const { user, accessToken } = store.getState();
      if (!user)
        store.setState({ accessToken: null }); // diğer sekmede çıkış
      else if (!hadUser || !accessToken) await sharedRefresh(); // diğer sekmede giriş
    })();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Token eklemeden çağır */
  anonymous?: boolean;
}

export async function api<T>(
  path: string,
  options: RequestOptions = {},
  retried = false,
): Promise<T> {
  const { body, anonymous, headers, ...rest } = options;
  const accessToken = anonymous ? null : useAuthStore.getState().accessToken;
  const isAuthCall = path.startsWith('/auth/');
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    // Giriş/kayıt/çıkış refresh çerezini yazar ya da siler
    ...(isAuthCall ? { credentials: 'include' as const } : {}),
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(isAuthCall ? AUTH_HEADERS : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !anonymous && !retried && useAuthStore.getState().user) {
    if (await sharedRefresh()) return api<T>(path, options, true);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? (JSON.parse(text) as unknown) : undefined;
  } catch {
    // JSON olmayan gövde (ör. proxy'nin HTML 502 sayfası): SyntaxError yerine durum kodlu ApiError
    throw new ApiError(res.ok ? 502 : res.status, { message: `HTTP ${res.status}` });
  }
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
