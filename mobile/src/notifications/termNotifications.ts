import * as Notifications from 'expo-notifications';
import type { ConceptSummary, Locale } from '@devacademy/shared';
import { conceptDefinition, conceptTerms } from '@/components/content/concept-text';
import { kv, KV_KEYS } from '@/lib/storage';
import { shortDefinition } from '@/lib/termText';
import { ensureAndroidChannel, REMINDER_CHANNEL_ID } from './push';

/**
 * GÜNDE 2 "GÜNÜN TERİMİ" BİLDİRİMİ (yerel bildirim — sunucu / Apple Developer hesabı gerekmez)
 * ---------------------------------------------------------------------------------------------
 * Her uygulama açılışında / ön plana gelişinde önümüzdeki DAYS_AHEAD gün için tek seferlik
 * bildirimler planlanır (iOS en fazla 64 bekleyen yerel bildirime izin verir: 7 gün × 2 = 14).
 * Aynı gün + slot her zaman aynı terimi verir (deterministik) → yeniden planlama tekrar üretmez.
 */

export const TERM_NOTIFICATION_TYPE = 'term';
export const DAYS_AHEAD = 7;
export const DEFAULT_HOURS: readonly [number, number] = [10, 19];
const DAY_MS = 86_400_000;

export interface TermNotificationSettings {
  enabled: boolean;
  hours: [number, number];
}

export function termNotificationSettings(): TermNotificationSettings {
  const enabled = kv.getBoolean(KV_KEYS.termNotifEnabled) ?? true;
  const h1 = kv.getNumber(KV_KEYS.termNotifHour1) ?? DEFAULT_HOURS[0];
  const h2 = kv.getNumber(KV_KEYS.termNotifHour2) ?? DEFAULT_HOURS[1];
  return { enabled, hours: [h1, h2] };
}

export function saveTermNotificationSettings(s: TermNotificationSettings): void {
  kv.set(KV_KEYS.termNotifEnabled, s.enabled);
  kv.set(KV_KEYS.termNotifHour1, s.hours[0]);
  kv.set(KV_KEYS.termNotifHour2, s.hours[1]);
}

/** Küçük, sabit tohumlu karıştırıcı (mulberry32) → tüm kavramlar tekrarsız dolaşılır */
function seededOrder(length: number, seed: number): number[] {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const idx = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx;
}

export interface PlannedTermNotification {
  date: Date;
  concept: ConceptSummary;
}

/** Saf planlayıcı: önümüzdeki `days` gün içindeki, geçmişte kalmayan slotlar */
export function planTermNotifications(
  concepts: readonly ConceptSummary[],
  hours: readonly [number, number],
  now: Date = new Date(),
  days = DAYS_AHEAD,
): PlannedTermNotification[] {
  if (concepts.length === 0) return [];
  // Sıra, gelen listenin sırasından bağımsız olsun: id'ye göre sabitle
  const sorted = [...concepts].sort((a, b) => a.id.localeCompare(b.id));
  const order = seededOrder(sorted.length, 20240611);
  const plan: PlannedTermNotification[] = [];
  for (let d = 0; d < days; d++) {
    const y = now.getFullYear();
    const m = now.getMonth();
    const day = now.getDate() + d;
    // Gün numarası yerel takvim gününe göre (DST'de kaymasın)
    const dayNumber = Math.floor(Date.UTC(y, m, day) / DAY_MS);
    hours.forEach((hour, slot) => {
      const date = new Date(y, m, day, hour, 0, 0, 0);
      if (date.getTime() <= now.getTime()) return;
      const pos = (dayNumber * hours.length + slot) % sorted.length;
      plan.push({ date, concept: sorted[order[pos]!]! });
    });
  }
  return plan;
}

export function termNotificationContent(
  concept: ConceptSummary,
  locale: Locale,
): Notifications.NotificationContentInput {
  const { primary, secondary } = conceptTerms(concept.term, locale);
  return {
    title: secondary ? `📘 ${primary} (${secondary})` : `📘 ${primary}`,
    body: shortDefinition(conceptDefinition(concept.definition, locale), 160),
    data: { type: TERM_NOTIFICATION_TYPE, conceptId: concept.id },
  };
}

/**
 * İptal/planlama işlemleri tek sırada çalışır: hızlı art arda çağrılar (saat ayarı, uygulama
 * açılışı, çıkış) iç içe geçip bildirimleri iki kat biriktirmesin.
 */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/** Daha önce planlanmış terim bildirimlerini iptal eder (günlük hatırlatmaya dokunmaz) */
export function cancelTermNotifications(): Promise<void> {
  return serial(cancelAll);
}

async function cancelAll(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => (n.content.data as { type?: string } | undefined)?.type === TERM_NOTIFICATION_TYPE)
      .map((n) =>
        Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined),
      ),
  );
}

/**
 * Ayarlara göre yeniden planlar: eskileri siler, yenilerini ekler.
 * İzin yoksa (kullanıcı reddettiyse) hiçbir şey planlamaz. Planlanan adedi döner.
 */
export function rescheduleTermNotifications(
  concepts: readonly ConceptSummary[],
  locale: Locale,
  settings: TermNotificationSettings = termNotificationSettings(),
): Promise<number> {
  return serial(() => reschedule(concepts, locale, settings));
}

async function reschedule(
  concepts: readonly ConceptSummary[],
  locale: Locale,
  settings: TermNotificationSettings,
): Promise<number> {
  await cancelAll();
  if (!settings.enabled) return 0;
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return 0;
  await ensureAndroidChannel();
  const plan = planTermNotifications(concepts, settings.hours);
  for (const { date, concept } of plan) {
    await Notifications.scheduleNotificationAsync({
      content: termNotificationContent(concept, locale),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
  }
  return plan.length;
}
