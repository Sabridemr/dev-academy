import { Linking, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LessonBlock } from '@devacademy/shared';
import { env } from '@/config/env';
import { useI18n } from '@/i18n';
import { spacing, useTheme } from '@/theme';
import { Button, Card, Row, Text } from '@/components/ui';
import { CodeBlockView } from './CodeBlockView';
import { MarkdownView } from './MarkdownView';

type ExerciseBlock = Extract<LessonBlock, { type: 'exercise' }>;

/**
 * Kodlama alıştırması (mobil). Python web'de Pyodide (WebAssembly) ile çalışır; React Native'de bu
 * çalışma zamanı yok. Mobilde görev ve başlangıç kodu gösterilir, çözmek için ders web'de açılır.
 */
export function ExerciseBlockView({ block, lessonId }: { block: ExerciseBlock; lessonId: string }) {
  const { t, tl } = useI18n();
  const { colors } = useTheme();
  const ex = block.exercise;
  if (!ex) return null;
  const url = `${env.webUrl}/lessons/${encodeURIComponent(lessonId)}#block-${block.id}`;

  return (
    <Card testID={`exercise-${ex.id}`}>
      <Row>
        <Ionicons name="terminal-outline" size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text variant="caption" muted>
            {t('exercise.role')}
          </Text>
          <Text variant="subheading">{tl(ex.title)}</Text>
        </View>
      </Row>
      {block.instructions ? <MarkdownView compact>{tl(block.instructions)}</MarkdownView> : null}
      <MarkdownView compact>{tl(ex.prompt)}</MarkdownView>
      <CodeBlockView
        block={{
          id: `${block.id}-starter`,
          order: block.order,
          type: 'code',
          language: ex.language,
          title: t('exercise.starter'),
          code: ex.starter.replace(/\n+$/, ''),
          alternatives: [],
          highlightLines: [],
        }}
      />
      <View style={{ gap: spacing.sm }}>
        <Text variant="caption" muted>
          {t('exercise.webOnly')}
          {ex.hints.length > 0 ? ` ${t('exercise.hints', { count: ex.hints.length })}.` : ''}
        </Text>
        <Button
          title={t('exercise.openOnWeb')}
          variant="secondary"
          icon="open-outline"
          onPress={() => void Linking.openURL(url)}
        />
      </View>
    </Card>
  );
}
