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
    const service = new NotificationsService(prisma as never, config as never);
    const sendEmail = jest.spyOn(service, 'sendEmail').mockResolvedValue();

    const out = await service.sendDailyReminders();

    expect(out.email).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith('ok@x.y', expect.any(String), expect.any(String));
  });
});
