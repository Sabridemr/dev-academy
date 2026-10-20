import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { api } from '@/lib/api';
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
const singleCard = {
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
};
const orderCard = {
  ...singleCard,
  id: 'c2',
  questionId: 'q2',
  type: 'order',
  prompt: { tr: 'İstek akışını sırala' },
  options: [
    { id: 'lb', text: { tr: 'Yük dengeleyici' } },
    { id: 'dns', text: { tr: 'DNS' } },
  ],
  correctAnswer: ['dns', 'lb'],
  explanation: { tr: '' },
};
const reviews = { cards: [singleCard] as unknown[] };
vi.mock('@/lib/hooks', () => ({
  useReviews: () => ({ isLoading: false, data: reviews.cards }),
  useProgressSummary: () => ({ data: undefined }),
}));

beforeEach(() => {
  reviews.cards = [singleCard];
  vi.mocked(api).mockClear();
});

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

  it('sıralama sorusu oklarla doğru sıraya dizilip doğru sayılır', () => {
    reviews.cards = [orderCard];
    renderWithProviders(<ReviewPage />);
    fireEvent.click(screen.getByRole('button', { name: 'DNS yukarı taşı' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cevabımı kontrol et' }));
    expect(screen.getByRole('status')).toHaveTextContent('Doğru cevap: DNS → Yük dengeleyici');
    expect(screen.getByRole('status')).not.toHaveTextContent('Cevabın doğru değil.');
  });

  it('değerlendirme düğmesine çift tıklama kartı bir kez değerlendirir', async () => {
    reviews.cards = [singleCard, { ...singleCard, id: 'c3' }];
    renderWithProviders(<ReviewPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Round-robin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cevabımı kontrol et' }));
    const [first] = screen.getAllByRole('button', { name: /^5 / });
    await act(async () => {
      fireEvent.click(first);
      fireEvent.click(first);
    });
    expect(api).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Kart 2/2')).toBeInTheDocument();
  });
});
