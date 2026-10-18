'use client';

import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  CircleDot,
  Clapperboard,
  Clock,
  FlaskConical,
  ListChecks,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import { useModule } from '@/lib/hooks';

export function ModuleView({ moduleId }: { moduleId: string }) {
  const { t, tl } = useI18n();
  const { data: m, isLoading, isError } = useModule(moduleId);

  if (isLoading)
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="card h-64 animate-pulse" />
      </div>
    );
  if (isError || !m)
    return <div className="mx-auto max-w-4xl px-4 py-10 text-muted">{t('common.notFound')}</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm font-semibold" style={{ color: m.color }}>
        {m.code} · {t('home.lessons', { count: m.lessonCount })}
      </p>
      <h1 className="mt-1 text-3xl font-bold">{tl(m.title)}</h1>
      <p className="mt-2 text-muted">{tl(m.description)}</p>
      {m.completedCount !== undefined && (
        <p className="mt-2 text-sm text-muted">
          {t('module.completed', { done: m.completedCount, total: m.lessonCount })}
        </p>
      )}

      <ol className="mt-8 space-y-3">
        {m.lessons.map((l) => {
          const status = l.progress?.status ?? 'not_started';
          const StatusIcon =
            status === 'completed' ? CheckCircle2 : status === 'in_progress' ? CircleDot : Circle;
          return (
            <li key={l.id}>
              <Link
                href={`/lessons/${l.id}`}
                className="card flex items-start gap-4 p-4 transition hover:border-primary"
              >
                <StatusIcon
                  className={
                    status === 'completed'
                      ? 'mt-0.5 text-success'
                      : status === 'in_progress'
                        ? 'mt-0.5 text-primary'
                        : 'mt-0.5 text-muted'
                  }
                  size={20}
                  aria-label={status}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="mr-2 text-muted">{l.order}.</span>
                    {tl(l.title)}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted">{tl(l.summary)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="chip">
                      <Clock size={11} /> {t('module.minutes', { count: l.durationMinutes })}
                    </span>
                    <span className="chip">
                      {t(`module.level.${l.level}` as 'module.level.beginner')}
                    </span>
                    {l.hasAnimation && (
                      <span className="chip">
                        <Clapperboard size={11} /> {t('module.hasAnimation')}
                      </span>
                    )}
                    {l.hasInteractive && (
                      <span className="chip">
                        <FlaskConical size={11} /> {t('module.hasInteractive')}
                      </span>
                    )}
                    {l.hasQuiz && (
                      <span className="chip">
                        <ListChecks size={11} /> {t('module.hasQuiz')}
                      </span>
                    )}
                  </div>
                </div>
                {l.progress && l.progress.status === 'in_progress' && (
                  <span className="text-xs text-muted">%{l.progress.percent}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
