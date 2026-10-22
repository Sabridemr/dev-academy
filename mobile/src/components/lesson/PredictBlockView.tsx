import { useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LessonBlock } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import { Row, Text } from '@/components/ui';
import { useReducedMotion } from '@/components/interactive/useReducedMotion';
import { MarkdownView } from './MarkdownView';

type PredictBlock = Extract<LessonBlock, { type: 'predict' }>;

/**
 * Tahmin sorusu (predict-observe-explain): animasyondan önce "sence ne olacak?".
 * Puanlanmaz, sunucuya gönderilmez; seçimden sonra doğru cevap ve açıklama gösterilir.
 * "Hareketi azalt" açıksa açıklama yerleşim animasyonu olmadan belirir.
 */
export function PredictBlockView({ block }: { block: PredictBlock }) {
  const { t, tl } = useI18n();
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;
  const correctIndex = block.options.findIndex((o) => o.id === block.correct);
  const correctOption = block.options[correctIndex];
  const letter = (i: number) => String.fromCharCode(65 + i);

  const choose = (id: string | null) => {
    if (!reduced) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelected(id);
  };

  return (
    <View
      style={[
        styles.box,
        {
          borderColor: withAlpha(colors.primary, 0.4),
          backgroundColor: withAlpha(colors.primary, 0.05),
        },
      ]}
      testID={`predict-${block.id}`}
    >
      <Row>
        <Ionicons name="help-circle" size={18} color={colors.primary} />
        <Text variant="label" color={colors.primary} style={{ flex: 1 }}>
          {t('lesson.predict.label')}
        </Text>
        <Text variant="caption" muted>
          {t('lesson.predict.notScored')}
        </Text>
      </Row>
      <MarkdownView compact>{tl(block.prompt)}</MarkdownView>
      {!answered ? (
        <Text variant="caption" muted>
          {t('lesson.predict.hint')}
        </Text>
      ) : null}
      <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
        {block.options.map((o, i) => {
          const chosen = selected === o.id;
          const right = o.id === block.correct;
          const tone =
            answered && right ? colors.success : answered && chosen ? colors.danger : null;
          return (
            <Pressable
              key={o.id}
              onPress={() => choose(o.id)}
              disabled={answered}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosen, disabled: answered }}
              accessibilityLabel={`${letter(i)}) ${tl(o.text)}`}
              accessibilityHint={
                answered ? (right ? t('lesson.predict.correctOption') : undefined) : undefined
              }
              testID={`predict-opt-${block.id}-${o.id}`}
              style={[
                styles.option,
                {
                  borderColor: tone ?? colors.border,
                  backgroundColor: tone ? withAlpha(tone, 0.1) : colors.surface,
                  opacity: answered && !chosen && !right ? 0.7 : 1,
                },
              ]}
            >
              <Text variant="mono" muted>
                {letter(i)}
              </Text>
              <Text style={{ flex: 1 }}>{tl(o.text)}</Text>
              {answered && right ? (
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              ) : null}
              {answered && chosen && !right ? (
                <Ionicons name="close-circle" size={18} color={colors.danger} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {answered ? (
        <View
          style={[styles.feedback, { borderTopColor: colors.border }]}
          accessibilityLiveRegion="polite"
          testID={`predict-feedback-${block.id}`}
        >
          <Text
            variant="label"
            color={selected === block.correct ? colors.success : colors.danger}
            accessibilityRole="alert"
          >
            {selected === block.correct
              ? t('lesson.predict.correct')
              : t('lesson.predict.incorrect', {
                  answer: `${letter(correctIndex)}) ${correctOption ? tl(correctOption.text) : ''}`,
                })}
          </Text>
          {block.explanation ? <MarkdownView compact>{tl(block.explanation)}</MarkdownView> : null}
          <Pressable
            onPress={() => choose(null)}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.retry}
          >
            <Ionicons name="refresh" size={14} color={colors.primary} />
            <Text variant="caption" color={colors.primary}>
              {t('lesson.predict.retry')}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 48,
  },
  feedback: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, gap: spacing.xs },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    minHeight: 32,
  },
});
