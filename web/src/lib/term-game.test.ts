import { describe, expect, it } from 'vitest';
import type { ConceptSummary } from '@devacademy/shared';
import { applyAnswer, buildRound, INITIAL_SCORE, maxScore, stars } from './match-game';
import { CATCHUP_MS, dueSlot, readSettings, termForSlot, termNotificationPayload } from './term-notifications';
import { shortDefinition } from './term-text';

const mk = (id: string): ConceptSummary => ({
  id,
  term: { tr: `Terim ${id}`, en: `Term ${id}` },
  definition: { tr: `Tanım ${id}. İkinci cümle burada.` },
  aliases: [],
  lessonCount: 1,
});
const ALL = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(mk);
const seq = () => {
  let i = 0;
  return () => (i++ * 0.37) % 1;
};

describe('shortDefinition', () => {
  it('ilk cümleyi alır, uzunu keser', () => {
    expect(shortDefinition('Birinci cümle. İkinci cümle.')).toBe('Birinci cümle.');
    const out = shortDefinition('kelime '.repeat(50), 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('buildRound / puanlama', () => {
  it('ders kavramları dahil, 6 çifte tamamlanır, sağ sütun karışık', () => {
    const r = buildRound(ALL, ['a', 'b'], 'tr', seq())!;
    expect(r.pairs).toHaveLength(6);
    expect(['a', 'b'].every((id) => r.pairs.some((p) => p.id === id))).toBe(true);
    expect(r.definitionOrder.every((v, i) => v === i)).toBe(false);
  });
  it('yeterli kavram yoksa null', () => {
    expect(buildRound([mk('a')], ['a'], 'tr')).toBeNull();
  });
  it('seri bonusu 10,12,14,16,16; yanlış -3 ve seri sıfır; 0 altına inmez', () => {
    let s = INITIAL_SCORE;
    const gains: number[] = [];
    for (let i = 0; i < 5; i++) {
      const n = applyAnswer(s, true);
      gains.push(n.score - s.score);
      s = n;
    }
    expect(gains).toEqual([10, 12, 14, 16, 16]);
    expect(maxScore(5)).toBe(s.score);
    expect(applyAnswer(applyAnswer(INITIAL_SCORE, true), false)).toEqual({ score: 7, streak: 0, mistakes: 1 });
    expect(applyAnswer(INITIAL_SCORE, false).score).toBe(0);
    expect([stars(0, 6), stars(1, 6), stars(3, 6), stars(4, 6)]).toEqual([3, 2, 1, 0]);
  });
});

describe('günün terimi bildirimi', () => {
  const noon = new Date(2026, 10, 8, 12, 0, 0);
  it('dueSlot: son slotu verir, eskiyi/gösterileni atlar', () => {
    expect(dueSlot(noon, [10, 19], 0)?.date.getHours()).toBe(10); // 10:00 geçti, 2 saat önce
    expect(dueSlot(noon, [10, 19], new Date(2026, 10, 8, 10).getTime())).toBeNull(); // zaten gösterildi
    expect(dueSlot(new Date(2026, 10, 8, 18), [10, 19], 0)).toBeNull(); // 10:00 > 4 saat önce, 19:00 gelmedi
    const late = new Date(2026, 10, 8, 19, 0, 0).getTime() + CATCHUP_MS - 1;
    expect(dueSlot(new Date(late), [10, 19], 0)?.slot).toBe(1);
  });
  it('termForSlot deterministik ve liste sırasından bağımsız', () => {
    const d = new Date(2026, 10, 8);
    expect(termForSlot(ALL, d, 0)?.id).toBe(termForSlot([...ALL].reverse(), d, 0)?.id);
    expect(termForSlot(ALL, d, 0)?.id).not.toBe(termForSlot(ALL, d, 1)?.id);
    expect(termForSlot([], d, 0)).toBeNull();
  });
  it('payload başlık/gövde/url', () => {
    const p = termNotificationPayload(mk('a'), 'tr');
    expect(p.title).toContain('Terim a');
    expect(p.body).toBe('Tanım a.');
    expect(p.url).toBe('/glossary/a');
  });
  it('readSettings bozuk veriye dayanıklı', () => {
    expect(readSettings({ getItem: () => '{bozuk' }).enabled).toBe(false);
    expect(readSettings({ getItem: () => JSON.stringify({ enabled: true, hours: [8, 99] }) })).toEqual({
      enabled: true,
      hours: [8, 19],
    });
  });
});
