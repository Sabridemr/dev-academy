import { describe, expect, it } from 'vitest';
import { daysBetween } from './index';
import { applyActivityWithFreeze, levelForXp, xpThresholdForLevel } from './xp';

describe('XP ve seviye', () => {
  it('eşikler artan aralıklarla büyür', () => {
    expect(xpThresholdForLevel(1)).toBe(0);
    expect(xpThresholdForLevel(2)).toBe(100);
    expect(xpThresholdForLevel(3)).toBe(250);
    expect(xpThresholdForLevel(4)).toBe(450);
  });
  it('toplam XP’den seviye ve ilerleme hesaplanır', () => {
    expect(levelForXp(0)).toMatchObject({ level: 1, xpIntoLevel: 0, xpForNextLevel: 100 });
    expect(levelForXp(120)).toMatchObject({ level: 2, xpIntoLevel: 20, xpForNextLevel: 150 });
    expect(levelForXp(250).level).toBe(3);
  });
});

describe('seri dondurma', () => {
  const base = {
    currentStreak: 5,
    longestStreak: 5,
    lastActivityDate: '2026-10-01',
    streakFreezes: 1,
  };
  it('bir gün atlanınca dondurma hakkı seriyi korur', () => {
    const r = applyActivityWithFreeze(base, '2026-10-03', daysBetween);
    expect(r.currentStreak).toBe(6);
    expect(r.streakFreezes).toBe(0);
    expect(r.usedFreeze).toBe(true);
  });
  it('hak yoksa seri sıfırlanır', () => {
    const r = applyActivityWithFreeze({ ...base, streakFreezes: 0 }, '2026-10-03', daysBetween);
    expect(r.currentStreak).toBe(1);
    expect(r.usedFreeze).toBe(false);
  });
  it('ardışık günde normal artar', () => {
    expect(applyActivityWithFreeze(base, '2026-10-02', daysBetween).currentStreak).toBe(6);
  });
});
