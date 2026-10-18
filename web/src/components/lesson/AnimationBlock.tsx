'use client';

import type { LocalizedString } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { useScene } from '@/lib/hooks';
import { ScenePlayer } from '../scene/ScenePlayer';

export function AnimationBlock({ sceneId, caption }: { sceneId?: string; caption?: LocalizedString }) {
  const { t, tl } = useI18n();
  const { data, isLoading, isError, refetch } = useScene(sceneId);
  if (!sceneId) return null;
  if (isLoading) return <div className="card flex h-72 items-center justify-center text-sm text-muted" aria-busy="true">{t('lesson.loadingScene')}</div>;
  if (isError || !data)
    return (
      <div className="card flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted">
        {t('lesson.sceneError')}
        <button type="button" className="btn-ghost" onClick={() => refetch()}>
          {t('common.retry')}
        </button>
      </div>
    );
  return <ScenePlayer scene={data.scene} caption={caption ? tl(caption) : undefined} />;
}
