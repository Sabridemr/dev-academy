'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Circle,
  CircleDot,
  Clapperboard,
  Clock,
  FileText,
  FlaskConical,
  Layers,
  ListChecks,
  PlayCircle,
} from 'lucide-react';
import type { LessonSummary, ModuleDetail } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { useIsAuthenticated } from '@/lib/auth-store';
import { useCertificates, useModule } from '@/lib/hooks';
import { cn, formatPercent } from '@/lib/utils';
import { ICONS } from '../home/Sections';
import { EmptyState } from '../ui/EmptyState';
import { ProgressRing } from '../ui/ProgressRing';
import { Skeleton, SkeletonCard } from '../ui/Skeleton';

export function ModuleView({ moduleId }: { moduleId: string }) {
  const { t, tl, locale } = useI18n();
  const authed = useIsAuthenticated();
  const { data: m, isLoading, isError } = useModule(moduleId);
  const { data: certificates } = useCertificates();

  if (isLoading)
    return (
      <div className="mx-auto max-w-5xl px-4 py-10" aria-busy="true">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  if (isError || !m)
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <EmptyState
          icon={Layers}
          title={t('common.notFound')}
          action={
            <Link href="/modules" className="btn-primary">
              {t('nav.modules')}
            </Link>
          }
        />
      </div>
    );

  const Icon = ICONS[m.icon] ?? Layers;
  const done = m.completedCount ?? 0;
  const pct = m.lessonCount ? Math.round((done / m.lessonCount) * 100) : 0;
  const counts = {
    animations: m.lessons.filter((l) => l.hasAnimation).length,
    interactives: m.lessons.filter((l) => l.hasInteractive).length,
    quizzes: m.lessons.filter((l) => l.hasQuiz).length,
  };
  const next = nextLesson(m);
  const hours = Math.floor(m.totalMinutes / 60);
  const minutes = m.totalMinutes % 60;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Modül başlığı: modül rengiyle tonlanmış kart */}
      <header
        className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-8"
        style={{ ['--mod' as string]: m.color }}
      >
        <div
          className="absolute inset-0 -z-10 opacity-[0.12]"
          style={{ background: `radial-gradient(70% 90% at 0% 0%, ${m.color}, transparent 70%)` }}
          aria-hidden="true"
        />
        <div className="bg-dots absolute inset-0 -z-10 opacity-40" aria-hidden="true" />
        <nav className="mb-4 text-sm text-muted" aria-label="breadcrumb">
          <Link href="/modules" className="hover:text-fg">
            {t('nav.modules')}
          </Link>{' '}
          <span aria-hidden="true">›</span>{' '}
          <span className="text-fg">{t(`module.groups.${m.group}` as 'module.groups.ai')}</span>
        </nav>
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-card"
            style={{ background: m.color }}
          >
            <Icon size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="t-mono-label" style={{ color: m.color }}>
              {m.code} · {t('home.lessons', { count: m.lessonCount })}
              {m.totalMinutes > 0 && (
                <>
                  {' '}
                  ·{' '}
                  {hours
                    ? t('module.totalTime', { hours, minutes })
                    : t('module.minutes', { count: minutes })}
                </>
              )}
            </p>
            <h1 className="t-h1 mt-1">{tl(m.title)}</h1>
            <p className="mt-2 max-w-2xl text-muted">{tl(m.description)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="chip">
                <Clapperboard size={12} /> {t('module.animations', { count: counts.animations })}
              </span>
              <span className="chip">
                <FlaskConical size={12} />{' '}
                {t('module.interactives', { count: counts.interactives })}
              </span>
              <span className="chip">
                <ListChecks size={12} /> {t('module.quizzes', { count: counts.quizzes })}
              </span>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {next ? (
                <Link href={`/lessons/${next.id}`} className="btn-primary btn-lg">
                  <PlayCircle size={18} />
                  {done > 0 ? t('module.continueLesson') : t('module.startFirst')}
                </Link>
              ) : (
                <span className="btn-soft btn-lg cursor-default">
                  <CheckCircle2 size={18} /> {t('module.allDone')}
                </span>
              )}
              {authed && m.lessonCount > 0 && done >= m.lessonCount && (
                <CertificateLink
                  publicId={
                    certificates?.find((c) => c.targetType === 'module' && c.targetId === m.id)
                      ?.publicId
                  }
                />
              )}
              {authed && m.completedCount !== undefined && (
                <span className="text-sm text-muted">
                  {t('module.completed', { done, total: m.lessonCount })}
                </span>
              )}
            </div>
          </div>
          {authed && m.completedCount !== undefined && (
            <ProgressRing
              percent={pct}
              size={96}
              color={m.color}
              label={`${t('module.completed', { done, total: m.lessonCount })}`}
              className="self-start"
            >
              {formatPercent(pct, locale)}
            </ProgressRing>
          )}
        </div>
      </header>

      <div className="mb-4 mt-10 flex items-baseline justify-between">
        <h2 className="t-h2">{t('module.lessons')}</h2>
        <p className="text-sm text-muted">{t('module.lessonsSubtitle')}</p>
      </div>
      <ol className="space-y-3">
        {m.lessons.map((l) => (
          <LessonRow key={l.id} lesson={l} color={m.color} isNext={next?.id === l.id} />
        ))}
      </ol>
    </div>
  );
}

