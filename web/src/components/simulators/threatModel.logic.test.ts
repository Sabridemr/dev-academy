import { describe, expect, it } from 'vitest';
import {
  SCENARIOS,
  SCENARIO_IDS,
  STRIDE,
  expectedThreats,
  scoreElement,
  scoreModel,
  threatDetail,
  toggleMark,
  type Marks,
} from './threatModel.logic';

const web = SCENARIOS['web-app'];
const el = (id: string) => web.elements.find((e) => e.id === id)!;

describe('threatModel.logic', () => {
  it('STRIDE-per-element temeli ve öğeye özgü eklemeler', () => {
    expect(expectedThreats(el('browser'))).toEqual(['S', 'R']);
    expect(expectedThreats(el('api'))).toEqual([...STRIDE]);
    expect(expectedThreats(el('db'))).toEqual(['T', 'I', 'D']);
    expect(expectedThreats(el('logs'))).toEqual(['T', 'R', 'I', 'D']);
    expect(expectedThreats(el('f-req'))).toEqual(['S', 'T', 'I', 'D']);
    expect(expectedThreats({ ...el('f-sql'), remove: ['I'] })).toEqual(['T', 'D']);
  });

  it('her beklenen tehdidin gerekçesi ve önlemi var; akışların uçları geçerli', () => {
    for (const id of SCENARIO_IDS) {
      const sc = SCENARIOS[id];
      const ids = new Set(sc.elements.map((e) => e.id));
      expect(ids.size).toBe(sc.elements.length);
      for (const e of sc.elements) {
        if (e.kind === 'flow') {
          expect(ids.has(e.from!)).toBe(true);
          expect(ids.has(e.to!)).toBe(true);
        } else {
          expect(typeof e.x).toBe('number');
        }
        for (const s of expectedThreats(e)) {
          const d = threatDetail(e, s);
          expect(d, `${id}/${e.id}/${s}`).not.toBeNull();
          expect(d!.fix.tr.length).toBeGreaterThan(5);
          expect(d!.fix.en.length).toBeGreaterThan(5);
        }
      }
    }
  });

  it('öğeye özgü metin genel metni ezer', () => {
    expect(threatDetail(el('f-sql'), 'T')?.fix.tr).toMatch(/Parametreli/);
    expect(threatDetail(el('db'), 'T')?.fix.tr).toMatch(/Erişim kontrolü/);
    expect(threatDetail(el('browser'), 'E')).toBeNull();
  });

  it('puanlama: bulunan, kaçırılan ve fazla işaretler', () => {
    let m: Marks = {};
    m = toggleMark(m, 'browser', 'S');
    m = toggleMark(m, 'browser', 'D');
    expect(scoreElement(el('browser'), m)).toEqual({ found: ['S'], missed: ['R'], extra: ['D'] });
    m = toggleMark(m, 'browser', 'D');
    expect(m.browser?.D).toBe(false);

    const empty = scoreModel(web, {});
    const total = web.elements.reduce((n, e) => n + expectedThreats(e).length, 0);
    expect(empty).toMatchObject({ found: 0, total, extra: 0, untouched: web.elements.length });

    const perfect: Marks = {};
    for (const e of web.elements)
      perfect[e.id] = Object.fromEntries(expectedThreats(e).map((s) => [s, true]));
    expect(scoreModel(web, perfect)).toMatchObject({ found: total, total, extra: 0, untouched: 0 });

    const one = scoreModel(web, m);
    expect(one).toMatchObject({ found: 1, extra: 0, untouched: web.elements.length - 1 });
  });
});
