'use client';

import { MODULE_GROUPS, type ModuleSummary } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { useModules } from '@/lib/hooks';
import { EmptyState } from '../ui/EmptyState';
import { SkeletonCard } from '../ui/Skeleton';
import { ModuleCard } from '../home/Sections';

/** Modül kataloğu: kategori başlıkları altında kartlar, oturumluysa ilerleme çubuğuyla */
export function ModulesView() {
  const { t } = useI18n();
  const { data, isLoading, isError, refetch } = useModules();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-10 max-w-2xl">
        <h1 className="t-h1">{t('nav.modules')}</h1>
        <p className="mt-2 text-muted">{t('home.modulesSubtitle')}</p>
      </div>
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}
      {isError && (
        <EmptyState
          title={t('common.error')}
          action={
            <button type="button" className="btn-ghost" onClick={() => refetch()}>
              {t('common.retry')}
            </button>
          }
        />
      )}
      <div className="space-y-14">
        {grouped(data).map(([group, items]) => (
          <section key={group} aria-labelledby={`group-${group}`}>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 id={`group-${group}`} className="t-h2">
                  {t(`module.groups.${group}` as 'module.groups.ai')}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {t(`module.groupDescriptions.${group}` as 'module.groupDescriptions.ai')}
                </p>
              </div>
              <span className="chip">
                {t('home.modulesCount', { count: items.length })} ·{' '}
                {t('home.lessons', { count: items.reduce((a, m) => a + m.lessonCount, 0) })}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((m) => (
                <ModuleCard key={m.id} module={m} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function grouped(
  modules: ModuleSummary[] | undefined,
): [ModuleSummary['group'], ModuleSummary[]][] {
  return MODULE_GROUPS.map((g): [ModuleSummary['group'], ModuleSummary[]] => [
    g,
    (modules ?? []).filter((m) => m.group === g),
  ]).filter(([, items]) => items.length > 0);
}
