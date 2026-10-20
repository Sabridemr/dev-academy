'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Captions, CaptionsOff, Maximize2, Minimize2, Play, RotateCcw } from 'lucide-react';
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
import { PlayerControls } from '../ui/PlayerControls';
import { SceneCanvas } from './SceneCanvas';

interface Props {
  scene: AnimationScene;
  caption?: string;
  autoPlay?: boolean;
  /** Bitince kısa bir duraklamanın ardından baştan oynat (vitrin) */
  loop?: boolean;
  className?: string;
  /** Oynatıcı ilk kez oynatıldığında (ilerleme/analitik) */
  onFirstPlay?: () => void;
}

/**
 * Web animasyon motoru. Tüm durum geçişleri shared/playerReducer'dan gelir;
 * zaman requestAnimationFrame ile ilerletilir. Klavye: Boşluk = oynat/duraklat, ←/→ = adım.
 * Kapakta büyük oynat düğmesi, tam ekran ve bitiş ekranı vardır.
 */
export function ScenePlayer({
  scene,
  caption,
  autoPlay = false,
  loop = false,
  className,
  onFirstPlay,
}: Props) {
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
  const playedOnce = useRef(autoPlay);
  const rootRef = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [started, setStarted] = useState(autoPlay);

  useEffect(() => {
    dispatch({ type: 'SET_REDUCED_MOTION', value: reducedMotionPref });
  }, [reducedMotionPref]);

  // Sahne değişirse baştan başlat (editör önizlemesi); ilk mount'ta değil (autoPlay korunur)
  const prevScene = useRef(scene);
  useEffect(() => {
    if (prevScene.current === scene) return;
    prevScene.current = scene;
    dispatch({ type: 'RESET' });
  }, [scene]);

  // Döngü: bitince 1.8 sn bekleyip baştan oynat (PLAY bitmiş durumda sıfırlayıp başlatır)
  useEffect(() => {
    if (!loop || !state.finished) return;
    const id = setTimeout(() => dispatch({ type: 'PLAY' }), 1800);
    return () => clearTimeout(id);
  }, [loop, state.finished]);

  useEffect(() => {
    if (!state.playing) {
      lastTs.current = null;
      return;
    }
    setStarted(true);
    if (!playedOnce.current) {
      playedOnce.current = true;
      onFirstPlay?.();
    }
    let raf = 0;
    const loopFrame = (ts: number) => {
      if (lastTs.current !== null)
        dispatch({ type: 'TICK', deltaMs: Math.min(100, ts - lastTs.current) });
      lastTs.current = ts;
      raf = requestAnimationFrame(loopFrame);
    };
    raf = requestAnimationFrame(loopFrame);
    return () => cancelAnimationFrame(raf);
  }, [state.playing, onFirstPlay]);

  // Herhangi bir adım etkileşimi kapağı kaldırır
  const interact = useCallback((action: PlayerAction) => {
    setStarted(true);
    dispatch(action);
  }, []);

  // Tam ekran durumunu tarayıcıdan izle (Esc ile çıkış dahil)
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen?.();
    } catch {
      /* desteklenmiyor */
    }
  };

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Odak bir kontrol üzerindeyse (düğme, sekme, kaydırıcı, özet...) tuş o kontrolün kendi işini yapar
      if (isInteractiveTarget(e.target)) return;
      if (e.key === ' ') {
        e.preventDefault();
        interact({ type: 'TOGGLE_PLAY' });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        interact({ type: 'NEXT' });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        interact({ type: 'PREV' });
      }
    },
    [interact],
  );

  const view = resolveStepView(scene, state.stepIndex);
  const step = view.step;
  const total = scene.steps.length;
  const stepProgress = Math.min(1, state.elapsedMs / step.durationMs);
  const transcript = sceneTranscript(scene);
  const showCover = !started && !state.playing && state.stepIndex === 0 && state.elapsedMs === 0;
  const showFinished = state.finished && !loop;

  return (
    <figure
      ref={rootRef}
      className={cn(
        'card overflow-hidden',
        fullscreen && 'flex h-full flex-col justify-center rounded-none border-0 bg-bg',
        className,
      )}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-roledescription={t('player.role')}
      aria-label={tl(scene.title)}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{tl(scene.title)}</p>
          <p className="text-xs text-muted">
            {t('player.step', { current: state.stepIndex + 1, total })} · {tl(step.title)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {state.reducedMotion && (
            <span className="chip hidden sm:inline-flex">{t('player.reducedMotion')}</span>
          )}
          <button
            type="button"
            className="btn-icon btn-icon-sm"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
            title={fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
          >
            {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          'bg-dots relative bg-surface px-2 py-3',
          fullscreen && 'flex flex-1 items-center justify-center [&>svg]:max-h-[70vh]',
        )}
      >
        <SceneCanvas
          scene={scene}
          view={view}
          elapsedMs={state.elapsedMs}
          reducedMotion={state.reducedMotion}
        />
        {/* Kapak: büyük oynat düğmesi */}
        <AnimatePresence>
          {showCover && (
            <motion.button
              key="cover"
              type="button"
              initial={false}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => interact({ type: 'PLAY' })}
              className="group absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg/40 backdrop-blur-[1px]"
              aria-label={t('player.play')}
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-fg shadow-glow transition group-hover:scale-105">
                <Play size={26} className="ml-1" />
              </span>
              <span className="rounded-full bg-surface/90 px-3 py-1 text-xs text-muted">
                {t('player.startHint')}
              </span>
            </motion.button>
          )}
          {showFinished && (
            <motion.div
              key="finished"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg/60 backdrop-blur-[1px]"
            >
              <p className="text-sm font-medium">{t('player.finished')}</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => interact({ type: 'PLAY' })}
              >
                <RotateCcw size={15} /> {t('player.replay')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {state.showNarration && (
          <motion.div
            key={step.id}
            initial={state.reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="min-h-[4.5rem] border-t border-border bg-elevated/50 px-4 py-3 text-sm leading-6"
            aria-live="polite"
          >
            <p className="mb-1 font-semibold">{tl(step.title)}</p>
            <div className="prose-da max-w-none [&_p]:my-0">
              <ReactMarkdown>{tl(step.narration)}</ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PlayerControls
        playing={state.playing}
        onTogglePlay={() => interact({ type: 'TOGGLE_PLAY' })}
        onPrev={() => interact({ type: 'PREV' })}
        onNext={() => interact({ type: 'NEXT' })}
        onRestart={() => interact({ type: 'RESET' })}
        canPrev={state.stepIndex > 0}
        canNext={!state.finished}
        timeline={
          <div
            className="flex w-full items-center gap-1"
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
                onClick={() => interact({ type: 'SEEK', stepIndex: i })}
                className="group relative h-6 flex-1"
              >
                <span className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-elevated group-hover:bg-border">
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
                </span>
              </button>
            ))}
          </div>
        }
        right={
          <>
            <div
              className="hidden items-center rounded-lg border border-border bg-elevated/60 p-0.5 sm:flex"
              role="group"
              aria-label={t('player.speed')}
            >
              {PLAYER_SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_SPEED', speed: s })}
                  aria-pressed={state.speed === s}
                  className={cn(
                    'rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums transition',
                    state.speed === s ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
                  )}
                >
                  {s}×
                </button>
              ))}
            </div>
            <label className="flex items-center text-xs text-muted sm:hidden">
              <span className="sr-only">{t('player.speed')}</span>
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
              className="btn-icon btn-icon-sm"
              onClick={() => dispatch({ type: 'TOGGLE_NARRATION' })}
              aria-pressed={state.showNarration}
              aria-label={
                state.showNarration ? t('player.hideNarration') : t('player.showNarration')
              }
              title={state.showNarration ? t('player.hideNarration') : t('player.showNarration')}
            >
              {state.showNarration ? <Captions size={15} /> : <CaptionsOff size={15} />}
            </button>
          </>
        }
      />

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
