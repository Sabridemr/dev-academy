import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Locale, UpdateProfileDto } from '@devacademy/shared';
import { useDownloads, usePaths } from '@/hooks/content';
import { useI18n } from '@/i18n';
import { endpoints } from '@/lib/endpoints';
import { useOnline } from '@/lib/network';
import { queryKeys } from '@/lib/queryClient';
import { scheduleDailyReminder, requestPermission } from '@/notifications/push';
import { pendingProgressCount } from '@/offline/queue';
import { lastSyncAt, refreshDownloadedModules, removeModuleDownload } from '@/offline/sync';
import { useSession } from '@/stores/session';
import { useSettings, type ThemePreference } from '@/stores/settings';
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import { Button, Card, IconButton, Row, Screen, Section, SegmentedControl, Text } from '@/components/ui';
import { ReminderPicker } from '@/components/content/ReminderPicker';
import { errorText } from '@/utils/errors';

/** Profil: öğrenme yolu, hatırlatma, dil, tema, çevrimdışı indirmeler, çıkış */
export default function ProfileScreen() {
  const { t, tl, locale, setLocale } = useI18n();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const online = useOnline();
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const signOut = useSession((s) => s.signOut);
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const paths = usePaths();
  const downloads = useDownloads();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const update = useMutation({
    mutationFn: (dto: UpdateProfileDto) => endpoints.updateMe(dto),
    onSuccess: (me) => setUser(me),
  });

  const changeLocale = (l: Locale) => {
    setLocale(l);
    if (online) update.mutate({ locale: l });
  };

  const changeReminder = async (hour: number | null) => {
    if (hour !== null) {
      const perm = await requestPermission();
      setPermissionDenied(perm === 'denied');
    }
    update.mutate({ reminderHour: hour, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    await scheduleDailyReminder(hour).catch(() => undefined);
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      await refreshDownloadedModules();
      await qc.invalidateQueries({ queryKey: queryKeys.downloads });
    } finally {
      setSyncing(false);
    }
  };

  const last = lastSyncAt();
  const pending = pendingProgressCount();

  return (
    <Screen testID="profile-screen">
      <Row>
        <View style={[styles.avatar, { backgroundColor: withAlpha(colors.primary, 0.15) }]}>
          <Text variant="heading" color={colors.primary}>
            {(user?.displayName ?? '?').slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="subheading">{user?.displayName}</Text>
          <Text variant="caption" muted>
            {user?.email}
          </Text>
        </View>
      </Row>

      <Section title={t('profile.path')}>
        {(paths.data ?? []).map((p) => {
          const selected = user?.selectedPathId === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => update.mutate({ selectedPathId: p.id })}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={[styles.option, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? withAlpha(colors.primary, 0.08) : colors.surface }]}
            >
              <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.primary : colors.muted} />
              <Text style={{ flex: 1 }}>{tl(p.title)}</Text>
            </Pressable>
          );
        })}
      </Section>

      <Card>
        <ReminderPicker value={user?.reminderHour ?? null} onChange={(h) => void changeReminder(h)} />
        {permissionDenied ? (
          <Text variant="caption" color={colors.warning}>
            {t('profile.notificationsDenied')}
          </Text>
        ) : null}
      </Card>

      <Card>
        <SegmentedControl<Locale>
          label={t('profile.language')}
          value={locale}
          onChange={changeLocale}
          options={[
            { value: 'tr', label: t('common.languages.tr') },
            { value: 'en', label: t('common.languages.en') },
          ]}
        />
        <SegmentedControl<ThemePreference>
          label={t('profile.theme')}
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'system', label: t('theme.system') },
            { value: 'light', label: t('theme.light') },
            { value: 'dark', label: t('theme.dark') },
          ]}
        />
      </Card>

      <Section title={t('profile.offline')}>
        <Text variant="caption" muted>
          {t('profile.downloadedCount', { count: downloads.data?.length ?? 0 })} · {t('profile.lastSync', { time: last ? new Date(last).toLocaleString() : t('profile.never') })}
        </Text>
        {pending > 0 ? (
          <Text variant="caption" color={colors.warning}>
            {t('offline.pending', { count: pending })}
          </Text>
        ) : null}
        {(downloads.data ?? []).map((d) => (
          <View key={d.id} style={[styles.option, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Ionicons name="cloud-done-outline" size={20} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text variant="label">{d.module ? `${d.module.code}. ${tl(d.module.title)}` : d.id}</Text>
              <Text variant="caption" muted>
                {t('home.lessons', { count: d.lessonCount })}
              </Text>
            </View>
            <IconButton
              icon="trash-outline"
              label={`${t('module.removeDownload')}: ${d.id}`}
              onPress={() => {
                void removeModuleDownload(d.id).then(() => qc.invalidateQueries({ queryKey: queryKeys.downloads }));
              }}
            />
          </View>
        ))}
        <Button title={t('profile.syncNow')} variant="secondary" icon="sync" loading={syncing} disabled={!online || !downloads.data?.length} onPress={() => void syncNow()} />
      </Section>

      {update.error ? (
        <Text variant="caption" color={colors.danger}>
          {errorText(update.error, t)}
        </Text>
      ) : null}

      <Button title={t('nav.logout')} variant="danger" icon="log-out-outline" onPress={() => void signOut().then(() => qc.clear())} testID="logout" />
      <Text variant="caption" muted align="center">
        {t('profile.version', { version: Constants.expoConfig?.version ?? '0.0.0' })}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md },
});
