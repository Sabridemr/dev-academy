'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Captions,
  CaptionsOff,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  PLAYER_SPEEDS,
  createPlayerState,
  playerReducer,
  resolveStepView,
  sceneTranscript,
  type AnimationScene,
  type PlayerAction,
  type PlayerState,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { SceneCanvas } from './SceneCanvas';

interface Props {
  scene: AnimationScene;
  caption?: string;
  autoPlay?: boolean;
  className?: string;
  /** Oynatıcı ilk kez oynatıldığında (ilerleme/analitik) */
  onFirstPlay?: () => void;
}

/**
 * Web animasyon motoru. Tüm durum geçişleri shared/playerReducer'dan gelir;
 * zaman requestAnimationFrame ile ilerletilir. Klavye: Boşluk = oynat/duraklat, ←/→ = adım.
 */
export function ScenePlayer({ scene, caption, autoPlay = false, className, onFirstPlay }: Props) {
  const { t, tl } = useI18n();
  const reducedMotionPref = usePrefersReducedMotion();
  const reducer = useMemo(
    () => (s: PlayerState, a: PlayerAction) => playerReducer(scene, s, a),
    [scene],
  );
  const [state, dispatch] = useReducer(reducer, scene, (sc) =>
    createPlayerState(sc, { playing: autoPlay }),
  );
  const lastTs = useRef<number | null>(null);
  const playedOnce = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dispatch({ type: 'SET_REDUCED_MOTION', value: reducedMotionPref });
  }, [reducedMotionPref]);

  // Sahne değişirse baştan başlat (editör önizlemesi)
  useEffect(() => {
    dispatch({ type: 'RESET' });
  }, [scene]);

  useEffect(() => {
    if (!state.playing) {
      lastTs.current = null;
      return;
    }
    if (!playedOnce.current) {
      playedOnce.current = true;
      onFirstPlay?.();
    }
    let raf = 0;
    const loop = (ts: number) => {
      if (lastTs.current !== null)
        dispatch({ type: 'TICK', deltaMs: Math.min(100, ts - lastTs.current) });
      lastTs.current = ts;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state.playing, onFirstPlay]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Odak bir kontrol üzerindeyse (düğme, sekme, kaydırıcı, özet...) tuş o kontrolün kendi işini yapar
    if (isInteractiveTarget(e.target)) return;
    if (e.key === ' ') {
      e.preventDefault();
      dispatch({ type: 'TOGGLE_PLAY' });
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      dispatch({ type: 'NEXT' });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      dispatch({ type: 'PREV' });
    }
  }, []);

  const view = resolveStepView(scene, state.stepIndex);
  const step = view.step;
  const total = scene.steps.length;
  const stepProgress = Math.min(1, state.elapsedMs / step.durationMs);
  const transcript = sceneTranscript(scene);

  return (
    <figure
      ref={rootRef}
      className={cn('card overflow-hidden', className)}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-roledescription="animasyon oynatıcı"
      aria-label={tl(scene.title)}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{tl(scene.title)}</p>
          <p className="text-xs text-muted">
            {t('player.step', { current: state.stepIndex + 1, total })} · {tl(step.title)}
          </p>
        </div>
        {state.reducedMotion && (
          <span className="chip hidden sm:inline-flex">{t('player.reducedMotion')}</span>
        )}
      </div>

      <div className="relative bg-bg/60 px-2 py-3">
        <SceneCanvas
          scene={scene}
          view={view}
          elapsedMs={state.elapsedMs}
          reducedMotion={state.reducedMotion}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {state.showNarration && (
          <motion.div
            key={step.id}
            initial={state.reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border bg-elevated/50 px-4 py-3 text-sm leading-6"
            aria-live="polite"
          >
            <p className="mb-1 font-semibold">{tl(step.title)}</p>
            <div className="prose-da max-w-none [&_p]:my-0">
              <ReactMarkdown>{tl(step.narration)}</ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kontroller */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2.5">
        <button
          type="button"
          className="btn-icon"
          onClick={() => dispatch({ type: 'PREV' })}
          disabled={state.stepIndex === 0}
          aria-label={t('player.stepBack')}
          title={t('player.stepBack')}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className="btn-primary h-9 px-3"
          onClick={() => dispatch({ type: 'TOGGLE_PLAY' })}
          aria-label={state.playing ? t('player.pause') : t('player.play')}
        >
          {state.playing ? <Pause size={16} /> : <Play size={16} />}
          <span className="hidden sm:inline">
            {state.playing ? t('player.pause') : t('player.play')}
          </span>
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={() => dispatch({ type: 'NEXT' })}
          disabled={state.finished}
          aria-label={t('player.stepForward')}
          title={t('player.stepForward')}
        >
          <ChevronRight size={18} />
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={() => dispatch({ type: 'RESET' })}
          aria-label={t('player.restart')}
          title={t('player.restart')}
        >
          <RotateCcw size={16} />
        </button>

        {/* Adım çizelgesi */}
        <div
          className="mx-1 flex min-w-[120px] flex-1 items-center gap-1"
          role="tablist"
          aria-label={t('player.step', { current: state.stepIndex + 1, total })}
        >
          {scene.steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === state.stepIndex}
              aria-label={`${i + 1}. ${tl(s.title)}`}
              title={tl(s.title)}
              onClick={() => dispatch({ type: 'SEEK', stepIndex: i })}
              className="group relative h-2 flex-1 overflow-hidden rounded-full bg-elevated"
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-100"
                style={{
                  width:
                    i < state.stepIndex
                      ? '100%'
                      : i === state.stepIndex
                        ? `${(state.finished ? 1 : stepProgress) * 100}%`
                        : '0%',
                }}
              />
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1 text-xs text-muted">
          <span className="sr-only sm:not-sr-only">{t('player.speed')}</span>
          <select
            className="rounded-lg border border-border bg-surface px-1.5 py-1 text-xs"
            value={state.speed}
            onChange={(e) => dispatch({ type: 'SET_SPEED', speed: Number(e.target.value) })}
          >
            {PLAYER_SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-icon"
          onClick={() => dispatch({ type: 'TOGGLE_NARRATION' })}
          aria-pressed={state.showNarration}
          aria-label={state.showNarration ? t('player.hideNarration') : t('player.showNarration')}
          title={state.showNarration ? t('player.hideNarration') : t('player.showNarration')}
        >
          {state.showNarration ? <Captions size={16} /> : <CaptionsOff size={16} />}
        </button>
      </div>

      {caption && (
        <figcaption className="border-t border-border px-4 py-2 text-xs text-muted">
          {caption}
        </figcaption>
      )}

      {/* Erişilebilirlik: metin alternatifi */}
      <details className="border-t border-border px-4 py-2 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-muted">
          {t('player.transcript')}
        </summary>
        <p className="mt-2 text-muted">{tl(scene.a11y.description)}</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {transcript.map((line, i) => (
            <li key={i}>{tl(line)}</li>
          ))}
        </ol>
      </details>
    </figure>
  );
}

/** Klavye kısayolları yalnızca oynatıcının kendisi odaktayken çalışır; kontroller yerel davranışını korur */
function isInteractiveTarget(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest(
      'button, a, input, select, textarea, summary, [role="tab"], [contenteditable]',
    ) !== null
  );
}
