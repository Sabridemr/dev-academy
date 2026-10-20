import { describe, expect, it } from 'vitest';
import type { ExamDto } from '@devacademy/shared';
import {
  buildSubmission,
  examDeadline,
  formatClock,
  isAnswered,
  ratioTone,
  remainingSeconds,
} from './exam.logic';

const exam = {
  id: 'e1',
  startedAt: '2026-10-20T10:00:00.000Z',
  durationSec: 900,
  passScore: 70,
  questions: [
    {
      id: 'q1',
      lessonId: 'l',
      moduleId: 'm',
      type: 'single',
      prompt: 'a',
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
      concepts: [],
    },
    {
      id: 'q2',
      lessonId: 'l',
      moduleId: 'm',
      type: 'order',
      prompt: 'b',
      options: [
        { id: 'x', text: 'X' },
        { id: 'y', text: 'Y' },
      ],
      concepts: [],
    },
  ],
} as ExamDto;

describe('exam.logic', () => {
  it('bitiş anını ve kalan süreyi hesaplar', () => {
    const deadline = examDeadline(exam, 0);
    expect(deadline).toBe(Date.parse('2026-10-20T10:15:00.000Z'));
    expect(remainingSeconds(deadline, Date.parse('2026-10-20T10:14:00.000Z'))).toBe(60);
    expect(remainingSeconds(deadline, Date.parse('2026-10-20T11:00:00.000Z'))).toBe(0);
    expect(examDeadline({ ...exam, durationSec: 0 }, 0)).toBeNull();
    expect(remainingSeconds(null, 0)).toBeNull();
  });

  it('saati biçimlendirir', () => {
    expect(formatClock(75)).toBe('01:15');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-3)).toBe('00:00');
  });

  it('gönderimde cevapsızları boş, dokunulmamış sıralamayı varsayılan sırayla yollar', () => {
    expect(buildSubmission(exam, {})).toEqual({
      answers: [
        { questionId: 'q1', selected: [] },
        { questionId: 'q2', selected: ['x', 'y'] },
      ],
    });
    expect(isAnswered({ q1: ['a'] }, 'q1')).toBe(true);
    expect(isAnswered({}, 'q2')).toBe(false);
  });

  it('oran tonları', () => {
    expect(ratioTone(8, 10)).toBe('success');
    expect(ratioTone(5, 10)).toBe('warning');
    expect(ratioTone(1, 10)).toBe('danger');
    expect(ratioTone(0, 0)).toBe('danger');
  });
});
