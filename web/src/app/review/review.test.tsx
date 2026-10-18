import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import ReviewPage from './page';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/components/auth/RequireAuth', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/lib/api', () => ({ api: vi.fn(async () => undefined) }));
vi.mock('@/lib/hooks', () => ({
  useReviews: () => ({
    isLoading: false,
    data: [
      {
        id: 'c1',
        concept: 'round-robin',
        questionId: 'q1',
        lessonId: 'a-05',
        dueAt: '2026-01-01T00:00:00.000Z',
        intervalDays: 1,
        easeFactor: 2.5,
        repetitions: 0,
        type: 'single',
        prompt: { tr: 'Hangi algoritma sırayla dağıtır?' },
        options: [
          { id: 'a', text: { tr: 'Rastgele' } },
          { id: 'b', text: { tr: 'Round-robin' } },
        ],
        correctAnswer: ['b'],
        explanation: { tr: 'Round-robin istekleri sırayla dağıtır.' },
      },
    ],
  }),
}));

describe('Tekrar sayfası', () => {
  it('kontrol edince doğru cevabı ve açıklamayı gösterir', () => {
    renderWithProviders(<ReviewPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Rastgele' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cevabımı kontrol et' }));

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Cevabın doğru değil.');
    expect(status).toHaveTextContent('Doğru cevap: Round-robin');
    expect(status).toHaveTextContent('Round-robin istekleri sırayla dağıtır.');
  });
});
