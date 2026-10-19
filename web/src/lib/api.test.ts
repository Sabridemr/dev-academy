import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';
import { useAuthStore } from './auth-store';

/** API istemcisi: refresh'in oturumu yalnızca gerçek retlerde kapatması, sekmeler arası token ve hata gövdeleri */

const user = { id: 'u1', email: 'a@b.c', displayName: 'A', role: 'student' } as never;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ user, accessToken: 'old', refreshToken: 'r1', hydrated: true });
});
afterEach(() => vi.unstubAllGlobals());

describe('api', () => {
  it('refresh 5xx dönerse oturumu kapatmaz', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/auth/refresh') ? json(503, {}) : json(401, { message: 'expired' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(api('/users/me')).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState().refreshToken).toBe('r1');
  });

  it('refresh reddedilirse oturumu kapatır', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/auth/refresh') ? json(401, {}) : json(401, { message: 'expired' }),
      ),
    );
    await expect(api('/users/me')).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('başka sekme token’ı zaten döndürdüyse eski refresh token’ı göndermez', async () => {
    // Diğer sekme yeni çifti depoya yazmış
    localStorage.setItem(
      'da-auth',
      JSON.stringify({ state: { user, accessToken: 'new', refreshToken: 'r2' }, version: 0 }),
    );
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return json(401, {});
      const auth = (init?.headers as Record<string, string>).Authorization;
      return auth === 'Bearer new' ? json(200, { ok: true }) : json(401, { message: 'expired' });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(api('/users/me')).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/auth/refresh'))).toBe(false);
    expect(useAuthStore.getState().refreshToken).toBe('r2');
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
