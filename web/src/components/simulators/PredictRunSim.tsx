'use client';

import { useMemo, useState } from 'react';
import { Check, Play, RotateCcw, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { TraceViewer } from '../lesson/TraceViewer';
import { SimShell, Stat } from './ui';
import { strParam, type SimulatorProps } from './types';
import { buildQuestions, score, type PredictQuestion } from './predictRun.logic';

const L = {
  tr: {
    title: 'Tahmin et, sonra çalıştır',
    code: 'Kod',
    missing: (src: string) =>
      `Bu bloğun kod izi yüklenemedi${src ? ` (${src})` : ''}. İçerik yeniden yüklendiğinde görünecek.`,
    noQuestions: 'Bu izden soru üretilemedi; "Çalıştır" ile kodu doğrudan izleyebilirsin.',
    output: 'Program bittiğinde çıktı ne olur?',
    variable: (q: Extract<PredictQuestion, { kind: 'variable' }>) =>
      `${q.line}. satır${q.totalRuns > 1 ? ` ${q.occurrence}. kez` : ''} çalıştıktan sonra ${q.name} değeri ne olur?`,
    question: (n: number) => `Soru ${n}`,
    run: 'Çalıştır ve karşılaştır',
    answerAll: 'Önce tüm soruları cevapla.',
    retry: 'Yeniden dene',
    correct: 'Doğru',
    wrong: 'Yanlış',
    questions: 'Soru',
    yourAnswer: 'Senin cevabın',
    seeStep: (step: number, total: number) => `İzde gör: adım ${step}/${total}`,
    hint: 'Kodu oku, her soruda bir seçenek işaretle ve "Çalıştır ve karşılaştır" ile izi oynat. Puan sunucuya gönderilmez; yalnızca kendini sınamak içindir.',
    summary: (c: number, n: number) => `${n} sorudan ${c} doğru.`,
  },
  en: {
    title: 'Predict, then run',
    code: 'Code',
    missing: (src: string) =>
      `The code trace for this block could not be loaded${src ? ` (${src})` : ''}. It will appear once the content is re-imported.`,
    noQuestions:
      'No questions could be generated from this trace; press "Run" to watch the code directly.',
    output: 'What is the output when the program finishes?',
    variable: (q: Extract<PredictQuestion, { kind: 'variable' }>) =>
      `After line ${q.line} runs${q.totalRuns > 1 ? ` for the ${ordinal(q.occurrence)} time` : ''}, what is the value of ${q.name}?`,
    question: (n: number) => `Question ${n}`,
    run: 'Run and compare',
    answerAll: 'Answer every question first.',
    retry: 'Try again',
    correct: 'Correct',
    wrong: 'Wrong',
    questions: 'Questions',
    yourAnswer: 'Your answer',
    seeStep: (step: number, total: number) => `See it in the trace: step ${step}/${total}`,
    hint: 'Read the code, pick an option for each question and press "Run and compare" to play the trace. Nothing is sent to the server; this is only a self-check.',
    summary: (c: number, n: number) => `${c} of ${n} correct.`,
  },
};

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
}

export default function PredictRunSim({ params, trace, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const src = strParam(params, 'src', '');
  const questions = useMemo(() => (trace ? buildQuestions(trace) : []), [trace]);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [revealed, setRevealed] = useState(false);
  const [round, setRound] = useState(0);

  if (!trace) {
    return (
      <SimShell title={l.title}>
        <p role="alert" className="text-sm text-muted">
          {l.missing(src)}
        </p>
      </SimShell>
    );
  }

  const lines = trace.code.split('\n');
  const total = trace.steps.length;
  const { correct, wrong } = score(questions, answers);
  const ready = answers.every((a) => a !== null);

  const choose = (qi: number, ci: number) => {
    if (revealed) return;
    onInteract();
    setAnswers((prev) => prev.map((a, i) => (i === qi ? ci : a)));
  };

  return (
    <SimShell
      title={l.title}
      aside={
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label={l.questions} value={questions.length} />
            <Stat
              label={l.correct}
              value={revealed ? correct : '—'}
              tone={revealed ? 'success' : undefined}
            />
            <Stat
              label={l.wrong}
              value={revealed ? wrong : '—'}
              tone={revealed && wrong ? 'danger' : undefined}
            />
          </div>
          <p className="text-xs leading-5 text-muted">{l.hint}</p>
        </>
      }
    >
      <div className="space-y-4">
        <div
          className="overflow-x-auto rounded-xl border border-border bg-bg/60 py-2 font-mono text-[13px] leading-6"
          aria-label={l.code}
        >
          {lines.map((text, i) => (
            <div key={i} className="flex min-w-fit pr-4">
              <span className="w-9 shrink-0 select-none pr-3 text-right text-xs leading-6 text-muted/70">
                {i + 1}
              </span>
              <span className="whitespace-pre">{text || ' '}</span>
            </div>
          ))}
        </div>

        {questions.length === 0 && <p className="text-sm text-muted">{l.noQuestions}</p>}

        {questions.map((q, qi) => {
          const chosen = answers[qi];
          return (
            <fieldset key={qi} className="rounded-xl border border-border bg-surface p-3">
              <legend className="px-1 text-sm font-semibold">
                {l.question(qi + 1)}: {q.kind === 'output' ? l.output : l.variable(q)}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {q.choices.map((c, ci) => {
                  const isAnswer = revealed && ci === q.answer;
                  const isWrongPick = revealed && ci === chosen && ci !== q.answer;
                  return (
                    <label
                      key={ci}
                      className={cn(
                        'flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-xs',
                        chosen === ci ? 'border-primary bg-primary/5' : 'border-border',
                        isAnswer && 'border-success bg-success/10',
                        isWrongPick && 'border-danger bg-danger/10',
                        revealed && 'cursor-default',
                      )}
                    >
                      <input
                        type="radio"
                        name={`predict-${round}-${qi}`}
                        className="mt-1 accent-[var(--da-primary)]"
                        checked={chosen === ci}
                        disabled={revealed}
                        onChange={() => choose(qi, ci)}
                      />
                      <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono">
                        {c}
                      </pre>
                      {isAnswer && (
                        <Check size={14} className="shrink-0 text-success" aria-label={l.correct} />
                      )}
                      {isWrongPick && (
                        <X size={14} className="shrink-0 text-danger" aria-label={l.wrong} />
                      )}
                    </label>
                  );
                })}
              </div>
              {revealed && (
                <p
                  className={cn(
                    'mt-2 text-xs',
                    chosen === q.answer ? 'text-success' : 'text-danger',
                  )}
                >
                  {chosen === q.answer ? l.correct : l.wrong} · {l.seeStep(q.step + 1, total)}
                </p>
              )}
            </fieldset>
          );
        })}

        <div className="flex flex-wrap items-center gap-2">
          {!revealed ? (
            <>
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={!ready}
                onClick={() => {
                  onInteract();
                  setRevealed(true);
                }}
              >
                <Play size={14} /> {l.run}
              </button>
              {!ready && <span className="text-xs text-muted">{l.answerAll}</span>}
            </>
          ) : (
            <>
              <p className="text-sm font-medium" aria-live="polite">
                {l.summary(correct, questions.length)}
              </p>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  setAnswers(questions.map(() => null));
                  setRevealed(false);
                  setRound((r) => r + 1);
                }}
              >
                <RotateCcw size={14} /> {l.retry}
              </button>
            </>
          )}
        </div>

        {revealed && <TraceViewer key={round} trace={trace} autoPlay />}
      </div>
    </SimShell>
  );
}
