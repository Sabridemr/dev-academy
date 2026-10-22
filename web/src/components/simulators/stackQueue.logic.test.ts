import { describe, expect, it } from 'vitest';
import { BFS_NODES, bfsSteps, bracketSteps, maxQueue } from './stackQueue.logic';

const last = <T>(a: T[]) => a[a.length - 1];

describe('stackQueue.logic — parantez eşleme', () => {
  it('dengeli ifade: her açılış itilir, her kapanış çekilir, sonda ok', () => {
    const steps = bracketSteps('{ a[i] * (b + c) }');
    expect(steps.map((s) => s.type)).toEqual(['push', 'push', 'pop', 'push', 'pop', 'pop', 'ok']);
    expect(steps[1].stack.map((e) => e.char)).toEqual(['{', '[']);
    expect(last(steps).stack).toEqual([]);
  });

  it('uyuşmayan çift: hata konumu ve beklenen kapanış', () => {
    const steps = bracketSteps('(a]');
    expect(last(steps)).toMatchObject({
      type: 'error',
      error: 'mismatch',
      index: 2,
      expected: ')',
    });
  });

  it('beklenmeyen kapanış: yığın boşken', () => {
    expect(last(bracketSteps('a)'))).toMatchObject({ error: 'unexpected-close', index: 1 });
  });

  it('kapanmamış açılış: tepedeki açılışın konumu raporlanır', () => {
    expect(last(bracketSteps('([]'))).toMatchObject({
      type: 'error',
      error: 'unclosed',
      index: 0,
      expected: ')',
    });
  });

  it('parantez olmayan ifade doğrudan ok', () => {
    expect(bracketSteps('abc')).toEqual([{ type: 'ok', stack: [] }]);
  });
});

describe('stackQueue.logic — BFS kuyruğu', () => {
  it('A’dan BFS katman sırasıyla ziyaret eder ve her düğümü bir kez kuyruğa koyar', () => {
    const steps = bfsSteps(0);
    const done = last(steps);
    expect(done.type).toBe('done');
    expect(done.order.map((i) => BFS_NODES[i]).join('')).toBe('ABCDEFG');
    expect(done.queue).toEqual([]);
    expect(steps.filter((s) => s.type === 'enqueue')).toHaveLength(BFS_NODES.length);
    expect(done.level).toEqual([0, 1, 1, 2, 2, 2, 3]);
  });

  it('kuyruk FIFO: çıkan düğüm her zaman önceki adımdaki kuyruğun başıdır', () => {
    const steps = bfsSteps(3);
    for (let k = 1; k < steps.length; k++) {
      if (steps[k].type === 'dequeue') expect(steps[k].node).toBe(steps[k - 1].queue[0]);
    }
    expect(maxQueue(steps)).toBeGreaterThanOrEqual(2);
    expect(maxQueue(steps, 1)).toBe(1);
  });
});
