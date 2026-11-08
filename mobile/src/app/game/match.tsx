import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useConcepts, useLesson } from '@/hooks/content';
import { useI18n } from '@/i18n';
import {
  applyAnswer,
  buildRound,
  INITIAL_SCORE,
  maxScore,
  stars,
  type MatchRound,
} from '@/lib/matchGame';
import { kv, KV_KEYS } from '@/lib/storage';
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import { Button, Card, EmptyState, ErrorView, LoadingView, Row, Screen, Text } from '@/components/ui';

/**
 * KELİME EŞLEŞTİRME OYUNU
 * Dersin (lessonId) kavramları: soldaki terime, sağdaki doğru anlamı eşleştir.
 * lessonId yoksa tüm sözlükten rastgele kavramlar kullanılır.
 */
export default function MatchGameScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId?: string }>();
  const { t, locale } = useI18n();
  const concepts = useConcepts();
  const lesson = useLesson(lessonId);
  const [round, setRound] = useState<MatchRound | null>(null);
  const [seed, setSeed] = useState(0);
  const waiting = concepts.isLoading || (Boolean(lessonId) && lesson.isLoading);

  // Tur her seed için yalnızca bir kez kurulur: arka planda kavram listesi yenilense de oyun sıfırlanmaz
  const builtFor = useRef<number | null>(null);
  useEffect(() => {
    if (builtFor.current === seed) return;
    if (!concepts.data || (lessonId && (lesson.isLoading || lesson.error))) return;
    builtFor.current = seed;
    setRound(buildRound(concepts.data, lesson.data?.concepts ?? [], locale));
  }, [concepts.data, lesson.data, lesson.isLoading, lesson.error, lessonId, locale, seed]);

  if (waiting) return <LoadingView />;
  if (concepts.error) return <ErrorView error={concepts.error} onRetry={() => void concepts.refetch()} />;
  if (lessonId && lesson.error)
    return <ErrorView error={lesson.error} onRetry={() => void lesson.refetch()} />;
  if (!round)
    return (
      <Screen edges={[]}>
        <EmptyState icon="game-controller-outline" text={t('game.notEnough')} />
      </Screen>
    );

  // seed değişince alt bileşen sıfırdan kurulur (puan/eşleşmeler temizlenir)
  return (
    <MatchBoard
      key={`${seed}:${round.pairs.map((p) => p.id).join(',')}`}
      round={round}
      lessonId={lessonId}
      onAgain={() => setSeed((s) => s + 1)}
    />
  );
}

