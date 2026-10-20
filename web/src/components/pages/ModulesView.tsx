'use client';

import Link from 'next/link';
import { Clock, Layers } from 'lucide-react';
import { MODULE_GROUPS, type ModuleSummary } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { useModules } from '@/lib/hooks';
import { ICONS } from './HomeView';

/** Modül ağacı: her modül tamamlanma çubuğuyla birlikte */
export function ModulesView() {
  const { t, tl } = useI18n();
  const { data, isLoading, isError, refetch } = useModules();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">{t('nav.modules')}</h1>
      {isLoading && <div className="card h-40 animate-pulse" />}
      {isError && (
        <button type="button" className="btn-ghost" onClick={() => refetch()}>
          {t('common.retry')}
        </button>
      )}
      {/* Kategori başlıkları altında modüller (sıra: MODULE_GROUPS, kategori içinde modül sırası) */}
      <div className="space-y-10">
        {grouped(data).map(([group, items]) => (
          <section key={group} aria-labelledby={`group-${group}`}>
            <h2 id={`group-${group}`} className="mb-4 text-lg font-semibold text-muted">
              {t(`module.groups.${group}` as 'module.groups.ai')}
            </h2>
            <ol className="relative space-y-4 border-l-2 border-border pl-6">
              {items.map((m) => {
                const Icon = ICONS[m.icon] ?? Layers;
                const done = m.completedCount ?? 0;
                const pct = m.lessonCount ? Math.round((done / m.lessonCount) * 100) : 0;
                return (
                  <li key={m.id} className="relative">
                    <span
                      className="absolute -left-[37px] top-5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-bg text-xs font-bold text-white"
                      style={{ background: m.color }}
                    >
                      {m.code}
                    </span>
                    <Link
                      href={`/modules/${m.id}`}
                      className="card flex items-center gap-4 p-5 transition hover:border-primary"
                    >
                      <Icon className="shrink-0" style={{ color: m.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{tl(m.title)}</p>
                        <p className="text-sm text-muted">{tl(m.description)}</p>
                        {m.completedCount !== undefined && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${pct}%`, background: m.color }}
                              />
                            </div>
                            <span className="text-xs text-muted">
                              {t('module.completed', { done, total: m.lessonCount })}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="chip">{t('home.lessons', { count: m.lessonCount })}</span>
                        {m.totalMinutes > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <Clock size={12} /> {formatMinutes(m.totalMinutes, t)}
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
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

/** 90 → "1 sa 30 dk", 45 → "45 dk" */
function formatMinutes(
  total: number,
  t: (key: 'module.totalTime' | 'module.minutes', params: Record<string, number>) => string,
): string {
  const hours = Math.floor(total / 60);
  return hours
    ? t('module.totalTime', { hours, minutes: total % 60 })
    : t('module.minutes', { count: total });
}
