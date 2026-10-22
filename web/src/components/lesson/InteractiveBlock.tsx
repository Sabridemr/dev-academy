'use client';

import { useMemo, useState } from 'react';
import type { CodeTrace, InteractiveType, LocalizedString } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { useTrackInteractive } from '@/lib/hooks';
import { SIMULATORS } from '../simulators/registry';
import { SimContext, type SimContextValue } from '../simulators/sim-context';

/**
 * Ders içindeki interaktif blok. Başlık, yönerge ve "baştan kur" SimShell'e context ile geçer;
 * baştan kurma simülatörü `key` ile yeniden kurar (her simülatörün kendi state'i sıfırlanır).
 */
export function InteractiveBlock({
  type,
  params,
  title,
  instructions,
  lessonId,
  trace,
}: {
  type: InteractiveType;
  params: Record<string, unknown>;
  title?: LocalizedString;
  instructions?: LocalizedString;
  lessonId?: string;
  /** İz kullanan simülatörler için (predict-run) */
  trace?: CodeTrace;
}) {
  const { t, tl } = useI18n();
  const track = useTrackInteractive(type, lessonId);
  const Sim = SIMULATORS[type];
  const [epoch, setEpoch] = useState(0);
  const ctx = useMemo<SimContextValue>(
    () => ({
      title: title ? tl(title) : undefined,
      goal: instructions ? tl(instructions) : undefined,
      onReset: () => setEpoch((e) => e + 1),
    }),
    [title, instructions, tl],
  );

  return (
    <section aria-label={title ? tl(title) : type}>
      {Sim ? (
        <SimContext.Provider value={ctx}>
          <Sim key={epoch} params={params} lessonId={lessonId} onInteract={track} trace={trace} />
        </SimContext.Provider>
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
