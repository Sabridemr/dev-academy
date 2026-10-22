import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ConceptDetail, ConceptSummary } from '@devacademy/shared';
import { renderWithProviders } from '@/test/utils';
import { ConceptView } from './ConceptView';
import { GlossaryView } from './GlossaryView';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
const api = vi.fn();
vi.mock('@/lib/api', () => ({ api: (...args: unknown[]) => api(...args) }));

const summary = (
  id: string,
  tr: string,
  en: string,
  definition: string,
  extra: Partial<ConceptSummary> = {},
): ConceptSummary => ({
  id,
  term: { tr, en },
  definition: { tr: definition },
  aliases: [],
  lessonCount: 1,
  ...extra,
});

const CONCEPTS: ConceptSummary[] = [
  summary('round-robin', 'Round-robin', 'Round-robin', 'İstekleri sunuculara sırayla dağıtır.', {
    aliases: ['RR'],
    lessonCount: 2,
  }),
  summary('sharding', 'Şardlama', 'Sharding', 'Veriyi anahtara göre parçalara böler.'),
  summary(
    'least-connections',
    'En az bağlantı',
    'Least connections',
    'Açık bağlantısı en az sunucuyu seçer.',
  ),
  summary('1nf', '1NF (Birinci Normal Form)', 'First Normal Form', 'Her hücre tek değer tutar.', {
    lessonCount: 0,
  }),
];

afterEach(() => api.mockReset());

const cardTitles = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent);

describe('GlossaryView', () => {
  it('kavramları Türkçe alfabeyle baş harf gruplarında listeler', () => {
    renderWithProviders(<GlossaryView initial={CONCEPTS} />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      '#',
      'E',
      'R',
      'Ş',
    ]);
    expect(cardTitles()).toEqual([
      '1NF (Birinci Normal Form)',
      'En az bağlantı',
      'Round-robin',
      'Şardlama',
    ]);
    expect(screen.getByRole('link', { name: /Şardlama/ })).toHaveAttribute(
      'href',
      '/glossary/sharding',
    );
    expect(screen.getByText('4 kavram')).toBeInTheDocument();
  });

  it('harf süzgeci yalnızca o harfle başlayan kavramları gösterir', () => {
    renderWithProviders(<GlossaryView initial={CONCEPTS} />);
    const letters = screen.getByRole('group', { name: 'Harfe göre süz' });
    fireEvent.click(within(letters).getByRole('button', { name: 'Ş' }));
    expect(cardTitles()).toEqual(['Şardlama']);
    expect(within(letters).getByRole('button', { name: 'Ş' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(within(letters).getByRole('button', { name: 'Tümü' }));
    expect(cardTitles()).toHaveLength(4);
  });

  it('arama eş ad, İngilizce terim ve tanımda Türkçe karakter duyarsız çalışır', async () => {
    renderWithProviders(<GlossaryView initial={CONCEPTS} />);
    const input = screen.getByRole('searchbox', { name: 'Sözlükte ara' });
    fireEvent.change(input, { target: { value: 'rr' } });
    await waitFor(() => expect(cardTitles()).toEqual(['Round-robin']));
    fireEvent.change(input, { target: { value: 'sharding' } });
    await waitFor(() => expect(cardTitles()).toEqual(['Şardlama']));
    fireEvent.change(input, { target: { value: 'baglanti' } });
    await waitFor(() => expect(cardTitles()).toEqual(['En az bağlantı']));
    fireEvent.change(input, { target: { value: 'kafka' } });
    await waitFor(() => expect(screen.getByText('Aramana uyan kavram yok.')).toBeInTheDocument());
  });

  it('İngilizcede İngilizce terimle sıralar ve Türkçe karşılığı alt satırda gösterir', () => {
    renderWithProviders(<GlossaryView initial={CONCEPTS} />, 'en');
    expect(cardTitles()).toEqual([
      'First Normal Form',
      'Least connections',
      'Round-robin',
      'Sharding',
    ]);
    expect(screen.getByText('Şardlama')).toBeInTheDocument();
  });

  it('başlangıç verisi yoksa sözlüğü API’den yükler', async () => {
    api.mockResolvedValue(CONCEPTS);
    renderWithProviders(<GlossaryView />);
    await waitFor(() => expect(cardTitles()).toHaveLength(4));
    expect(api).toHaveBeenCalledWith('/concepts', { anonymous: true });
  });
});

describe('ConceptView', () => {
  const detail: ConceptDetail = {
    ...CONCEPTS[0]!,
    questionCount: 3,
    lessons: [
      {
        id: 'a-05-load-balancing',
        slug: 'load-balancing',
        moduleId: 'a-system-design-fundamentals',
        moduleCode: 'A',
        title: { tr: 'Load Balancer', en: 'Load Balancer' },
      },
    ],
    related: [{ id: 'least-connections', term: { tr: 'En az bağlantı', en: 'Least connections' } }],
  };

  it('tanımı, geçtiği dersleri ve ilgili kavramları bağlantılı gösterir', () => {
    renderWithProviders(<ConceptView initial={detail} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Round-robin' })).toBeInTheDocument();
    expect(screen.getByText('İstekleri sunuculara sırayla dağıtır.')).toBeInTheDocument();
    expect(screen.getByText('RR')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Load Balancer/ })).toHaveAttribute(
      'href',
      '/lessons/a-05-load-balancing',
    );
    expect(screen.getByRole('link', { name: 'En az bağlantı' })).toHaveAttribute(
      'href',
      '/glossary/least-connections',
    );
    expect(screen.getByText('3 quiz sorusu bu kavramı ölçüyor')).toBeInTheDocument();
  });

  it('hiçbir derste geçmeyen kavram için bilgi notu gösterir', () => {
    renderWithProviders(
      <ConceptView
        initial={{ ...detail, lessons: [], related: [], questionCount: 0, lessonCount: 0 }}
      />,
    );
    expect(screen.getByText('Bu kavram henüz yayındaki bir derste geçmiyor.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'İlgili kavramlar' })).not.toBeInTheDocument();
  });
});
