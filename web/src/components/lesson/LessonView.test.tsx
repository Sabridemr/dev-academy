import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import type { LessonDetail } from '@devacademy/shared';
import { renderWithProviders } from '@/test/utils';
import { LessonView } from './LessonView';

const mutate = vi.fn();
let lessonData: LessonDetail | undefined;

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/lib/auth-store', () => ({ useIsAuthenticated: () => true }));
vi.mock('@/lib/api', () => ({ api: vi.fn(async () => undefined) }));
vi.mock('@/lib/hooks', () => ({
  useLesson: () => ({ data: lessonData }),
  useModule: () => ({ data: undefined }),
  useUpdateProgress: () => ({ mutate, isPending: false }),
  useBookmarks: () => ({ data: [] }),
  useNotes: () => ({ data: [] }),
  useConcepts: () => ({
    data: [{ id: 'round-robin', term: { tr: 'Round-robin (sırayla)', en: 'Round-robin' } }],
  }),
  usePrefersReducedMotion: () => true,
  useLessonFeedback: () => ({ data: undefined, isLoading: false }),
  useSubmitLessonFeedback: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
}));

const initial = {
  id: 'l1',
  slug: 'l1',
  moduleId: 'm1',
  order: 1,
  title: { tr: 'Ders' },
  summary: { tr: 'Özet' },
  durationMinutes: 10,
  level: 'beginner',
  tags: [],
  concepts: [],
  blocks: [],
  module: { id: 'm1', slug: 'm1', code: 'A', title: { tr: 'Modül' } },
  prev: null,
  next: null,
} as unknown as LessonDetail;

afterEach(() => {
  lessonData = undefined;
  mutate.mockReset();
  vi.useRealTimers();
});

describe('LessonView ilerleme', () => {
  it('misafir SSR verisinden sonra gelen oturumlu ilerlemeyi gösterir', () => {
    const view = renderWithProviders(<LessonView initial={initial} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

    lessonData = { ...initial, progress: { status: 'in_progress', percent: 40 } } as LessonDetail;
    view.rerender(<LessonView initial={initial} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
  });

  it('sayfa gizlenince ilerlemeyi keepalive isteğiyle gönderir', async () => {
    const { api } = await import('@/lib/api');
    lessonData = { ...initial, progress: { status: 'in_progress', percent: 30 } } as LessonDetail;
    renderWithProviders(<LessonView initial={initial} />);

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(api).toHaveBeenCalledWith(
      '/progress/lessons/l1',
      expect.objectContaining({
        method: 'PUT',
        keepalive: true,
        body: expect.objectContaining({ percent: 30 }),
      }),
    );
  });

  it('yüzde değişmedikçe periyodik kayıt tekrar istek atmaz', () => {
    vi.useFakeTimers();
    lessonData = { ...initial, progress: { status: 'in_progress', percent: 20 } } as LessonDetail;
    renderWithProviders(<LessonView initial={initial} />);
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(mutate).toHaveBeenCalledTimes(1);
  });
});

describe('LessonView kavram çipleri', () => {
  it('frontmatter kavramlarını sözlük terimiyle gösterir ve detay sayfasına bağlar', () => {
    renderWithProviders(
      <LessonView initial={{ ...initial, concepts: ['round-robin', 'sozlukte-yok'] }} />,
    );
    expect(screen.getByRole('heading', { name: 'Bu dersteki kavramlar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Round-robin (sırayla)' })).toHaveAttribute(
      'href',
      '/glossary/round-robin',
    );
    // Sözlükte terimi bulunamayan kavram id'siyle gösterilir
    expect(screen.getByRole('link', { name: 'sozlukte-yok' })).toHaveAttribute(
      'href',
      '/glossary/sozlukte-yok',
    );
  });

  it('kavramı olmayan derste bölüm gösterilmez', () => {
    renderWithProviders(<LessonView initial={initial} />);
    expect(screen.queryByText('Bu dersteki kavramlar')).not.toBeInTheDocument();
  });
});
