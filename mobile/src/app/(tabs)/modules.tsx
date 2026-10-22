import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useModule, useModules } from '@/hooks/content';
import { useI18n } from '@/i18n';
import { spacing } from '@/theme';
import { EmptyState, ErrorView, IconButton, LoadingView, Row, Screen, Text } from '@/components/ui';
import { LessonRow, ModuleCard } from '@/components/content/ModuleCard';

/** Modül ağacı: her modül genişletilerek dersleri görüntülenir */
export default function ModulesScreen() {
  const { t } = useI18n();
  const modules = useModules();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Screen
      refreshing={modules.isRefetching}
      onRefresh={() => void modules.refetch()}
      testID="modules-screen"
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="heading" accessibilityRole="header">
          {t('nav.modules')}
        </Text>
        <IconButton
          icon="book-outline"
          label={t('nav.glossary')}
          onPress={() => router.push('/glossary')}
          testID="open-glossary"
        />
      </Row>
      {modules.isLoading ? <LoadingView /> : null}
      {modules.error ? (
        <ErrorView error={modules.error} onRetry={() => void modules.refetch()} />
      ) : null}
      {modules.data?.length === 0 ? <EmptyState text={t('library.empty')} /> : null}
      {(modules.data ?? []).map((m) => {
        const open = expanded === m.id;
        return (
          <View key={m.id} style={{ gap: spacing.sm }}>
            <ModuleCard
              module={m}
              right={
                <IconButton
                  icon={open ? 'chevron-up' : 'chevron-down'}
                  label={open ? t('module.hideLessons') : t('module.showLessons')}
                  onPress={() => setExpanded(open ? null : m.id)}
                />
              }
            />
            {open ? <ModuleLessons moduleId={m.id} /> : null}
          </View>
        );
      })}
    </Screen>
  );
}

function ModuleLessons({ moduleId }: { moduleId: string }) {
  const mod = useModule(moduleId);
  if (mod.isLoading) return <LoadingView />;
  if (mod.error || !mod.data)
    return <ErrorView error={mod.error} onRetry={() => void mod.refetch()} />;
  return (
    <View style={{ gap: spacing.sm, paddingLeft: spacing.md }}>
      {mod.data.lessons.map((l) => (
        <LessonRow key={l.id} lesson={l} />
      ))}
    </View>
  );
}
