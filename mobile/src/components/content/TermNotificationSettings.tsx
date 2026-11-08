import { useState } from 'react';
import { Switch, View } from 'react-native';
import { useConcepts } from '@/hooks/content';
import { useI18n } from '@/i18n';
import { requestPermission } from '@/notifications/push';
import {
  rescheduleTermNotifications,
  saveTermNotificationSettings,
  termNotificationSettings,
  type TermNotificationSettings as Settings,
} from '@/notifications/termNotifications';
import { spacing, useTheme } from '@/theme';
import { Card, Row, Stepper, Text } from '@/components/ui';

const fmt = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** İki bildirim aynı saate denk gelmesin: çakışırsa aynı yönde bir sonraki saate atla */
function distinctHour(next: number, current: number, other: number): number {
  if (next !== other) return next;
  const candidate = next + (next >= current ? 1 : -1);
  return candidate < 0 || candidate > 23 ? current : candidate;
}

/** Profil ekranı: günde 2 "günün terimi" bildirimi — aç/kapa ve iki saat seçimi */
export function TermNotificationSettings() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const concepts = useConcepts();
  const [settings, setSettings] = useState<Settings>(() => termNotificationSettings());
  const [denied, setDenied] = useState(false);

  const apply = async (next: Settings) => {
    setSettings(next);
    saveTermNotificationSettings(next);
    if (next.enabled) setDenied((await requestPermission()) === 'denied');
    if (concepts.data) await rescheduleTermNotifications(concepts.data, locale, next).catch(() => 0);
  };

  return (
    <Card>
      <View style={{ gap: spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="label" style={{ flex: 1 }}>
            {t('notifications.term.toggle')}
          </Text>
          <Switch
            value={settings.enabled}
            onValueChange={(on) => void apply({ ...settings, enabled: on })}
            accessibilityLabel={t('notifications.term.toggle')}
            testID="term-notif-switch"
          />
        </Row>
        <Text variant="caption" muted>
          {t('notifications.term.description')}
        </Text>
        {settings.enabled ? (
          <>
            <Stepper
              label={t('notifications.term.first')}
              value={settings.hours[0]}
              min={0}
              max={23}
              format={fmt}
              onChange={(h) =>
                void apply({
                  ...settings,
                  hours: [distinctHour(h, settings.hours[0], settings.hours[1]), settings.hours[1]],
                })
              }
            />
            <Stepper
              label={t('notifications.term.second')}
              value={settings.hours[1]}
              min={0}
              max={23}
              format={fmt}
              onChange={(h) =>
                void apply({
                  ...settings,
                  hours: [settings.hours[0], distinctHour(h, settings.hours[1], settings.hours[0])],
                })
              }
            />
          </>
        ) : null}
        {denied ? (
          <Text variant="caption" color={colors.warning}>
            {t('profile.notificationsDenied')}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
