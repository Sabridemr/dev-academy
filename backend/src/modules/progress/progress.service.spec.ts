import { XP_RULES } from '@devacademy/shared';
import { ProgressService } from './progress.service';

/** recordActivityDetailed için Prisma'nın kullanılan kısımlarının bellek içi taklidi */
function createService(opts: { dailyGoalMinutes?: number | null; moduleDone?: boolean } = {}) {
  const user = {
    id: 'u1',
    timezone: 'UTC',
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: null as string | null,
    streakFreezes: 1,
    lastFreezeGrantAt: null as Date | null,
    xp: 0,
    dailyGoalMinutes: opts.dailyGoalMinutes ?? null,
  };
  const xpEvents = new Set<string>();
  const daily = { seconds: 0, xp: 0, lessonsCompleted: 0, quizzesPassed: 0 };
  const prisma = {
    user: {
      findUniqueOrThrow: jest.fn(async () => ({ ...user })),
      update: jest.fn(async ({ data }) => {
        if (data.xp?.increment) user.xp += data.xp.increment;
        else Object.assign(user, data);
        return { ...user };
      }),
    },
    dailyActivity: {
      upsert: jest.fn(async ({ update }) => {
        daily.seconds += update.seconds?.increment ?? 0;
        daily.xp += update.xp?.increment ?? 0;
        daily.lessonsCompleted += update.lessonsCompleted?.increment ?? 0;
        return { ...daily };
      }),
    },
    xpEvent: {
      createMany: jest.fn(async ({ data: [d] }) => {
        const key = `${d.kind}:${d.refId}`;
        if (xpEvents.has(key)) return { count: 0 };
        xpEvents.add(key);
        return { count: 1 };
      }),
    },
    lesson: {
      findUnique: jest.fn(async () => ({ moduleId: 'm1' })),
      count: jest.fn(async () => 2),
      groupBy: jest.fn(async () => []),
    },
    progress: {
      count: jest.fn(async () => (opts.moduleDone ? 2 : 1)),
      findMany: jest.fn(async () => []),
    },
    learningPathItem: { findMany: jest.fn(async () => []) },
    attempt: { count: jest.fn(async () => 0) },
    interactiveSession: { count: jest.fn(async () => 0) },
    note: { count: jest.fn(async () => 0) },
    userBadge: { findMany: jest.fn(async () => []) },
    badge: { findMany: jest.fn(async () => []) },
  };
  // Transaction istemcisi aynı taklit nesnedir
  Object.assign(prisma, {
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  });
  const realtime = { emitToUser: jest.fn() };
  const certificates = {
    issue: jest.fn(async (_u: string, type: string, id: string) => ({
      id: 'c1',
      targetType: type,
      targetId: id,
    })),
  };
  const service = new ProgressService(prisma as never, realtime as never, certificates as never);
  return { service, prisma, realtime, certificates, user, daily };
}

const events = (realtime: { emitToUser: jest.Mock }, type: string) =>
  realtime.emitToUser.mock.calls.map(([, e]) => e).filter((e) => e.type === type);

describe('ProgressService.recordActivityDetailed', () => {
  it('ders ilk tamamlamada XP verir; aynı ders için ikinci kez vermez', async () => {
    const { service, realtime, user, daily } = createService();
    const first = await service.recordActivityDetailed('u1', { lessonCompleted: 'l1' });
    expect(first.xpDelta).toBe(XP_RULES.lessonCompleted);
    expect(user.xp).toBe(XP_RULES.lessonCompleted);
    expect(daily.xp).toBe(XP_RULES.lessonCompleted);
    expect(daily.lessonsCompleted).toBe(1);
    expect(events(realtime, 'xp.updated')[0].payload).toEqual({
      xp: XP_RULES.lessonCompleted,
      level: 1,
      delta: XP_RULES.lessonCompleted,
    });
    const again = await service.recordActivityDetailed('u1', { lessonCompleted: 'l1' });
    expect(again.xpDelta).toBe(0);
    expect(events(realtime, 'xp.updated')).toHaveLength(1);
  });

  it('modül bitince moduleCompleted XP ve sertifika üretir', async () => {
    const { service, realtime, certificates } = createService({ moduleDone: true });
    const out = await service.recordActivityDetailed('u1', { lessonCompleted: 'l2' });
    expect(out.xpDelta).toBe(XP_RULES.lessonCompleted + XP_RULES.moduleCompleted);
    expect(certificates.issue).toHaveBeenCalledWith('u1', 'module', 'm1');
    expect(out.certificates).toHaveLength(1);
    expect(events(realtime, 'certificate.issued')).toHaveLength(1);
  });

  it('günlük hedef tutturulunca günde bir kez XP verir', async () => {
    const { service } = createService({ dailyGoalMinutes: 5 });
    expect((await service.recordActivityDetailed('u1', { secondsSpent: 200 })).xpDelta).toBe(0);
    expect((await service.recordActivityDetailed('u1', { secondsSpent: 200 })).xpDelta).toBe(
      XP_RULES.dailyGoalMet,
    );
    expect((await service.recordActivityDetailed('u1', { secondsSpent: 200 })).xpDelta).toBe(0);
  });

  it('quiz ilk geçişte geçme + kusursuz bonusu verir', async () => {
    const { service } = createService();
    const out = await service.recordActivityDetailed('u1', {
      quizCompleted: true,
      quizPassed: 'q1',
      perfectQuiz: true,
    });
    expect(out.xpDelta).toBe(XP_RULES.quizPassed + XP_RULES.quizPerfectBonus);
  });

  it('ilk aktivitede seri başlar ve dondurma sayacı kurulur', async () => {
    const { service, user, realtime } = createService();
    await service.recordActivityDetailed('u1', {});
    expect(user.currentStreak).toBe(1);
    expect(user.lastFreezeGrantAt).toBeInstanceOf(Date);
    expect(user.streakFreezes).toBe(1);
    expect(events(realtime, 'streak.updated')).toHaveLength(1);
  });
});
