import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { LessonBlock, LessonDetail, LocalizedString, Locale } from '@devacademy/shared';
import { useScene, useQuiz } from '@/hooks/content';
import { useI18n } from '@/i18n';
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import { Card, ErrorView, LoadingView, Row, Text, type IconName } from '@/components/ui';
import { ScenePlayer } from '@/components/scene/ScenePlayer';
import { InteractiveBlockView } from '@/components/interactive/registry';
import { QuizView } from '@/components/quiz/QuizView';
import { CodeBlockView } from './CodeBlockView';
import { DiagramBlockView } from './DiagramBlockView';
import { ExerciseBlockView } from './ExerciseBlockView';
import { MarkdownView } from './MarkdownView';
import { TraceView } from './TraceView';
import { PredictBlockView } from './PredictBlockView';
import { ResourcesBlockView } from './ResourcesBlockView';

/** Dile göre Markdown seçimi (markdownEn yoksa Türkçe) */
function md(block: { markdown: string; markdownEn?: string }, locale: Locale): string {
  return locale === 'en' && block.markdownEn ? block.markdownEn : block.markdown;
}

interface Props {
  block: LessonBlock;
  lesson: LessonDetail;
  onQuizPassed?: () => void;
}

/** Ders bloğu → bileşen. Tüm LessonBlock türleri desteklenir. */
export const BlockRenderer = memo(function BlockRenderer({ block, lesson, onQuizPassed }: Props) {
  const { locale } = useI18n();
  switch (block.type) {
    case 'text':
      return <MarkdownView>{md(block, locale)}</MarkdownView>;
    case 'diagram':
      return <DiagramBlockView block={block} />;
    case 'animation':
      return <AnimationBlockView sceneId={block.sceneId} caption={block.caption} />;
    case 'interactive':
      return <InteractiveBlockView block={block} lessonId={lesson.id} />;
    case 'code':
      return <CodeBlockView block={block} />;
    case 'realworld':
      return <RealWorldBlockView company={block.company} markdown={md(block, locale)} />;
    case 'callout':
      return (
        <CalloutBlockView tone={block.tone} title={block.title} markdown={md(block, locale)} />
      );
    case 'quiz':
      return <QuizBlockView lessonId={lesson.id} onPassed={onQuizPassed} />;
    case 'trace':
      return <TraceView block={block} />;
    case 'exercise':
      return <ExerciseBlockView block={block} lessonId={lesson.id} />;
    case 'predict':
      return <PredictBlockView block={block} />;
    case 'resources':
      return <ResourcesBlockView block={block} />;
    case 'next':
      return <NextBlockView lessonId={block.lesson} note={block.note} lesson={lesson} />;
    default:
      return null;
  }
});

function AnimationBlockView({ sceneId, caption }: { sceneId?: string; caption?: LocalizedString }) {
  const { t, tl } = useI18n();
  const scene = useScene(sceneId);
  if (!sceneId) return null;
  if (scene.isLoading) return <LoadingView label={t('lesson.loadingScene')} />;
  if (scene.error || !scene.data)
    return <ErrorView error={scene.error} onRetry={() => void scene.refetch()} />;
  return <ScenePlayer scene={scene.data.scene} caption={caption ? tl(caption) : undefined} />;
}

function QuizBlockView({ lessonId, onPassed }: { lessonId: string; onPassed?: () => void }) {
  const quiz = useQuiz(lessonId);
  if (quiz.isLoading) return <LoadingView />;
  if (quiz.error || !quiz.data)
    return <ErrorView error={quiz.error} onRetry={() => void quiz.refetch()} />;
  return <QuizView quiz={quiz.data} lessonId={lessonId} onPassed={onPassed} />;
}

const CALLOUT_ICONS: Record<'info' | 'tip' | 'warning' | 'danger', IconName> = {
  info: 'information-circle',
  tip: 'bulb',
  warning: 'warning',
  danger: 'alert-circle',
};

function CalloutBlockView({
  tone,
  title,
  markdown,
}: {
  tone: 'info' | 'tip' | 'warning' | 'danger';
  title?: LocalizedString;
  markdown: string;
}) {
  const { t, tl } = useI18n();
  const { colors } = useTheme();
  const color =
    tone === 'tip'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'danger'
          ? colors.danger
          : colors.primary;
  return (
    <View
      style={[styles.callout, { borderLeftColor: color, backgroundColor: withAlpha(color, 0.08) }]}
      accessibilityRole="summary"
    >
      <Row>
        <Ionicons name={CALLOUT_ICONS[tone]} size={18} color={color} />
        <Text variant="label" color={color}>
          {title ? tl(title) : t(`lesson.callout.${tone}`)}
        </Text>
      </Row>
      <MarkdownView compact>{markdown}</MarkdownView>
    </View>
  );
}

function RealWorldBlockView({ company, markdown }: { company: string; markdown: string }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <Card>
      <Row>
        <Ionicons name="business" size={18} color={colors.accent} />
        <Text variant="label">{t('lesson.realWorld', { company })}</Text>
      </Row>
      <MarkdownView compact>{markdown}</MarkdownView>
    </Card>
  );
}

function NextBlockView({
  lessonId,
  note,
  lesson,
}: {
  lessonId: string;
  note?: LocalizedString;
  lesson: LessonDetail;
}) {
  const { t, tl } = useI18n();
  const { colors } = useTheme();
  const targetId =
    lesson.next && (lesson.next.id === lessonId || lesson.next.slug === lessonId)
      ? lesson.next.id
      : lessonId;
  const title = lesson.next && targetId === lesson.next.id ? tl(lesson.next.title) : lessonId;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: targetId } })}
      accessibilityRole="link"
      accessibilityLabel={`${t('lesson.nextStep')}: ${title}`}
      style={({ pressed }) => [
        styles.next,
        {
          borderColor: colors.primary,
          backgroundColor: withAlpha(colors.primary, pressed ? 0.16 : 0.08),
        },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="caption" muted>
          {t('lesson.nextStep')}
        </Text>
        <Text variant="label">{title}</Text>
        {note ? (
          <Text variant="caption" muted>
            {tl(note)}
          </Text>
        ) : null}
      </View>
      <Ionicons name="arrow-forward" size={20} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  callout: { borderLeftWidth: 4, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
});
