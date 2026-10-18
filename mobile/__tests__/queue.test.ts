import { ApiError } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import {
  clearQueues,
  enqueueAttempt,
  enqueueProgress,
  flushAttemptQueue,
  pendingProgressCount,
  readAttemptQueue,
  storeAttemptResult,
  takeAttemptResult,
} from '@/offline/queue';

/** Çevrimdışı kuyruklar: çıkışta temizlik ve geçici hatalarda denemenin korunması */

jest.mock('@/lib/endpoints', () => ({ endpoints: { submitAttempt: jest.fn(), updateProgress: jest.fn() } }));

const dto = { answers: [{ questionId: 'q1', selected: ['a'] }] };
const result = { attemptId: 'at1', score: 100, passed: true, correctCount: 1, totalCount: 1, results: [], reviewCardsCreated: 0 } as never;

beforeEach(() => {
  clearQueues();
  jest.mocked(endpoints.submitAttempt).mockReset();
});

describe('clearQueues', () => {
  it('ilerleme, deneme kuyruklarını ve saklı sonuçları siler', () => {
    enqueueProgress('l1', { percent: 50, secondsSpent: 10 });
    enqueueAttempt('quiz-1', 'l1', dto);
    storeAttemptResult('quiz-1', result);
    expect(pendingProgressCount()).toBe(2);

    clearQueues();

    expect(pendingProgressCount()).toBe(0);
    expect(takeAttemptResult('quiz-1')).toBeUndefined();
  });
});

describe('flushAttemptQueue', () => {
  it('hız sınırına takılan deneme kuyrukta kalır', async () => {
    enqueueAttempt('quiz-1', 'l1', dto);
    jest.mocked(endpoints.submitAttempt).mockRejectedValue(new ApiError('rate_limited', 429, 'Çok fazla istek'));
    const out = await flushAttemptQueue();
    expect(out).toEqual([]);
    expect(readAttemptQueue()).toHaveLength(1);
  });

  it('kalıcı doğrulama hatasında deneme düşürülür', async () => {
    enqueueAttempt('quiz-1', 'l1', dto);
    jest.mocked(endpoints.submitAttempt).mockRejectedValue(new ApiError('validation', 400, 'Geçersiz'));
    await flushAttemptQueue();
    expect(readAttemptQueue()).toHaveLength(0);
  });
});
