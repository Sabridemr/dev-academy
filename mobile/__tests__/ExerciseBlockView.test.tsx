import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import type { LessonBlock } from '@devacademy/shared';
import { ExerciseBlockView } from '@/components/lesson/ExerciseBlockView';

/** Mobilde Pyodide yok: görev ve başlangıç kodu gösterilir, çözmek için web'e yönlendirilir */
const block: Extract<LessonBlock, { type: 'exercise' }> = {
  id: 'exercise-1',
  order: 3,
  type: 'exercise',
  src: 'toplam.exercise.json',
  exercise: {
    id: 'k-06-toplam',
    title: { tr: 'Toplam fonksiyonu', en: 'Sum function' },
    language: 'python',
    prompt: { tr: 'Listeyi topla.', en: 'Sum the list.' },
    starter: 'def toplam(xs):\n    ...\n',
    tests: 'assert toplam([1]) == 1\n',
    hints: [{ tr: 'sum()', en: 'sum()' }],
    timeoutMs: 5000,
  },
};

describe('ExerciseBlockView', () => {
  it('görevi, başlangıç kodunu ve web bağlantısını gösterir', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    render(<ExerciseBlockView block={block} lessonId="k-06-fonksiyonlar" />);
    expect(screen.getByText('Toplam fonksiyonu')).toBeTruthy();
    expect(screen.getByText('Listeyi topla.')).toBeTruthy();
    expect(screen.getByText('Başlangıç kodu')).toBeTruthy();
    expect(screen.getByLabelText('def toplam(xs):\n    ...')).toBeTruthy();
    fireEvent.press(screen.getByText('Web’de çöz'));
    expect(open).toHaveBeenCalledWith(
      expect.stringMatching(/\/lessons\/k-06-fonksiyonlar#block-exercise-1$/),
    );
  });

  it('alıştırma içeriği yoksa hiçbir şey çizmez', () => {
    const { toJSON } = render(
      <ExerciseBlockView block={{ ...block, exercise: undefined }} lessonId="x" />,
    );
    expect(toJSON()).toBeNull();
  });
});
