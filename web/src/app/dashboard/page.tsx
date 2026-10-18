'use client';

import Link from 'next/link';
import { ArrowRight, Award, Clock, Flame, Repeat, Target } from 'lucide-react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { useI18n } from '@/i18n';
import { useModules, useProgressSummary } from '@/lib/hooks';
import { formatDuration } from '@/lib/utils';

function Dashboard() {
  const { t, tl, locale } = useI18n();
  const { data: s, isLoading } = useProgressSummary();
  const { data: modules } = useModules();
  if (isLoading || !s) return <div className="mx-auto max-w-6xl px-4 py-10"><div className="card h-48 animate-pulse" /></div>;

  const ring = 2 * Math.PI * 42;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">{t('dashboard.title')}</h1>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="card flex items-center gap-4 p-5">
          <svg viewBox="0 0 100 100" className="h-20 w-20 -rotate-90" aria-label={`${t('dashboard.completion')} %${s.completionPercent}`}>
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--da-elevated)" strokeWidth="10" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--da-primary)" strokeWidth="10" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={ring * (1 - s.completionPercent / 100)} />
          </svg>
          <div>
            <p className="label">{t('dashboard.completion')}</p>
            <p className="text-2xl font-bold">%{s.completionPercent}</p>
            <p className="text-xs text-muted">{s.completedLessons}/{s.totalLessons}</p>
          </div>
        </div>
        <div className="card p-5">
          <p className="label flex items-center gap-1"><Flame size={12} /> {t('dashboard.streak')}</p>
          <p className="text-2xl font-bold">{t('dashboard.days', { count: s.currentStreak })}</p>
          <p className="text-xs text-muted">{t('dashboard.longest', { count: s.longestStreak })}</p>
        </div>
        <div className="card p-5">
          <p className="label flex items-center gap-1"><Clock size={12} /> {t('dashboard.timeSpent')}</p>
          <p className="text-2xl font-bold">{formatDuration(s.totalSecondsSpent, locale)}</p>
        </div>
        <div className="card p-5">
          <p className="label flex items-center gap-1"><Repeat size={12} /> {t('nav.review')}</p>
          <p className="text-sm">{t('dashboard.dueReviews', { count: s.dueReviews })}</p>
          <Link href="/review" className="btn-ghost mt-2 w-full">{t('dashboard.startReview')}</Link>
        </div>
      </div>

      {s.continueLesson && (
        <Link href={`/lessons/${s.continueLesson.id}`} className="card mt-6 flex items-center justify-between gap-4 p-5 hover:border-primary">
          <div>
            <p className="label flex items-center gap-1"><Target size={12} /> {t('dashboard.continue')}</p>
            <p className="font-semibold">{tl(s.continueLesson.title)}</p>
            <div className="mt-2 h-1.5 w-64 max-w-full overflow-hidden rounded-full bg-elevated"><div className="h-full bg-primary" style={{ width: `${s.continueLesson.percent}%` }} /></div>
          </div>
          <ArrowRight className="text-primary" />
        </Link>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">{t('dashboard.perModule')}</h2>
          <ul className="space-y-3">
            {s.perModule.map((pm) => {
              const m = modules?.find((x) => x.id === pm.moduleId);
              const pct = pm.total ? Math.round((pm.completed / pm.total) * 100) : 0;
              return (
                <li key={pm.moduleId}>
                  <div className="mb-1 flex justify-between text-sm"><span>{m ? `${m.code} · ${tl(m.title)}` : pm.moduleId}</span><span className="text-muted">{pm.completed}/{pm.total}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-elevated"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: m?.color ?? 'var(--da-primary)' }} /></div>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold"><Award size={16} /> {t('dashboard.badges')}</h2>
          {s.badges.length === 0 ? (
            <p className="text-sm text-muted">{t('dashboard.noBadges')}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {s.badges.map((b) => (
                <li key={b.id} className="rounded-xl border border-border bg-elevated/50 p-3 text-center">
                  <Award className="mx-auto text-accent" />
                  <p className="mt-1 text-sm font-semibold">{tl(b.title)}</p>
                  <p className="text-[11px] text-muted">{tl(b.description)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}
