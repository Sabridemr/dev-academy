import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { PublicExercise } from '@devacademy/shared';
import { renderWithProviders } from '@/test/utils';
import type { RunResult } from '@/lib/pyodide/harness';
import type { PyodideRunner } from '@/lib/pyodide/runner';
import { ExerciseBlock } from './ExerciseBlock';

const EXERCISE: PublicExercise = {
  id: 'test-toplam',
  title: { tr: 'Toplam', en: 'Sum' },
  language: 'python',
  prompt: { tr: '`toplam` fonksiyonunu yaz.', en: 'Write `toplam`.' },
  starter: 'def toplam(xs):\n    ...\n',
  tests: 'assert toplam([1, 2]) == 3\n',
  hints: [{ tr: 'sum() var', en: 'there is sum()' }, { tr: 'ya da döngü' }],
  timeoutMs: 2000,
};

/** Gerçek Pyodide yerine sırayla verilen sonuçları döndüren çalıştırıcı */
function fakeRunner(results: RunResult[]) {
  const run = vi.fn(async () => results.shift() ?? { status: 'ok', stdout: '', stderr: '' });
  const runner = { state: 'idle', subscribe: () => () => undefined, run };
  return { runner: runner as unknown as PyodideRunner, run };
}

const fail: RunResult = {
  status: 'failed',
  stdout: '',
  stderr: '',
  error: 'AssertionError',
  testLine: 1,
  testSource: 'assert toplam([1, 2]) == 3',
};

describe('ExerciseBlock', () => {
  afterEach(() => window.localStorage.clear());

  it('görev ve başlangıç kodunu gösterir; çalıştır testleri göndermez', async () => {
    const { runner, run } = fakeRunner([{ status: 'ok', stdout: 'merhaba', stderr: '' }]);
    renderWithProviders(<ExerciseBlock exercise={EXERCISE} lessonId="k-06" runner={runner} />);
    expect(screen.getByRole('heading', { name: 'Toplam' })).toBeInTheDocument();
    const editor = screen.getByRole('textbox', { name: /Kod düzenleyici/ });
    expect(editor).toHaveValue(EXERCISE.starter);

    fireEvent.click(screen.getByRole('button', { name: /^Çalıştır$/ }));
    expect(await screen.findByText('merhaba')).toBeInTheDocument();
    expect(run).toHaveBeenCalledWith(
      { code: EXERCISE.starter, tests: undefined, mode: 'run' },
      2000,
    );
  });

  it('testler: başarısız satırı, sonra geçti rozetini gösterir; çözüm 3 hatadan sonra açılır', async () => {
    const { runner, run } = fakeRunner([
      fail,
      fail,
      fail,
      { status: 'ok', stdout: '', stderr: '' },
    ]);
    renderWithProviders(<ExerciseBlock exercise={EXERCISE} lessonId="k-06" runner={runner} />);
    const editor = screen.getByRole('textbox', { name: /Kod düzenleyici/ });
    fireEvent.change(editor, { target: { value: 'def toplam(xs):\n    return 0\n' } });

    const solutionBtn = screen.getByRole('button', { name: /Çözümü göster/ });
    expect(solutionBtn).toBeDisabled();
    const testsBtn = screen.getByRole('button', { name: /Testleri çalıştır/ });
    for (let i = 0; i < 3; i++) {
      fireEvent.click(testsBtn);
      await waitFor(() => expect(run).toHaveBeenCalledTimes(i + 1));
      await screen.findByText(`${i + 1} başarısız deneme`);
    }
    expect(screen.getByText('1. test satırı: assert toplam([1, 2]) == 3')).toBeInTheDocument();
    expect(screen.getByTestId('exercise-badge')).toHaveTextContent('Test başarısız');
    expect(run).toHaveBeenLastCalledWith(
      { code: 'def toplam(xs):\n    return 0\n', tests: EXERCISE.tests, mode: 'test' },
      2000,
    );
    // Oturum yokken çözüm yine kapalı (uç nokta giriş ister), ipucu metni bunu söyler
    expect(screen.getByText('Çözümü görmek için giriş yap')).toBeInTheDocument();

    fireEvent.click(testsBtn);
    await waitFor(() =>
      expect(screen.getByTestId('exercise-badge')).toHaveTextContent('Testler geçti'),
    );
  });

  it('ipuçları sırayla açılır, sıfırla iki adımda başlangıca döner, Tab girinti ekler', async () => {
    const { runner } = fakeRunner([]);
    renderWithProviders(<ExerciseBlock exercise={EXERCISE} lessonId="k-06" runner={runner} />);
    const hint = screen.getByRole('button', { name: /İpucu/ });
    fireEvent.click(hint);
    expect(screen.getByText('sum() var')).toBeInTheDocument();
    fireEvent.click(hint);
    expect(screen.getByText('ya da döngü')).toBeInTheDocument();
    expect(hint).toBeDisabled();

    const editor = screen.getByRole('textbox', { name: /Kod düzenleyici/ }) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'x' } });
    editor.setSelectionRange(1, 1);
    fireEvent.keyDown(editor, { key: 'Tab' });
    expect(editor.value).toBe('x    ');
    // Esc'den sonra Tab odağı bırakır (varsayılan davranış engellenmez)
    fireEvent.keyDown(editor, { key: 'Escape' });
    expect(fireEvent.keyDown(editor, { key: 'Tab' })).toBe(true);
    expect(window.localStorage.getItem('da:exercise:test-toplam')).toBe('x    ');

    const reset = screen.getByRole('button', { name: /Sıfırla/ });
    fireEvent.click(reset);
    expect(editor.value).toBe('x    ');
    fireEvent.click(screen.getByRole('button', { name: /başlangıç/ }));
    expect(editor.value).toBe(EXERCISE.starter);
    expect(window.localStorage.getItem('da:exercise:test-toplam')).toBeNull();
  });
});
