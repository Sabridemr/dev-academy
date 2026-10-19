import { NotificationsService } from './notifications.service';

/** Saatlik hatırlatma işi: tek kullanıcının bozuk verisi (geçersiz saat dilimi) diğerlerini engellememeli */
describe('NotificationsService.sendDailyReminders', () => {
  const currentUtcHour = new Date().getUTCHours();
  const user = (over: Record<string, unknown>) => ({
    id: 'u',
    email: 'u@x.y',
    locale: 'tr',
    timezone: 'UTC',
    reminderHour: currentUtcHour,
    lastActivityDate: null,
    currentStreak: 0,
    pushTokens: [],
    ...over,
  });

  it('geçersiz saat dilimli kullanıcıyı atlayıp diğerlerine gönderir', async () => {
    const prisma = {
      user: {
        findMany: jest.fn(async () => [
          user({ id: 'bozuk', timezone: 'Nope/Zone' }),
          user({ id: 'saglam', email: 'ok@x.y' }),
        ]),
      },
    };
    const config = { get: (k: string) => ({ NODE_ENV: 'development', SMTP_URL: undefined })[k] };
    const service = new NotificationsService(prisma as never, config as never, {} as never);
    const sendEmail = jest.spyOn(service, 'sendEmail').mockResolvedValue();

    const out = await service.sendDailyReminders();

    expect(out.email).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith('ok@x.y', expect.any(String), expect.any(String));
  });

  it('zamanlanmış iş saat kilidini alamazsa göndermez (başka örnek çalıştırıyor)', async () => {
    const redis = { acquireLock: jest.fn(async () => false) };
    const config = { get: () => undefined };
    const service = new NotificationsService({} as never, config as never, redis as never);
    const send = jest.spyOn(service, 'sendDailyReminders').mockResolvedValue({ push: 0, email: 0 });
    await service.scheduledReminders();
    expect(redis.acquireLock).toHaveBeenCalledWith(
      expect.stringMatching(/^lock:reminders:\d{4}-\d{2}-\d{2}T\d{2}$/),
      expect.any(Number),
    );
    expect(send).not.toHaveBeenCalled();
  });
});
