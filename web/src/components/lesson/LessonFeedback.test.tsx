import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { LessonFeedback } from './LessonFeedback';

const mutateAsync = vi.fn(async () => undefined);
let summary: unknown = {
  lessonId: 'l1',
  up: 3,
  down: 0,
  difficulty: { easy: 0, ok: 0, hard: 0 },
  mine: null,
};

vi.mock('@/lib/hooks', () => ({
  useLessonFeedback: () => ({ data: summary, isLoading: false }),
  useSubmitLessonFeedback: () => ({ mutateAsync, isPending: false, isError: false }),
}));

describe('LessonFeedback', () => {
  it('oy + zorluk + yorumu gönderir', async () => {
    renderWithProviders(<LessonFeedback lessonId="l1" />);
    fireEvent.click(screen.getByRole('button', { name: /Faydalıydı/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Zor' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' Güzel ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gönder' }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ rating: 1, difficulty: 'hard', comment: 'Güzel' }),
    );
  });

  it('önceki geri bildirim varsa teşekkür durumunda açılır', () => {
    summary = {
      lessonId: 'l1',
      up: 1,
      down: 0,
      difficulty: { easy: 0, ok: 1, hard: 0 },
      mine: { rating: 1, difficulty: 'ok' },
    };
    renderWithProviders(<LessonFeedback lessonId="l1" />);
    expect(screen.getByText('Geri bildirimin için teşekkürler!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Düzenle/ })).toBeInTheDocument();
  });
});
