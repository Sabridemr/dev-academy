import { ApiError, createApiClient, type TokenStore } from '@/lib/api';
import type { StoredTokens } from '@/lib/storage';

/**
 * API istemcisi: 401 → tek uçuşlu (single-flight) token yenileme, başarısız yenilemede oturum
 * sonlandırma, çevrimdışı hata ve ETag/304 desteği.
 */

interface FakeResponseInit {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

function response({ status, body, headers = {} }: FakeResponseInit): Response {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

type MemoryTokenStore = TokenStore & { current: StoredTokens | null; clear: jest.Mock };

function memoryTokens(initial: StoredTokens | null): MemoryTokenStore {
  const store: MemoryTokenStore = {
    current: initial,
    get: jest.fn(async () => store.current),
    set: jest.fn(async (t: StoredTokens) => {
      store.current = t;
    }),
    clear: jest.fn(async () => {
      store.current = null;
    }),
  };
  return store;
}

const BASE = 'https://api.test/api/v1';

describe('createApiClient', () => {
  it('eşzamanlı 401 yanıtlarında yalnızca BİR refresh isteği atar ve hepsini yeni token ile tekrarlar', async () => {
    const tokens = memoryTokens({ accessToken: 'old', refreshToken: 'refresh-1' });
    let refreshCalls = 0;
    let releaseRefresh: () => void = () => undefined;
    const refreshGate = new Promise<void>((r) => {
      releaseRefresh = r;
    });

    const fetchImpl = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (u.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        await refreshGate; // tüm istekler 401 alana kadar yenilemeyi beklet
        return response({
          status: 200,
          body: {
            accessToken: 'new',
            refreshToken: 'refresh-2',
            expiresIn: 900,
            tokenType: 'Bearer',
          },
        });
      }
      if (auth === 'Bearer old')
        return response({ status: 401, body: { statusCode: 401, message: 'expired' } });
      if (auth === 'Bearer new')
        return response({ status: 200, body: { path: u.replace(BASE, '') } });
      return response({ status: 500 });
    }) as unknown as typeof fetch;

    const api = createApiClient({ baseUrl: BASE, tokens, fetchImpl });
    const pending = Promise.all([
      api.get<{ path: string }>('/a'),
      api.get<{ path: string }>('/b'),
      api.get<{ path: string }>('/c'),
    ]);
    // Mikro görevlerin ilerlemesine izin ver, sonra yenilemeyi serbest bırak
    await new Promise((r) => setTimeout(r, 10));
    releaseRefresh();
    const results = await pending;

    expect(refreshCalls).toBe(1);
    expect(results.map((r) => r.path)).toEqual(['/a', '/b', '/c']);
    expect(tokens.current).toEqual({ accessToken: 'new', refreshToken: 'refresh-2' });
  });

  it('refresh reddedilirse token’ları siler, onSessionExpired çağırır ve unauthorized fırlatır', async () => {
    const tokens = memoryTokens({ accessToken: 'old', refreshToken: 'bad-refresh' });
    const onSessionExpired = jest.fn();
    const fetchImpl = jest.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith('/auth/refresh'))
        return response({ status: 401, body: { message: 'invalid' } });
      return response({ status: 401, body: { statusCode: 401, message: 'expired' } });
    }) as unknown as typeof fetch;

    const api = createApiClient({ baseUrl: BASE, tokens, fetchImpl, onSessionExpired });
    await expect(api.get('/users/me')).rejects.toMatchObject({ code: 'unauthorized', status: 401 });
    expect(tokens.clear).toHaveBeenCalled();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('refresh ağ hatası ya da 5xx alırsa oturumu korur ve geçici hatayı iletir', async () => {
    for (const [refresh, code] of [
      [() => Promise.reject(new TypeError('Network request failed')), 'network'],
      [async () => response({ status: 503 }), 'server'],
    ] as const) {
      const tokens = memoryTokens({ accessToken: 'old', refreshToken: 'refresh-1' });
      const onSessionExpired = jest.fn();
      const fetchImpl = jest.fn(async (url: RequestInfo | URL) => {
        if (String(url).endsWith('/auth/refresh')) return refresh();
        return response({ status: 401, body: { statusCode: 401, message: 'expired' } });
      }) as unknown as typeof fetch;

      const api = createApiClient({ baseUrl: BASE, tokens, fetchImpl, onSessionExpired });
      await expect(api.get('/users/me')).rejects.toMatchObject({ code });
      expect(tokens.clear).not.toHaveBeenCalled();
      expect(onSessionExpired).not.toHaveBeenCalled();
      expect(tokens.current).toEqual({ accessToken: 'old', refreshToken: 'refresh-1' });
    }
  });

  it('auth:false isteklerinde Authorization başlığı göndermez ve 401’de refresh denemez', async () => {
    const tokens = memoryTokens({ accessToken: 'tok', refreshToken: 'r' });
    const fetchImpl = jest.fn(async () =>
      response({ status: 401, body: { message: 'Invalid credentials' } }),
    ) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: BASE, tokens, fetchImpl });
    await expect(
      api.post('/auth/login', { email: 'a@b.co', password: 'x' }, { auth: false }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const init = (fetchImpl as unknown as jest.Mock).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('çevrimdışıyken istek atmadan offline hatası verir', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    const api = createApiClient({
      baseUrl: BASE,
      tokens: memoryTokens(null),
      fetchImpl,
      isOffline: () => true,
    });
    const err = await api.get('/paths').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('offline');
    expect((err as ApiError).isConnectivity).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fetch ağ hatasını network koduna çevirir', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: BASE, tokens: memoryTokens(null), fetchImpl });
    await expect(api.get('/paths')).rejects.toMatchObject({ code: 'network' });
  });

  it('If-None-Match gönderir ve 304’ü notModified olarak döner', async () => {
    const fetchImpl = jest.fn(async () =>
      response({ status: 304, headers: { ETag: 'W/"v1"' } }),
    ) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: BASE, tokens: memoryTokens(null), fetchImpl });
    const res = await api.requestRaw('/offline/modules/a', { etag: 'W/"v1"' });
    expect(res).toEqual({ status: 304, data: null, etag: 'W/"v1"', notModified: true });
    const init = (fetchImpl as unknown as jest.Mock).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['If-None-Match']).toBe('W/"v1"');
  });
});
