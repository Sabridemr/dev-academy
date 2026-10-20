import type { Question } from '@prisma/client';
import { EXAM_GRACE_MS, gradeExam, isTimedOut, pickQuestions } from './exam-logic';

const pool = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, moduleId: 'A' })),
  ...Array.from({ length: 3 }, (_, i) => ({ id: `b${i}`, moduleId: 'B' })),
];

describe('pickQuestions', () => {
  it('aynı tohum aynı seçimi, farklı tohum farklı seçimi verir', () => {
    expect(pickQuestions(pool, 6, 's1')).toEqual(pickQuestions(pool, 6, 's1'));
    expect(pickQuestions(pool, 6, 's1')).not.toEqual(pickQuestions(pool, 6, 's2'));
  });

  it('modüller arasında dengeli seçer, tekrar etmez, havuzdan fazlasını istemez', () => {
    const six = pickQuestions(pool, 6, 'x');
    expect(six.filter((id) => id.startsWith('b'))).toHaveLength(3);
    expect(new Set(six).size).toBe(6);
    expect(pickQuestions(pool, 40, 'x')).toHaveLength(pool.length);
  });
});

describe('isTimedOut', () => {
  const start = new Date('2026-10-20T10:00:00Z');
  it('süresiz sınav zaman aşımına uğramaz', () => {
    expect(isTimedOut(start, 0, new Date('2027-01-01'))).toBe(false);
  });
  it('tolerans sonrası aşım sayılır', () => {
    expect(isTimedOut(start, 60, new Date(start.getTime() + 60_000 + EXAM_GRACE_MS - 1))).toBe(
      false,
    );
    expect(isTimedOut(start, 60, new Date(start.getTime() + 60_000 + EXAM_GRACE_MS + 1))).toBe(
      true,
    );
  });
});

describe('gradeExam', () => {
  const q = (key: string, correct: string[], concepts: string[], type = 'single') =>
    ({
      id: `id-${key}`,
      quizId: 'quiz1',
      key,
      type,
      correct,
      concepts,
      explanation: { tr: 'açıklama' },
    }) as unknown as Question;
  const rows = [
    { question: q('q1', ['a'], ['cache']), lessonId: 'l1', moduleId: 'A' },
    { question: q('q2', ['b'], ['cache', 'cdn']), lessonId: 'l1', moduleId: 'A' },
    { question: q('q3', ['x', 'y'], [], 'order'), lessonId: 'l2', moduleId: 'B' },
  ];

  it('puan, kavram ve modül kırılımı', () => {
    const out = gradeExam(
      rows,
      new Map([
        ['quiz1:q1', ['a']],
        ['quiz1:q2', ['a']],
        ['quiz1:q3', ['x', 'y']],
      ]),
    );
    expect(out.correctCount).toBe(2);
    expect(out.totalCount).toBe(3);
    expect(out.score).toBe(67);
    expect(out.passed).toBe(false);
    expect(out.results.map((r) => r.questionId)).toEqual(['quiz1:q1', 'quiz1:q2', 'quiz1:q3']);
    expect(out.results[1]).toMatchObject({ correct: false, correctAnswer: ['b'] });
    expect(out.perConcept).toEqual([
      { concept: 'cache', correct: 1, total: 2 },
      { concept: 'cdn', correct: 0, total: 1 },
    ]);
    expect(out.perModule).toEqual([
      { moduleId: 'A', correct: 1, total: 2 },
      { moduleId: 'B', correct: 1, total: 1 },
    ]);
  });

  it('cevapsız soru yanlış sayılır; hepsi doğruysa geçer', () => {
    expect(gradeExam(rows, new Map()).correctCount).toBe(0);
    const all = gradeExam(
      rows,
      new Map([
        ['quiz1:q1', ['a']],
        ['quiz1:q2', ['b']],
        ['quiz1:q3', ['x', 'y']],
      ]),
    );
    expect(all).toMatchObject({ score: 100, passed: true });
  });
});
