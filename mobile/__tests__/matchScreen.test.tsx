import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ConceptSummary } from '@devacademy/shared';
import MatchGameScreen from '@/app/game/match';
import { endpoints } from '@/lib/endpoints';
import { kv, KV_KEYS } from '@/lib/storage';
import { maxScore } from '@/lib/matchGame';

/** Kelime eşleştirme ekranı: tam doğru tur, yanlış eşleşme, tekrar oyna, boş durum */

const mockBack = jest.fn();
let mockParams: { lessonId?: string } = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: () => mockBack() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/lib/endpoints', () => ({ endpoints: { concepts: jest.fn(), lesson: jest.fn() } }));

const mk = (n: number): ConceptSummary => ({
  id: `c${n}`,
  term: { tr: `Terim${n}`, en: `Term${n}` },
  definition: { tr: `Tanim${n} aciklamasi.` },
  aliases: [],
  lessonCount: 1,
});
const MANY = [1, 2, 3, 4, 5, 6, 7, 8].map(mk);

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <MatchGameScreen />
    </QueryClientProvider>,
  );
}

/** Terim i ile tanım i aynı çifttir (aynı indeks = doğru eşleşme) */
const pairCount = () => screen.queryAllByTestId(/^match-term-/).length;
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const solveAll = (n: number) => {
  for (let i = 0; i < n; i++) {
    press(`match-term-${i}`);
    press(`match-def-${i}`);
  }
};

beforeEach(() => {
  mockParams = {};
  mockBack.mockClear();
  kv.clearAll();
  jest.mocked(endpoints.concepts).mockResolvedValue(MANY);
});

it('tüm eşleşmeler doğruysa sonuç ekranı ve tam puan gösterilir', async () => {
  renderScreen();
  await screen.findByTestId('match-screen');
  const n = pairCount();
  expect(n).toBeGreaterThanOrEqual(3);
  solveAll(n);
  expect(await screen.findByTestId('match-result')).toBeTruthy();
  expect(screen.getByText(`${maxScore(n)} / ${maxScore(n)} puan`)).toBeTruthy();
  expect(screen.getByText('Hata: 0')).toBeTruthy();
  expect(screen.getByText('Yeni rekor!')).toBeTruthy();
  expect(kv.getNumber(KV_KEYS.matchBest('random'))).toBe(maxScore(n));
});

it('yanlış eşleşme puanı düşürür, kartlar kısa süre kilitlenir, hata sayısı artar', async () => {
  renderScreen();
  await screen.findByTestId('match-screen');
  const n = pairCount();
  press('match-term-0');
  press('match-def-0'); // +10
  expect(screen.getByText('Puan: 10')).toBeTruthy();
  press('match-term-1');
  press('match-def-2'); // yanlış: -3
  expect(screen.getByText('Puan: 7')).toBeTruthy();
  // kilit süresince başka dokunuş yok sayılır
  press('match-term-3');
  press('match-def-3');
  expect(screen.getByText('Puan: 7')).toBeTruthy();
  await act(() => new Promise((r) => setTimeout(r, 800)));
  for (let i = 1; i < n; i++) {
    press(`match-term-${i}`);
    press(`match-def-${i}`);
  }
  expect(screen.getByTestId('match-result')).toBeTruthy();
  expect(screen.getByText('Hata: 1')).toBeTruthy();
});

it('Tekrar oyna yeni tur başlatır (puan sıfırlanır)', async () => {
  renderScreen();
  await screen.findByTestId('match-screen');
  solveAll(pairCount());
  fireEvent.press(await screen.findByTestId('match-again'));
  expect(await screen.findByTestId('match-screen')).toBeTruthy();
  expect(screen.getByText('Puan: 0')).toBeTruthy();
  expect(screen.getByTestId('match-term-0')).toBeTruthy();
});

it('yeterli kavram yoksa boş durum gösterir', async () => {
  jest.mocked(endpoints.concepts).mockResolvedValue(MANY.slice(0, 2));
  renderScreen();
  expect(await screen.findByText('Oyun için yeterli kavram bulunamadı.')).toBeTruthy();
  expect(screen.queryByTestId('match-screen')).toBeNull();
});
