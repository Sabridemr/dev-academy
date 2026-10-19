import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { CodeTraceSchema } from '@devacademy/shared';
import { renderWithProviders } from '@/test/utils';
import { TRACE_FIXTURE } from '@/test/trace-fixture';
import { TraceViewer } from './TraceViewer';

// Shiki testte yüklenmez: kod düz metin olarak çizilir
vi.mock('./CodeBlock', () => ({ getHighlighter: () => new Promise(() => undefined) }));

describe('TraceViewer', () => {
  it('fikstür şemaya uyar', () => {
    expect(CodeTraceSchema.safeParse(TRACE_FIXTURE).success).toBe(true);
  });

  it('adım adım ilerler: değişken, heap nesnesi, yeni çerçeve ve çıktı', () => {
    renderWithProviders(<TraceViewer trace={TRACE_FIXTURE} title={{ tr: 'Deneme' }} />);
    expect(screen.getByText('Deneme')).toBeInTheDocument();
    expect(screen.getByText('4. satır çalışacak')).toBeInTheDocument();
    expect(screen.getByText('Henüz nesne yok')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Adım ileri' }));
    expect(screen.getByText('Liste oluştu')).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(document.querySelector('[data-obj="1"]')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Adım ileri' }));
    expect(screen.getByText('ekle() çağrıldı: yeni çerçeve açıldı')).toBeInTheDocument();
    expect(screen.getByText('ekle')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sona git' }));
    expect(screen.getByText('Program bitti')).toBeInTheDocument();
    expect(screen.getByText('[1, 2, 3]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adım ileri' })).toBeDisabled();
  });

  it('klavyeyle gezilir', () => {
    renderWithProviders(<TraceViewer trace={TRACE_FIXTURE} />);
    const figure = screen.getByRole('figure');
    fireEvent.keyDown(figure, { key: 'End' });
    expect(screen.getByText('4/4')).toBeInTheDocument();
    fireEvent.keyDown(figure, { key: 'ArrowLeft' });
    expect(screen.getByText('3/4')).toBeInTheDocument();
  });
});
