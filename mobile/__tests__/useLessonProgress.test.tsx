import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { LessonDetail } from '@devacademy/shared';
import { useLessonProgress } from '@/hooks/useLessonProgress';
import { saveProgress } from '@/offline/queue';
import { useSession } from '@/stores/session';

/** Ders ilerlemesi: refetch oturum sayaçlarını silmemeli, ekrandan çıkarken süre gönderilmeli */

jest.mock('@/offline/queue', () => ({ saveProgress: jest.fn(async () => true) }));

const lesson = (percent: number) =>
  ({
    id: 'l1',
    blocks: Array.from({ length: 10 }, (_, i) => ({ id: `b${i}` })),
    progress: { percent, status: 'in_progress' },
  }) as unknown as LessonDetail;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(saveProgress).mockClear();
  useSession.setState({ status: 'authenticated' });
});
afterEach(() => jest.useRealTimers());

it('refetch (yeni yüzde) görüntülenen blokları ve süreyi sıfırlamaz', async () => {
  const { result, rerender, unmount } = renderHook(
    ({ l }: { l: LessonDetail }) => useLessonProgress(l),
    {
      wrapper,
      initialProps: { l: lesson(0) },
    },
  );
  act(() => result.current.markViewed('b0'));
  act(() => result.current.markViewed('b1'));
  jest.advanceTimersByTime(30_000);

  // Bağlantı gelince ders yeniden çekildi; sunucu yüzdesi değişti
  rerender({ l: lesson(20) });
  expect(result.current.percent).toBe(20);

  jest.mocked(saveProgress).mockClear();
  await act(async () => unmount());
  expect(saveProgress).toHaveBeenCalledTimes(1);
  const [, dto] = jest.mocked(saveProgress).mock.calls[0];
  expect(dto.secondsSpent).toBeGreaterThanOrEqual(30);
  expect(dto.lastBlockId).toBe('b1');
});
