import { fireEvent, render, screen } from '@testing-library/react-native';
import type { CodeTrace, LessonBlock } from '@devacademy/shared';
import { TraceView } from '@/components/lesson/TraceView';

/** Kod izi oynatıcısı: adım ilerletme, çerçeve/heap/çıktı gösterimi */
const trace: CodeTrace = {
  version: 1,
  language: 'python',
  code: 'def ekle(l):\n    l.append(3)\n\na = [1, 2]\nekle(a)\nprint(a)',
  sourceHash: 'a'.repeat(64),
  pythonVersion: '3.12',
  steps: [
    {
      line: 4,
      event: 'line',
      frames: [{ id: 0, name: 'Global', line: 4, locals: [] }],
      heap: [],
      stdout: '',
    },
    {
      line: 1,
      event: 'call',
      frames: [
        { id: 0, name: 'Global', line: 5, locals: [['a', { t: 'ref', id: 1 }]] },
        { id: 1, name: 'ekle', line: 1, locals: [['l', { t: 'ref', id: 1 }]] },
      ],
      heap: [{ id: 1, kind: 'list', type: 'list', items: [{ t: 'prim', type: 'int', repr: '1' }] }],
      stdout: '',
      note: { tr: 'Çerçeve açıldı', en: 'Frame pushed' },
    },
    {
      line: 6,
      event: 'end',
      frames: [{ id: 0, name: 'Global', line: 6, locals: [['a', { t: 'ref', id: 1 }]] }],
      heap: [
        {
          id: 1,
          kind: 'list',
          type: 'list',
          items: [
            { t: 'prim', type: 'int', repr: '1' },
            { t: 'prim', type: 'int', repr: '3' },
          ],
        },
      ],
      stdout: '[1, 3]\n',
    },
  ],
};
const block = {
  id: 'trace-1',
  order: 0,
  type: 'trace',
  src: 'x.trace.json',
  trace,
} as LessonBlock & { type: 'trace' };

describe('TraceView', () => {
  it('adımlar arasında ilerler', () => {
    render(<TraceView block={block} />);
    expect(screen.getByText('4. satır çalışacak')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Adım ileri'));
    expect(screen.getByText('ekle() çağrıldı: yeni çerçeve açıldı')).toBeTruthy();
    expect(screen.getByText('Çerçeve açıldı')).toBeTruthy();
    expect(screen.getAllByText('#1').length).toBeGreaterThan(1);
    fireEvent.press(screen.getByLabelText('Sona git'));
    expect(screen.getByText('Program bitti')).toBeTruthy();
  });

  it('iz yoksa hiçbir şey çizmez', () => {
    const { toJSON } = render(<TraceView block={{ ...block, trace: undefined }} />);
    expect(toJSON()).toBeNull();
  });
});
