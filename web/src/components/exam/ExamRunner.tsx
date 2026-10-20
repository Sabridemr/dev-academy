'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Flag, Loader2, Send, Timer } from 'lucide-react';
import type { ExamDto, ExamResult } from '@devacademy/shared';
import { QuestionInput } from '@/components/lesson/QuizBlock';
import { Dialog } from '@/components/ui/Dialog';
import { useI18n } from '@/i18n';
import { useSubmitExam } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import {
  buildSubmission,
  examDeadline,
  formatClock,
  isAnswered,
  remainingSeconds,
  type ExamAnswers,
} from './exam.logic';

interface Draft {
  answers: ExamAnswers;
  flags: string[];
}

const draftKey = (id: string) => `da-exam-${id}`;

function loadDraft(id: string): Draft {
  try {
    const raw = sessionStorage.getItem(draftKey(id));
    if (raw) {
      const d = JSON.parse(raw) as Partial<Draft>;
      return { answers: d.answers ?? {}, flags: Array.isArray(d.flags) ? d.flags : [] };
    }
  } catch {
    /* gizli mod / bozuk veri */
  }
  return { answers: {}, flags: [] };
}

/** Sınav ekranı: geri sayım, soru gezgini, işaretleme; süre bitince otomatik gönderim */
export function ExamRunner({
  exam,
  onDone,
}: {
  exam: ExamDto;
  onDone: (result: ExamResult, answers: ExamAnswers) => void;
}) {
  const { t, tl } = useI18n();
  const submit = useSubmitExam(exam.id);
  const [draft, setDraft] = useState<Draft>(() => loadDraft(exam.id));
  const [index, setIndex] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const deadline = useMemo(() => examDeadline(exam, Date.now()), [exam]);
  const remaining = remainingSeconds(deadline, now);
  const submitting = useRef(false);
  const [timeUp, setTimeUp] = useState(false);

  const total = exam.questions.length;
  const q = exam.questions[index];
  const answeredCount = exam.questions.filter((x) => isAnswered(draft.answers, x.id)).length;
  const flags = new Set(draft.flags);

  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey(exam.id), JSON.stringify(draft));
    } catch {
      /* depolama yok */
    }
  }, [draft, exam.id]);

  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const send = useCallback(async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      const result = await submit.mutateAsync(buildSubmission(exam, draft.answers));
      try {
        sessionStorage.removeItem(draftKey(exam.id));
      } catch {
        /* yok say */
      }
      onDone(result, draft.answers);
    } catch {
      /* submit.isError ile gösterilir; kullanıcı tekrar deneyebilir */
    } finally {
      submitting.current = false;
    }
  }, [submit, exam, draft.answers, onDone]);

  // Süre dolunca bir kez otomatik gönder
  useEffect(() => {
    if (remaining === 0 && !timeUp) {
      setTimeUp(true);
      setConfirmOpen(false);
      void send();
    }
  }, [remaining, timeUp, send]);

  const setAnswer = (next: string[]) =>
    setDraft((d) => ({ ...d, answers: { ...d.answers, [q.id]: next } }));
  const toggleFlag = () =>
    setDraft((d) => ({
      ...d,
      flags: d.flags.includes(q.id) ? d.flags.filter((x) => x !== q.id) : [...d.flags, q.id],
    }));

  const locked = timeUp || submit.isPending;
  const lowTime = remaining !== null && remaining <= 60;
  const selected = draft.answers[q.id] ?? (q.type === 'order' ? q.options.map((o) => o.id) : []);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
      {/* Üst şerit: ilerleme + sayaç (mobilde yapışkan) */}
      <div className="glass sticky top-16 z-20 -mx-4 flex flex-wrap items-center gap-3 px-4 py-3 lg:col-span-2 lg:mx-0 lg:rounded-2xl">
        <p className="text-sm font-medium tabular-nums">
          {t('exam.question', { current: index + 1, total })}
        </p>
        <span className="chip tabular-nums">
          {t('exam.answered', { count: answeredCount, total })}
        </span>
        {flags.size > 0 && (
          <span className="chip border-warning/40 text-warning-fg">
            <Flag size={11} /> {t('exam.flaggedCount', { count: flags.size })}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-sm tabular-nums',
              lowTime ? 'bg-danger/10 text-danger-fg' : 'bg-elevated',
            )}
            role="timer"
            aria-live={lowTime ? 'polite' : 'off'}
            aria-label={t('exam.timeLeft')}
          >
            <Timer size={14} />
            {remaining === null ? t('exam.noLimit') : formatClock(remaining)}
          </span>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => setConfirmOpen(true)}
            disabled={locked}
          >
            <Send size={13} /> {t('exam.finish')}
          </button>
        </div>
      </div>

      <section className="card p-5 sm:p-6" aria-labelledby="exam-q">
        <div className="mb-4 flex items-start justify-between gap-3">
          <p id="exam-q" className="whitespace-pre-line font-medium">
            <span className="mr-2 text-muted">{index + 1}.</span>
            {tl(q.prompt)}
          </p>
          <button
            type="button"
            className={cn(
              'btn-ghost btn-sm shrink-0',
              flags.has(q.id) && 'border-warning/60 text-warning-fg',
            )}
            onClick={toggleFlag}
            aria-pressed={flags.has(q.id)}
            disabled={locked}
          >
            <Flag size={13} /> {flags.has(q.id) ? t('exam.unflag') : t('exam.flag')}
          </button>
        </div>
        <QuestionInput
          key={q.id}
          type={q.type}
          options={q.options}
          selected={selected}
          disabled={locked}
          onChange={setAnswer}
        />
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
          >
            <ArrowLeft size={15} /> {t('exam.prev')}
          </button>
          {index < total - 1 ? (
            <button
              type="button"
              className="btn-soft"
              onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            >
              {t('exam.next')} <ArrowRight size={15} />
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setConfirmOpen(true)}
              disabled={locked}
            >
              <Send size={15} /> {t('exam.finish')}
            </button>
          )}
        </div>
        {(timeUp || submit.isError) && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm" role="alert">
            {submit.isPending ? (
              <span className="flex items-center gap-2 text-muted">
                <Loader2 size={14} className="animate-spin" /> {t('exam.timeUp')}
              </span>
            ) : submit.isError ? (
              <>
                <span className="text-danger-fg">{t('exam.submitError')}</span>
                <button type="button" className="btn-ghost btn-sm" onClick={() => void send()}>
                  {t('common.retry')}
                </button>
              </>
            ) : (
              <span className="text-muted">{t('exam.timeUp')}</span>
            )}
          </div>
        )}
      </section>

      <nav className="card h-max p-4" aria-label={t('exam.navigator')}>
        <p className="label mb-3">{t('exam.navigator')}</p>
        <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-10 lg:grid-cols-5">
          {exam.questions.map((x, i) => {
            const answered = isAnswered(draft.answers, x.id);
            const flagged = flags.has(x.id);
            const states = [
              answered && t('exam.stateAnswered'),
              flagged && t('exam.stateFlagged'),
            ].filter(Boolean);
            return (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={i === index ? 'step' : undefined}
                  aria-label={[t('exam.navItem', { n: i + 1 }), ...states].join(', ')}
                  className={cn(
                    'relative flex h-9 w-full items-center justify-center rounded-lg border text-xs font-semibold tabular-nums transition',
                    answered
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-surface text-muted hover:bg-elevated',
                    i === index && 'ring-2 ring-primary',
                  )}
                >
                  {i + 1}
                  {flagged && (
                    <Flag
                      size={10}
                      className="absolute -right-1 -top-1 rounded-full bg-surface text-warning-fg"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('exam.confirmFinish')}
        size="sm"
      >
        <p className="text-sm text-muted">
          {answeredCount < total
            ? t('exam.confirmUnanswered', { count: total - answeredCount })
            : t('exam.confirmAll')}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => setConfirmOpen(false)}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={submit.isPending}
            onClick={() => {
              setConfirmOpen(false);
              void send();
            }}
          >
            {submit.isPending && <Loader2 size={14} className="animate-spin" />}
            {t('exam.finish')}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
