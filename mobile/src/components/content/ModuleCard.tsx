import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { LessonSummary, ModuleSummary } from '@devacademy/shared';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/i18n';
import { radius, resolveThemeColor, spacing, useTheme, withAlpha } from '@/theme';
import { Chip, ProgressBar, Row, Text } from '@/components/ui';

/** Modül kartı: kod rozeti, başlık, ilerleme */
export function ModuleCard({ module, onPress, right }: { module: ModuleSummary; onPress?: () => void; right?: React.ReactNode }) {
  const { t, tl } = useI18n();
  const { colors } = useTheme();
  const color = resolveThemeColor(module.color, colors);
  const done = module.completedCount ?? 0;
  return (
    <Pressable
      onPress={onPress ?? (() => router.push({ pathname: '/module/[id]', params: { id: module.id } }))}
      accessibilityRole="button"
      accessibilityLabel={`${module.code}. ${tl(module.title)}, ${t('module.completed', { done, total: module.lessonCount })}`}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
      testID={`module-${module.id}`}
    >
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={[styles.code, { backgroundColor: withAlpha(color, 0.15) }]}>
          <Text variant="label" color={color}>
            {module.code}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">{tl(module.title)}</Text>
          <Text variant="caption" muted numberOfLines={2}>
            {tl(module.description)}
          </Text>
        </View>
        {right}
      </Row>
      <Row>
        <View style={{ flex: 1 }}>
          <ProgressBar value={module.lessonCount ? done / module.lessonCount : 0} color={color} />
        </View>
        <Text variant="caption" muted>
          {t('module.completed', { done, total: module.lessonCount })}
        </Text>
      </Row>
    </Pressable>
  );
}

/** Ders satırı: başlık, süre, seviye, ilerleme ve içerik rozetleri */
export function LessonRow({ lesson }: { lesson: LessonSummary }) {
  const { t, tl } = useI18n();
  const { colors } = useTheme();
  const status = lesson.progress?.status ?? 'not_started';
  const icon = status === 'completed' ? 'checkmark-circle' : status === 'in_progress' ? 'ellipse-outline' : 'play-circle-outline';
  const iconColor = status === 'completed' ? colors.success : status === 'in_progress' ? colors.accent : colors.muted;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${lesson.order}. ${tl(lesson.title)}`}
      style={({ pressed }) => [styles.lesson, { borderColor: colors.border, backgroundColor: pressed ? colors.elevated : colors.surface }]}
      testID={`lesson-${lesson.id}`}
    >
      <Ionicons name={icon} size={22} color={iconColor} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="label">
          {lesson.order}. {tl(lesson.title)}
        </Text>
        <Row wrap gap={6}>
          <Text variant="caption" muted>
            {t('module.minutes', { count: lesson.durationMinutes })} · {t(`module.level.${lesson.level}`)}
          </Text>
          {lesson.hasAnimation ? <Chip label={t('module.hasAnimation')} tone="primary" /> : null}
          {lesson.hasInteractive ? <Chip label={t('module.hasInteractive')} tone="success" /> : null}
          {lesson.hasQuiz ? <Chip label={t('module.hasQuiz')} tone="warning" /> : null}
        </Row>
        {status === 'in_progress' && lesson.progress ? <ProgressBar value={lesson.progress.percent / 100} height={4} /> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  code: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  lesson: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
});
