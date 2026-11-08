import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { ConceptSummary } from '@devacademy/shared';
import { QueryClient } from '@tanstack/react-query';
import { renderWithProviders } from '@/test/utils';
import { maxScore } from '@/lib/match-game';
import { MatchGame } from './MatchGame';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
const api = vi.fn();
vi.mock('@/lib/api', () => ({ api: (...a: unknown[]) => api(...a) }));

const mk = (n: number): ConceptSummary => ({
  id: `c${n}`,
  term: { tr: `Terim${n}`, en: `Term${n}` },
  definition: { tr: `Tanim${n} aciklamasi.` },
  aliases: [],
  lessonCount: 1,
});
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
const press = (id: string) => fireEvent.click(screen.getByTestId(id));

beforeEach(() => {
  api.mockReset();
  window.localStorage.clear();
});

describe('MatchGame', () => {
  it('tüm eşleşmeler doğruysa sonuç ekranı, tam puan ve rekor', async () => {
    api.mockResolvedValue([1, 2, 3, 4, 5, 6, 7, 8].map(mk));
    renderWithProviders(<MatchGame />, 'tr', client());
    await screen.findByTestId('match-screen');
    const n = screen.getAllByTestId(/^match-term-/).length;
    for (let i = 0; i < n; i++) {
      press(`match-term-${i}`);
      press(`match-def-${i}`);
    }
    expect(await screen.findByTestId('match-result')).toBeTruthy();
    expect(screen.getByText(new RegExp(`${maxScore(n)} / ${maxScore(n)}`))).toBeTruthy();
    expect(screen.getByText(/Yeni rekor/)).toBeTruthy();
    expect(window.localStorage.getItem('da.match.best.random')).toBe(String(maxScore(n)));
  });

  it('yanlış eşleşme puanı düşürür (10 → 7) ve hata sayılır', async () => {
    api.mockResolvedValue([1, 2, 3, 4, 5, 6, 7, 8].map(mk));
    renderWithProviders(<MatchGame />, 'tr', client());
    await screen.findByTestId('match-screen');
    press('match-term-0');
    press('match-def-0'); // doğru: +10
    expect(screen.getByText('Puan: 10')).toBeTruthy();
    press('match-term-1');
    press('match-def-2'); // yanlış: -3
    expect(screen.getByText('Puan: 7')).toBeTruthy();
  });

  it('yeterli kavram yoksa boş durum', async () => {
    api.mockResolvedValue([mk(1), mk(2)]);
    renderWithProviders(<MatchGame />, 'tr', client());
    expect(await screen.findByText(/yeterli kavram/i)).toBeTruthy();
  });
});
