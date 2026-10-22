import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import PythonMemorySim from './PythonMemorySim';

describe('PythonMemorySim', () => {
  it('Adım ileri ile satırları çalıştırır, isimleri ve olayları gösterir', () => {
    const onInteract = vi.fn();
    renderWithProviders(
      <PythonMemorySim params={{ scenario: 'aliasing' }} onInteract={onInteract} />,
    );
    expect(screen.getByText('Program başlamadı')).toBeInTheDocument();
    const next = screen.getByRole('button', { name: 'Adım ileri' });
    fireEvent.click(next);
    expect(onInteract).toHaveBeenCalled();
    expect(screen.getByText('1. satır çalıştı')).toBeInTheDocument();
    expect(screen.getByText(/a → #\d+ \(isim bağlandı\)/)).toBeInTheDocument();
    fireEvent.click(next);
    expect(screen.getByText(/b → #\d+ \(isim bağlandı\)/)).toBeInTheDocument();
    expect(screen.getByText('ref=2')).toBeInTheDocument();
  });

  it('refcount-gc senaryosunda silinen nesneyi gösterir', () => {
    renderWithProviders(
      <PythonMemorySim params={{ scenario: 'refcount-gc' }} onInteract={() => undefined} />,
    );
    const next = screen.getByRole('button', { name: 'Adım ileri' });
    for (let i = 0; i < 5; i++) fireEvent.click(next);
    expect(screen.getByText(/referans sayısı 0, silindi/)).toBeInTheDocument();
  });

  it('düzenlenen kodda desteklenmeyen yapıyı hata olarak gösterir, geçerli kodu çalıştırır', () => {
    renderWithProviders(<PythonMemorySim params={{}} onInteract={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Kodu düzenle/ }));
    const editor = screen.getByLabelText('Python kodu');
    fireEvent.change(editor, { target: { value: 'x = 1\nwhile x:\n    pass' } });
    fireEvent.click(screen.getByRole('button', { name: /Çalıştır/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      "2. satır: 'while' bu simülatörde desteklenmiyor",
    );
    fireEvent.change(editor, { target: { value: 'liste = [1]\nkopya = liste' } });
    fireEvent.click(screen.getByRole('button', { name: /Çalıştır/ }));
    expect(screen.getByText('Düzenlenmiş kod çalışıyor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sona git' }));
    expect(screen.getByText('kopya')).toBeInTheDocument();
  });
});
