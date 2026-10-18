import { Switch, View } from 'react-native';
import { useI18n } from '@/i18n';
import { spacing } from '@/theme';
import { Row, Stepper, Text } from '@/components/ui';

/** Günlük hatırlatma saati seçici: kapalı (null) ya da 0–23 saat */
export function ReminderPicker({ value, onChange }: { value: number | null; onChange: (hour: number | null) => void }) {
  const { t } = useI18n();
  const enabled = value !== null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="label">{t('onboarding.reminder')}</Text>
        <Switch value={enabled} onValueChange={(on) => onChange(on ? 20 : null)} accessibilityLabel={t('onboarding.reminder')} testID="reminder-switch" />
      </Row>
      {enabled ? (
        <Stepper label={t('profile.reminder')} value={value} min={0} max={23} onChange={(h) => onChange(h)} format={(h) => `${String(h).padStart(2, '0')}:00`} />
      ) : (
        <Text variant="caption" muted>
          {t('onboarding.noReminder')}
        </Text>
      )}
    </View>
  );
}
