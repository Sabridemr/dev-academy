import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useDownloads, useModule } from '@/hooks/content';
import { useI18n } from '@/i18n';
import { useOnline } from '@/lib/network';
import { queryKeys } from '@/lib/queryClient';
import { removeModuleDownload, syncModule } from '@/offline/sync';
import { resolveThemeColor, spacing, useTheme } from '@/theme';
import {
  Button,
  Card,
  Chip,
  ErrorView,
  LoadingView,
  ProgressBar,
  Row,
  Screen,
  Text,
} from '@/components/ui';
import { LessonRow } from '@/components/content/ModuleCard';
import { errorText } from '@/utils/errors';

/** Modül detayı: dersler + "Çevrimdışı için indir" */
export default function ModuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, tl } = useI18n();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const online = useOnline();
  const mod = useModule(id);
  const downloads = useDownloads();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const moduleId = mod.data?.id ?? id ?? '';
  const downloaded = downloads.data?.some((d) => d.id === moduleId) ?? false;

  const download = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await syncModule(moduleId);
      setMessage(res.status === 'updated' ? t('module.updated') : t('module.upToDate'));
      await qc.invalidateQueries({ queryKey: queryKeys.downloads });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    await removeModuleDownload(moduleId);
    setMessage(null);
    await qc.invalidateQueries({ queryKey: queryKeys.downloads });
  };

  if (mod.isLoading) return <LoadingView />;
  if (mod.error || !mod.data)
    return <ErrorView error={mod.error} onRetry={() => void mod.refetch()} />;
  const m = mod.data;
  const color = resolveThemeColor(m.color, colors);
  const done = m.lessons.filter((l) => l.progress?.status === 'completed').length;

  return (
    <Screen
      edges={[]}
      refreshing={mod.isRefetching}
      onRefresh={() => void mod.refetch()}
      testID="module-screen"
    >
      <Stack.Screen options={{ title: `${m.code}. ${tl(m.title)}` }} />
      <Card>
        <Text variant="heading" accessibilityRole="header">
          {tl(m.title)}
        </Text>
        <Text muted>{tl(m.description)}</Text>
        <ProgressBar value={m.lessons.length ? done / m.lessons.length : 0} color={color} />
        <Text variant="caption" muted>
          {t('module.completed', { done, total: m.lessons.length })}
        </Text>
        <Row wrap>
          {downloaded ? <Chip tone="success" label={t('module.downloaded')} /> : null}
          {message ? <Chip tone="primary" label={message} /> : null}
        </Row>
        <Button
          title={
            busy
              ? t('module.downloading')
              : downloaded
                ? t('profile.syncNow')
                : t('module.download')
          }
          icon={downloaded ? 'sync' : 'cloud-download-outline'}
          variant={downloaded ? 'secondary' : 'primary'}
          loading={busy}
          disabled={!online}
          onPress={() => void download()}
          testID="module-download"
        />
        {downloaded ? (
          <Button
            title={t('module.removeDownload')}
            variant="ghost"
            icon="trash-outline"
            onPress={() => void remove()}
          />
        ) : null}
        {error ? (
          <Text variant="caption" color={colors.danger}>
            {errorText(error, t)}
          </Text>
        ) : null}
      </Card>
      <Text variant="subheading">{t('module.lessons')}</Text>
      <View style={{ gap: spacing.sm }}>
        {m.lessons.map((l) => (
          <LessonRow key={l.id} lesson={l} />
        ))}
      </View>
    </Screen>
  );
}
