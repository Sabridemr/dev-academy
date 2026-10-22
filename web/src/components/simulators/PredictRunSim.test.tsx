import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { CodeTrace, TraceStep } from '@devacademy/shared';
import { renderWithProviders } from '@/test/utils';
import PredictRunSim from './PredictRunSim';
import { buildQuestions } from './predictRun.logic';

vi.mock('../lesson/CodeBlock', () => ({ getHighlighter: () => new Promise(() => undefined) }));

const int = (n: number) => ({ t: 'prim' as const, type: 'int', repr: String(n) });

function trace(): CodeTrace {
  const code = 'x = 1\ny = x + 1\nprint(x, y)';
  const step = (
    line: number,
    locals: [string, ReturnType<typeof int>][],
    stdout = '',
    event: TraceStep['event'] = 'line',
  ): TraceStep => ({
    line,
    event,
    frames: [{ id: 0, name: 'Global', line, locals }],
    heap: [],
    stdout,
  });
  return {
    version: 1,
    language: 'python',
    code,
    sourceHash: 'b'.repeat(64),
    pythonVersion: '3.12',
    steps: [
      step(1, []),
      step(2, [['x', int(1)]]),
      step(3, [
        ['x', int(1)],
        ['y', int(2)],
      ]),
      step(
        3,
        [
          ['x', int(1)],
          ['y', int(2)],
        ],
        '1 2\n',
        'end',
      ),
    ],
  };
}

describe('PredictRunSim', () => {
  it('cevaplar seçilmeden çalıştırılamaz; cevaplayınca doğru/yanlış sayısını ve izi gösterir', () => {
    const onInteract = vi.fn();
    const t = trace();
    const qs = buildQuestions(t);
    renderWithProviders(
      <PredictRunSim params={{ src: 'x.trace.json' }} trace={t} onInteract={onInteract} />,
    );
    const run = screen.getByRole('button', { name: /Çalıştır ve karşılaştır/ });
    expect(run).toBeDisabled();
    expect(screen.getByText(/Program bittiğinde çıktı ne olur\?/)).toBeInTheDocument();

    // İlk soruyu doğru, diğerlerini yanlış cevapla
    const groups = screen.getAllByRole('group');
    expect(groups).toHaveLength(qs.length);
    qs.forEach((q, qi) => {
      const radios = groups[qi].querySelectorAll('input[type="radio"]');
      const pick = qi === 0 ? q.answer : (q.answer + 1) % q.choices.length;
      fireEvent.click(radios[pick]);
    });
    expect(onInteract).toHaveBeenCalled();
    fireEvent.click(run);
    expect(screen.getByText(`${qs.length} sorudan 1 doğru.`)).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: 'Kod simülasyonu' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Yeniden dene/ }));
    expect(screen.getByRole('button', { name: /Çalıştır ve karşılaştır/ })).toBeDisabled();
  });

  it('iz yoksa anlaşılır mesaj gösterir', () => {
    renderWithProviders(
      <PredictRunSim params={{ src: 'yok.trace.json' }} onInteract={() => undefined} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('yok.trace.json');
  });
});
