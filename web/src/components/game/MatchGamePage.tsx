'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/i18n';
import { SkeletonCard } from '../ui/Skeleton';
import { MatchGame, MatchGameIcon } from './MatchGame';

function Inner() {
  const { t } = useI18n();
  const lessonId = useSearchParams().get('lesson') ?? undefined;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="t-h1 mb-6 flex items-center gap-2">
        <MatchGameIcon /> {t('game.matchTitle')}
      </h1>
      <MatchGame lessonId={lessonId} />
    </div>
  );
}

/** useSearchParams, statik üretimde Suspense sınırı ister */
export function MatchGamePage() {
  return (
    <Suspense fallback={<SkeletonCard />}>
      <Inner />
    </Suspense>
  );
}
