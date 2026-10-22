'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  CheckCircle2,
  Eye,
  Lightbulb,
  Loader2,
  Play,
  RotateCcw,
  SquareTerminal,
  TestTubes,
  XCircle,
} from 'lucide-react';
import {
  EXERCISE_SESSION_KIND,
  EXERCISE_SOLUTION_AFTER_FAILURES,
  type LocalizedString,
  type PublicExercise,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useIsAuthenticated } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import type { RunMode, RunResult } from '@/lib/pyodide/harness';
import { getPyodideRunner, type PyodideRunner, type RunnerState } from '@/lib/pyodide/runner';
import { useOptionalToast } from '../ui/Toast';
import { Markdown } from './Markdown';

const INDENT = '    ';

/** Taslak kod tarayıcıda saklanır (yalnızca bu cihaz; sunucuya gitmez) */
function draftKey(id: string) {
  return `da:exercise:${id}`;
}
function readDraft(id: string): string | null {
  try {
    return window.localStorage.getItem(draftKey(id));
  } catch {
    return null;
  }
}
function writeDraft(id: string, code: string | null) {
  try {
    if (code === null) window.localStorage.removeItem(draftKey(id));
    else window.localStorage.setItem(draftKey(id), code);
  } catch {
    /* gizli pencere / depolama kapalı: taslak tutulmaz */
  }
}

function useRunnerState(runner: PyodideRunner): RunnerState {
  return useSyncExternalStore(
    (cb) => runner.subscribe(cb),
    () => runner.state,
    () => 'idle',
  );
}

interface Outcome {
  mode: RunMode;
  result: RunResult;
}

/**
 * Kodlama alıştırması: görev, satır numaralı düzenleyici, Çalıştır / Testleri çalıştır, ipuçları,
 * sıfırlama, (kurala bağlı) çözüm ve çıktı paneli. Python tarayıcıda Pyodide ile bir Web Worker'da
 * çalışır; Pyodide ilk çalıştırmada yüklenir. Kod sunucuya gönderilmez. Testler geçince oturum
 * `/progress/interactive`'e kaydedilir (çözüm açıldıysa kaydedilmez).
 */