/** Modül tamamlandıysa sertifika bağlantısı (sertifika henüz listede yoksa sertifikalar sayfası) */
function CertificateLink({ publicId }: { publicId?: string }) {
  const { t } = useI18n();
  return (
    <Link
      href={publicId ? `/certificates/${publicId}` : '/certificates'}
      className="btn-ghost btn-lg border-warning/50 text-warning-fg"
    >
      <Award size={18} /> {t('certificates.moduleCertificate')}
    </Link>
  );
}

/** Sıradaki ders: başlanmış olan, yoksa ilk tamamlanmamış */
function nextLesson(m: ModuleDetail): LessonSummary | null {
  return (
    m.lessons.find((l) => l.progress?.status === 'in_progress') ??
    m.lessons.find((l) => l.progress?.status !== 'completed') ??
    null
  );
}

function LessonRow({
  lesson: l,
  color,
  isNext,
}: {
  lesson: LessonSummary;
  color: string;
  isNext: boolean;
}) {
  const { t, tl, locale } = useI18n();
  const status = l.progress?.status ?? 'not_started';
  const StatusIcon =
    status === 'completed' ? CheckCircle2 : status === 'in_progress' ? CircleDot : Circle;
  return (
    <li>
      <Link
        href={`/lessons/${l.id}`}
        className={cn(
          'card card-hover group flex items-start gap-4 p-4 sm:p-5',
          isNext && 'border-primary/50',
        )}
      >
        <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-sm font-semibold tabular-nums text-muted">
          {l.order}
          <StatusIcon
            size={14}
            aria-label={t(`module.status.${status}` as 'module.status.completed')}
            className={cn(
              'absolute -bottom-1 -right-1 rounded-full bg-surface',
              status === 'completed'
                ? 'text-success-fg'
                : status === 'in_progress'
                  ? 'text-primary'
                  : 'text-border',
            )}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{tl(l.title)}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted">{tl(l.summary)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Clock size={11} /> {t('module.minutes', { count: l.durationMinutes })}
            </span>
            <span>{t(`module.level.${l.level}` as 'module.level.beginner')}</span>
            <span className="inline-flex items-center gap-1.5" aria-hidden="true">
              {l.hasAnimation && <Clapperboard size={12} className="text-primary" />}
              {l.hasInteractive && <FlaskConical size={12} className="text-accent-fg" />}
              {l.hasQuiz && <ListChecks size={12} className="text-success-fg" />}
              {l.format !== 'standard' && <FileText size={12} />}
            </span>
            <span className="sr-only">
              {[
                l.hasAnimation && t('module.hasAnimation'),
                l.hasInteractive && t('module.hasInteractive'),
                l.hasQuiz && t('module.hasQuiz'),
                l.format !== 'standard' &&
                  t(`module.format.${l.format}` as 'module.format.infographic'),
              ]
                .filter(Boolean)
                .join(', ')}
            </span>
            {isNext && (
              <span className="chip chip-primary">
                {t('module.continueLesson')} <ArrowRight size={11} />
              </span>
            )}
          </div>
        </div>
        {l.progress && l.progress.status === 'in_progress' && (
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {formatPercent(l.progress.percent, locale)}
          </span>
        )}
        <span
          className="absolute inset-y-0 left-0 w-1 rounded-l-2xl opacity-0 transition group-hover:opacity-100"
          style={{ background: color }}
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}
