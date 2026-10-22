import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { ContentExportDialog } from './ContentExportDialog';

const api = vi.fn();
vi.mock('@/lib/api', () => ({ api: (...args: unknown[]) => api(...args) }));

describe('ContentExportDialog', () => {
  it('dışa aktarımı ister, dosyaları gösterir ve panoya kopyalar', async () => {
    api.mockResolvedValueOnce({
      lessonId: 'a-05',
      version: 3,
      status: 'published',
      files: [
        { path: 'modules/a/a-05/lesson.md', content: '---\nid: a-05\n---\n', encoding: 'utf8' },
        { path: 'modules/a/a-05/gorsel.png', content: 'iVBORw0KGgo=', encoding: 'base64' },
      ],
      warnings: ['blok 2: uyarı'],
    });
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderWithProviders(<ContentExportDialog lessonId="a-05" />);
    fireEvent.click(screen.getByRole('button', { name: /content\/ formatında dışa aktar/ }));

    await screen.findByRole('dialog');
    expect(api).toHaveBeenCalledWith('/admin/lessons/a-05/export', { method: 'POST', body: {} });
    expect(screen.getByText('modules/a/a-05/lesson.md')).toBeTruthy();
    expect(screen.getByText('blok 2: uyarı')).toBeTruthy();
    // Raster görsel yalnızca indirilebilir: tek kopyala düğmesi (lesson.md)
    const copyButtons = screen.getAllByRole('button', { name: /Kopyala/ });
    expect(copyButtons).toHaveLength(1);
    fireEvent.click(copyButtons[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('---\nid: a-05\n---\n'));
    expect(await screen.findByText('Kopyalandı')).toBeTruthy();
  });

  it('hata mesajını gösterir', async () => {
    api.mockRejectedValueOnce(new Error('403'));
    renderWithProviders(<ContentExportDialog lessonId="a-05" />);
    fireEvent.click(screen.getByRole('button', { name: /dışa aktar/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('Dışa aktarılamadı');
  });
});
