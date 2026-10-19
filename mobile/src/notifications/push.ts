import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { easProjectId } from '@/config/env';
import { translateNow } from '@/i18n';
import { endpoints } from '@/lib/endpoints';
import { kv, KV_KEYS } from '@/lib/storage';

/**
 * PUSH BİLDİRİMLERİ
 * -----------------
 * 1) İzin iste (yalnızca fiziksel cihaz — simülatör/emülatör Expo push token alamaz)
 * 2) Expo push token al (projectId: app.config.ts → extra.eas.projectId)
 * 3) POST /users/me/push-tokens ile backend'e kaydet (backend günlük hatırlatmayı Expo Push API ile yollar)
 * 4) Android bildirim kanalı oluştur
 * 5) Yedek: kullanıcının hatırlatma saatinde YEREL günlük bildirim planla (push çalışmasa da hatırlatma gelir)
 * Bildirime dokunulunca "devam edilecek ders" açılır (app/_layout.tsx → useNotificationNavigation).
 */

export const REMINDER_CHANNEL_ID = 'daily-reminder';
const REMINDER_ID_KEY = 'push.reminderNotificationId';

/** Bildirim verisi sözleşmesi (backend push payload'ı ile aynı) */
export interface ReminderData {
  type?: 'reminder' | 'lesson';
  lessonId?: string;
  [key: string]: unknown;
}

/** Uygulama ön plandayken bildirim nasıl gösterilsin */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: translateNow('notifications.channelName'),
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#6366F1',
  });
}

export type PermissionResult = 'granted' | 'denied' | 'unsupported';

export async function requestPermission(): Promise<PermissionResult> {
  if (!Device.isDevice) return 'unsupported';
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted' && current.canAskAgain) {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  return status === 'granted' ? 'granted' : 'denied';
}

/**
 * İzin + token + backend kaydı. Token değişmediyse tekrar göndermez.
 * @returns alınan Expo push token'ı ya da null
 */
export async function registerForPushNotifications(): Promise<string | null> {
  const permission = await requestPermission();
  if (permission !== 'granted') return null;
  const projectId = easProjectId();
  if (!projectId) {
    // EAS projectId yoksa push token alınamaz; yerel hatırlatmalar yine çalışır
    return null;
  }
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (kv.getString(KV_KEYS.pushToken) !== token) {
      await endpoints.registerPushToken({
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        deviceName: Device.deviceName ?? undefined,
      });
      kv.set(KV_KEYS.pushToken, token);
    }
    return token;
  } catch {
    return null;
  }
}

/**
 * Yerel günlük hatırlatma (push'a yedek). hour null → iptal.
 * Aynı anda yalnızca bir hatırlatma planlı kalır.
 */
export async function scheduleDailyReminder(hour: number | null, minute = 0): Promise<void> {
  const previous = kv.getString(REMINDER_ID_KEY);
  if (previous) {
    await Notifications.cancelScheduledNotificationAsync(previous).catch(() => undefined);
    kv.delete(REMINDER_ID_KEY);
  }
  kv.set(KV_KEYS.reminderHour, hour === null ? -1 : hour);
  if (hour === null) return;
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return;
  await ensureAndroidChannel();
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: translateNow('notifications.reminderTitle'),
      body: translateNow('notifications.reminderBody'),
      data: { type: 'reminder' } satisfies ReminderData,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: REMINDER_CHANNEL_ID,
    },
  });
  kv.set(REMINDER_ID_KEY, id);
}

/** Çıkışta: planlı yerel hatırlatmayı iptal eder ve saat tercihini siler (sonraki hesaba taşınmasın) */
export async function cancelDailyReminder(): Promise<void> {
  const previous = kv.getString(REMINDER_ID_KEY);
  kv.delete(REMINDER_ID_KEY);
  kv.delete(KV_KEYS.reminderHour);
  if (previous)
    await Notifications.cancelScheduledNotificationAsync(previous).catch(() => undefined);
}

/** MMKV'de saklanan hatırlatma saati (-1 → kapalı, tanımsız → null) */
export function storedReminderHour(): number | null {
  const v = kv.getNumber(KV_KEYS.reminderHour);
  return v === undefined || v < 0 ? null : v;
}

export function notificationData(response: Notifications.NotificationResponse): ReminderData {
  return (response.notification.request.content.data ?? {}) as ReminderData;
}
