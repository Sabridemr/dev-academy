'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ListChecks,
  Repeat,
  XCircle,
} from 'lucide-react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { useI18n } from '@/i18n';
import { useAttempts, useExams, type AttemptSummaryDto } from '@/lib/hooks';
import { cn, formatDate, formatDuration, formatPercent } from '@/lib/utils';

interface LessonRow {
  title: AttemptSummaryDto['quizTitle'];
  lessonId: string;
  best: number;
  count: number;
  passed: boolean;
}

function History() {
  const { t, tl, locale } = useI18n();
  const { data, isLoading } = useAttempts();

  const stats = useMemo(() => {
    const list = data ?? [];
    const passed = list.filter((a) => a.passed).length;
    const avg = list.length ? Math.round(list.reduce((s, a) => s + a.score, 0) / list.length) : 0;
    const best = list.reduce((m, a) => Math.max(m, a.score), 0);
    // Derse göre: en iyi puan ve deneme sayısı
    const byLesson = new Map<string, LessonRow>();
    for (const a of list) {
      const cur = byLesson.get(a.lessonId);
      if (cur) {
        cur.best = Math.max(cur.best, a.score);
        cur.count += 1;
        cur.passed = cur.passed || a.passed;
      } else
        byLesson.set(a.lessonId, {
          title: a.quizTitle,
          lessonId: a.lessonId,
          best: a.score,
          count: 1,
          passed: a.passed,
        });
    }
    return { count: list.length, passed, avg, best, byLesson: Array.from(byLesson.values()) };
  }, [data]);

  if (isLoading)
    return (
      <div className="grid gap-4 md:grid-cols-4" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  if (!data?.length)
    return (
      <EmptyState
        icon={ListChecks}
        title={t('history.empty')}
        description={t('history.emptyHint')}
        action={
          <Link href="/modules" className="btn-primary">
            {t('nav.modules')} <ArrowRight size={16} />
          </Link>
        }
        className="card"
      />
    );

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={ListChecks} label={t('history.attempts')} value={stats.count} />
        <StatCard
          icon={CheckCircle2}
          tone="success"
          label={t('history.passRate')}
          value={formatPercent(stats.count ? (stats.passed / stats.count) * 100 : 0, locale)}
        />
        <StatCard label={t('history.avgScore')} value={formatPercent(stats.avg, locale)} />
        <StatCard label={t('history.best')} value={formatPercent(stats.best, locale)} />
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <Repeat size={12} /> {t('history.weakHint')}{' '}
        <Link href="/review" className="btn-link text-xs">
          {t('nav.review')}
        </Link>
      </p>

      <section className="card mt-6 p-5">
        <h2 className="t-h3 mb-3">{t('history.byLesson')}</h2>
        <ul className="divide-y divide-border">
          {stats.byLesson.map((l) => (
            <li key={l.lessonId} className="flex items-center gap-3 py-2.5">
              {l.passed ? (
                <CheckCircle2 size={16} className="shrink-0 text-success-fg" />
              ) : (
                <XCircle size={16} className="shrink-0 text-danger-fg" />
              )}
              <Link
                href={`/lessons/${l.lessonId}`}
                className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary"
              >
                {tl(l.title)}
              </Link>
              <span className="text-xs text-muted">×{l.count}</span>
              <span
                className={cn(
                  'chip tabular-nums',
                  l.passed
                    ? 'border-success/40 text-success-fg'
                    : 'border-danger/40 text-danger-fg',
                )}
              >
                {t('history.best')}: {formatPercent(l.best, locale)}
              </span>
              <Link
                href={`/lessons/${l.lessonId}`}
                className="btn-ghost btn-sm hidden sm:inline-flex"
              >
                {t('history.retake')}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="card mt-6 overflow-x-auto p-5">
        <h2 className="t-h3 mb-3">{t('history.allAttempts')}</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="py-2 pr-3 font-medium">{t('history.colQuiz')}</th>
              <th className="py-2 pr-3 font-medium">{t('history.colScore')}</th>
              <th className="py-2 pr-3 font-medium">{t('history.colCorrect')}</th>
              <th className="py-2 pr-3 font-medium">{t('history.colDuration')}</th>
              <th className="py-2 font-medium">{t('history.colLesson')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="py-2 pr-3">
                  <span className="block">{tl(a.quizTitle)}</span>
                  <span className="block text-xs text-muted">
                    {formatDate(a.createdAt, locale)}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={cn(
                      'chip tabular-nums',
                      a.passed
                        ? 'border-success/40 text-success-fg'
                        : 'border-danger/40 text-danger-fg',
                    )}
                  >
                    {formatPercent(a.score, locale)} ·{' '}
                    {a.passed ? t('history.passed') : t('history.failed')}
                  </span>
                </td>
                <td className="py-2 pr-3 tabular-nums text-muted">
                  {t('history.correctOf', { correct: a.correctCount, total: a.totalCount })}
                </td>
                <td className="py-2 pr-3 tabular-nums text-muted">
                  {t('history.duration', { seconds: Math.round(a.durationMs / 1000) })}
                </td>
                <td className="py-2">
                  <Link href={`/lessons/${a.lessonId}`} className="btn-link text-xs">
                    {t('review.goToLesson')} <ArrowRight size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

/** Mülakat modu sınavları (GET /exams) */
function ExamHistory() {
  const { t, locale } = useI18n();
  const { data, isLoading, isError } = useExams();
  if (isLoading)
    return (
      <div className="grid gap-4 md:grid-cols-3" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  if (isError || !data?.length)
    return (
      <EmptyState
        icon={BriefcaseBusiness}
        title={isError ? t('history.examsError') : t('history.examsEmpty')}
        description={t('history.examsEmptyHint')}
        action={
          <Link href="/exam" className="btn-primary">
            {t('history.startExam')} <ArrowRight size={16} />
          </Link>
        }
        className="card"
      />
    );
  const done = data.filter((e) => typeof e.score === 'number');
  const passed = done.filter((e) => e.passed).length;
  const best = done.reduce((m, e) => Math.max(m, e.score ?? 0), 0);
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={BriefcaseBusiness} label={t('history.tabExams')} value={data.length} />
        <StatCard
          icon={CheckCircle2}
          tone="success"
          label={t('history.passRate')}
          value={formatPercent(done.length ? (passed / done.length) * 100 : 0, locale)}
        />
        <StatCard label={t('history.best')} value={formatPercent(best, locale)} />
      </div>
      <section className="card mt-6 overflow-x-auto p-5">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="py-2 pr-3 font-medium">{t('history.colDate')}</th>
              <th className="py-2 pr-3 font-medium">{t('history.colScore')}</th>
              <th className="py-2 pr-3 font-medium">{t('history.colCorrect')}</th>
              <th className="py-2 font-medium">{t('history.colDuration')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="py-2 pr-3">{formatDate(e.submittedAt ?? e.startedAt, locale)}</td>
                <td className="py-2 pr-3">
                  {typeof e.score === 'number' ? (
                    <span
                      className={cn(
                        'chip tabular-nums',
                        e.passed
                          ? 'border-success/40 text-success-fg'
                          : 'border-danger/40 text-danger-fg',
                      )}
                    >
                      {formatPercent(e.score, locale)} ·{' '}
                      {e.passed ? t('history.passed') : t('history.failed')}
                    </span>
                  ) : (
                    <span className="chip">{t('history.examInProgress')}</span>
                  )}
                </td>
                <td className="py-2 pr-3 tabular-nums text-muted">
                  {typeof e.correctCount === 'number'
                    ? t('history.correctOf', { correct: e.correctCount, total: e.totalCount })
                    : t('exam.questions', { count: e.totalCount })}
                </td>
                <td className="py-2 tabular-nums text-muted">
                  {e.durationSec ? formatDuration(e.durationSec, locale) : t('exam.noLimit')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

type Tab = 'quizzes' | 'exams';

function HistoryTabs() {
  const { t } = useI18n();
  const initial = useSearchParams().get('tab') === 'exams' ? 'exams' : 'quizzes';
  const [tab, setTab] = useState<Tab>(initial);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'quizzes', label: t('history.tabQuizzes') },
    { id: 'exams', label: t('history.tabExams') },
  ];
  return (
    <>
      <div
        role="tablist"
        aria-label={t('history.tabs')}
        className="mb-6 inline-flex gap-1 rounded-xl border border-border bg-elevated p-1"
      >
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            id={`tab-${x.id}`}
            aria-selected={tab === x.id}
            aria-controls={`panel-${x.id}`}
            onClick={() => setTab(x.id)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm transition',
              tab === x.id ? 'bg-surface font-medium shadow-card' : 'text-muted hover:text-fg',
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'quizzes' ? <History /> : <ExamHistory />}
      </div>
    </>
  );
}

export default function HistoryPage() {
  const { t } = useI18n();
  return (
    <RequireAuth>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8">
          <h1 className="t-h1">{t('history.title')}</h1>
          <p className="mt-1 text-muted">{t('history.subtitle')}</p>
        </div>
        <Suspense>
          <HistoryTabs />
        </Suspense>
      </div>
    </RequireAuth>
  );
}
