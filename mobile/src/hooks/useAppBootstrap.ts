import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { isOnline, onConnectivityChange, startNetworkMonitoring } from '@/lib/network';
import { queryKeys } from '@/lib/queryClient';
import { flushAllQueues } from '@/offline/queue';
import { refreshDownloadedModules } from '@/offline/sync';
import {
  registerForPushNotifications,
  scheduleDailyReminder,
  storedReminderHour,
} from '@/notifications/push';
import { useSession } from '@/stores/session';

/**
 * Uygulama açılış işleri:
 * - NetInfo izleme, oturumun SecureStore'dan yüklenmesi
 * - Çevrimiçiyken: bekleyen ilerleme/quiz kuyruğunu boşalt, indirilmiş modülleri ETag ile tazele
 * - Oturum açıkken: push kaydı + yerel günlük hatırlatma
 * - Uygulama ön plana gelince ve bağlantı geri gelince kuyrukları tekrar boşalt
 */
export function useAppBootstrap(): void {
  const qc = useQueryClient();
  const status = useSession((s) => s.status);
  const reminderHour = useSession((s) => s.user?.reminderHour);
  const refreshedOnce = useRef(false);

  useEffect(() => {
    const stop = startNetworkMonitoring();
    void useSession.getState().bootstrap();
    return stop;
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const syncAll = async () => {
      if (!isOnline()) return;
      await flushAllQueues().catch(() => undefined);
      void qc.invalidateQueries({ queryKey: queryKeys.summary });
      if (!refreshedOnce.current) {
        refreshedOnce.current = true;
        const results = await refreshDownloadedModules();
        if (results.some((r) => r.status === 'updated')) {
          void qc.invalidateQueries({ queryKey: queryKeys.downloads });
        }
      }
    };
    void syncAll();

    const offConn = onConnectivityChange((online) => {
      if (online) void syncAll();
    });
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncAll();
    });
    void registerForPushNotifications();
    return () => {
      offConn();
      appSub.remove();
    };
  }, [status, qc]);

  // Sunucudaki hatırlatma saatine göre yerel yedek bildirimi planla
  useEffect(() => {
    if (status !== 'authenticated' || reminderHour === undefined) return;
    if (reminderHour !== storedReminderHour())
      void scheduleDailyReminder(reminderHour).catch(() => undefined);
  }, [status, reminderHour]);
}
