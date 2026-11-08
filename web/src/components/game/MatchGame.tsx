'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Gamepad2, RotateCcw, Star, Trophy } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useConcepts, useLesson } from '@/lib/hooks';
import {
  INITIAL_SCORE,
  applyAnswer,
  buildRound,
  maxScore,
  stars,
  type MatchRound,
} from '@/lib/match-game';
import { cn } from '@/lib/utils';
import { EmptyState } from '../ui/EmptyState';
import { SkeletonCard } from '../ui/Skeleton';

const bestKey = (lessonId: string | undefined) => `da.match.best.${lessonId ?? 'random'}`;

function readBest(key: string): number {
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}
function writeBest(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // depolama kapalı: rekor bu oturumla sınırlı
  }
}

/**
 * KELİME EŞLEŞTİRME OYUNU: dersin (lessonId) kavramlarından 6 terim; soldaki terime sağdaki
 * doğru anlamı eşleştir. lessonId yoksa tüm sözlükten rastgele.
 */
export function MatchGame({ lessonId }: { lessonId?: string }) {
  const { t, locale } = useI18n();
  const concepts = useConcepts();
  const lesson = useLesson(lessonId ?? '');
  const [round, setRound] = useState<MatchRound | null>(null);
  const [seed, setSeed] = useState(0);
  const lessonPending = Boolean(lessonId) && lesson.isLoading;

  // Tur her seed için yalnızca bir kez kurulur: arka plan yenilemesi oyunu sıfırlamaz
  const builtFor = useRef<number | null>(null);
  useEffect(() => {
    if (builtFor.current === seed) return;
    if (!concepts.data || lessonPending) return;
    builtFor.current = seed;
    setRound(buildRound(concepts.data, lesson.data?.concepts ?? [], locale));
  }, [concepts.data, lesson.data, lessonPending, locale, seed]);

  if (concepts.isLoading || lessonPending)
    return <SkeletonCard />;
  if (concepts.isError)
    return (
      <EmptyState
        title={t('common.error')}
        action={
          <button className="btn-ghost" onClick={() => void concepts.refetch()}>
            {t('common.retry')}
          </button>
        }
      />
    );
  if (!round) return <EmptyState title={t('game.notEnough')} />;

  return (
    <Board
      key={`${seed}:${round.pairs.map((p) => p.id).join(',')}`}
      round={round}
      lessonId={lessonId}
      onAgain={() => setSeed((s) => s + 1)}
    />
  );
}

function Board({
  round,
  lessonId,
  onAgain,
}: {
  round: MatchRound;
  lessonId?: string;
  onAgain: () => void;
}) {
  const { t } = useI18n();
  const [matched, setMatched] = useState<ReadonlySet<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [wrong, setWrong] = useState<{ term: number; def: number } | null>(null);
  const [state, setState] = useState(INITIAL_SCORE);
  const [best, setBest] = useState<{ value: number; isNew: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = round.pairs.length;
  const done = matched.size === total;

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  useEffect(() => {
    if (!done) return;
    const key = bestKey(lessonId);
    const previous = readBest(key);
    const isNew = state.score > previous;
    if (isNew) writeBest(key, state.score);
    setBest({ value: isNew ? state.score : previous, isNew });
    // yalnızca bitiş anında bir kez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const pickTerm = (i: number) => {
    if (wrong || matched.has(i)) return;
    setSelected((cur) => (cur === i ? null : i));
  };

  const pickDefinition = (i: number) => {
    if (wrong || selected === null || matched.has(i)) return;
    if (selected === i) {
      setMatched((m) => new Set(m).add(i));
      setState((s) => applyAnswer(s, true));
      setSelected(null);
    } else {
      setState((s) => applyAnswer(s, false));
      setWrong({ term: selected, def: i });
      timer.current = setTimeout(() => {
        setWrong(null);
        setSelected(null);
      }, 650);
    }
  };

  const starCount = useMemo(() => stars(state.mistakes, total), [state.mistakes, total]);

  if (done) {
    return (
      <div className="card mx-auto max-w-md space-y-4 p-8 text-center" data-testid="match-result">
        <Trophy size={44} className="mx-auto text-accent" />
        <h2 className="t-h2">{t('game.finished')}</h2>
        <div className="flex justify-center gap-1" aria-label={t('game.stars', { count: starCount })}>
          {[1, 2, 3].map((n) => (
            <Star
              key={n}
              size={30}
              className={n <= starCount ? 'fill-accent text-accent' : 'text-muted'}
            />
          ))}
        </div>
        <p className="text-lg font-semibold">
          {t('game.result', { score: state.score, max: maxScore(total) })}
        </p>
        <p className="text-sm text-muted">
          {t('game.mistakes')}: {state.mistakes}
        </p>
        {best ? (
          <p className={cn('text-sm font-medium', best.isNew ? 'text-success-fg' : 'text-muted')}>
            {best.isNew ? t('game.newBest') : t('game.best', { score: best.value })}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primary" onClick={onAgain} data-testid="match-again">
            <RotateCcw size={16} /> {t('game.again')}
          </button>
          {lessonId ? (
            <Link href={`/lessons/${lessonId}`} className="btn-ghost">
              {t('game.backToLesson')}
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const cell = (kind: 'idle' | 'selected' | 'matched' | 'wrong') =>
    cn(
      'w-full rounded-xl border-2 p-3 text-left text-sm transition-colors',
      kind === 'idle' && 'border-border bg-surface hover:bg-elevated',
      kind === 'selected' && 'border-primary bg-primary/10',
      kind === 'matched' && 'border-success bg-success/10 opacity-70',
      kind === 'wrong' && 'border-danger bg-danger/10',
    );

  return (
    <div className="space-y-4" data-testid="match-screen">
      <p className="text-sm text-muted">{t('game.intro')}</p>
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>
          {t('game.score')}: {state.score}
        </span>
        <span className={state.streak > 1 ? 'text-accent' : 'text-muted'}>
          {t('game.streak')}: {state.streak}
        </span>
        <span className="text-muted">
          {matched.size}/{total}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <h2 className="t-mono-label text-muted">{t('game.terms')}</h2>
          {round.pairs.map((p, i) => (
            <button
              key={p.id}
              type="button"
              disabled={matched.has(i)}
              aria-pressed={selected === i}
              data-testid={`match-term-${i}`}
              onClick={() => pickTerm(i)}
              className={cell(
                matched.has(i) ? 'matched' : wrong?.term === i ? 'wrong' : selected === i ? 'selected' : 'idle',
              )}
            >
              <span className="font-semibold">{p.term}</span>
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <h2 className="t-mono-label text-muted">{t('game.meanings')}</h2>
          {round.definitionOrder.map((i) => (
            <button
              key={round.pairs[i]!.id}
              type="button"
              disabled={matched.has(i)}
              data-testid={`match-def-${i}`}
              onClick={() => pickDefinition(i)}
              className={cell(matched.has(i) ? 'matched' : wrong?.def === i ? 'wrong' : 'idle')}
            >
              {round.pairs[i]!.definition}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Başlık ikonu için dışa açılan küçük yardımcı (sayfa başlığında kullanılır) */
export function MatchGameIcon() {
  return <Gamepad2 size={20} className="text-primary" aria-hidden />;
}
