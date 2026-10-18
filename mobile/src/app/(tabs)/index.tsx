import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useModules, usePaths, useProgressSummary } from '@/hooks/content';
import { useI18n } from '@/i18n';
import { useSession } from '@/stores/session';
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import {
  Button,
  Card,
  ErrorView,
  IconButton,
  LoadingView,
  ProgressBar,
  Row,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { ModuleCard } from '@/components/content/ModuleCard';

/** Ana sayfa: selamlama, seri/özet, devam et, öğrenme yolları, modüller */
export default function HomeScreen() {
  const { t, tl } = useI18n();
  const { colors } = useTheme();
  const user = useSession((s) => s.user);
  const summary = useProgressSummary();
  const paths = usePaths();
  const modules = useModules();
  const refreshing = summary.isRefetching || modules.isRefetching;

  const refresh = () => {
    void summary.refetch();
    void paths.refetch();
    void modules.refetch();
  };

  const s = summary.data;
  return (
    <Screen refreshing={refreshing} onRefresh={refresh} testID="home-screen">
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" muted>
            {t('app.name')}
          </Text>
          <Text variant="heading" accessibilityRole="header">
            {t('home.greeting', { name: user?.displayName?.split(' ')[0] ?? '' })}
          </Text>
        </View>
        <IconButton
          icon="search"
          label={t('nav.search')}
          onPress={() => router.push('/search')}
          testID="open-search"
        />
      </Row>

      {s ? (
        <Row gap={spacing.sm}>
          <StatTile
            icon="flame"
            color={colors.accent}
            label={t('dashboard.streak')}
            value={t('dashboard.days', { count: s.currentStreak })}
          />
          <StatTile
            icon="pie-chart"
            color={colors.primary}
            label={t('dashboard.completion')}
            value={`%${s.completionPercent}`}
          />
          <Pressable
            style={{ flex: 1 }}
            onPress={() => router.push('/review')}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.dueReviews', { count: s.dueReviews })}
          >
            <StatTile
              icon="repeat"
              color={colors.success}
              label={t('nav.review')}
              value={String(s.dueReviews)}
            />
          </Pressable>
        </Row>
      ) : null}

      <Card>
        <Text variant="label">{t('home.continue')}</Text>
        {s?.continueLesson ? (
          <>
            <Text variant="subheading">{tl(s.continueLesson.title)}</Text>
            <ProgressBar value={s.continueLesson.percent / 100} label={t('lesson.progress')} />
            <Button
              title={t('home.start')}
              icon="play"
              onPress={() =>
                router.push({ pathname: '/lesson/[id]', params: { id: s.continueLesson!.id } })
              }
              testID="continue-lesson"
            />
          </>
        ) : (
          <Text muted>{t('home.noContinue')}</Text>
        )}
      </Card>

      <Section title={t('home.pathsTitle')}>
        {paths.isLoading ? <LoadingView /> : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.md }}
        >
          {(paths.data ?? []).map((p) => {
            const selected = user?.selectedPathId === p.id;
            return (
              <View
                key={p.id}
                style={[
                  styles.path,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? withAlpha(colors.primary, 0.08) : colors.surface,
                  },
                ]}
              >
                {selected ? (
                  <Text variant="caption" color={colors.primary} weight="700">
                    {t('home.selectedPath')}
                  </Text>
                ) : null}
                <Text variant="label">{tl(p.title)}</Text>
                <Text variant="caption" muted numberOfLines={3}>
                  {tl(p.description)}
                </Text>
                <Text variant="caption" muted>
                  {t('home.modulesCount', { count: p.moduleCount })} ·{' '}
                  {t('home.lessons', { count: p.lessonCount })}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </Section>

      <Section title={t('home.modulesTitle')}>
        {modules.isLoading ? <LoadingView /> : null}
        {modules.error ? (
          <ErrorView error={modules.error} onRetry={() => void modules.refetch()} />
        ) : null}
        {(modules.data ?? []).map((m) => (
          <ModuleCard key={m.id} module={m} />
        ))}
      </Section>
    </Screen>
  );
}

function StatTile({
  icon,
  color,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  label: string;
  value: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text variant="label">{value}</Text>
      <Text variant="caption" muted numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  path: {
    width: 240,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  tile: { flex: 1, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 2 },
});