function MatchBoard({
  round,
  lessonId,
  onAgain,
}: {
  round: MatchRound;
  lessonId?: string;
  onAgain: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [matched, setMatched] = useState<ReadonlySet<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null); // seçili terimin pair indeksi
  const [wrong, setWrong] = useState<{ term: number; def: number } | null>(null);
  const [state, setState] = useState(INITIAL_SCORE);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = round.pairs.length;
  const done = matched.size === total;
  const bestKey = KV_KEYS.matchBest(lessonId ?? 'random');
  const [best, setBest] = useState<{ previous: number; isNew: boolean } | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  useEffect(() => {
    if (!done) return;
    const previous = kv.getNumber(bestKey) ?? 0;
    const isNew = state.score > previous;
    if (isNew) kv.set(bestKey, state.score);
    setBest({ previous: isNew ? state.score : previous, isNew });
    // yalnızca bitiş anında bir kez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const pickTerm = (i: number) => {
    if (wrong || matched.has(i)) return;
    setSelected((cur) => (cur === i ? null : i));
  };

  const pickDefinition = useCallback(
    (defIndex: number) => {
      if (wrong || selected === null || matched.has(defIndex)) return;
      if (selected === defIndex) {
        setMatched((m) => new Set(m).add(defIndex));
        setState((s) => applyAnswer(s, true));
        setSelected(null);
      } else {
        setState((s) => applyAnswer(s, false));
        setWrong({ term: selected, def: defIndex });
        timer.current = setTimeout(() => {
          setWrong(null);
          setSelected(null);
        }, 650);
      }
    },
    [matched, selected, wrong],
  );

  const cardStyle = (kind: 'idle' | 'selected' | 'matched' | 'wrong') => {
    const map = {
      idle: { borderColor: colors.border, backgroundColor: colors.surface },
      selected: { borderColor: colors.primary, backgroundColor: withAlpha(colors.primary, 0.1) },
      matched: { borderColor: colors.success, backgroundColor: withAlpha(colors.success, 0.12) },
      wrong: { borderColor: colors.danger, backgroundColor: withAlpha(colors.danger, 0.12) },
    } as const;
    return [styles.card, map[kind], kind === 'matched' && { opacity: 0.7 }];
  };

  const termKind = (i: number) =>
    matched.has(i) ? 'matched' : wrong?.term === i ? 'wrong' : selected === i ? 'selected' : 'idle';
  const defKind = (i: number) => (matched.has(i) ? 'matched' : wrong?.def === i ? 'wrong' : 'idle');

  const starCount = useMemo(() => stars(state.mistakes, total), [state.mistakes, total]);

  if (done) {
    return (
      <Screen testID="match-result">
        <Card style={{ alignItems: 'center', gap: spacing.md }}>
          <Ionicons name="trophy" size={48} color={colors.accent} />
          <Text variant="heading">{t('game.finished')}</Text>
          <Row gap={4}>
            {[1, 2, 3].map((n) => (
              <Ionicons
                key={n}
                name={n <= starCount ? 'star' : 'star-outline'}
                size={32}
                color={n <= starCount ? colors.accent : colors.muted}
              />
            ))}
          </Row>
          <Text variant="subheading">{t('game.result', { score: state.score, max: maxScore(total) })}</Text>
          <Text muted>
            {t('game.mistakes')}: {state.mistakes}
          </Text>
          {best ? (
            <Text variant="label" color={best.isNew ? colors.success : colors.muted}>
              {best.isNew ? t('game.newBest') : t('game.best', { score: best.previous })}
            </Text>
          ) : null}
        </Card>
        <Button title={t('game.again')} icon="refresh" onPress={onAgain} testID="match-again" />
        {lessonId ? (
          <Button
            variant="secondary"
            title={t('game.backToLesson')}
            icon="arrow-back"
            onPress={() => router.back()}
          />
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen edges={[]} testID="match-screen">
      <Text variant="caption" muted>
        {t('game.intro')}
      </Text>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="label">
          {t('game.score')}: {state.score}
        </Text>
        <Text variant="label" color={state.streak > 1 ? colors.accent : colors.muted}>
          {t('game.streak')}: {state.streak}
        </Text>
        <Text variant="label" color={colors.muted}>
          {matched.size}/{total}
        </Text>
      </Row>
      <View style={styles.columns}>
        <View style={styles.column}>
          <Text variant="caption" muted>
            {t('game.terms')}
          </Text>
          {round.pairs.map((p, i) => (
            <Pressable
              key={p.id}
              onPress={() => pickTerm(i)}
              disabled={matched.has(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: selected === i, disabled: matched.has(i) }}
              testID={`match-term-${i}`}
              style={cardStyle(termKind(i))}
            >
              <Text variant="label">{p.term}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.column}>
          <Text variant="caption" muted>
            {t('game.meanings')}
          </Text>
          {round.definitionOrder.map((i) => (
            <Pressable
              key={round.pairs[i]!.id}
              onPress={() => pickDefinition(i)}
              disabled={matched.has(i)}
              accessibilityRole="button"
              accessibilityState={{ disabled: matched.has(i) }}
              testID={`match-def-${i}`}
              style={cardStyle(defKind(i))}
            >
              <Text variant="caption">{round.pairs[i]!.definition}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  column: { flex: 1, gap: spacing.sm },
  card: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.sm,
    minHeight: 56,
    justifyContent: 'center',
  },
});
