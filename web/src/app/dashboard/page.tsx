'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  ListChecks,
  Lock,
  Repeat,
  Route,
  Target,
} from 'lucide-react';
import type { BadgeDto, ModuleSummary, ProgressSummary } from '@devacademy/shared';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { BadgeIcon } from '@/components/ui/BadgeIcon';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/lib/auth-store';
import { useBadgeCatalog, useModules, useProgressSummary } from '@/lib/hooks';
import { cn, formatDate, formatDuration, formatPercent } from '@/lib/utils';

function Dashboard() {
  const { t, tl, locale } = useI18n();
  const user = useAuthStore((s) => s.user);
  const { data: s, isLoading } = useProgressSummary();
  const { data: modules } = useModules();
  const { data: catalog } = useBadgeCatalog();

  if (isLoading || !s)
    return (
      <div className="mx-auto max-w-6xl px-4 py-10" aria-busy="true">
        <Skeleton className="h-9 w-48" />
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <Skeleton className="mt-6 h-40 w-full rounded-2xl" />
      </div>
    );

  const isNew = s.completedLessons === 0;
  const perModule = sortPerModule(s, modules);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-h1">{t('dashboard.title')}</h1>
          <p className="mt-1 text-muted">{t('dashboard.subtitle')}</p>
        </div>
        {s.dueReviews > 0 && (
          <Link href="/review" className="btn-primary">
            <Repeat size={16} /> {t('dashboard.dueReviews', { count: s.dueReviews })}
          </Link>
        )}
      </div>

      {/* Devam et / başlangıç görevleri: en üstte, asıl eylem */}
      {s.continueLesson ? (
        <Link
          href={`/lessons/${s.continueLesson.id}`}
          className="card card-hover bg-glow mb-6 flex items-center justify-between gap-4 p-6"
        >
          <div className="min-w-0">
            <p className="t-eyebrow flex items-center gap-1.5">
              <Target size={12} className="text-primary" /> {t('dashboard.continue')}
            </p>
            <p className="t-h3 mt-1 truncate">{tl(s.continueLesson.title)}</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 w-64 max-w-full overflow-hidden rounded-full bg-elevated">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${s.continueLesson.percent}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-muted">
                {formatPercent(s.continueLesson.percent, locale)}
              </span>
            </div>
          </div>
          <span className="btn-primary shrink-0">
            {t('home.continue')} <ArrowRight size={16} />
          </span>
        </Link>
      ) : (
        isNew && <GettingStarted summary={s} hasPath={Boolean(user?.selectedPathId)} />
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label={t('dashboard.completion')} className="flex items-center gap-4">
          <ProgressRing
            percent={s.completionPercent}
            size={72}
            label={`${t('dashboard.completion')} ${formatPercent(s.completionPercent, locale)}`}
          >
            {formatPercent(s.completionPercent, locale)}
          </ProgressRing>
          <div>
            <p className="text-2xl font-bold tabular-nums">
              {s.completedLessons}
              <span className="text-base font-normal text-muted">/{s.totalLessons}</span>
            </p>
            <p className="text-xs text-muted">{t('home.statsLessons')}</p>
          </div>
        </StatCard>
        <StatCard
          icon={Flame}
          tone={s.activeToday ? 'accent' : undefined}
          label={t('dashboard.streak')}
          value={t('dashboard.days', { count: s.currentStreak })}
          hint={t('dashboard.longest', { count: s.longestStreak })}
        />
        <StatCard
          icon={Clock}
          label={t('dashboard.timeSpent')}
          value={formatDuration(s.totalSecondsSpent, locale)}
        />
        <StatCard icon={Repeat} label={t('nav.review')}>
          <p className="mt-2 text-sm">
            {s.dueReviews > 0
              ? t('dashboard.dueReviews', { count: s.dueReviews })
              : t('dashboard.noReviews')}
          </p>
          {s.dueReviews === 0 && s.nextReviewAt && (
            <p className="mt-1 text-xs text-muted">
              {t('dashboard.nextReview', { date: formatDate(s.nextReviewAt, locale) })}
            </p>
          )}
          {s.dueReviews > 0 && (
            <Link href="/review" className="btn-soft btn-sm mt-3">
              {t('dashboard.startReview')} <ArrowRight size={13} />
            </Link>
          )}
        </StatCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="card p-5">
          <h2 className="t-h3 mb-4 flex items-center gap-2">
            <BookOpen size={16} className="text-muted" /> {t('dashboard.perModule')}
          </h2>
          <ul className="space-y-3">
            {perModule.map(({ pm, m }) => {
              const pct = pm.total ? Math.round((pm.completed / pm.total) * 100) : 0;
              return (
                <li key={pm.moduleId}>
                  <Link href={`/modules/${pm.moduleId}`} className="group block">
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                          style={{ background: m?.color ?? 'var(--da-primary)' }}
                        >
                          {m?.code ?? '?'}
                        </span>
                        <span className="truncate group-hover:text-primary">
                          {m ? tl(m.title) : pm.moduleId}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        {t('dashboard.lessonsDone', { done: pm.completed, total: pm.total })}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-elevated">
                      <div
                        className="h-full rounded-full transition-[width]"
                        style={{ width: `${pct}%`, background: m?.color ?? 'var(--da-primary)' }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
        <BadgesPanel earned={s.badges} catalog={catalog ?? []} />
      </div>
    </div>
  );
}

/** Modül özetlerini müfredat sırasına (A, B, C…) göre diz; backend groupBy sırası belirsiz */
function sortPerModule(s: ProgressSummary, modules: ModuleSummary[] | undefined) {
  const byId = new Map((modules ?? []).map((m) => [m.id, m]));
  return s.perModule
    .map((pm) => ({ pm, m: byId.get(pm.moduleId) }))
    .sort((a, b) => (a.m?.order ?? 999) - (b.m?.order ?? 999));
}

function GettingStarted({ summary, hasPath }: { summary: ProgressSummary; hasPath: boolean }) {
  const { t } = useI18n();
  const tasks = [
    { done: hasPath, label: t('dashboard.taskPickPath'), href: '/onboarding', icon: Route },
    {
      done: summary.completedLessons > 0,
      label: t('dashboard.taskFirstLesson'),
      href: '/modules',
      icon: BookOpen,
    },
    {
      done: summary.badges.length > 0,
      label: t('dashboard.taskFirstQuiz'),
      href: '/modules',
      icon: ListChecks,
    },
  ];
  return (
    <section className="card bg-glow mb-6 p-6">
      <p className="t-eyebrow">{t('dashboard.gettingStarted')}</p>
      <p className="mt-1 text-sm text-muted">{t('dashboard.gettingStartedHint')}</p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {tasks.map((task) => (
          <li key={task.label}>
            <Link
              href={task.href}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-3 text-sm transition hover:border-primary/60',
                task.done ? 'border-success/40 bg-success/5' : 'border-border bg-surface',
              )}
            >
              {task.done ? (
                <CheckCircle2 size={18} className="shrink-0 text-success-fg" />
              ) : (
                <Circle size={18} className="shrink-0 text-muted" />
              )}
              <span className={cn('flex-1', task.done && 'line-through opacity-70')}>
                {task.label}
              </span>
              <task.icon size={15} className="text-muted" />
            </Link>
          </li>
        ))}
      </ol>
      <Link href="/modules" className="btn-primary mt-4">
        {t('dashboard.pickLesson')} <ArrowRight size={16} />
      </Link>
    </section>
  );
}

function BadgesPanel({ earned, catalog }: { earned: BadgeDto[]; catalog: BadgeDto[] }) {
  const { t, tl, locale } = useI18n();
  const earnedIds = new Set(earned.map((b) => b.id));
  const locked = catalog.filter((b) => !earnedIds.has(b.id));
  return (
    <section className="card p-5">
      <h2 className="t-h3 mb-4 flex items-center gap-2">
        <Award size={16} className="text-warning-fg" /> {t('dashboard.badges')}
        <span className="chip ml-auto">
          {earned.length}/{catalog.length || earned.length}
        </span>
      </h2>
      {earned.length === 0 && catalog.length === 0 && (
        <p className="text-sm text-muted">{t('dashboard.noBadges')}</p>
      )}
      {earned.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {earned.map((b) => (
            <li
              key={b.id}
              className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-center"
              title={b.earnedAt ? formatDate(b.earnedAt, locale) : undefined}
            >
              <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-warning/15 text-warning-fg">
                <BadgeIcon icon={b.icon} />
              </span>
              <p className="mt-2 text-sm font-semibold">{tl(b.title)}</p>
              <p className="text-xs text-muted">{tl(b.description)}</p>
            </li>
          ))}
        </ul>
      )}
      {locked.length > 0 && (
        <>
          <p className="t-eyebrow mb-2 mt-5">{t('dashboard.lockedBadges')}</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {locked.map((b) => (
              <li
                key={b.id}
                className="flex items-start gap-2 rounded-xl border border-dashed border-border p-2.5 opacity-80"
                title={t('dashboard.badgeLocked')}
              >
                <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-muted">
                  <BadgeIcon icon={b.icon} size={15} />
                  <Lock
                    size={9}
                    className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{tl(b.title)}</span>
                  <span className="block text-xs leading-4 text-muted">{tl(b.description)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}
