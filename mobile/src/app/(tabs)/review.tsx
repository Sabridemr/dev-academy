import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useReviews } from '@/hooks/content';
import { useI18n } from '@/i18n';
import { endpoints } from '@/lib/endpoints';
import { queryKeys } from '@/lib/queryClient';
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import { Button, Card, EmptyState, ErrorView, LoadingView, Row, Screen, Text } from '@/components/ui';
import { errorText } from '@/utils/errors';

/**
 * ARALIKLI TEKRAR (SM-2)
 * Tekrar kartlarında doğru cevap bulunmaz (güvenlik: herkese açık soru şeması). Akış:
 * 1) Soru ve seçenekler gösterilir, kullanıcı cevabını zihninde netleştirir
 * 2) "Cevabımı düşündüm" → 0–5 arası öz değerlendirme
 * 3) POST /progress/reviews/:id/grade → sunucu SM-2 ile bir sonraki tarihi hesaplar
 */
export default function ReviewScreen() {
  const { t, tl, messages } = useI18n();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const reviews = useReviews();
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);

  const grade = useMutation({
    mutationFn: ({ id, quality }: { id: string; quality: number }) => endpoints.gradeReview(id, quality),
    onSuccess: (_res, vars) => {
      setDoneIds((d) => [...d, vars.id]);
      setRevealed(false);
      void qc.invalidateQueries({ queryKey: queryKeys.summary });
    },
  });

  const remaining = (reviews.data ?? []).filter((c) => !doneIds.includes(c.id));
  const card = remaining[0];

  return (
    <Screen
      refreshing={reviews.isRefetching}
      onRefresh={() => {
        setDoneIds([]);
        void reviews.refetch();
      }}
      testID="review-screen"
    >
      <Text variant="heading" accessibilityRole="header">
        {t('review.title')}
      </Text>
      {reviews.isLoading ? <LoadingView /> : null}
      {reviews.error ? <ErrorView error={reviews.error} onRetry={() => void reviews.refetch()} /> : null}
      {reviews.data && !card ? <EmptyState icon="happy-outline" text={t('review.empty')} /> : null}

      {card ? (
        <Card testID="review-card">
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="caption" muted>
              {t('review.concept', { name: card.concept })}
            </Text>
            <Text variant="caption" muted>
              {t('review.remaining', { count: remaining.length })}
            </Text>
          </Row>
          <Text variant="subheading">{tl(card.prompt)}</Text>
          {(card.options ?? []).map((o, i) => (
            <View key={o.id} style={[styles.option, { borderColor: colors.border, backgroundColor: colors.elevated }]}>
              <Text variant="label" muted>
                {String.fromCharCode(65 + i)}
              </Text>
              <Text style={{ flex: 1 }}>{tl(o.text)}</Text>
            </View>
          ))}

          {!revealed ? (
            <>
              <Text variant="caption" muted>
                {t('review.think')}
              </Text>
              <Button title={t('review.reveal')} icon="bulb-outline" onPress={() => setRevealed(true)} testID="review-reveal" />
            </>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Text variant="label">{t('review.howWell')}</Text>
              <View style={styles.grades}>
                {messages.review.grades.map((label, q) => {
                  const tone = q < 3 ? colors.danger : q < 4 ? colors.warning : colors.success;
                  return (
                    <Pressable
                      key={q}
                      disabled={grade.isPending}
                      onPress={() => grade.mutate({ id: card.id, quality: q })}
                      accessibilityRole="button"
                      accessibilityLabel={`${q} — ${label}`}
                      style={({ pressed }) => [styles.grade, { borderColor: tone, backgroundColor: withAlpha(tone, pressed ? 0.25 : 0.1) }]}
                      testID={`review-grade-${q}`}
                    >
                      <Text variant="label" color={tone}>
                        {q}
                      </Text>
                      <Text variant="caption">{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {grade.error ? (
                <Text variant="caption" color={colors.danger}>
                  {errorText(grade.error, t)}
                </Text>
              ) : null}
            </View>
          )}
          <Button title={t('review.openLesson')} variant="ghost" icon="book-outline" compact onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: card.lessonId } })} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  grades: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grade: { flexBasis: '30%', flexGrow: 1, alignItems: 'center', borderWidth: 1.5, borderRadius: radius.md, paddingVertical: spacing.sm, gap: 2 },
});
