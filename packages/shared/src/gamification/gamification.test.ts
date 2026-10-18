import { describe, expect, it } from 'vitest';
import { applyActivity, effectiveStreak, sm2Review, SM2_INITIAL, evaluateBadges, gradeAnswer, daysBetween } from './index';

describe('Streak', () => {
  it('ardışık günlerde artar, boşlukta sıfırlanır', () => {
    let s = applyActivity({ currentStreak: 0, longestStreak: 0, lastActivityDate: null }, '2026-01-01');
    expect(s.currentStreak).toBe(1);
    s = applyActivity(s, '2026-01-02');
    s = applyActivity(s, '2026-01-02'); // aynı gün
    expect(s.currentStreak).toBe(2);
    s = applyActivity(s, '2026-01-05');
    expect(s.currentStreak).toBe(1);
    expect(s.longestStreak).toBe(2);
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1);
  });
  it('dünden eski aktivitede efektif seri 0', () => {
    expect(effectiveStreak({ currentStreak: 5, longestStreak: 5, lastActivityDate: '2026-01-01' }, '2026-01-02')).toBe(5);
    expect(effectiveStreak({ currentStreak: 5, longestStreak: 5, lastActivityDate: '2026-01-01' }, '2026-01-03')).toBe(0);
  });
});

describe('SM-2', () => {
  it('doğru cevaplarda aralık büyür, yanlışta sıfırlanır', () => {
    let c = sm2Review(SM2_INITIAL, 4);
    expect(c.intervalDays).toBe(1);
    c = sm2Review(c, 4);
    expect(c.intervalDays).toBe(6);
    c = sm2Review(c, 5);
    expect(c.intervalDays).toBeGreaterThan(6);
    c = sm2Review(c, 1);
    expect(c.intervalDays).toBe(1);
    expect(c.repetitions).toBe(0);
    expect(c.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});

describe('Rozetler ve puanlama', () => {
  it('koşulu sağlanan ve kazanılmamış rozetleri döner', () => {
    const got = evaluateBadges(
      { completedLessons: 1, completedModuleIds: [], currentStreak: 7, perfectQuizzes: 0, totalQuizzes: 0, interactiveSessions: 0, notesCount: 0 },
      ['first-steps'],
    );
    expect(got.map((b) => b.slug)).toEqual(['streak-7']);
  });
  it('gradeAnswer tiplere göre karşılaştırır', () => {
    expect(gradeAnswer('multiple', ['b', 'a'], ['a', 'b'])).toBe(true);
    expect(gradeAnswer('order', ['b', 'a'], ['a', 'b'])).toBe(false);
    expect(gradeAnswer('single', ['a'], ['b'])).toBe(false);
  });
});
