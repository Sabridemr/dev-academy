import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { LessonBlock } from '@devacademy/shared';
import { renderWithProviders } from '@/test/utils';
import { PredictBlock } from './PredictBlock';
import { ResourcesBlock } from './ResourcesBlock';

const predict = {
  id: 'lb-tahmin',
  order: 0,
  type: 'predict',
  prompt: { tr: 'Dördüncü sunucu eklenince ne olur?', en: 'What happens with a fourth server?' },
  options: [
    { id: 'a', text: { tr: 'Hep ilk sunucu', en: 'Always the first' } },
    { id: 'b', text: { tr: 'Sıraya katılır', en: 'It joins the rotation' } },
    { id: 'c', text: { tr: 'Rastgele' } },
  ],
  correct: 'b',
  explanation: { tr: 'Round robin sırayı korur.', en: 'Round robin keeps the order.' },
} as Extract<LessonBlock, { type: 'predict' }>;

const setReducedMotion = (matches: boolean) => {
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('reduce') ? matches : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
};

afterEach(() => setReducedMotion(false));

describe('PredictBlock', () => {
  it('seçimden önce açıklamayı göstermez; yanlış seçimde doğru cevabı ve açıklamayı gösterir', () => {
    renderWithProviders(<PredictBlock block={predict} />);
    expect(screen.getByText('Dördüncü sunucu eklenince ne olur?')).toBeInTheDocument();
    expect(screen.queryByText('Round robin sırayı korur.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Hep ilk sunucu/ }));

    expect(screen.getByRole('button', { name: /Hep ilk sunucu/ })).toHaveAttribute(
      'data-state',
      'wrong',
    );
    expect(screen.getByRole('button', { name: /Sıraya katılır/ })).toHaveAttribute(
      'data-state',
      'correct',
    );
    expect(screen.getByText('Tam değil. Doğru cevap: B) Sıraya katılır')).toBeInTheDocument();
    expect(screen.getByText('Round robin sırayı korur.')).toBeInTheDocument();
  });

  it('cevap verildikten sonra seçim değişmez; yeniden dene sıfırlar', () => {
    renderWithProviders(<PredictBlock block={predict} />);
    fireEvent.click(screen.getByRole('button', { name: /Sıraya katılır/ }));
    expect(screen.getByText('Doğru tahmin!')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Rastgele/ }));
    expect(screen.getByRole('button', { name: /Rastgele/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: /Yeniden dene/ }));
    expect(screen.queryByText('Doğru tahmin!')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hep ilk sunucu/ })).toHaveFocus();
  });

  it('ok tuşlarıyla seçenekler arasında döngüsel gezinir; seçenekler yerel düğmedir', () => {
    renderWithProviders(<PredictBlock block={predict} />);
    const first = screen.getByRole('button', { name: /Hep ilk sunucu/ });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: /Sıraya katılır/ })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(screen.getByRole('button', { name: /Rastgele/ })).toHaveFocus();
    // Native <button>: Enter/Boşluk tıklama üretir
    expect(screen.getByRole('button', { name: /Rastgele/ }).tagName).toBe('BUTTON');
  });

  it('İngilizce arayüzde İngilizce metni, yoksa Türkçesini kullanır', () => {
    renderWithProviders(<PredictBlock block={predict} />, 'en');
    expect(screen.getByText('What happens with a fourth server?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rastgele/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /It joins the rotation/ }));
    expect(screen.getByText('Round robin keeps the order.')).toBeInTheDocument();
  });

  it('hareket azaltma tercihinde geçiş ve kayma animasyonu kullanmaz', () => {
    setReducedMotion(true);
    renderWithProviders(<PredictBlock block={predict} />);
    const option = screen.getByRole('button', { name: /Hep ilk sunucu/ });
    expect(option.className).not.toContain('transition');
    fireEvent.click(option);
    expect(screen.getByTestId('predict-feedback').className).not.toContain('animate-');
  });

  it('hareket tercihi yoksa açıklama yumuşak geçişle gelir', () => {
    renderWithProviders(<PredictBlock block={predict} />);
    fireEvent.click(screen.getByRole('button', { name: /Hep ilk sunucu/ }));
    expect(screen.getByTestId('predict-feedback').className).toContain('animate-fade-up');
  });
});

describe('ResourcesBlock', () => {
  const resources = {
    id: 'resources-1',
    order: 0,
    type: 'resources',
    items: [
      {
        title: 'Designing Data-Intensive Applications',
        url: 'https://dataintensive.net',
        kind: 'book',
        note: '6. bölüm',
      },
      { title: 'Bir bağlantı', url: 'https://example.org/x' },
    ],
  } as Extract<LessonBlock, { type: 'resources' }>;

  it('bağlantıları yeni sekmede güvenli açar; tür ve notu gösterir', () => {
    renderWithProviders(<ResourcesBlock block={resources} />);
    expect(screen.getByRole('heading', { name: 'Kaynakça' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Designing Data-Intensive Applications/ });
    expect(link).toHaveAttribute('href', 'https://dataintensive.net');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Kitap · 6. bölüm')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
