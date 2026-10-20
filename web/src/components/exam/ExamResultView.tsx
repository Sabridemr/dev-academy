'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  History,
  Repeat,
  RotateCcw,
  Sparkles,
  TimerOff,
  XCircle,
} from 'lucide-react';
import type { ExamDto, ExamResult, LocalizedString } from '@devacademy/shared';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useI18n } from '@/i18n';
import { useModules } from '@/lib/hooks';
import { cn, formatPercent } from '@/lib/utils';
import { ratioTone, type ExamAnswers } from './exam.logic';

const TONE_BAR = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
} as const;

/** Sonuç ekranı: puan halkası, kavram/modül kırılımı, yanlışların açıklamaları */
export function ExamResultView({
  exam,
  result,
  answers,
  onNew,
}: {
  exam: ExamDto | null;
  result: ExamResult;
  answers: ExamAnswers;
  onNew: () => void;
}) {
  const { t, tl, locale } = useI18n();
  const { data: modules } = useModules();
  const moduleTitle = (id: string) => {
    const m = modules?.find((x) => x.id === id);
    return m ? `${m.code} · ${tl(m.title)}` : id;
  };
  const questions = new Map((exam?.questions ?? []).map((q) => [q.id, q]));
  const wrongs = result.results.filter((r) => !r.correct);
  const perConcept = [...result.perConcept].sort(
    (a, b) => a.correct / Math.max(1, a.total) - b.correct / Math.max(1, b.total),
  );
  const perModule = [...result.perModule].sort(
    (a, b) => a.correct / Math.max(1, a.total) - b.correct / Math.max(1, b.total),
  );
  const optionText = (qid: string, ids: string[]) => {
    const q = questions.get(qid);
    const sep = q?.type === 'order' ? ' → ' : ', ';
    return ids
      .map((id) => {
        const o = q?.options.find((x) => x.id === id);
        return o ? tl(o.text as LocalizedString) : id;
      })
      .join(sep);
  };

  return (
    <div className="space-y-6">
      <section
        className={cn(
          'card bg-glow flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8',
          result.passed ? 'border-success/40' : 'border-warning/40',
        )}
        aria-live="polite"
      >
        <ProgressRing
          percent={result.score}
          size={128}
          stroke={10}
          color={result.passed ? 'var(--da-success)' : 'var(--da-warning)'}
          label={`${t('exam.score')}: ${formatPercent(result.score, locale)}`}
        >
          <span className="text-2xl">{formatPercent(result.score, locale)}</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="t-eyebrow">{t('exam.resultTitle')}</p>
          <h2 className="t-h1 mt-1">{result.passed ? t('exam.passed') : t('exam.failed')}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="chip tabular-nums">
              {t('exam.correctOf', { correct: result.correctCount, total: result.totalCount })}
            </span>
            {exam && (
              <span className="chip">
                {t('exam.passScore', { score: formatPercent(exam.passScore, locale) })}
              </span>
            )}
            {result.xpEarned > 0 && (
              <span className="chip chip-primary">
                <Sparkles size={12} /> {t('exam.xpEarned', { count: result.xpEarned })}
              </span>
            )}
          </div>
          {result.timedOut && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
              <TimerOff size={14} /> {t('exam.timedOut')}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={onNew}>
              <RotateCcw size={15} /> {t('exam.newExam')}
            </button>
            <Link href="/history?tab=exams" className="btn-ghost">
              <History size={15} /> {t('exam.historyLink')}
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Breakdown
          title={t('exam.byConcept')}
          rows={perConcept.map((c) => ({ key: c.concept, label: c.concept, ...c }))}
        />
        <Breakdown
          title={t('exam.byModule')}
          rows={perModule.map((m) => ({ key: m.moduleId, label: moduleTitle(m.moduleId), ...m }))}
        />
      </div>

      <section className="card p-5">
        <h2 className="t-h3 mb-1">{t('exam.wrongs')}</h2>
        {wrongs.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success-fg">
            <CheckCircle2 size={16} /> {t('exam.noWrongs')}
          </p>
        ) : (
          <>
            <p className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted">
              <Repeat size={13} /> {t('exam.reviewAdded')}
              <Link href="/review" className="btn-link text-sm">
                {t('exam.goReview')} <ArrowRight size={12} />
              </Link>
            </p>
            <ol className="space-y-4">
              {wrongs.map((r) => {
                const q = questions.get(r.questionId);
                const mine = answers[r.questionId] ?? [];
                return (
                  <li
                    key={r.questionId}
                    className="rounded-xl border border-danger/40 bg-danger/5 p-4"
                  >
                    <p className="flex gap-2 font-medium">
                      <XCircle size={16} className="mt-1 shrink-0 text-danger-fg" />
                      <span className="whitespace-pre-line">{q ? tl(q.prompt) : r.questionId}</span>
                    </p>
                    <dl className="mt-3 grid gap-2 pl-6 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="t-eyebrow">{t('exam.yourAnswer')}</dt>
                        <dd className="mt-0.5">
                          {mine.length ? optionText(r.questionId, mine) : t('exam.unanswered')}
                        </dd>
                      </div>
                      <div>
                        <dt className="t-eyebrow">{t('exam.correctAnswer')}</dt>
                        <dd className="mt-0.5 font-medium text-success-fg">
                          {optionText(r.questionId, r.correctAnswer)}
                        </dd>
                      </div>
                    </dl>
                    {tl(r.explanation) && (
                      <p className="mt-3 pl-6 text-sm text-muted">{tl(r.explanation)}</p>
                    )}
                    {q && (
                      <Link href={`/lessons/${q.lessonId}`} className="btn-link ml-6 mt-2 text-xs">
                        {t('exam.goToLesson')} <ArrowRight size={12} />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; correct: number; total: number }[];
}) {
  const { locale } = useI18n();
  if (rows.length === 0) return null;
  return (
    <section className="card p-5">
      <h2 className="t-h3 mb-4">{title}</h2>
      <ul className="space-y-3">
        {rows.map((r) => {
          const pct = r.total ? (r.correct / r.total) * 100 : 0;
          return (
            <li key={r.key}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{r.label}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {r.correct}/{r.total} · {formatPercent(pct, locale)}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-elevated"
                role="progressbar"
                aria-label={r.label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pct)}
              >
                <div
                  className={cn('h-full rounded-full', TONE_BAR[ratioTone(r.correct, r.total)])}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
