'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BriefcaseBusiness,
  CalendarDays,
  Goal,
  Snowflake,
  Sparkles,
} from 'lucide-react';
import { STREAK_FREEZE_MAX, type ProgressSummary } from '@devacademy/shared';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton } from '@/components/ui/Skeleton';
import { useI18n } from '@/i18n';
import { dailyGoalProgress, summaryLevel } from '@/lib/gamification';
import { useActivity, useCertificates } from '@/lib/hooks';
import { formatDate, formatPercent } from '@/lib/utils';
import { ActivityHeatmap } from './ActivityHeatmap';

/** Seviye + XP çubuğu (levelForXp kuralları) */
export function XpCard({ summary }: { summary: ProgressSummary }) {
  const { t, locale } = useI18n();
  const lv = summaryLevel(summary);
  if (!lv) return null;
  const pct = Math.round(lv.progress * 100);
  const maxed = lv.progress >= 1;
  return (
    <section className="card bg-glow p-5">
      <p className="t-eyebrow flex items-center gap-1.5">
        <Sparkles size={13} className="text-primary" /> {t('dashboard.xpTitle')}
      </p>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className="text-3xl font-bold tracking-tight">
          {t('dashboard.level', { level: lv.level })}
        </p>
        <p className="text-xs tabular-nums text-muted">
          {t('dashboard.totalXp', { xp: lv.xp.toLocaleString(locale) })}
        </p>
      </div>
      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-elevated"
        role="progressbar"
        aria-label={t('dashboard.xpProgress')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={formatPercent(pct, locale)}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: 'var(--da-gradient)' }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        {maxed
          ? t('dashboard.maxLevel')
          : t('dashboard.xpToNext', {
              remaining: Math.max(0, lv.xpForNextLevel - lv.xpIntoLevel),
              next: lv.level + 1,
            })}
      </p>
    </section>
  );
}

/** Bugün/hedef halkası; hedef yoksa ayarlara yönlendirir */
export function DailyGoalCard({ summary }: { summary: ProgressSummary }) {
  const { t, locale } = useI18n();
  const { minutes, goal, percent } = dailyGoalProgress(summary);
  return (
    <section className="card flex items-center gap-4 p-5">
      <ProgressRing
        percent={percent}
        size={76}
        color={percent >= 100 ? 'var(--da-success)' : 'var(--da-accent)'}
        label={
          goal
            ? `${t('dashboard.dailyGoal')}: ${t('dashboard.goalProgress', { done: minutes, goal })}`
            : t('dashboard.noGoal')
        }
      >
        {goal ? formatPercent(percent, locale) : <Goal size={20} className="text-muted" />}
      </ProgressRing>
      <div className="min-w-0">
        <p className="t-eyebrow">{t('dashboard.dailyGoal')}</p>
        {goal ? (
          <>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {t('dashboard.goalProgress', { done: minutes, goal })}
            </p>
            <p className="text-xs text-muted">
              {minutes >= goal
                ? t('dashboard.goalMet')
                : t('dashboard.goalRemaining', { count: goal - minutes })}
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm">{t('dashboard.todayMinutes', { count: minutes })}</p>
            <Link href="/settings" className="btn-soft btn-sm mt-2">
              {t('dashboard.setGoal')}
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

/** Seri dondurma hakkı (seri kartının alt bilgisi) */
export function StreakFreezeHint({ summary }: { summary: ProgressSummary }) {
  const { t } = useI18n();
  if (typeof summary.streakFreezes !== 'number') return null;
  return (
    <p
      className="mt-2 flex items-center gap-1 text-xs text-muted"
      title={t('dashboard.freezesHint', { max: STREAK_FREEZE_MAX })}
    >
      <Snowflake size={12} className="text-accent-fg" />
      {t('dashboard.freezes', { count: summary.streakFreezes })}
      <span className="sr-only">. {t('dashboard.freezesHint', { max: STREAK_FREEZE_MAX })}</span>
    </p>
  );
}

export function ActivitySection() {
  const { t } = useI18n();
  const { data, isLoading, isError } = useActivity(365);
  return (
    <section className="card mt-6 p-5">
      <h2 className="t-h3 mb-3 flex items-center gap-2">
        <CalendarDays size={16} className="text-muted" /> {t('activity.title')}
      </h2>
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : isError ? (
        <p className="text-sm text-muted">{t('activity.error')}</p>
      ) : (
        <ActivityHeatmap activity={data ?? []} />
      )}
    </section>
  );
}

export function CertificatesPanel() {
  const { t, tl, locale } = useI18n();
  const { data, isLoading, isError } = useCertificates();
  const list = data ?? [];
  return (
    <section className="card p-5">
      <h2 className="t-h3 mb-4 flex items-center gap-2">
        <Award size={16} className="text-warning-fg" /> {t('dashboard.certificates')}
        {list.length > 0 && (
          <Link href="/certificates" className="btn-link ml-auto text-xs">
            {t('dashboard.allCertificates')} <ArrowRight size={12} />
          </Link>
        )}
      </h2>
      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : isError || list.length === 0 ? (
        <EmptyState compact icon={Award} title={t('dashboard.certificatesEmpty')} />
      ) : (
        <ul className="space-y-2">
          {list.slice(0, 3).map((c) => (
            <li key={c.id}>
              <Link
                href={`/certificates/${c.publicId}`}
                className="flex items-center gap-3 rounded-xl border border-border p-3 transition hover:border-primary/60"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning-fg">
                  <Award size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{tl(c.title)}</span>
                  <span className="block text-xs text-muted">
                    {t('certificates.issuedAt', { date: formatDate(c.issuedAt, locale) })}
                  </span>
                </span>
                <ArrowRight size={14} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ExamCta() {
  const { t } = useI18n();
  return (
    <section className="card flex flex-col justify-between gap-3 p-5">
      <div>
        <p className="t-eyebrow flex items-center gap-1.5">
          <BriefcaseBusiness size={13} className="text-primary" /> {t('dashboard.examTitle')}
        </p>
        <p className="mt-2 text-sm text-muted">{t('dashboard.examText')}</p>
      </div>
      <Link href="/exam" className="btn-primary self-start">
        {t('dashboard.examCta')} <ArrowRight size={15} />
      </Link>
    </section>
  );
}
