'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Route } from 'lucide-react';
import { ICONS, ModuleCard } from '@/components/home/Sections';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { useOptionalToast } from '@/components/ui/Toast';
import { useI18n } from '@/i18n';
import { useAuthStore, useIsAuthenticated } from '@/lib/auth-store';
import { useModule, usePath, useUpdateProfile } from '@/lib/hooks';
import { formatPercent } from '@/lib/utils';

/** Öğrenme yolu: sıralı modüller, yol ilerlemesi ve sıradaki önerilen ders */
export default function PathPage({ params }: { params: Promise<{ pathId: string }> }) {
  const { pathId } = use(params);
  const { t, tl, locale } = useI18n();
  const authed = useIsAuthenticated();
  const user = useAuthStore((s) => s.user);
  const { data: path, isLoading, isError } = usePath(pathId);
  const update = useUpdateProfile();
  const { toast } = useOptionalToast();

  // Sıradaki modül: tamamlanmamış ilk modül; dersi modül detayından bulunur
  const nextModule = path?.modules.find((m) => (m.completedCount ?? 0) < m.lessonCount) ?? null;
  const { data: nextModuleDetail } = useModule(nextModule?.id ?? '');
  const nextLesson =
    nextModuleDetail?.lessons.find((l) => l.progress?.status === 'in_progress') ??
    nextModuleDetail?.lessons.find((l) => l.progress?.status !== 'completed') ??
    null;

  if (isLoading)
    return (
      <div className="mx-auto max-w-5xl px-4 py-10" aria-busy="true">
        <Skeleton className="h-44 w-full rounded-3xl" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  if (isError || !path)
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <EmptyState
          icon={Route}
          title={t('common.notFound')}
          action={
            <Link href="/" className="btn-primary">
              {t('common.goHome')}
            </Link>
          }
        />
      </div>
    );

  const Icon = ICONS[path.icon] ?? Route;
  const done = path.modules.reduce((a, m) => a + (m.completedCount ?? 0), 0);
  const total = path.modules.reduce((a, m) => a + m.lessonCount, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const isMine = user?.selectedPathId === path.id;

  const choose = async () => {
    await update.mutateAsync({ selectedPathId: path.id }).catch(() => undefined);
    toast({ title: t('path.chosen'), tone: 'success' });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="bg-glow relative overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <div className="bg-grid mask-fade-b absolute inset-0 -z-10 opacity-50" aria-hidden="true" />
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-glow">
            <Icon size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="t-mono-label">
              {t('home.modulesCount', { count: path.moduleCount })} ·{' '}
              {t('home.lessons', { count: path.lessonCount })}
              {isMine && <span className="chip chip-accent ml-2">{t('path.yourPath')}</span>}
            </p>
            <h1 className="t-h1 mt-1">{tl(path.title)}</h1>
            <p className="mt-2 max-w-2xl text-muted">{tl(path.description)}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {authed ? (
                nextLesson ? (
                  <Link href={`/lessons/${nextLesson.id}`} className="btn-primary btn-lg">
                    {t('path.nextLesson')}: {tl(nextLesson.title)} <ArrowRight size={16} />
                  </Link>
                ) : total > 0 && done >= total ? (
                  <span className="btn-soft btn-lg cursor-default">
                    <CheckCircle2 size={18} /> {t('path.completed')}
                  </span>
                ) : null
              ) : (
                <Link href={`/register?path=${path.id}`} className="btn-primary btn-lg">
                  {t('home.start')} <ArrowRight size={16} />
                </Link>
              )}
              {authed && !isMine && (
                <button
                  type="button"
                  className="btn-ghost btn-lg"
                  onClick={() => void choose()}
                  disabled={update.isPending}
                >
                  {t('path.choose')}
                </button>
              )}
              {authed && (
                <span className="text-sm text-muted">{t('path.progress', { done, total })}</span>
              )}
            </div>
          </div>
          {authed && (
            <ProgressRing
              percent={pct}
              size={96}
              label={t('path.progress', { done, total })}
              className="self-start"
            >
              {formatPercent(pct, locale)}
            </ProgressRing>
          )}
        </div>
      </header>

      <div className="mb-4 mt-10 flex items-baseline justify-between">
        <h2 className="t-h2">{t('path.modules')}</h2>
        <p className="text-sm text-muted">{t('path.subtitle')}</p>
      </div>
      <ol className="relative space-y-4 border-l-2 border-border pl-6">
        {path.modules.map((m, i) => (
          <li key={m.id} className="relative">
            <span
              className="absolute -left-[31px] top-6 flex h-5 w-5 items-center justify-center rounded-full border-2 border-bg text-xs font-bold text-white"
              style={{ background: m.color }}
              aria-label={t('path.step', { n: i + 1 })}
            >
              {i + 1}
            </span>
            <ModuleCard module={m} />
          </li>
        ))}
      </ol>
    </div>
  );
}
