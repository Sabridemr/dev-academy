import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import type { ConceptSummary } from '@devacademy/shared';
import GlossaryScreen from '@/app/glossary/index';
import { ConceptChips } from '@/components/content/ConceptChips';
import { endpoints } from '@/lib/endpoints';

/** Sözlük ekranı (istemci tarafı arama) ve ders ekranındaki kavram çipleri */

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/lib/endpoints', () => ({ endpoints: { concepts: jest.fn() } }));

const CONCEPTS: ConceptSummary[] = [
  {
    id: 'round-robin',
    term: { tr: 'Round-robin', en: 'Round-robin' },
    definition: { tr: 'İstekleri sunuculara sırayla dağıtır.' },
    aliases: ['RR'],
    lessonCount: 2,
  },
  {
    id: 'sharding',
    term: { tr: 'Şardlama', en: 'Sharding' },
    definition: { tr: 'Veriyi anahtara göre parçalara böler.' },
    aliases: [],
    lessonCount: 1,
  },
];

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** Arama kutusuna yazar ve 150 ms'lik debounce'un geçmesini bekler */
async function search(text: string) {
  fireEvent.changeText(screen.getByTestId('glossary-search'), text);
  await act(() => new Promise((r) => setTimeout(r, 250)));
}

beforeEach(() => {
  jest.mocked(endpoints.concepts).mockResolvedValue(CONCEPTS);
  mockPush.mockClear();
});

it('sözlüğü listeler, aramada eş ad ve İngilizce terimle süzer', async () => {
  renderWithClient(<GlossaryScreen />);
  await screen.findByTestId('concept-round-robin');
  expect(screen.getByTestId('concept-sharding')).toBeTruthy();
  expect(screen.getByText('2 kavram')).toBeTruthy();

  await search('sharding');
  expect(screen.queryByTestId('concept-round-robin')).toBeNull();
  expect(screen.getByTestId('concept-sharding')).toBeTruthy();

  await search('rr');
  expect(screen.queryByTestId('concept-sharding')).toBeNull();
  fireEvent.press(screen.getByTestId('concept-round-robin'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/glossary/[id]',
    params: { id: 'round-robin' },
  });
  // CI'da iki debounce beklemesi ve ilk render 5 sn'lik varsayılanı aşabiliyor
}, 20000);

it('ders kavram çipleri terimi gösterir, bilinmeyen kavramda id’ye düşer, dokununca detayı açar', async () => {
  renderWithClient(<ConceptChips concepts={['sharding', 'sozlukte-yok']} />);
  expect(await screen.findByText('Şardlama')).toBeTruthy();
  expect(screen.getByText('sozlukte-yok')).toBeTruthy();
  fireEvent.press(screen.getByTestId('concept-chip-sharding'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/glossary/[id]', params: { id: 'sharding' } });
});

it('kavramı olmayan derste çip bölümü çizilmez', () => {
  renderWithClient(<ConceptChips concepts={[]} />);
  expect(screen.queryByTestId('lesson-concepts')).toBeNull();
});
