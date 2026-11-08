import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useConcepts } from '@/hooks/content';
import { useSettings } from '@/stores/settings';
import { useSession } from '@/stores/session';
import { rescheduleTermNotifications } from './termNotifications';

/**
 * "Günün terimi" bildirimlerini güncel tutar: kavram sözlüğü yüklenince ve uygulama
 * ön plana her geldiğinde önümüzdeki günleri yeniden planlar (pencere kayar).
 * Çevrimdışıysa sözlük yüklenemez; önceden planlananlar yerinde kalır.
 */
export function useTermNotifications(): void {
  const status = useSession((s) => s.status);
  const locale = useSettings((s) => s.locale);
  const concepts = useConcepts();
  const data = concepts.data;
  const latest = useRef({ data, locale });
  latest.current = { data, locale };

  useEffect(() => {
    if (status !== 'authenticated' || !data) return;
    void rescheduleTermNotifications(data, locale).catch(() => undefined);
  }, [status, data, locale]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const sub = AppState.addEventListener('change', (state) => {
      const { data: d, locale: l } = latest.current;
      if (state === 'active' && d) void rescheduleTermNotifications(d, l).catch(() => undefined);
    });
    return () => sub.remove();
  }, [status]);
}
