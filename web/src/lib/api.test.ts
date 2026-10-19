import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, startAuthSession } from './api';
import { useAuthStore } from './auth-store';

/**
 * API istemcisi: refresh token httpOnly çerezde (çerez modu), access token yalnızca bellekte;
 * oturum yalnızca gerçek retlerde kapanır; eski localStorage token'ı bir kez çereze taşınır.
 */

const user = { id: 'u1', email: 'a@b.c', displayName: 'A', role: 'student' } as never;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
type Init = RequestInit & { headers: Record<string, string> };

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ user, accessToken: 'old', hydrated: true });
});
afterEach(() => vi.unstubAllGlobals());

describe('api', () => {
  it('401 sonrası çerezle yeniler ve isteği yeni token ile tekrarlar', async () => {
    const fetchMock = vi.fn(async (url: string, init?: Init) => {
      if (url.endsWith('/auth/refresh')) return json(200, { accessToken: 'new', refreshToken: '' });
      return init?.headers.Authorization === 'Bearer new'
        ? json(200, { ok: true })
        : json(401, { message: 'expired' });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(api('/users/me')).resolves.toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/auth/refresh'))!;
    expect(init?.credentials).toBe('include');
    expect(init?.headers['X-Auth-Mode']).toBe('cookie');
    expect(init?.body).toBe('{}'); // refresh token gövdede değil, çerezde
    expect(useAuthStore.getState().accessToken).toBe('new');
  });

  it('refresh 5xx dönerse oturumu kapatmaz', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/auth/refresh') ? json(503, {}) : json(401, { message: 'expired' }),
      ),
    );
    await expect(api('/users/me')).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState().user).not.toBeNull();
  });

  it('refresh reddedilirse oturumu kapatır', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/auth/refresh') ? json(401, {}) : json(401, { message: 'expired' }),
      ),
    );
    await expect(api('/users/me')).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('JSON olmayan hata gövdesini ApiError’a çevirir', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>Bad Gateway</html>', { status: 502 })),
    );
    await expect(api('/modules', { anonymous: true })).rejects.toMatchObject({
      name: 'ApiError',
      status: 502,
    });
  });
});

describe('startAuthSession', () => {
  it('eski sürümün localStorage token’ını bir kez çereze taşır ve depodan siler', async () => {
    useAuthStore.setState({ user: null, accessToken: null, hydrated: false });
    localStorage.setItem(
      'da-auth',
      JSON.stringify({ state: { user, accessToken: 'a', refreshToken: 'legacy-r' }, version: 0 }),
    );
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      json(200, { accessToken: 'fresh', refreshToken: '' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const stop = startAuthSession();
    await vi.waitFor(() => expect(useAuthStore.getState().hydrated).toBe(true));
    stop();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      refreshToken: 'legacy-r',
    });
    expect(useAuthStore.getState().accessToken).toBe('fresh');
    expect(localStorage.getItem('da-auth')).not.toContain('legacy-r');
  });
});
