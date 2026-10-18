'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, CheckCircle2, XCircle, Award } from 'lucide-react';
import type { AttemptResult, QuizPublic } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { useQuiz, useSubmitAttempt } from '@/lib/hooks';
import { useIsAuthenticated } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

type Answers = Record<string, string[]>;

/** Quiz motoru (istemci): sorular doğru cevapsız gelir, puanlama sunucuda yapılır. */
export function QuizBlock({ lessonId }: { lessonId: string }) {
  const { t } = useI18n();
  const { data: quiz, isLoading } = useQuiz(lessonId);
  if (isLoading) return <div className="card h-48 animate-pulse" />;
  if (!quiz) return null;
  return <QuizForm key={quiz.id} quiz={quiz} title={t('quiz.title')} />;
}

function QuizForm({ quiz, title }: { quiz: QuizPublic; title: string }) {
  const { t, tl } = useI18n();
  const authed = useIsAuthenticated();
  const submit = useSubmitAttempt(quiz.id);
  const initialOrder = useMemo(() => Object.fromEntries(quiz.questions.filter((q) => q.type === 'order').map((q) => [q.id, q.options.map((o) => o.id)])), [quiz]);
  const [answers, setAnswers] = useState<Answers>(initialOrder);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [startedAt] = useState(() => Date.now());

  const toggle = (qid: string, oid: string, multiple: boolean) => {
    if (result) return;
    setAnswers((a) => {
      const cur = a[qid] ?? [];
      if (!multiple) return { ...a, [qid]: [oid] };
      return { ...a, [qid]: cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid] };
    });
  };
  const move = (qid: string, idx: number, dir: -1 | 1) => {
    if (result) return;
    setAnswers((a) => {
      const arr = [...(a[qid] ?? [])];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return a;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...a, [qid]: arr };
    });
  };

  const allAnswered = quiz.questions.every((q) => (answers[q.id]?.length ?? 0) > 0);
  const onSubmit = async () => {
    const res = await submit.mutateAsync({ answers: quiz.questions.map((q) => ({ questionId: q.id, selected: answers[q.id] ?? [] })), durationMs: Date.now() - startedAt });
    setResult(res);
  };
  const reset = () => {
    setResult(null);
    setAnswers(initialOrder);
  };
  const resultFor = (qid: string) => result?.results.find((r) => r.questionId === qid);

  return (
    <section className="card p-5" aria-labelledby={`quiz-${quiz.id}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 id={`quiz-${quiz.id}`} className="text-lg font-semibold">
          {title} <span className="text-sm font-normal text-muted">· {tl(quiz.title)}</span>
        </h2>
      </div>

      <ol className="space-y-6">
        {quiz.questions.map((q, qi) => {
          const r = resultFor(q.id);
          const selected = answers[q.id] ?? [];
          const multiple = q.type === 'multiple';
          return (
            <li key={q.id} className={cn('rounded-xl border p-4', r ? (r.correct ? 'border-success/50 bg-success/5' : 'border-danger/50 bg-danger/5') : 'border-border')}>
              <p className="mb-3 font-medium">
                <span className="mr-2 text-muted">{qi + 1}.</span>
                {tl(q.prompt)}
              </p>
              {multiple && <p className="mb-2 text-xs text-muted">{t('quiz.selectAll')}</p>}
              {q.type === 'order' ? (
                <>
                  <p className="mb-2 text-xs text-muted">{t('quiz.orderHint')}</p>
                  <ul className="space-y-2">
                    {selected.map((oid, idx) => {
                      const opt = q.options.find((o) => o.id === oid)!;
                      return (
                        <li key={oid} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                          <span className="w-5 text-muted">{idx + 1}</span>
                          <span className="flex-1">{tl(opt.text)}</span>
                          <button type="button" className="btn-icon h-7 w-7" onClick={() => move(q.id, idx, -1)} disabled={idx === 0 || Boolean(result)} aria-label="↑">
                            <ArrowUp size={14} />
                          </button>
                          <button type="button" className="btn-icon h-7 w-7" onClick={() => move(q.id, idx, 1)} disabled={idx === selected.length - 1 || Boolean(result)} aria-label="↓">
                            <ArrowDown size={14} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <div role={multiple ? 'group' : 'radiogroup'} className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((o) => {
                    const isSel = selected.includes(o.id);
                    const isCorrect = r?.correctAnswer.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role={multiple ? 'checkbox' : 'radio'}
                        aria-checked={isSel}
                        disabled={Boolean(result)}
                        onClick={() => toggle(q.id, o.id, multiple)}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-left text-sm transition',
                          isSel ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:bg-elevated',
                          r && isCorrect && 'border-success bg-success/10',
                          r && isSel && !isCorrect && 'border-danger bg-danger/10',
                        )}
                      >
                        {tl(o.text)}
                      </button>
                    );
                  })}
                </div>
              )}
              {r && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex gap-2 text-sm">
                  {r.correct ? <CheckCircle2 className="mt-0.5 shrink-0 text-success" size={16} /> : <XCircle className="mt-0.5 shrink-0 text-danger" size={16} />}
                  <p>
                    <strong>{r.correct ? t('quiz.correct') : t('quiz.wrong')}.</strong> <span className="text-muted">{tl(r.explanation)}</span>
                  </p>
                </motion.div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!authed ? (
          <p className="text-sm text-muted">
            {t('quiz.loginToSave')}{' '}
            <Link href="/login" className="text-primary underline">
              {t('nav.login')}
            </Link>
          </p>
        ) : result ? (
          <>
            <div className={cn('rounded-xl px-4 py-2 text-sm font-semibold', result.passed ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning')} aria-live="polite">
              {t('quiz.score', { score: result.score })} — {result.passed ? t('quiz.passed') : t('quiz.failed')}
            </div>
            {result.newBadges.map((b) => (
              <span key={b.id} className="chip border-accent text-accent">
                <Award size={13} /> {t('quiz.newBadge', { name: tl(b.title) })}
              </span>
            ))}
            <button type="button" className="btn-ghost" onClick={reset}>
              {t('quiz.retry')}
            </button>
          </>
        ) : (
          <button type="button" className="btn-primary" onClick={onSubmit} disabled={!allAnswered || submit.isPending}>
            {t('quiz.submit')}
          </button>
        )}
        {submit.isError && <p className="text-sm text-danger">{t('common.error')}</p>}
      </div>
    </section>
  );
}
