import { describe, expect, it } from 'vitest';
import type { CodeTrace, TraceStep } from '@devacademy/shared';
import { buildQuestions, renderTraceValue, score, shiftNumber } from './predictRun.logic';

const int = (n: number) => ({ t: 'prim' as const, type: 'int', repr: String(n) });

/** toplam = 0; for i in range(1, 4): toplam += i; print("Toplam:", toplam) */
function loopTrace(): CodeTrace {
  const code = 'toplam = 0\nfor i in range(1, 4):\n    toplam += i\nprint("Toplam:", toplam)';
  const steps: TraceStep[] = [];
  const push = (
    line: number,
    locals: [string, ReturnType<typeof int>][],
    stdout = '',
    event: TraceStep['event'] = 'line',
  ) =>
    steps.push({
      line,
      event,
      frames: [{ id: 0, name: 'Global', line, locals }],
      heap: [],
      stdout,
    });
  push(1, []);
  push(2, [['toplam', int(0)]]);
  let total = 0;
  for (let i = 1; i <= 3; i++) {
    push(3, [
      ['toplam', int(total)],
      ['i', int(i)],
    ]);
    total += i;
    push(2, [
      ['toplam', int(total)],
      ['i', int(i)],
    ]);
  }
  push(4, [
    ['toplam', int(total)],
    ['i', int(3)],
  ]);
  push(
    4,
    [
      ['toplam', int(total)],
      ['i', int(3)],
    ],
    'Toplam: 6\n',
    'end',
  );
  return {
    version: 1,
    language: 'python',
    code,
    sourceHash: 'a'.repeat(64),
    pythonVersion: '3.12',
    steps,
  };
}

describe('predictRun soru üretimi', () => {
  it('son çıktı sorusu ve global değişken soruları üretir; doğru cevap seçenekler arasında tektir', () => {
    const qs = buildQuestions(loopTrace());
    expect(qs[0]).toMatchObject({ kind: 'output' });
    expect(qs[0].choices[qs[0].answer]).toBe('Toplam: 6');
    expect(new Set(qs[0].choices).size).toBe(qs[0].choices.length);
    const vars = qs.filter((q) => q.kind === 'variable');
    expect(vars.length).toBeGreaterThan(0);
    for (const q of vars) {
      expect(q.choices.length).toBeGreaterThanOrEqual(3);
      expect(new Set(q.choices).size).toBe(q.choices.length);
    }
  });

  it('değişken sorusunun cevabı iz adımındaki değerle aynıdır ve k. çalışma doğru sayılır', () => {
    const trace = loopTrace();
    for (const q of buildQuestions(trace)) {
      if (q.kind !== 'variable') continue;
      const step = trace.steps[q.step];
      const v = step.frames[0].locals.find(([n]) => n === q.name)![1];
      expect(q.choices[q.answer]).toBe(renderTraceValue(v, step));
      if (q.line === 3) {
        // 3. satır her turda bir kez çalışır: toplam 1, 3, 6
        expect(q.totalRuns).toBe(3);
        expect(q.choices[q.answer]).toBe(String([1, 3, 6][q.occurrence - 1]));
      }
    }
  });

  it('aynı iz her zaman aynı soruları verir (deterministik)', () => {
    expect(buildQuestions(loopTrace())).toEqual(buildQuestions(loopTrace()));
  });

  it('heap nesnelerini Python gösterimine çevirir', () => {
    const step: TraceStep = {
      line: 1,
      event: 'line',
      frames: [{ id: 0, name: 'Global', line: 1, locals: [] }],
      heap: [
        { id: 1, kind: 'list', type: 'list', items: [int(1), { t: 'ref', id: 2 }] },
        { id: 2, kind: 'tuple', type: 'tuple', items: [{ t: 'prim', type: 'str', repr: "'a'" }] },
        {
          id: 3,
          kind: 'dict',
          type: 'dict',
          entries: [[{ t: 'prim', type: 'str', repr: "'k'" }, int(5)]],
        },
      ],
      stdout: '',
    };
    expect(renderTraceValue({ t: 'ref', id: 1 }, step)).toBe("[1, ('a',)]");
    expect(renderTraceValue({ t: 'ref', id: 3 }, step)).toBe("{'k': 5}");
  });

  it('sayı kaydırma ve puanlama yardımcıları', () => {
    expect(shiftNumber('fib(4) = 3 | çağrı: 9', 1)).toBe('fib(4) = 3 | çağrı: 10');
    expect(shiftNumber('a 2 b 7', -1, 1)).toBe('a 1 b 7');
    expect(shiftNumber('yok', 1)).toBeNull();
    const qs = buildQuestions(loopTrace());
    expect(
      score(
        qs,
        qs.map((q) => q.answer),
      ),
    ).toEqual({ correct: qs.length, wrong: 0 });
    expect(
      score(
        qs,
        qs.map(() => null),
      ),
    ).toEqual({ correct: 0, wrong: qs.length });
  });
});
