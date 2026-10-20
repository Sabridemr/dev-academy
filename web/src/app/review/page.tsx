'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, PartyPopper, Repeat } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { gradeAnswer, type ReviewCardDto } from '@devacademy/shared';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { OrderList } from '@/components/lesson/OrderList';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useProgressSummary, useReviews } from '@/lib/hooks';
import { cn, formatDate } from '@/lib/utils';

/**
 * Aralıklı tekrar: yanlış cevaplanan sorular SM-2 takvimine göre geri gelir.
 * Kullanıcı soruyu düşünür, seçim yapar; kontrol edince doğru cevap ve açıklama gösterilir,
 * ardından ne kadar iyi hatırladığını 0-5 arası değerlendirir. Oturum bitince kutlama ve sonraki vade.
 */
function Review() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data: cards, isLoading } = useReviews();
  const { data: summary } = useProgressSummary();
  const [index, setIndex] = useState(0);
  const [graded, setGraded] = useState(0);
  const [done, setDone] = useState(false);
  const [grading, setGrading] = useState(false);
  const gradingRef = useRef(false);

  if (isLoading)
    return (
      <div className="card p-6" aria-busy="true">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-6 w-3/4" />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  const total = cards?.length ?? 0;
  const card = cards?.[index];

  if (done || (!card && graded > 0)) {
    return (
      <EmptyState
        icon={PartyPopper}
        title={t('review.sessionDone')}
        description={t('review.sessionDoneText', { count: graded })}
        action={
          <>
            <Link href="/dashboard" className="btn-primary">
              {t('review.backToDashboard')}
            </Link>
            <Link href="/modules" className="btn-ghost">
              {t('nav.modules')}
            </Link>
          </>
        }
        className="card"
      />
    );
  }
  if (!card)
    return (
      <EmptyState
        icon={CheckCircle2}
        title={t('review.empty')}
        description={
          summary?.nextReviewAt
            ? t('review.nextReview', { date: formatDate(summary.nextReviewAt, locale) })
            : t('review.noNextReview')
        }
        action={
          <Link href="/modules" className="btn-primary">
            {t('nav.modules')} <ArrowRight size={16} />
          </Link>
        }
        className="card"
      />
    );

  // Çift tıklama aynı kartı iki kez değerlendirip sonrakini atlamasın (ref: aynı render'daki tıklamalar için)
  const grade = async (quality: number) => {
    if (gradingRef.current) return;
    gradingRef.current = true;
    setGrading(true);
    try {
      await api(`/progress/reviews/${card.id}/grade`, { method: 'POST', body: { quality } });
      setGraded((g) => g + 1);
      if (index + 1 >= total) {
        await qc.invalidateQueries({ queryKey: ['reviews'] });
        await qc.invalidateQueries({ queryKey: ['progress-summary'] });
        setDone(true);
        setIndex(0);
      } else setIndex(index + 1);
    } finally {
      gradingRef.current = false;
      setGrading(false);
    }
  };

  return (
    <>
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-xs text-muted">
          <span>{t('review.progress', { current: index + 1, total })}</span>
          <span className="tabular-nums">
            {index}/{total}
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-elevated"
          role="progressbar"
          aria-valuenow={index}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${total ? (index / total) * 100 : 0}%` }}
          />
        </div>
      </div>
      <ReviewCardView key={card.id} card={card} grading={grading} onGrade={grade} />
    </>
  );
}

/** Tek kart; seçim durumu karta özeldir (key ile kart değişince sıfırlanır) */
function ReviewCardView({
  card,
  grading,
  onGrade,
}: {
  card: ReviewCardDto;
  grading: boolean;
  onGrade: (quality: number) => void;
}) {
  const { t, tl, messages } = useI18n();
  // Sıralama sorusunda başlangıç sırası seçeneklerin kendisidir (QuizBlock ile aynı)
  const [selected, setSelected] = useState<string[]>(() =>
    card.type === 'order' ? card.options.map((o) => o.id) : [],
  );
  const [revealed, setRevealed] = useState(false);
  const isRight = revealed && gradeAnswer(card.type, selected, card.correctAnswer);
  const optionText = (id: string) => {
    const o = card.options.find((x) => x.id === id);
    return o ? tl(o.text) : id;
  };

  return (
    <div className="card p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="chip chip-accent">{t('review.concept', { name: card.concept })}</span>
        <Link href={`/lessons/${card.lessonId}`} className="btn-link text-xs">
          {t('review.goToLesson')} <ArrowRight size={12} />
        </Link>
      </div>
      <p className="mb-4 text-lg font-medium">{tl(card.prompt)}</p>
      {card.type === 'order' ? (
        <OrderList
          order={selected}
          options={card.options}
          disabled={revealed}
          onChange={setSelected}
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {card.options.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={revealed}
              onClick={() =>
                setSelected((s) =>
                  card.type === 'multiple'
                    ? s.includes(o.id)
                      ? s.filter((x) => x !== o.id)
                      : [...s, o.id]
                    : [o.id],
                )
              }
              className={cn(
                'rounded-lg border px-3 py-2 text-left text-sm transition',
                revealed && card.correctAnswer.includes(o.id)
                  ? 'border-success bg-success/10'
                  : revealed && selected.includes(o.id)
                    ? 'border-danger bg-danger/10'
                    : selected.includes(o.id)
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-elevated',
              )}
            >
              {tl(o.text)}
            </button>
          ))}
        </div>
      )}
      {!revealed ? (
        <button
          type="button"
          className="btn-primary mt-5"
          disabled={selected.length === 0}
          onClick={() => setRevealed(true)}
        >
          {t('review.reveal')}
        </button>
      ) : (
        <div className="mt-5">
          <div className="mb-4 rounded-lg bg-elevated/60 p-3 text-sm" role="status">
            <p className={cn('font-medium', isRight ? 'text-success-fg' : 'text-danger-fg')}>
              {isRight ? t('review.yourAnswerCorrect') : t('review.yourAnswerWrong')}
            </p>
            <p className="mt-1">
              <span className="font-medium">{t('review.correctAnswer')}:</span>{' '}
              {card.correctAnswer.map(optionText).join(card.type === 'order' ? ' → ' : ', ')}
            </p>
            {tl(card.explanation) && <p className="mt-1 text-muted">{tl(card.explanation)}</p>}
          </div>
          <p className="mb-2 text-sm text-muted">{t('review.howWell')}</p>
          <div className="flex flex-wrap gap-2">
            {messages.review.grades.map((label, q) => (
              <button
                key={label}
                type="button"
                disabled={grading}
                className={cn('btn-ghost', q < 3 ? 'hover:border-danger' : 'hover:border-success')}
                onClick={() => onGrade(q)}
              >
                <span className="font-mono text-xs text-muted">{q}</span> {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewPage() {
  const { t } = useI18n();
  return (
    <RequireAuth>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6">
          <h1 className="t-h1 flex items-center gap-2">
            <Repeat size={24} className="text-primary" /> {t('review.title')}
          </h1>
          <p className="mt-1 text-muted">{t('review.subtitle')}</p>
        </div>
        <Review />
      </div>
    </RequireAuth>
  );
}
