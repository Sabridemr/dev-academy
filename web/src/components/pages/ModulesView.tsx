'use client';

import Link from 'next/link';
import { Layers } from 'lucide-react';
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
      <ol className="relative space-y-4 border-l-2 border-border pl-6">
        {data?.map((m) => {
          const Icon = ICONS[m.icon] ?? Layers;
          const done = m.completedCount ?? 0;
          const pct = m.lessonCount ? Math.round((done / m.lessonCount) * 100) : 0;
          return (
            <li key={m.id} className="relative">
              <span className="absolute -left-[37px] top-5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-bg text-[10px] font-bold text-white" style={{ background: m.color }}>
                {m.code}
              </span>
              <Link href={`/modules/${m.id}`} className="card flex items-center gap-4 p-5 transition hover:border-primary">
                <Icon className="shrink-0" style={{ color: m.color }} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{tl(m.title)}</p>
                  <p className="text-sm text-muted">{tl(m.description)}</p>
                  {m.completedCount !== undefined && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: m.color }} />
                      </div>
                      <span className="text-xs text-muted">{t('module.completed', { done, total: m.lessonCount })}</span>
                    </div>
                  )}
                </div>
                <span className="chip">{t('home.lessons', { count: m.lessonCount })}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