export function ExerciseBlock({
  exercise,
  instructions,
  lessonId,
  runner: runnerProp,
}: {
  exercise: PublicExercise;
  instructions?: LocalizedString;
  lessonId: string;
  /** Testler için enjekte edilebilir çalıştırıcı */
  runner?: PyodideRunner;
}) {
  const { t, tl } = useI18n();
  const authed = useIsAuthenticated();
  const { toast } = useOptionalToast();
  const runner = runnerProp ?? getPyodideRunner();
  const runnerState = useRunnerState(runner);

  const [code, setCode] = useState(exercise.starter);
  const [busy, setBusy] = useState<RunMode | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [failures, setFailures] = useState(0);
  const [passed, setPassed] = useState(false);
  const [hintsShown, setHintsShown] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [solution, setSolution] = useState<string | null>(null);
  const [solutionError, setSolutionError] = useState<string | null>(null);
  const [tabTraps, setTabTraps] = useState(true);
  const recorded = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Taslağı yükle (SSR ile uyumsuzluk olmasın diye effect içinde)
  useEffect(() => {
    const draft = readDraft(exercise.id);
    if (draft !== null) setCode(draft);
  }, [exercise.id]);

  useEffect(() => {
    if (!confirmReset) return;
    const timer = setTimeout(() => setConfirmReset(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmReset]);

  const updateCode = (next: string) => {
    setCode(next);
    writeDraft(exercise.id, next === exercise.starter ? null : next);
  };

  const execute = useCallback(
    async (mode: RunMode) => {
      if (busy) return;
      setBusy(mode);
      const result = await runner.run(
        { code, tests: mode === 'test' ? exercise.tests : undefined, mode },
        exercise.timeoutMs,
      );
      setBusy(null);
      setOutcome({ mode, result });
      if (mode !== 'test') return;
      if (result.status === 'ok') {
        setPassed(true);
        if (authed && !recorded.current && solution === null) {
          recorded.current = true;
          void api('/progress/interactive', {
            method: 'POST',
            body: {
              interactive: EXERCISE_SESSION_KIND,
              lessonId,
              params: { exerciseId: exercise.id },
            },
          })
            .then(() => toast({ title: t('exercise.savedProgress'), tone: 'success' }))
            .catch(() => undefined);
        }
      } else if (result.status !== 'crashed') {
        setFailures((n) => n + 1);
      }
    },
    [busy, runner, code, exercise, authed, solution, lessonId, toast, t],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void execute('test');
      return;
    }
    if (e.key === 'Escape') {
      // Klavye kullanıcısı düzenleyiciden Tab ile çıkabilsin
      setTabTraps(false);
      return;
    }
    if (e.key === 'Tab' && !e.shiftKey && tabTraps) {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: end, value } = el;
      const next = value.slice(0, s) + INDENT + value.slice(end);
      updateCode(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = s + INDENT.length;
      });
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      // Önceki satırın girintisini koru, ':' ile bitiyorsa bir seviye artır
      const { selectionStart: s, selectionEnd: end, value } = el;
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const line = value.slice(lineStart, s);
      const indent = /^\s*/.exec(line)?.[0] ?? '';
      const extra = line.trimEnd().endsWith(':') ? INDENT : '';
      e.preventDefault();
      const insert = `\n${indent}${extra}`;
      updateCode(value.slice(0, s) + insert + value.slice(end));
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = s + insert.length;
      });
    }
  };

  const revealSolution = async () => {
    setSolutionError(null);
    try {
      const res = await api<{ solution: string }>(
        `/lessons/${encodeURIComponent(lessonId)}/exercises/${encodeURIComponent(exercise.id)}/solution`,
      );
      setSolution(res.solution);
    } catch {
      setSolutionError(t('exercise.solutionError'));
    }
  };

  const reset = () => {
    if (!confirmReset && code !== exercise.starter) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    updateCode(exercise.starter);
    setOutcome(null);
    editorRef.current?.focus();
  };

  const lineCount = code.split('\n').length;
  const solutionUnlocked = failures >= EXERCISE_SOLUTION_AFTER_FAILURES || passed;
  const loading = runnerState === 'loading';
  const headingId = `exercise-${exercise.id}-title`;
  const helpId = `exercise-${exercise.id}-help`;

  return (
    <section className="card overflow-hidden" aria-labelledby={headingId}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {t('exercise.role')}
          </p>
          <h3 id={headingId} className="text-base font-semibold">
            {tl(exercise.title)}
          </h3>
        </div>
        {outcome?.mode === 'test' && (
          <span
            className={cn(
              'chip shrink-0',
              outcome.result.status === 'ok' ? 'text-success' : 'text-danger',
            )}
            data-testid="exercise-badge"
          >
            {outcome.result.status === 'ok' ? (
              <CheckCircle2 size={14} aria-hidden />
            ) : (
              <XCircle size={14} aria-hidden />
            )}
            {outcome.result.status === 'ok' ? t('exercise.passed') : t('exercise.failed')}
          </span>
        )}
      </div>

      <div className="space-y-3 px-4 py-3">
        {instructions && (
          <Markdown className="max-w-none text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {tl(instructions)}
          </Markdown>
        )}
        <Markdown className="max-w-none text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          {tl(exercise.prompt)}
        </Markdown>

        {/* Düzenleyici: textarea + kaydırmayla eşlenen satır numaraları */}
        <div className="flex overflow-hidden rounded-xl border border-border bg-elevated/40 font-mono text-[13px] leading-6 focus-within:ring-2 focus-within:ring-primary/50">
          <div
            ref={gutterRef}
            aria-hidden
            className="select-none overflow-hidden border-r border-border px-2 py-2 text-right text-muted"
            style={{ minWidth: '2.75rem' }}
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <textarea
            ref={editorRef}
            value={code}
            onChange={(e) => updateCode(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setTabTraps(true)}
            onScroll={(e) => {
              if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
            }}
            aria-label={`${t('exercise.editor')}: ${tl(exercise.title)}`}
            aria-describedby={helpId}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            wrap="off"
            rows={Math.min(Math.max(lineCount, 6), 24)}
            className="min-w-0 flex-1 resize-y whitespace-pre bg-transparent px-3 py-2 text-fg outline-none"
          />
        </div>
        <p id={helpId} className="text-xs text-muted">
          {t('exercise.editorHelp')} {t('exercise.clientOnly')}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => void execute('run')}
            disabled={busy !== null}
          >
            <Play size={14} aria-hidden /> {t('exercise.run')}
          </button>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => void execute('test')}
            disabled={busy !== null}
          >
            <TestTubes size={14} aria-hidden /> {t('exercise.runTests')}
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => setHintsShown((n) => Math.min(n + 1, exercise.hints.length))}
            disabled={hintsShown >= exercise.hints.length}
            title={hintsShown >= exercise.hints.length ? t('exercise.noMoreHints') : undefined}
          >
            <Lightbulb size={14} aria-hidden /> {t('exercise.hint')}
            {exercise.hints.length > 0 && ` (${hintsShown}/${exercise.hints.length})`}
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={reset}>
            <RotateCcw size={14} aria-hidden />{' '}
            {confirmReset ? t('exercise.resetConfirm') : t('exercise.reset')}
          </button>
          {solution === null && (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => void revealSolution()}
              disabled={!solutionUnlocked || !authed}
              title={
                !solutionUnlocked
                  ? t('exercise.solutionLocked', { n: EXERCISE_SOLUTION_AFTER_FAILURES })
                  : !authed
                    ? t('exercise.solutionLogin')
                    : undefined
              }
            >
              <Eye size={14} aria-hidden /> {t('exercise.showSolution')}
            </button>
          )}
          {failures > 0 && !passed && (
            <span className="text-xs text-muted">{t('exercise.attempts', { n: failures })}</span>
          )}
        </div>
        {solution === null && (!solutionUnlocked || !authed) && (
          <p className="text-xs text-muted">
            {!solutionUnlocked
              ? t('exercise.solutionLocked', { n: EXERCISE_SOLUTION_AFTER_FAILURES })
              : t('exercise.solutionLogin')}
          </p>
        )}

        {hintsShown > 0 && (
          <ol className="space-y-2" aria-label={t('exercise.hint')}>
            {exercise.hints.slice(0, hintsShown).map((h, i) => (
              <li key={i} className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-warning">
                  <Lightbulb size={13} aria-hidden /> {t('exercise.hintN', { n: i + 1 })}
                </p>
                <Markdown className="max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  {tl(h)}
                </Markdown>
              </li>
            ))}
          </ol>
        )}

        {solutionError && (
          <p className="text-sm text-danger" role="alert">
            {solutionError}
          </p>
        )}
        {solution !== null && (
          <div className="rounded-xl border border-border">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
              <p className="text-xs font-semibold">{t('exercise.solutionTitle')}</p>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => updateCode(solution)}
              >
                {t('exercise.useSolution')}
              </button>
            </div>
            <pre className="overflow-x-auto px-3 py-2 font-mono text-[13px] leading-6">
              {solution}
            </pre>
          </div>
        )}
      </div>

      {/* Çıktı paneli */}
      <div className="border-t border-border bg-elevated/50 px-4 py-2.5">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
          <SquareTerminal size={13} aria-hidden /> {t('exercise.output')}
        </p>
        <div aria-live="polite" aria-busy={busy !== null} data-testid="exercise-output">
          {busy !== null || loading ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden />
              {loading ? t('exercise.loading') : t('exercise.running')}
            </p>
          ) : outcome ? (
            <OutcomeView outcome={outcome} timeoutMs={exercise.timeoutMs} />
          ) : runnerState === 'error' ? (
            <p className="text-sm text-danger">{t('exercise.loadError')}</p>
          ) : (
            <p className="text-sm text-muted">{t('exercise.idle')}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function OutcomeView({ outcome, timeoutMs }: { outcome: Outcome; timeoutMs: number }) {
  const { t } = useI18n();
  const { result, mode } = outcome;
  const status =
    result.status === 'ok'
      ? mode === 'test'
        ? t('exercise.passed')
        : t('exercise.finished')
      : result.status === 'failed'
        ? t('exercise.failed')
        : result.status === 'timeout'
          ? t('exercise.timeout', { seconds: Math.round(timeoutMs / 100) / 10 })
          : result.status === 'crashed'
            ? t('exercise.loadError')
            : t('exercise.errored');
  return (
    <div className="space-y-1.5 text-sm">
      <p
        className={cn('font-medium', result.status === 'ok' ? 'text-success' : 'text-danger')}
        role={result.status === 'ok' ? 'status' : 'alert'}
      >
        {status}
      </p>
      {result.testLine && result.testSource && (
        <p className="font-mono text-xs">
          {t('exercise.failedTest', { line: result.testLine, source: result.testSource })}
        </p>
      )}
      {result.stdout || result.stderr ? (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-2 font-mono text-xs">
          {result.stdout}
          {result.stderr && <span className="text-warning">{`\n${result.stderr}`}</span>}
        </pre>
      ) : (
        result.status === 'ok' && <p className="text-xs text-muted">{t('exercise.noOutput')}</p>
      )}
      {result.error && (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-danger/5 p-2 font-mono text-xs text-danger">
          {result.error}
        </pre>
      )}
    </div>
  );
}
