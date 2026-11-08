import type { ConceptSummary } from '@devacademy/shared';
import {
  applyAnswer,
  buildRound,
  INITIAL_SCORE,
  maxScore,
  stars,
} from '@/lib/matchGame';
import { shortDefinition } from '@/lib/termText';
import { planTermNotifications } from '@/notifications/termNotifications';

const mk = (id: string, n = id): ConceptSummary => ({
  id,
  term: { tr: `Terim ${n}`, en: `Term ${n}` },
  definition: { tr: `Tanım ${n}. İkinci cümle burada.` },
  aliases: [],
  lessonCount: 1,
});
const ALL = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x) => mk(x));
const seq = (): (() => number) => {
  let i = 0;
  return () => ((i++ * 0.37) % 1);
};

describe('shortDefinition', () => {
  it('ilk cümleyi alır', () => {
    expect(shortDefinition('Birinci cümle. İkinci cümle.')).toBe('Birinci cümle.');
  });
  it('uzun metni kelime sınırında keser', () => {
    const out = shortDefinition('kelime '.repeat(50), 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('buildRound', () => {
  it('dersin kavramlarını kullanır ve sağ sütunu karıştırır', () => {
    const r = buildRound(ALL, ['a', 'b', 'c', 'd'], 'tr', seq())!;
    // Ders 4 kavramlı: tur 6'ya sözlükten tamamlanır, ders kavramlarının hepsi dahildir
    expect(r.pairs).toHaveLength(6);
    expect(['a', 'b', 'c', 'd'].every((id) => r.pairs.some((p) => p.id === id))).toBe(true);
    expect([...r.definitionOrder].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(r.definitionOrder.every((v, i) => v === i)).toBe(false);
  });
  it('az kavram varsa sözlükten tamamlar', () => {
    const r = buildRound(ALL, ['a'], 'tr', seq())!;
    expect(r.pairs.length).toBeGreaterThanOrEqual(3);
    expect(r.pairs.some((p) => p.id === 'a')).toBe(true);
  });
  it('en fazla ROUND_SIZE çift', () => {
    expect(buildRound(ALL, ALL.map((c) => c.id), 'tr', seq())!.pairs).toHaveLength(6);
  });
  it('yeterli kavram yoksa null', () => {
    expect(buildRound([mk('a')], ['a'], 'tr')).toBeNull();
  });
});

describe('puanlama', () => {
  it('doğru cevaplar seri bonusu verir (10, 12, 14, 16, 16)', () => {
    let s = INITIAL_SCORE;
    const gains: number[] = [];
    for (let i = 0; i < 5; i++) {
      const next = applyAnswer(s, true);
      gains.push(next.score - s.score);
      s = next;
    }
    expect(gains).toEqual([10, 12, 14, 16, 16]);
    expect(maxScore(5)).toBe(s.score);
  });
  it('yanlış cevap seriyi sıfırlar, puan 0 altına inmez', () => {
    let s = applyAnswer(INITIAL_SCORE, true);
    s = applyAnswer(s, false);
    expect(s).toEqual({ score: 7, streak: 0, mistakes: 1 });
    expect(applyAnswer(INITIAL_SCORE, false).score).toBe(0);
  });
  it('yıldızlar', () => {
    expect(stars(0, 6)).toBe(3);
    expect(stars(1, 6)).toBe(2);
    expect(stars(3, 6)).toBe(1);
    expect(stars(4, 6)).toBe(0);
  });
});

describe('planTermNotifications', () => {
  const now = new Date(2026, 10, 8, 12, 0, 0); // 8 Kasım 12:00 yerel
  it('günde 2 slot, geçmişi atlar (bugün yalnız 19:00)', () => {
    const plan = planTermNotifications(ALL, [10, 19], now, 7);
    expect(plan).toHaveLength(1 + 6 * 2);
    expect(plan[0]!.date.getHours()).toBe(19);
    expect(plan.every((p) => p.date.getTime() > now.getTime())).toBe(true);
  });
  it('deterministik ve art arda aynı terim yok', () => {
    const a = planTermNotifications(ALL, [10, 19], now, 7);
    const b = planTermNotifications([...ALL].reverse(), [10, 19], now, 7);
    expect(a.map((p) => p.concept.id)).toEqual(b.map((p) => p.concept.id));
    for (let i = 1; i < a.length; i++) expect(a[i]!.concept.id).not.toBe(a[i - 1]!.concept.id);
  });
  it('boş sözlükte plan yok', () => {
    expect(planTermNotifications([], [10, 19], now)).toEqual([]);
  });
});
