import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { endpoints } from '@/lib/endpoints';
import { useSession } from '@/stores/session';
import { notificationData } from './push';

/**
 * Bildirime dokunulduğunda yönlendirme:
 * - data.lessonId varsa o ders
 * - hatırlatma ise /progress/summary → continueLesson
 * - aksi halde ana sayfa
 * Soğuk açılış (uygulama kapalıyken dokunma) useLastNotificationResponse ile yakalanır.
 */
export function useNotificationNavigation(): void {
  const status = useSession((s) => s.status);
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !lastResponse) return;
    const id = lastResponse.notification.request.identifier + lastResponse.notification.date;
    if (handled.current === id) return;
    handled.current = id;
    void openFromNotification(notificationData(lastResponse));
  }, [lastResponse, status]);
}

async function openFromNotification(data: { lessonId?: string }): Promise<void> {
  if (data.lessonId) {
    router.push({ pathname: '/lesson/[id]', params: { id: data.lessonId } });
    return;
  }
  try {
    const summary = await endpoints.progressSummary();
    if (summary.continueLesson) {
      router.push({ pathname: '/lesson/[id]', params: { id: summary.continueLesson.id } });
      return;
    }
  } catch {
    // çevrimdışı → ana sayfa
  }
  router.push('/');
}
