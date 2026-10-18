import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import type { AttemptResult, QuizPublic } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { isApiError } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { queryKeys } from '@/lib/queryClient';
import { enqueueAttempt, queuedAttemptFor, takeAttemptResult } from '@/offline/queue';
import { useSession } from '@/stores/session';
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import { Button, Card, Chip, IconButton, Text } from '@/components/ui';
import { Celebration } from '@/components/celebration/Celebration';
import { errorText } from '@/utils/errors';

type Question = QuizPublic['questions'][number];

/**
 * QUIZ — tek/çok seçimli, doğru-yanlış ve sıralama soruları.
 * Doğru cevaplar istemciye gönderilmez; puanlama sunucuda yapılır. Çevrimdışıyken deneme kuyruğa
 * alınır ve bağlantı gelince gönderilir ("bağlantı gelince değerlendirilecek").
 */
export function QuizView({
  quiz,
  lessonId,
  onPassed,
}: {
  quiz: QuizPublic;
  lessonId: string;
  onPassed?: () => void;
}) {
  const { t, tl } = useI18n();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const authed = useSession((s) => s.status === 'authenticated');
  const initialAnswers = useMemo(
    () =>
      Object.fromEntries(
        quiz.questions
          .filter((q) => q.type === 'order')
          .map((q) => [q.id, q.options.map((o) => o.id)]),
      ) as Record<string, string[]>,
    [quiz],
  );
  const [answers, setAnswers] = useState<Record<string, string[]>>(initialAnswers);
  const [result, setResult] = useState<AttemptResult | null>(
    () => takeAttemptResult(quiz.id) ?? null,
  );
  const [queued, setQueued] = useState(() => Boolean(queuedAttemptFor(quiz.id)));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const startedAt = useRef(Date.now());
  const onPassedRef = useRef(onPassed);
  onPassedRef.current = onPassed;

  // Kuyruktaki deneme arka planda değerlendirildiyse sonucu göster
  useEffect(() => {
    if (!queued) return;
    const id = setInterval(() => {
      const r = takeAttemptResult(quiz.id);
      if (r) {
        setResult(r);
        setQueued(false);
        // Çevrimiçi gönderimle aynı yan etkiler: ders tamamlandı + özet/tekrar listesi tazelenir
        if (r.passed) onPassedRef.current?.();
        void qc.invalidateQueries({ queryKey: queryKeys.summary });
        void qc.invalidateQueries({ queryKey: queryKeys.reviews });
      }
    }, 3000);
    return () => clearInterval(id);
  }, [queued, quiz.id, qc]);

  const answeredCount = quiz.questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length;
  const complete = answeredCount === quiz.questions.length;

  const toggle = (q: Question, optionId: string) => {
    setAnswers((prev) => {
      const cur = prev[q.id] ?? [];
      if (q.type === 'multiple') {
        return {
          ...prev,
          [q.id]: cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId],
        };
      }
      return { ...prev, [q.id]: [optionId] };
    });
  };

  const move = (q: Question, index: number, dir: -1 | 1) => {
    setAnswers((prev) => {
      const cur = [...(prev[q.id] ?? q.options.map((o) => o.id))];
      const j = index + dir;
      if (j < 0 || j >= cur.length) return prev;
      [cur[index], cur[j]] = [cur[j], cur[index]];
      return { ...prev, [q.id]: cur };
    });
  };

  const submit = async () => {
    const dto = {
      answers: quiz.questions.map((q) => ({ questionId: q.id, selected: answers[q.id] ?? [] })),
      durationMs: Date.now() - startedAt.current,
    };
    setSubmitting(true);
    setError(null);
    try {
      const res = await endpoints.submitAttempt(quiz.id, dto);
      setResult(res);
      if (res.passed) onPassed?.();
      void qc.invalidateQueries({ queryKey: queryKeys.summary });
      void qc.invalidateQueries({ queryKey: queryKeys.reviews });
    } catch (e) {
      if (isApiError(e) && e.isConnectivity) {
        enqueueAttempt(quiz.id, lessonId, dto);
        setQueued(true);
      } else {
        setError(e);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const retry = () => {
    setResult(null);
    setQueued(false);
    setAnswers(initialAnswers);
    startedAt.current = Date.now();
  };

  const optionText = (q: Question, id: string) => tl(q.options.find((o) => o.id === id)?.text);

  return (
    <Card testID="quiz">
      <Text variant="subheading" accessibilityRole="header">
        {tl(quiz.title) || t('quiz.title')}
      </Text>
      <Text variant="caption" muted>
        {t('quiz.passScore', { score: quiz.passScore })} ·{' '}
        {t('quiz.answered', { done: answeredCount, total: quiz.questions.length })}
      </Text>

      {result ? (
        <View style={styles.resultBox} accessibilityLiveRegion="polite" testID="quiz-result">
          {result.passed ? <Celebration size={140} /> : null}
          <Text
            variant="heading"
            align="center"
            color={result.passed ? colors.success : colors.warning}
          >
            {t('quiz.score', { score: Math.round(result.score) })}
          </Text>
          <Text align="center">{result.passed ? t('quiz.passed') : t('quiz.failed')}</Text>
          {result.newBadges.map((b) => (
            <Chip
              key={b.id}
              tone="primary"
              label={t('quiz.newBadge', { name: tl(b.title) })}
              icon={<Ionicons name="ribbon" size={14} color={colors.primary} />}
            />
          ))}
        </View>
      ) : null}

      {quiz.questions.map((q, qi) => {
        const r = result?.results.find((x) => x.questionId === q.id);
        const selected = answers[q.id] ?? [];
        return (
          <View
            key={q.id}
            style={[styles.question, { borderTopColor: colors.border }]}
            testID={`quiz-q-${q.id}`}
          >
            <Text variant="label">
              {qi + 1}. {tl(q.prompt)}
            </Text>
            {q.type === 'multiple' ? (
              <Text variant="caption" muted>
                {t('quiz.selectAll')}
              </Text>
            ) : null}
            {q.type === 'order' ? (
              <Text variant="caption" muted>
                {t('quiz.orderHint')}
              </Text>
            ) : null}

            {q.type === 'order'
              ? selected.map((id, idx) => (
                  <View
                    key={id}
                    style={[
                      styles.option,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                    ]}
                  >
                    <Text variant="label" muted style={{ width: 22 }}>
                      {idx + 1}.
                    </Text>
                    <Text style={{ flex: 1 }}>{optionText(q, id)}</Text>
                    <IconButton
                      icon="arrow-up"
                      size={16}
                      label={`${t('quiz.moveUp')}: ${optionText(q, id)}`}
                      disabled={Boolean(result) || idx === 0}
                      onPress={() => move(q, idx, -1)}
                    />
                    <IconButton
                      icon="arrow-down"
                      size={16}
                      label={`${t('quiz.moveDown')}: ${optionText(q, id)}`}
                      disabled={Boolean(result) || idx === selected.length - 1}
                      onPress={() => move(q, idx, 1)}
                    />
                  </View>
                ))
              : q.options.map((o) => {
                  const isSel = selected.includes(o.id);
                  const isCorrect = r?.correctAnswer.includes(o.id);
                  const border = r
                    ? isCorrect
                      ? colors.success
                      : isSel
                        ? colors.danger
                        : colors.border
                    : isSel
                      ? colors.primary
                      : colors.border;
                  return (
                    <Pressable
                      key={o.id}
                      disabled={Boolean(result)}
                      onPress={() => toggle(q, o.id)}
                      accessibilityRole={q.type === 'multiple' ? 'checkbox' : 'radio'}
                      accessibilityState={{ checked: isSel, disabled: Boolean(result) }}
                      accessibilityLabel={tl(o.text)}
                      style={[
                        styles.option,
                        {
                          borderColor: border,
                          backgroundColor: isSel ? withAlpha(colors.primary, 0.08) : colors.surface,
                        },
                      ]}
                      testID={`quiz-opt-${q.id}-${o.id}`}
                    >
                      <Ionicons
                        name={
                          q.type === 'multiple'
                            ? isSel
                              ? 'checkbox'
                              : 'square-outline'
                            : isSel
                              ? 'radio-button-on'
                              : 'radio-button-off'
                        }
                        size={20}
                        color={isSel ? colors.primary : colors.muted}
                      />
                      <Text style={{ flex: 1 }}>{tl(o.text)}</Text>
                      {r && isCorrect ? (
                        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                      ) : null}
                    </Pressable>
                  );
                })}

            {r ? (
              <View
                style={[
                  styles.explain,
                  { backgroundColor: withAlpha(r.correct ? colors.success : colors.danger, 0.1) },
                ]}
              >
                <Text variant="label" color={r.correct ? colors.success : colors.danger}>
                  {r.correct ? t('quiz.correct') : t('quiz.wrong')}
                </Text>
                {!r.correct ? (
                  <Text variant="caption">
                    {t('quiz.correctAnswer', {
                      answer: r.correctAnswer
                        .map((id) => optionText(q, id))
                        .join(q.type === 'order' ? ' → ' : ', '),
                    })}
                  </Text>
                ) : null}
                <Text variant="caption">
                  {t('quiz.explanation')}: {tl(r.explanation)}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}

      {queued ? (
        <View
          style={[styles.explain, { backgroundColor: withAlpha(colors.warning, 0.14) }]}
          accessibilityLiveRegion="polite"
          testID="quiz-queued"
        >
          <Text variant="caption">{t('quiz.queued')}</Text>
        </View>
      ) : null}
      {!authed ? (
        <Text variant="caption" muted>
          {t('lesson.loginRequired')}
        </Text>
      ) : null}
      {error ? (
        <Text variant="caption" color={colors.danger}>
          {errorText(error, t)}
        </Text>
      ) : null}

      {result || queued ? (
        <Button title={t('quiz.retry')} variant="secondary" icon="refresh" onPress={retry} />
      ) : (
        <Button
          title={t('quiz.submit')}
          icon="send"
          onPress={submit}
          loading={submitting}
          disabled={!complete || !authed}
          testID="quiz-submit"
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  resultBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  question: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 48,
  },
  explain: { borderRadius: radius.md, padding: spacing.md, gap: 4 },
});
