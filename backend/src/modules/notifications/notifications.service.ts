import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import nodemailer, { type Transporter } from 'nodemailer';
import { dateKey } from '@devacademy/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import type { Env } from '../../config/env';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
}

const MESSAGES = {
  tr: {
    title: 'Günlük çalışma zamanı 🔥',
    body: (streak: number) =>
      streak > 0
        ? `${streak} günlük serini koru! 10 dakikalık bir ders seni bekliyor.`
        : 'Bugün yeni bir kavram öğrenmeye ne dersin? Kısa bir ders seni bekliyor.',
  },
  en: {
    title: 'Time for today’s lesson 🔥',
    body: (streak: number) =>
      streak > 0
        ? `Keep your ${streak}-day streak alive! A 10-minute lesson is waiting.`
        : 'How about learning a new concept today? A short lesson is waiting.',
  },
};

/**
 * Günlük hatırlatma bildirimleri.
 * Her saat başı: hatırlatma saati o anki yerel saate denk gelen ve bugün aktif olmayan kullanıcılara
 * mobil push (Expo) ve/veya e-posta gönderilir.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly mailer: Transporter | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly redis: RedisService,
  ) {
    const smtp = config.get('SMTP_URL');
    this.mailer = smtp ? nodemailer.createTransport(smtp) : null;
    if (!this.mailer) this.logger.log('SMTP yapılandırılmamış; e-postalar loglanacak');
  }

  /** Saatlik iş: her API örneğinde tetiklenir, saat başına kilidi yalnızca biri alır (kopya bildirim olmaz) */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduledReminders(): Promise<void> {
    const hourKey = new Date().toISOString().slice(0, 13);
    if (!(await this.redis.acquireLock(`lock:reminders:${hourKey}`, 55 * 60 * 1000))) return;
    await this.sendDailyReminders();
  }

  async sendDailyReminders(): Promise<{ push: number; email: number }> {
    if (this.config.get('NODE_ENV') === 'test') return { push: 0, email: 0 };
    const now = new Date();
    const candidates = await this.prisma.user.findMany({
      where: { deletedAt: null, reminderHour: { not: null } },
      include: { pushTokens: true },
    });
    let push = 0;
    let email = 0;
    for (const user of candidates) {
      // Tek bir kullanıcının hatalı verisi (ör. geçersiz saat dilimi) tüm işi durdurmasın
      try {
        const localHour =
          Number(
            new Intl.DateTimeFormat('en-US', {
              timeZone: user.timezone,
              hour: 'numeric',
              hour12: false,
            }).format(now),
          ) % 24;
        if (localHour !== user.reminderHour) continue;
        if (user.lastActivityDate === dateKey(now, user.timezone)) continue; // bugün zaten çalışmış
        const msg = MESSAGES[user.locale];
        const body = msg.body(user.currentStreak);
        if (user.pushTokens.length > 0) {
          await this.sendExpoPush(
            user.pushTokens.map((t) => ({
              to: t.token,
              title: msg.title,
              body,
              sound: 'default',
              data: { type: 'daily-reminder' },
            })),
          );
          push += user.pushTokens.length;
        } else {
          await this.sendEmail(user.email, msg.title, body);
          email += 1;
        }
      } catch (err) {
        this.logger.warn(`Hatırlatma atlandı (user=${user.id}): ${(err as Error).message}`);
      }
    }
    if (push || email) this.logger.log(`Hatırlatmalar gönderildi: push=${push} email=${email}`);
    return { push, email };
  }

  async sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
    const expoTokens = messages.filter((m) => m.to.startsWith('ExponentPushToken'));
    if (expoTokens.length === 0) return;
    try {
      const res = await fetch(this.config.get('EXPO_PUSH_URL'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(expoTokens),
      });
      if (!res.ok) this.logger.warn(`Expo push yanıtı ${res.status}`);
      else {
        const json = (await res.json()) as {
          data?: { status: string; details?: { error?: string } }[];
        };
        // Geçersiz token'ları temizle
        const invalid = (json.data ?? [])
          .map((d, i) =>
            d.status === 'error' && d.details?.error === 'DeviceNotRegistered'
              ? expoTokens[i].to
              : null,
          )
          .filter((t): t is string => Boolean(t));
        if (invalid.length)
          await this.prisma.pushToken.deleteMany({ where: { token: { in: invalid } } });
      }
    } catch (err) {
      this.logger.warn(`Expo push gönderilemedi: ${(err as Error).message}`);
    }
  }

  async sendEmail(to: string, subject: string, text: string): Promise<void> {
    if (!this.mailer) {
      this.logger.log(`[email→${to}] ${subject}: ${text}`);
      return;
    }
    try {
      await this.mailer.sendMail({ from: this.config.get('MAIL_FROM'), to, subject, text });
    } catch (err) {
      this.logger.warn(`E-posta gönderilemedi (${to}): ${(err as Error).message}`);
    }
  }
}
