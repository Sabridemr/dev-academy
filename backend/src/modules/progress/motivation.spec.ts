import { STREAK_FREEZE_MAX, XP_RULES } from '@devacademy/shared';
import { refillFreezes, xpAwardsFor } from './motivation';
import { streakWithFreeze } from './progress.service';

const DAY = 86_400_000;

describe('refillFreezes', () => {
  const t0 = new Date('2026-10-01T10:00:00Z');

  it('ilk aktivitede sayacı başlatır, hak eklemez', () => {
    expect(refillFreezes(1, null, t0)).toEqual({ streakFreezes: 1, lastFreezeGrantAt: t0 });
  });

  it('bir haftadan önce yenilemez', () => {
    const now = new Date(t0.getTime() + 6 * DAY);
    expect(refillFreezes(0, t0, now)).toEqual({ streakFreezes: 0, lastFreezeGrantAt: t0 });
  });

  it('her tam hafta bir hak ekler, sayaç tam haftalar kadar ilerler', () => {
    const now = new Date(t0.getTime() + 7 * DAY + 3_600_000);
    const out = refillFreezes(0, t0, now);
    expect(out.streakFreezes).toBe(1);
    expect(out.lastFreezeGrantAt).toEqual(new Date(t0.getTime() + 7 * DAY));
  });

  it(`en fazla ${STREAK_FREEZE_MAX} hak birikir`, () => {
    const now = new Date(t0.getTime() + 30 * DAY);
    expect(refillFreezes(1, t0, now).streakFreezes).toBe(STREAK_FREEZE_MAX);
  });
});

describe('xpAwardsFor', () => {
  it('olayları tekillik anahtarlarıyla üretir', () => {
    const awards = xpAwardsFor(
      {
        lessonCompleted: 'l1',
        quizPassed: 'q1',
        perfectQuiz: true,
        reviewGraded: 'c1',
        examPassed: 'e1',
        dailyGoalMet: true,
        modulesCompleted: ['m1'],
      },
      '2026-10-20',
    );
    expect(awards).toEqual([
      { kind: 'lessonCompleted', refId: 'l1' },
      { kind: 'quizPassed', refId: 'q1' },
      { kind: 'quizPerfectBonus', refId: 'q1' },
      { kind: 'reviewGraded', refId: 'c1:2026-10-20' },
      { kind: 'examPassed', refId: 'e1' },
      { kind: 'dailyGoalMet', refId: '2026-10-20' },
      { kind: 'moduleCompleted', refId: 'm1' },
    ]);
    for (const a of awards) expect(XP_RULES[a.kind]).toBeGreaterThan(0);
  });

  it('geçilmeyen quizde kusursuz bonusu yoktur; boş tetik boş liste', () => {
    expect(xpAwardsFor({ perfectQuiz: true }, '2026-10-20')).toEqual([]);
  });
});

describe('streakWithFreeze', () => {
  const base = { currentStreak: 5, longestStreak: 5, streakFreezes: 1 };
  it('dün aktifse seri geçerli', () => {
    expect(streakWithFreeze({ ...base, lastActivityDate: '2026-10-19' }, '2026-10-20')).toBe(5);
  });
  it('bir gün atlanmış ve dondurma hakkı varsa seri sıfır gösterilmez', () => {
    expect(streakWithFreeze({ ...base, lastActivityDate: '2026-10-18' }, '2026-10-20')).toBe(5);
  });
  it('hak yoksa ya da iki gün atlanmışsa sıfır', () => {
    expect(
      streakWithFreeze({ ...base, streakFreezes: 0, lastActivityDate: '2026-10-18' }, '2026-10-20'),
    ).toBe(0);
    expect(streakWithFreeze({ ...base, lastActivityDate: '2026-10-17' }, '2026-10-20')).toBe(0);
  });
});
