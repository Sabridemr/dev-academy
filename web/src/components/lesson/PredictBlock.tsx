'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { CheckCircle2, CircleHelp, RotateCcw, XCircle } from 'lucide-react';
import type { LessonBlock } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Markdown } from './Markdown';

type PredictBlockData = Extract<LessonBlock, { type: 'predict' }>;

/**
 * Tahmin sorusu (predict-observe-explain): animasyon/simülatörden önce öğrencinin tahminini alır.
 * Puanlanmaz, sunucuya gönderilmez, ilerlemeyi etkilemez; seçimden sonra doğru cevap ve açıklama
 * gösterilir. Seçenekler düğmedir (Tab/Enter/Boşluk); ok tuşları seçenekler arasında odak gezdirir.
 * Hareket azaltma tercihinde renk geçişi ve açıklamanın kayarak gelişi kapatılır.
 */
export function PredictBlock({ block }: { block: PredictBlockData }) {
  const { t, tl } = useI18n();
  const reduced = usePrefersReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const answered = selected !== null;
  const isCorrect = selected === block.correct;
  const correctIndex = block.options.findIndex((o) => o.id === block.correct);
  const correctOption = block.options[correctIndex];
  const letter = (i: number) => String.fromCharCode(65 + i);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? -1
          : 0;
    if (!delta) return;
    e.preventDefault();
    const n = block.options.length;
    optionRefs.current[(i + delta + n) % n]?.focus();
  };

  const retry = () => {
    setSelected(null);
    // Yeniden deneme düğmesi kaybolunca odak ilk seçeneğe döner
    optionRefs.current[0]?.focus();
  };

  const promptId = `${block.id}-prompt`;
  return (
    <section
      className="rounded-2xl border border-primary/40 bg-primary/5 p-5"
      aria-labelledby={promptId}
      data-block="predict"
    >
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
        <CircleHelp size={16} aria-hidden /> {t('lesson.predict.label')}
        <span className="ml-auto text-xs font-normal text-muted">
          {t('lesson.predict.notScored')}
        </span>
      </p>
      <div id={promptId}>
        <Markdown className="max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          {tl(block.prompt)}
        </Markdown>
      </div>
      {!answered && <p className="mt-2 text-xs text-muted">{t('lesson.predict.hint')}</p>}
      <div role="group" aria-labelledby={promptId} className="mt-3 grid gap-2">
        {block.options.map((o, i) => {
          const chosen = selected === o.id;
          const right = o.id === block.correct;
          return (
            <button
              key={o.id}
              ref={(el) => {
                optionRefs.current[i] = el;
              }}
              type="button"
              aria-pressed={chosen}
              aria-disabled={answered}
              onClick={() => !answered && setSelected(o.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              data-state={answered ? (right ? 'correct' : chosen ? 'wrong' : 'idle') : 'idle'}
              className={cn(
                'flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                !reduced && 'transition-colors',
                !answered && 'border-border bg-surface hover:bg-elevated',
                answered && right && 'border-success bg-success/10',
                answered && chosen && !right && 'border-danger bg-danger/10',
                answered && !chosen && !right && 'border-border bg-surface opacity-70',
              )}
            >
              <span className="font-mono text-xs font-semibold text-muted" aria-hidden>
                {letter(i)}
              </span>
              <span className="flex-1">{tl(o.text)}</span>
              {answered && right && (
                <CheckCircle2 className="mt-0.5 shrink-0 text-success" size={16} aria-hidden />
              )}
              {answered && chosen && !right && (
                <XCircle className="mt-0.5 shrink-0 text-danger" size={16} aria-hidden />
              )}
            </button>
          );
        })}
      </div>
      <div aria-live="polite">
        {answered && (
          <div
            className={cn('mt-4 border-t border-border pt-3', !reduced && 'animate-fade-up')}
            data-testid="predict-feedback"
          >
            <p className={cn('text-sm font-semibold', isCorrect ? 'text-success' : 'text-danger')}>
              {isCorrect
                ? t('lesson.predict.correct')
                : t('lesson.predict.incorrect', {
                    answer: `${letter(correctIndex)}) ${correctOption ? tl(correctOption.text) : ''}`,
                  })}
            </p>
            {block.explanation && (
              <Markdown className="mt-1 max-w-none text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                {tl(block.explanation)}
              </Markdown>
            )}
            <button
              type="button"
              onClick={retry}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <RotateCcw size={12} aria-hidden /> {t('lesson.predict.retry')}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
