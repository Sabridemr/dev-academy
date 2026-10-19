import { describe, expect, it } from 'vitest';
import {
  CodeTraceSchema,
  changedTraceObjects,
  changedTraceVars,
  previousTraceLine,
  type TraceStep,
} from './trace';

const step = (line: number, locals: TraceStep['frames'][number]['locals'], heap: TraceStep['heap'] = []): TraceStep => ({
  line,
  event: 'line',
  frames: [{ id: 0, name: 'Global', line, locals }],
  heap,
  stdout: '',
});

describe('kod izi', () => {
  const s1 = step(1, [], []);
  const s2 = step(2, [['a', { t: 'ref', id: 1 }]], [{ id: 1, kind: 'list', type: 'list', items: [] }]);
  const s3 = step(3, [['a', { t: 'ref', id: 1 }], ['b', { t: 'ref', id: 1 }]], [
    { id: 1, kind: 'list', type: 'list', items: [{ t: 'prim', type: 'int', repr: '3' }] },
  ]);

  it('şema heap\'te olmayan referansı reddeder', () => {
    const bad = {
      version: 1,
      language: 'python',
      code: 'a = []\nb = a\nb.append(3)',
      sourceHash: 'a'.repeat(64),
      pythonVersion: '3.12',
      steps: [step(2, [['a', { t: 'ref', id: 9 }]])],
    };
    expect(CodeTraceSchema.safeParse(bad).success).toBe(false);
    expect(CodeTraceSchema.safeParse({ ...bad, steps: [s2, s3] }).success).toBe(true);
  });

  it('yeni ve değişen nesneleri/değişkenleri bulur', () => {
    expect([...changedTraceObjects(s1, s2)]).toEqual([1]);
    expect([...changedTraceObjects(s2, s3)]).toEqual([1]);
    expect([...changedTraceVars(s2, s3)]).toEqual(['0:b']);
    expect(changedTraceObjects(undefined, s2).size).toBe(0);
  });

  it('aynı çerçevede az önce çalışan satırı verir', () => {
    expect(previousTraceLine([s1, s2, s3], 2)).toBe(2);
    expect(previousTraceLine([s1, s2, s3], 0)).toBeNull();
  });
});
