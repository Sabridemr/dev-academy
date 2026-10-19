import { act, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AttemptResult, QuizPublic } from '@devacademy/shared';
import { QuizView } from '@/components/quiz/QuizView';
import { clearQueues, enqueueAttempt, storeAttemptResult } from '@/offline/queue';

/** Çevrimdışı kuyruğa alınmış quiz sonucu gelince ders tamamlama akışı (onPassed) tetiklenmeli */

jest.mock('@/components/celebration/Celebration', () => ({ Celebration: () => null }));

const quiz: QuizPublic = {
  id: 'quiz-1',
  lessonId: 'l1',
  title: { tr: 'Quiz' },
  passScore: 70,
  questions: [
    {
      id: 'q1',
      type: 'single',
      prompt: { tr: 'Soru' },
      options: [{ id: 'a', text: { tr: 'A' } }],
      difficulty: 'easy',
      concepts: [],
    },
  ],
};
const passed = {
  attemptId: 'at1',
  quizId: 'quiz-1',
  score: 100,
  passed: true,
  correctCount: 1,
  totalCount: 1,
  results: [],
  newBadges: [],
} as AttemptResult;

afterEach(() => {
  clearQueues();
  jest.useRealTimers();
});

it('kuyruktaki deneme geçerse onPassed çağrılır', () => {
  jest.useFakeTimers();
  enqueueAttempt('quiz-1', 'l1', { answers: [{ questionId: 'q1', selected: ['a'] }] });
  const onPassed = jest.fn();
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <QuizView quiz={quiz} lessonId="l1" onPassed={onPassed} />
    </QueryClientProvider>,
  );
  expect(onPassed).not.toHaveBeenCalled();

  storeAttemptResult('quiz-1', passed);
  act(() => {
    jest.advanceTimersByTime(3100);
  });

  expect(onPassed).toHaveBeenCalledTimes(1);
});

it('kuyruktaki deneme kalıcı hatayla düşürülürse kullanıcıya gösterilir', () => {
  jest.useFakeTimers();
  enqueueAttempt('quiz-1', 'l1', { answers: [{ questionId: 'q1', selected: ['a'] }] });
  const qc = new QueryClient();
  const view = render(
    <QueryClientProvider client={qc}>
      <QuizView quiz={quiz} lessonId="l1" />
    </QueryClientProvider>,
  );
  expect(view.getByTestId('quiz-queued')).toBeTruthy();

  clearQueues(); // flushAttemptQueue kalıcı hatada kaydı siler
  act(() => {
    jest.advanceTimersByTime(3100);
  });

  expect(view.queryByTestId('quiz-queued')).toBeNull();
  expect(view.getByTestId('quiz-dropped')).toBeTruthy();
});
