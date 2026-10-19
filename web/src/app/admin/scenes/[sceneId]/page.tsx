'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AnimationSceneInput } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { SceneEditor } from '@/components/admin/SceneEditor';

const NEW_SCENE: AnimationSceneInput = {
  id: 'yeni-sahne',
  title: { tr: 'Yeni sahne', en: 'New scene' },
  a11y: { description: { tr: 'Sahne açıklaması', en: 'Scene description' } },
  nodes: [
    { id: 'client', kind: 'client', label: 'Client', x: 150, y: 300 },
    { id: 'server', kind: 'server', label: 'Server', x: 650, y: 300 },
  ],
  edges: [{ id: 'c-s', from: 'client', to: 'server', kind: 'request' }],
  steps: [
    {
      id: 'step-1',
      title: { tr: 'İstek', en: 'Request' },
      narration: { tr: 'İstemci sunucuya istek gönderir.', en: 'The client sends a request.' },
      highlight: { nodes: ['client', 'server'], edges: ['c-s'] },
      packets: [{ edge: 'c-s' }],
    },
  ],
};

export default function AdminSceneEditorPage({ params }: { params: Promise<{ sceneId: string }> }) {
  const { sceneId } = use(params);
  const isNew = sceneId === 'new';
  const { t } = useI18n();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-scene', sceneId],
    queryFn: () =>
      api<{ id: string; lessonId: string | null; data: AnimationSceneInput }>(
        `/admin/scenes/${sceneId}`,
      ),
    enabled: !isNew,
  });
  if (!isNew && isLoading) return <div className="card h-96 animate-pulse" />;
  if (!isNew && !data)
    return (
      <div className="card p-6 text-sm text-danger" role="alert">
        {t('common.error')}
        {error ? `: ${(error as Error).message}` : ''}
      </div>
    );
  return (
    <SceneEditor
      initial={isNew ? NEW_SCENE : data!.data}
      lessonId={isNew ? undefined : (data?.lessonId ?? undefined)}
    />
  );
}
