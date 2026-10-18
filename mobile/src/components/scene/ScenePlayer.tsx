import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import { Button, IconButton, Text } from '@/components/ui';
import { MarkdownView } from '@/components/lesson/MarkdownView';
import { SceneCanvas } from './SceneCanvas';

interface Props {
  scene: AnimationScene;
  caption?: string;
  autoPlay?: boolean;
  /** İlk oynatmada (ilerleme/analitik) */
  onFirstPlay?: () => void;
  testID?: string;
}

/** Bir karede en fazla bu kadar ms ilerlet (uygulama arka plandan dönünce sıçramayı önler) */
const MAX_FRAME_DELTA = 100;

/**
 * MOBİL ANİMASYON MOTORU
 * ----------------------
 * Web ScenePlayer ile aynı sahne JSON'unu, aynı shared `playerReducer` ile oynatır.
 * Zaman requestAnimationFrame ile ilerletilir (TICK); düğüm geçişleri SceneCanvas içinde Reanimated ile.
 * Erişilebilirlik: reduced-motion (AccessibilityInfo) → SET_REDUCED_MOTION; metin transkripti; tüm
 * kontrollerde etiketler.
 */
export function ScenePlayer({
  scene,
  caption,
  autoPlay = false,
  onFirstPlay,
  testID = 'scene-player',
}: Props) {
  const { t, tl } = useI18n();
  const { colors } = useTheme();
  const reducer = useMemo(
    () => (s: PlayerState, a: PlayerAction) => playerReducer(scene, s, a),
    [scene],
  );
  const [state, dispatch] = useReducer(reducer, scene, (sc) =>
    createPlayerState(sc, { playing: autoPlay }),
  );
  const [width, setWidth] = useState(0);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const playedOnce = useRef(false);
  const onFirstPlayRef = useRef(onFirstPlay);
  onFirstPlayRef.current = onFirstPlay;

  // Reduced motion tercihi
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) dispatch({ type: 'SET_REDUCED_MOTION', value });
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value: boolean) =>
      dispatch({ type: 'SET_REDUCED_MOTION', value }),
    );
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

  // Sahne değişirse baştan
  const firstScene = useRef(scene);
  useEffect(() => {
    if (firstScene.current !== scene) dispatch({ type: 'RESET' });
  }, [scene]);

  // Zaman döngüsü
  useEffect(() => {
    if (!state.playing) return;
    if (!playedOnce.current) {
      playedOnce.current = true;
      onFirstPlayRef.current?.();
    }
    let raf = 0;
    let last: number | null = null;
    const loop = () => {
      const now = Date.now();
      if (last !== null) dispatch({ type: 'TICK', deltaMs: Math.min(MAX_FRAME_DELTA, now - last) });
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state.playing]);

  const view = resolveStepView(scene, state.stepIndex);
  const step = view.step;
  const total = scene.steps.length;
  const stepProgress = Math.min(1, state.elapsedMs / step.durationMs);
  const transcript = sceneTranscript(scene);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };

  return (
    <View
      testID={testID}
      style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel={tl(scene.title)}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text variant="label" numberOfLines={1}>
          {tl(scene.title)}
        </Text>
        <Text variant="caption" muted testID="scene-step-label" numberOfLines={1}>
          {t('player.step', { current: state.stepIndex + 1, total })} · {tl(step.title)}
        </Text>
        {state.reducedMotion ? (
          <Text variant="caption" muted>
            {t('player.reducedMotion')}
          </Text>
        ) : null}
      </View>

      <View
        onLayout={onLayout}
        testID="scene-canvas-container"
        style={[styles.canvas, { backgroundColor: withAlpha(colors.bg, 0.6) }]}
      >
        <SceneCanvas
          scene={scene}
          view={view}
          elapsedMs={state.elapsedMs}
          reducedMotion={state.reducedMotion}
          width={width}
        />
      </View>

      {state.showNarration ? (
        <View
          style={[
            styles.narration,
            { borderTopColor: colors.border, backgroundColor: withAlpha(colors.elevated, 0.5) },
          ]}
          accessibilityLiveRegion="polite"
          testID="scene-narration"
        >
          <Text variant="label">{tl(step.title)}</Text>
          <NarrationText key={step.id} text={tl(step.narration)} />
        </View>
      ) : null}

      {/* Kontroller */}
      <View style={[styles.controls, { borderTopColor: colors.border }]}>
        <IconButton
          icon="chevron-back"
          label={t('player.stepBack')}
          onPress={() => dispatch({ type: 'PREV' })}
          disabled={state.stepIndex === 0}
          testID="scene-prev"
        />
        <Button
          title={state.playing ? t('player.pause') : t('player.play')}
          icon={state.playing ? 'pause' : 'play'}
          compact
          onPress={() => dispatch({ type: 'TOGGLE_PLAY' })}
          testID="scene-play"
        />
        <IconButton
          icon="chevron-forward"
          label={t('player.stepForward')}
          onPress={() => dispatch({ type: 'NEXT' })}
          disabled={state.finished}
          testID="scene-next"
        />
        <IconButton
          icon="refresh"
          label={t('player.restart')}
          onPress={() => dispatch({ type: 'RESET' })}
          testID="scene-restart"
        />
        <View style={{ flex: 1 }} />
        <IconButton
          icon={state.showNarration ? 'chatbox-ellipses' : 'chatbox-outline'}
          label={state.showNarration ? t('player.hideNarration') : t('player.showNarration')}
          active={state.showNarration}
          onPress={() => dispatch({ type: 'TOGGLE_NARRATION' })}
          testID="scene-narration-toggle"
        />
      </View>

      {/* Adım çizelgesi (seek) */}
      <View style={styles.timeline} accessibilityRole="tablist">
        {scene.steps.map((s, i) => {
          const fillPct =
            i < state.stepIndex
              ? 1
              : i === state.stepIndex
                ? state.finished
                  ? 1
                  : stepProgress
                : 0;
          return (
            <Pressable
              key={s.id}
              onPress={() => dispatch({ type: 'SEEK', stepIndex: i })}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === state.stepIndex }}
              accessibilityLabel={t('player.seekTo', { index: i + 1, title: tl(s.title) })}
              hitSlop={{ top: 12, bottom: 12 }}
              style={[styles.segment, { backgroundColor: colors.elevated }]}
              testID={`scene-seek-${i}`}
            >
              <View
                style={{
                  width: `${fillPct * 100}%`,
                  height: '100%',
                  backgroundColor: colors.primary,
                  borderRadius: 3,
                }}
              />
            </Pressable>
          );
        })}
      </View>

      {/* Hız */}
      <View
        style={styles.speedRow}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('player.speed')}
      >
        <Text variant="caption" muted>
          {t('player.speed')}
        </Text>
        {PLAYER_SPEEDS.map((sp) => {
          const selected = state.speed === sp;
          return (
            <Pressable
              key={sp}
              onPress={() => dispatch({ type: 'SET_SPEED', speed: sp })}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${t('player.speed')} ${sp}×`}
              style={[
                styles.speedBtn,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? withAlpha(colors.primary, 0.12) : 'transparent',
                },
              ]}
              testID={`scene-speed-${sp}`}
            >
              <Text variant="caption" weight="600" color={selected ? colors.primary : colors.fg}>
                {sp}×
              </Text>
            </Pressable>
          );
        })}
      </View>

      {caption ? (
        <Text variant="caption" muted style={[styles.caption, { borderTopColor: colors.border }]}>
          {caption}
        </Text>
      ) : null}

      {/* Erişilebilirlik: metin alternatifi */}
      <View style={[styles.transcript, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={() => setTranscriptOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ expanded: transcriptOpen }}
          style={styles.transcriptToggle}
          testID="scene-transcript-toggle"
        >
          <Ionicons
            name={transcriptOpen ? 'chevron-down' : 'chevron-forward'}
            size={14}
            color={colors.muted}
          />
          <Text variant="caption" muted weight="600">
            {t('player.transcript')}
          </Text>
        </Pressable>
        {transcriptOpen ? (
          <View style={{ gap: spacing.xs }} testID="scene-transcript">
            <Text variant="caption" muted>
              {tl(scene.a11y.description)}
            </Text>
            {transcript.map((line, i) => (
              <Text key={i} variant="caption">
                {i + 1}. {tl(line)}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Anlatım yalnızca adım değişince yeniden çizilir (her karede değil) */
function NarrationText({ text }: { text: string }) {
  return <MarkdownView compact>{text}</MarkdownView>;
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  canvas: { paddingVertical: spacing.sm },
  narration: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  timeline: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  segment: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  speedBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  caption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  transcript: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  transcriptToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
});
