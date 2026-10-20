'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
} from 'lucide-react';
import type { AdminLessonAnalytics } from '@devacademy/shared';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useI18n, type MessageKey } from '@/i18n';
import { useAdminAnalytics, useModules } from '@/lib/hooks';
import { cn, formatDuration, formatPercent } from '@/lib/utils';

/** Tamamlanma oranı bu eşiğin altındaysa satır vurgulanır */
const LOW_COMPLETION = 0.4;

/** Oran 0..1 ya da 0..100 gelebilir; her durumda yüzde döner */
function toPercent(v: number): number {
  return v <= 1 ? v * 100 : v;
}

type SortKey =
  | 'title'
  | 'started'
  | 'completed'
  | 'completionRate'
  | 'avgSecondsSpent'
  | 'quizPassRate'
  | 'feedback'
  | 'hardVotes';

const COLUMNS: { key: SortKey; label: MessageKey; numeric: boolean }[] = [
  { key: 'title', label: 'admin.colLesson', numeric: false },
  { key: 'started', label: 'admin.colStarted', numeric: true },
  { key: 'completed', label: 'admin.colCompleted', numeric: true },
  { key: 'completionRate', label: 'admin.colCompletion', numeric: true },
  { key: 'avgSecondsSpent', label: 'admin.colAvgTime', numeric: true },
  { key: 'quizPassRate', label: 'admin.colQuizPass', numeric: true },
  { key: 'feedback', label: 'admin.colFeedback', numeric: true },
  { key: 'hardVotes', label: 'admin.colHard', numeric: true },
];

export default function AdminAnalyticsPage() {
  const { t, tl, locale } = useI18n();
  const { data, isLoading, isError } = useAdminAnalytics();
  const { data: modules } = useModules();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: 'completionRate',
    dir: 1,
  });
  const [moduleId, setModuleId] = useState('');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const value = (r: AdminLessonAnalytics, key: SortKey): number | string => {
      if (key === 'title') return tl(r.title).toLocaleLowerCase(locale);
      if (key === 'feedback') return r.feedbackUp - r.feedbackDown;
      if (key === 'completionRate' || key === 'quizPassRate') return toPercent(r[key]);
      return r[key];
    };
    const q = query.trim().toLocaleLowerCase(locale);
    return (data ?? [])
      .filter((r) => !moduleId || r.moduleId === moduleId)
      .filter((r) => !q || tl(r.title).toLocaleLowerCase(locale).includes(q))
      .sort((a, b) => {
        const va = value(a, sort.key);
        const vb = value(b, sort.key);
        const c =
          typeof va === 'string' && typeof vb === 'string'
            ? va.localeCompare(vb, locale)
            : Number(va) - Number(vb);
        return c * sort.dir;
      });
  }, [data, moduleId, query, sort, locale, tl]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const moduleIds = Array.from(new Set((data ?? []).map((r) => r.moduleId)));
  const moduleLabel = (id: string) => {
    const m = modules?.find((x) => x.id === id);
    return m ? `${m.code} · ${tl(m.title)}` : id;
  };

  return (
    <div>
      <h1 className="t-h2 flex items-center gap-2">
        <BarChart3 size={20} className="text-primary" /> {t('admin.analytics')}
      </h1>
      <p className="mb-6 mt-1 text-sm text-muted">{t('admin.analyticsHint')}</p>

      {isLoading ? (
        <Skeleton className="h-80 w-full rounded-2xl" />
      ) : isError || !data?.length ? (
        <EmptyState
          className="card"
          icon={BarChart3}
          title={isError ? t('admin.analyticsError') : t('admin.analyticsEmpty')}
          description={t('admin.analyticsEmptyHint')}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              className="input max-w-xs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('admin.searchLesson')}
              aria-label={t('admin.searchLesson')}
            />
            <select
              className="input max-w-xs"
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              aria-label={t('admin.modules')}
            >
              <option value="">{t('admin.allModules')}</option>
              {moduleIds.map((id) => (
                <option key={id} value={id}>
                  {moduleLabel(id)}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">{t('admin.rows', { count: rows.length })}</span>
            <span className="chip ml-auto border-warning/40 bg-warning/10 text-warning-fg">
              <TriangleAlert size={12} /> {t('admin.lowCompletion')} &lt;{' '}
              {formatPercent(LOW_COMPLETION * 100, locale)}
            </span>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  {COLUMNS.map((c) => {
                    const active = sort.key === c.key;
                    const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
                    return (
                      <th
                        key={c.key}
                        scope="col"
                        aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                        className={cn('px-3 py-2.5 font-medium', c.numeric && 'text-right')}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className={cn(
                            'inline-flex items-center gap-1 uppercase hover:text-fg',
                            active && 'text-fg',
                          )}
                        >
                          {t(c.label)} <Icon size={12} aria-hidden="true" />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const completion = toPercent(r.completionRate);
                  const low = r.started > 0 && completion < LOW_COMPLETION * 100;
                  return (
                    <tr
                      key={r.lessonId}
                      className={cn('border-t border-border', low && 'bg-warning/5')}
                    >
                      <td className="max-w-[280px] px-3 py-2">
                        <Link
                          href={`/admin/lessons/${r.lessonId}`}
                          className="block truncate font-medium hover:text-primary"
                        >
                          {tl(r.title)}
                        </Link>
                        <span className="block truncate text-xs text-muted">
                          {moduleLabel(r.moduleId)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.started}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.completed}</td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 tabular-nums',
                            low && 'font-semibold text-warning-fg',
                          )}
                        >
                          {low && <TriangleAlert size={12} aria-label={t('admin.lowCompletion')} />}
                          {formatPercent(completion, locale)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">
                        {formatDuration(r.avgSecondsSpent, locale)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.quizAttempts > 0
                          ? formatPercent(toPercent(r.quizPassRate), locale)
                          : '—'}
                      </td>
                      <td
                        className="px-3 py-2 text-right tabular-nums"
                        aria-label={t('admin.likes', { up: r.feedbackUp, down: r.feedbackDown })}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex items-center gap-0.5 text-success-fg">
                            <ThumbsUp size={12} aria-hidden="true" /> {r.feedbackUp}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-danger-fg">
                            <ThumbsDown size={12} aria-hidden="true" /> {r.feedbackDown}
                          </span>
                        </span>
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right tabular-nums',
                          r.hardVotes > 0 && 'text-warning-fg',
                        )}
                      >
                        {r.hardVotes}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
