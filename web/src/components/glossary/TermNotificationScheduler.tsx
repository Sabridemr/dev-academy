'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { useConcepts } from '@/lib/hooks';
import {
  DEFAULT_SETTINGS,
  SETTINGS_EVENT,
  dueSlot,
  notificationsSupported,
  readLastShown,
  readSettings,
  showTermNotification,
  termForSlot,
  termNotificationPayload,
  writeLastShown,
  type TermNotifSettings,
} from '@/lib/term-notifications';

/**
 * Kökte çalışır: ayar açıksa (ve tarayıcı izni verildiyse) saati gelen "günün terimi"
 * bildirimini gösterir. Ayar kapalıyken sözlük bile indirilmez.
 */
export function TermNotificationScheduler() {
  const [settings, setSettings] = useState<TermNotifSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    const sync = () => setSettings(readSettings());
    sync();
    window.addEventListener(SETTINGS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return settings.enabled ? <Runner h1={settings.hours[0]} h2={settings.hours[1]} /> : null;
}

function Runner({ h1, h2 }: { h1: number; h2: number }) {
  const { locale } = useI18n();
  const { data } = useConcepts();

  useEffect(() => {
    if (!data || !notificationsSupported() || Notification.permission !== 'granted') return;
    const tick = () => {
      const due = dueSlot(new Date(), [h1, h2], readLastShown());
      if (!due) return;
      const concept = termForSlot(data, due.date, due.slot);
      if (!concept) return;
      writeLastShown(due.date.getTime()); // önce kaydet: aynı slot iki kez gösterilmesin
      void showTermNotification(termNotificationPayload(concept, locale));
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [data, h1, h2, locale]);

  return null;
}
