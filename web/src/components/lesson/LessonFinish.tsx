'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Layers, PartyPopper } from 'lucide-react';
import type { LessonDetail } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { cn } from '@/lib/utils';

/**
 * Ders sonu kartı: tamamlama düğmesi, tamamlanınca kutlama ve sıradaki ders.
 * İçerikteki `:::next` bloğunun notu da burada gösterilir (tek bitiş noktası).
 */
export function LessonFinish({
  lesson,
  completed,
  authed,
  pending,
  onComplete,
}: {
  lesson: LessonDetail;
  completed: boolean;
  authed: boolean;
  pending: boolean;
  onComplete: () => void;
}) {
  const { t, tl } = useI18n();
  const reduced = usePrefersReducedMotion();
  const nextBlock = lesson.blocks.find((b) => b.type === 'next');
  const note = nextBlock && nextBlock.type === 'next' && nextBlock.note ? tl(nextBlock.note) : null;

  return (
    <section
      className={cn(
        'relative mt-12 overflow-hidden rounded-3xl border p-6 sm:p-8',
        completed ? 'border-success/40 bg-success/5' : 'border-border bg-surface',
      )}
      aria-live="polite"
    >
      {completed && !reduced && <Confetti />}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="t-eyebrow flex items-center gap-1.5">
            {completed ? (
              <PartyPopper size={13} className="text-success-fg" />
            ) : (
              <CheckCircle2 size={13} />
            )}
            {completed ? t('lesson.finishTitle') : t('lesson.finishPrompt')}
          </p>
          <h2 className="t-h2 mt-2">{completed ? t('lesson.completed') : tl(lesson.title)}</h2>
          <p className="mt-2 max-w-prose text-sm text-muted">
            {completed ? t('lesson.finishText') : (note ?? t('lesson.finishHint'))}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {authed && !completed && (
            <button
              type="button"
              className="btn-primary btn-lg"
              onClick={onComplete}
              disabled={pending}
            >
              <CheckCircle2 size={18} /> {t('lesson.markComplete')}
            </button>
          )}
          {lesson.next ? (
            <Link
              href={`/lessons/${lesson.next.id}`}
              className={cn('btn-lg', completed || !authed ? 'btn-primary' : 'btn-ghost')}
            >
              {t('lesson.nextLesson')}: {tl(lesson.next.title)} <ArrowRight size={16} />
            </Link>
          ) : (
            <Link href={`/modules/${lesson.module.id}`} className="btn-ghost btn-lg">
              <Layers size={16} /> {t('lesson.backToModule')}
            </Link>
          )}
        </div>
      </div>
      {!lesson.next && completed && (
        <p className="mt-4 text-sm text-muted">{t('lesson.moduleDone')}</p>
      )}
    </section>
  );
}

const PIECES = Array.from({ length: 14 }, (_, i) => i);

/** Hafif, bir kez oynayan konfeti (CSS/Framer; harici kütüphane yok) */
function Confetti() {
  const colors = [
    'var(--da-primary)',
    'var(--da-accent)',
    'var(--da-success)',
    'var(--da-warning)',
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {PIECES.map((i) => (
        <motion.span
          key={i}
          className="absolute top-0 block h-2 w-2 rounded-sm"
          style={{
            left: `${6 + (i * 88) / PIECES.length}%`,
            background: colors[i % colors.length],
          }}
          initial={{ y: -10, opacity: 0, rotate: 0 }}
          animate={{ y: 260, opacity: [0, 1, 1, 0], rotate: 360 + i * 40 }}
          transition={{ duration: 1.6 + (i % 4) * 0.2, delay: (i % 5) * 0.08, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}
