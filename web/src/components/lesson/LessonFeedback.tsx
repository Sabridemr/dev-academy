'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Pencil, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { LessonFeedbackDto } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { useLessonFeedback, useSubmitLessonFeedback } from '@/lib/hooks';
import { cn } from '@/lib/utils';

type Difficulty = NonNullable<LessonFeedbackDto['difficulty']>;
const DIFFICULTIES: Difficulty[] = ['easy', 'ok', 'hard'];

/**
 * Ders sonu geri bildirimi: beğendim/beğenmedim + zorluk + isteğe bağlı yorum.
 * Daha önce gönderildiyse (GET mine) teşekkür durumunda açılır, "Düzenle" ile güncellenebilir.
 */
export function LessonFeedback({ lessonId }: { lessonId: string }) {
  const { t } = useI18n();
  const { data, isLoading } = useLessonFeedback(lessonId);
  const submit = useSubmitLessonFeedback(lessonId);
  const mine = data?.mine ?? null;

  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>(undefined);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!mine) return;
    setRating(mine.rating);
    setDifficulty(mine.difficulty);
    setComment(mine.comment ?? '');
  }, [mine]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === null) return;
    const dto: LessonFeedbackDto = {
      rating,
      ...(difficulty ? { difficulty } : {}),
      ...(comment.trim() ? { comment: comment.trim().slice(0, 1000) } : {}),
    };
    const ok = await submit
      .mutateAsync(dto)
      .then(() => true)
      .catch(() => false);
    if (ok) setEditing(false);
  };

  if (isLoading) return null;

  if (mine && !editing)
    return (
      <div
        className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/60 p-4"
        role="status"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success-fg" />
          <div>
            <p className="text-sm font-semibold">{t('feedback.thanks')}</p>
            <p className="text-xs text-muted">
              {t('feedback.yours', {
                rating: mine.rating === 1 ? t('feedback.helpful') : t('feedback.notHelpful'),
              })}
              {mine.difficulty && <> · {t(`feedback.${mine.difficulty}`)}</>}
              {' · '}
              {t('feedback.thanksHint')}
            </p>
          </div>
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(true)}>
          <Pencil size={13} /> {t('feedback.edit')}
        </button>
      </div>
    );

  return (
    <form
      onSubmit={send}
      className="mt-6 rounded-2xl border border-border bg-surface/60 p-4"
      aria-labelledby={`feedback-${lessonId}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <p id={`feedback-${lessonId}`} className="text-sm font-semibold">
          {t('feedback.title')}
        </p>
        <div className="flex gap-2" role="group" aria-label={t('feedback.title')}>
          <RatingButton
            active={rating === 1}
            onClick={() => setRating(1)}
            label={t('feedback.helpful')}
            tone="success"
          >
            <ThumbsUp size={15} />
          </RatingButton>
          <RatingButton
            active={rating === -1}
            onClick={() => setRating(-1)}
            label={t('feedback.notHelpful')}
            tone="danger"
          >
            <ThumbsDown size={15} />
          </RatingButton>
        </div>
        {data && data.up > 0 && (
          <span className="text-xs text-muted">{t('feedback.stats', { up: data.up })}</span>
        )}
      </div>

      {rating !== null && (
        <div className="mt-4 space-y-4 animate-fade-up">
          <fieldset>
            <legend className="label">{t('feedback.difficulty')}</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={difficulty === d}
                  onClick={() => setDifficulty((cur) => (cur === d ? undefined : d))}
                  className={cn(
                    'chip h-8 px-3 transition',
                    difficulty === d ? 'chip-primary' : 'hover:border-primary/40',
                  )}
                >
                  {t(`feedback.${d}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="label">{t('feedback.comment')}</span>
            <textarea
              className="input"
              rows={3}
              maxLength={1000}
              value={comment}
              placeholder={t('feedback.commentPlaceholder')}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary btn-sm" disabled={submit.isPending}>
              {submit.isPending && <Loader2 size={13} className="animate-spin" />}
              {t('feedback.submit')}
            </button>
            {editing && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(false)}>
                {t('common.cancel')}
              </button>
            )}
            {submit.isError && (
              <p className="text-sm text-danger-fg" role="alert">
                {t('feedback.error')}
              </p>
            )}
          </div>
        </div>
      )}
    </form>
  );
}

function RatingButton({
  active,
  onClick,
  label,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone: 'success' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'btn-ghost btn-sm',
        active &&
          (tone === 'success'
            ? 'border-success/60 bg-success/10 text-success-fg'
            : 'border-danger/60 bg-danger/10 text-danger-fg'),
      )}
    >
      {children} {label}
    </button>
  );
}
