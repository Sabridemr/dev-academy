'use client';

import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useConcepts } from '@/lib/hooks';
import {
  DEFAULT_SETTINGS,
  notificationsSupported,
  readSettings,
  showTermNotification,
  termNotificationPayload,
  writeSettings,
  type TermNotifSettings,
} from '@/lib/term-notifications';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const fmt = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** Ayarlar sayfası kartı: günde 2 "günün terimi" bildirimi (aç/kapa, iki saat, deneme) */
export function TermNotificationSettings() {
  const { t, locale } = useI18n();
  const [settings, setSettings] = useState<TermNotifSettings>(DEFAULT_SETTINGS);
  const [supported, setSupported] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const { data: concepts } = useConcepts();

  useEffect(() => {
    setSettings(readSettings());
    setSupported(notificationsSupported());
    setBlocked(notificationsSupported() && Notification.permission === 'denied');
  }, []);

  const save = (next: TermNotifSettings) => {
    setSettings(next);
    writeSettings(next);
  };

  const toggle = async (on: boolean) => {
    if (!on) return save({ ...settings, enabled: false });
    const permission =
      Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
    setBlocked(permission !== 'granted');
    if (permission === 'granted') save({ ...settings, enabled: true });
  };

  /** İki saat aynı olamaz: çakışırsa aynı yönde bir sonraki saate atla */
  const setHour = (slot: 0 | 1, value: number) => {
    const other = settings.hours[slot === 0 ? 1 : 0];
    const current = settings.hours[slot];
    let h = value;
    if (h === other) h = h + (h >= current ? 1 : -1);
    if (h < 0 || h > 23) h = current;
    const hours: [number, number] = slot === 0 ? [h, other] : [other, h];
    save({ ...settings, hours });
  };

  const sendTest = () => {
    const c = concepts?.[Math.floor(Math.random() * (concepts?.length ?? 0))];
    if (c) void showTermNotification(termNotificationPayload(c, locale));
  };

  return (
    <section className="card p-6" data-testid="term-notif-settings">
      <h2 className="t-h3 flex items-center gap-2">
        <BellRing size={16} className="text-primary" /> {t('termNotif.title')}
      </h2>
      <p className="mt-1 text-sm text-muted">{t('termNotif.description')}</p>

      {!supported ? (
        <p className="mt-4 text-sm text-warning-fg" role="status">
          {t('termNotif.unsupported')}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => void toggle(e.target.checked)}
              data-testid="term-notif-toggle"
            />
            {t('termNotif.toggle')}
          </label>
          {blocked ? (
            <p className="text-sm text-warning-fg" role="status">
              {t('termNotif.blocked')}
            </p>
          ) : null}
          {settings.enabled ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {([0, 1] as const).map((slot) => (
                  <label key={slot} className="block text-sm">
                    <span className="mb-1 block text-muted">
                      {t(slot === 0 ? 'termNotif.first' : 'termNotif.second')}
                    </span>
                    <select
                      className="input"
                      value={settings.hours[slot]}
                      onChange={(e) => setHour(slot, Number(e.target.value))}
                    >
                      {HOURS.map((h) => (
                        <option key={h} value={h}>
                          {fmt(h)}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <button type="button" className="btn-ghost btn-sm" onClick={sendTest}>
                {t('termNotif.test')}
              </button>
              <p className="text-xs text-muted">{t('termNotif.limit')}</p>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
