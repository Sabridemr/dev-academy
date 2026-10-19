import type { CodeTrace } from '@devacademy/shared';

/** Üç adımlık küçük bir iz: liste oluşturma, takma ad ve fonksiyon çağrısı */
export const TRACE_FIXTURE: CodeTrace = {
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
      line: 5,
      event: 'line',
      frames: [{ id: 0, name: 'Global', line: 5, locals: [['a', { t: 'ref', id: 1 }]] }],
      heap: [
        {
          id: 1,
          kind: 'list',
          type: 'list',
          items: [
            { t: 'prim', type: 'int', repr: '1' },
            { t: 'prim', type: 'int', repr: '2' },
          ],
        },
      ],
      stdout: '',
      note: { tr: 'Liste oluştu', en: 'List created' },
    },
    {
      line: 1,
      event: 'call',
      frames: [
        { id: 0, name: 'Global', line: 5, locals: [['a', { t: 'ref', id: 1 }]] },
        { id: 1, name: 'ekle', line: 1, locals: [['l', { t: 'ref', id: 1 }]] },
      ],
      heap: [
        {
          id: 1,
          kind: 'list',
          type: 'list',
          items: [
            { t: 'prim', type: 'int', repr: '1' },
            { t: 'prim', type: 'int', repr: '2' },
          ],
        },
      ],
      stdout: '',
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
            { t: 'prim', type: 'int', repr: '2' },
            { t: 'prim', type: 'int', repr: '3' },
          ],
        },
      ],
      stdout: '[1, 2, 3]\n',
    },
  ],
};
