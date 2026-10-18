'use client';

import { FlaskConical } from 'lucide-react';
import type { InteractiveType, LocalizedString } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { useTrackInteractive } from '@/lib/hooks';
import { SIMULATORS } from '../simulators/registry';

export function InteractiveBlock({
  type,
  params,
  title,
  instructions,
  lessonId,
}: {
  type: InteractiveType;
  params: Record<string, unknown>;
  title?: LocalizedString;
  instructions?: LocalizedString;
  lessonId?: string;
}) {
  const { t, tl } = useI18n();
  const track = useTrackInteractive(type, lessonId);
  const Sim = SIMULATORS[type];

  return (
    <section className="space-y-3" aria-label={title ? tl(title) : type}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <FlaskConical size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold">{title ? tl(title) : t('module.hasInteractive')}</p>
          {instructions && <p className="text-sm text-muted">{tl(instructions)}</p>}
        </div>
      </div>
      {Sim ? (
        <Sim params={params} lessonId={lessonId} onInteract={track} />
      ) : (
        <div className="card p-4 text-sm text-muted">
          <p>{t('sim.unsupported')}</p>
          <p className="mt-2 font-mono text-xs">
            {type} · {t('sim.params')}: {JSON.stringify(params)}
          </p>
        </div>
      )}
    </section>
  );
}
