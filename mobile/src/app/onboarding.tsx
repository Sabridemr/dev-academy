import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePaths } from '@/hooks/content';
import { useI18n } from '@/i18n';
import { endpoints } from '@/lib/endpoints';
import { kv, KV_KEYS } from '@/lib/storage';
import { requestPermission, scheduleDailyReminder } from '@/notifications/push';
import { useSession } from '@/stores/session';
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import { Button, Card, ErrorView, LoadingView, Screen, Text } from '@/components/ui';
import { ReminderPicker } from '@/components/content/ReminderPicker';
import { errorText } from '@/utils/errors';

/** İlk açılış: öğrenme yolu seçimi + günlük hatırlatma saati */
export default function OnboardingScreen() {
  const { t, tl } = useI18n();
  const { colors } = useTheme();
  const paths = usePaths();
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const [pathId, setPathId] = useState<string | null>(user?.selectedPathId ?? null);
  const [hour, setHour] = useState<number | null>(20);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const finish = () => {
    kv.set(KV_KEYS.onboarded, true);
    router.replace('/');
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (hour !== null) await requestPermission();
      const me = await endpoints.updateMe({
        selectedPathId: pathId,
        reminderHour: hour,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setUser(me);
      await scheduleDailyReminder(hour).catch(() => undefined);
      finish();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']} testID="onboarding-screen">
      <Text variant="heading" accessibilityRole="header">
        {t('onboarding.title')}
      </Text>
      <Text muted>{t('onboarding.subtitle')}</Text>
      {paths.isLoading ? <LoadingView /> : null}
      {paths.error ? <ErrorView error={paths.error} onRetry={() => void paths.refetch()} /> : null}
      {(paths.data ?? []).map((p) => {
        const selected = p.id === pathId;
        return (
          <Pressable
            key={p.id}
            onPress={() => setPathId(p.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={tl(p.title)}
            style={[styles.path, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? withAlpha(colors.primary, 0.08) : colors.surface }]}
            testID={`path-${p.id}`}
          >
            <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? colors.primary : colors.muted} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="label">{tl(p.title)}</Text>
              <Text variant="caption" muted>
                {tl(p.description)}
              </Text>
              <Text variant="caption" muted>
                {t('home.modulesCount', { count: p.moduleCount })} · {t('home.lessons', { count: p.lessonCount })}
              </Text>
            </View>
          </Pressable>
        );
      })}
      <Card>
        <ReminderPicker value={hour} onChange={setHour} />
      </Card>
      {error ? (
        <Text color={colors.danger} variant="caption">
          {errorText(error, t)}
        </Text>
      ) : null}
      <Button title={t('onboarding.save')} onPress={() => void save()} loading={saving} disabled={!pathId} testID="onboarding-save" />
      <Button title={t('onboarding.skip')} variant="ghost" onPress={finish} testID="onboarding-skip" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  path: { flexDirection: 'row', gap: spacing.md, borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.lg },
});
