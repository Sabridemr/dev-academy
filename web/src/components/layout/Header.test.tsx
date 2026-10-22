import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { renderWithProviders } from '@/test/utils';
import { useAuthStore } from '@/lib/auth-store';
import { Header } from './Header';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/api', () => ({
  api: vi.fn(async () => undefined),
  API_URL: 'http://localhost:4000/api/v1',
}));

describe('Header çıkış', () => {
  it('oturumu ve sorgu önbelleğini temizler', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['me'], { id: 'u1', email: 'onceki@x.y' });
    client.setQueryData(['bookmarks'], [{ id: 'b1' }]);
    useAuthStore.setState({
      hydrated: true,
      accessToken: 'a',
      user: {
        id: 'u1',
        email: 'onceki@x.y',
        displayName: 'Önceki',
        avatarUrl: null,
        role: 'student',
        locale: 'tr',
        selectedPathId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });

    renderWithProviders(<Header />, 'tr', client);
    fireEvent.click(screen.getByRole('button', { name: 'Kullanıcı menüsü' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Çıkış' }));

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull());
    expect(client.getQueryData(['me'])).toBeUndefined();
    expect(client.getQueryData(['bookmarks'])).toBeUndefined();
    expect(
      client
        .getQueryCache()
        .getAll()
        .filter((q) => q.state.data !== undefined),
    ).toHaveLength(0);
  });
});

describe('Header gezinme', () => {
  it('oturum açmamış kullanıcıya da Sözlük bağlantısını gösterir', () => {
    useAuthStore.setState({ hydrated: true, accessToken: null, user: null });
    renderWithProviders(<Header />, 'tr');
    const links = screen.getAllByRole('link', { name: 'Sözlük' });
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l).toHaveAttribute('href', '/glossary');
  });
});

