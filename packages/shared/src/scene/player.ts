import type { AnimationScene, EdgeState, NodeState, NodeStatus, SceneStep } from './schema';

/**
 * PLATFORMDAN BAĞIMSIZ SAHNE OYNATICI DURUM MAKİNESİ
 * ---------------------------------------------------
 * Web ve mobil motorlar bu reducer'ı kullanır; sadece çizim katmanı farklıdır.
 * Zaman ilerletme (TICK) dışarıdan requestAnimationFrame / Reanimated frame callback ile gelir.
 */

export interface PlayerState {
  stepIndex: number;
  /** Aktif adımda geçen süre (ms, hız uygulanmış) */
  elapsedMs: number;
  playing: boolean;
  speed: number;
  showNarration: boolean;
  finished: boolean;
  /** Reduced-motion: paketler anında varış noktasında gösterilir */
  reducedMotion: boolean;
}

export type PlayerAction =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'SEEK'; stepIndex: number }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'TOGGLE_NARRATION' }
  | { type: 'SET_REDUCED_MOTION'; value: boolean }
  | { type: 'TICK'; deltaMs: number }
  | { type: 'RESET' };

export const PLAYER_SPEEDS = [0.5, 1, 1.5, 2] as const;

export function createPlayerState(scene: AnimationScene, overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    stepIndex: 0,
    elapsedMs: 0,
    playing: false,
    speed: scene.defaultSpeed ?? 1,
    showNarration: true,
    finished: false,
    reducedMotion: false,
    ...overrides,
  };
}

function clampStep(scene: AnimationScene, idx: number): number {
  return Math.max(0, Math.min(scene.steps.length - 1, idx));
}

export function playerReducer(scene: AnimationScene, state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'PLAY':
      if (state.finished) {
        return { ...state, stepIndex: 0, elapsedMs: 0, finished: false, playing: true };
      }
      return { ...state, playing: true };
    case 'PAUSE':
      return { ...state, playing: false };
    case 'TOGGLE_PLAY':
      return playerReducer(scene, state, { type: state.playing ? 'PAUSE' : 'PLAY' });
    case 'NEXT': {
      const last = scene.steps.length - 1;
      if (state.stepIndex >= last) {
        return { ...state, elapsedMs: 0, playing: false, finished: true };
      }
      return { ...state, stepIndex: state.stepIndex + 1, elapsedMs: 0, finished: false };
    }
    case 'PREV':
      return { ...state, stepIndex: clampStep(scene, state.stepIndex - 1), elapsedMs: 0, finished: false };
    case 'SEEK':
      return { ...state, stepIndex: clampStep(scene, action.stepIndex), elapsedMs: 0, finished: false };
    case 'SET_SPEED':
      return { ...state, speed: Math.max(0.1, Math.min(8, action.speed)) };
    case 'TOGGLE_NARRATION':
      return { ...state, showNarration: !state.showNarration };
    case 'SET_REDUCED_MOTION':
      return { ...state, reducedMotion: action.value };
    case 'RESET':
      return createPlayerState(scene, { speed: state.speed, showNarration: state.showNarration, reducedMotion: state.reducedMotion });
    case 'TICK': {
      if (!state.playing) return state;
      const step = scene.steps[state.stepIndex];
      const elapsed = state.elapsedMs + action.deltaMs * state.speed;
      if (elapsed < step.durationMs) {
        return { ...state, elapsedMs: elapsed };
      }
      const last = scene.steps.length - 1;
      if (state.stepIndex >= last) {
        if (scene.loop) return { ...state, stepIndex: 0, elapsedMs: 0 };
        return { ...state, elapsedMs: step.durationMs, playing: false, finished: true };
      }
      return { ...state, stepIndex: state.stepIndex + 1, elapsedMs: 0 };
    }
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* Adım görünümü çözümleme: inherit zinciri ile kümülatif durumlar     */
/* ------------------------------------------------------------------ */

export interface ResolvedNodeView {
  id: string;
  status: NodeStatus;
  badge?: string;
  counter?: number;
  progress?: number;
  visible: boolean;
  highlighted: boolean;
  labelOverride?: NodeState['label'];
  sublabelOverride?: NodeState['sublabel'];
}

export interface ResolvedEdgeView {
  id: string;
  status: NonNullable<EdgeState['status']>;
  visible: boolean;
  highlighted: boolean;
  labelOverride?: EdgeState['label'];
}

export interface ResolvedStepView {
  step: SceneStep;
  nodes: Record<string, ResolvedNodeView>;
  edges: Record<string, ResolvedEdgeView>;
}

const resolveCache = new WeakMap<AnimationScene, Map<number, ResolvedStepView>>();

/**
 * Verilen adım için tüm düğüm/kenar durumlarını hesaplar.
 * inherit=true olan adımlar bir önceki adımın çözümlenmiş durumunu temel alır.
 */
export function resolveStepView(scene: AnimationScene, stepIndex: number): ResolvedStepView {
  let perScene = resolveCache.get(scene);
  if (!perScene) {
    perScene = new Map();
    resolveCache.set(scene, perScene);
  }
  const cached = perScene.get(stepIndex);
  if (cached) return cached;

  const step = scene.steps[stepIndex];
  const nodes: Record<string, ResolvedNodeView> = {};
  const edges: Record<string, ResolvedEdgeView> = {};

  if (step.inherit && stepIndex > 0) {
    const prev = resolveStepView(scene, stepIndex - 1);
    for (const [id, v] of Object.entries(prev.nodes)) nodes[id] = { ...v, highlighted: false };
    for (const [id, v] of Object.entries(prev.edges)) edges[id] = { ...v, highlighted: false };
  } else {
    for (const n of scene.nodes) {
      nodes[n.id] = { id: n.id, status: n.status, visible: true, highlighted: false };
    }
    for (const e of scene.edges) {
      edges[e.id] = { id: e.id, status: 'idle', visible: true, highlighted: false };
    }
  }

  for (const [id, st] of Object.entries(step.nodeStates)) {
    const cur = nodes[id] ?? { id, status: 'idle' as NodeStatus, visible: true, highlighted: false };
    nodes[id] = {
      ...cur,
      status: st.status ?? cur.status,
      badge: st.badge !== undefined ? st.badge : cur.badge,
      counter: st.counter !== undefined ? st.counter : cur.counter,
      progress: st.progress !== undefined ? st.progress : cur.progress,
      visible: st.visible !== undefined ? st.visible : cur.visible,
      labelOverride: st.label !== undefined ? st.label : cur.labelOverride,
      sublabelOverride: st.sublabel !== undefined ? st.sublabel : cur.sublabelOverride,
    };
  }
  for (const [id, st] of Object.entries(step.edgeStates)) {
    const cur = edges[id] ?? { id, status: 'idle' as const, visible: true, highlighted: false };
    edges[id] = {
      ...cur,
      status: st.status ?? cur.status,
      visible: st.visible !== undefined ? st.visible : cur.visible,
      labelOverride: st.label !== undefined ? st.label : cur.labelOverride,
    };
  }
  for (const id of step.highlight.nodes) if (nodes[id]) nodes[id].highlighted = true;
  for (const id of step.highlight.edges) if (edges[id]) edges[id].highlighted = true;

  const view = { step, nodes, edges };
  perScene.set(stepIndex, view);
  return view;
}

/* ------------------------------------------------------------------ */
/* Paket konumu hesaplama                                              */
/* ------------------------------------------------------------------ */

export interface PacketInstance {
  key: string;
  edgeId: string;
  direction: 'forward' | 'backward';
  /** 0..1 arası ilerleme, görünmüyorsa null */
  progress: number | null;
  label?: ScenePacketLabel;
  color?: string;
  shape: 'dot' | 'envelope' | 'square' | 'diamond';
}
type ScenePacketLabel = SceneStep['packets'][number]['label'];

/** Aktif adımda geçen süreye göre her paket örneğinin ilerlemesini verir. */
export function computePackets(step: SceneStep, elapsedMs: number, reducedMotion = false): PacketInstance[] {
  const out: PacketInstance[] = [];
  step.packets.forEach((p, pIdx) => {
    for (let r = 0; r < p.repeat; r++) {
      const start = p.startAt + r * (p.durationMs + p.repeatGapMs);
      const end = start + p.durationMs;
      let progress: number | null;
      if (reducedMotion) {
        progress = elapsedMs >= start ? 1 : null;
      } else if (elapsedMs < start || elapsedMs > end) {
        progress = null;
      } else {
        progress = (elapsedMs - start) / p.durationMs;
      }
      out.push({
        key: `${p.id ?? pIdx}-${r}`,
        edgeId: p.edge,
        direction: p.direction,
        progress,
        label: p.label,
        color: p.color,
        shape: p.shape,
      });
    }
  });
  return out;
}

/** Toplam sahne süresi (ms) */
export function sceneDuration(scene: AnimationScene): number {
  return scene.steps.reduce((acc, s) => acc + s.durationMs, 0);
}

/** Erişilebilirlik transkripti: a11y.transcript varsa onu, yoksa adım anlatımlarını döner */
export function sceneTranscript(scene: AnimationScene) {
  return scene.a11y.transcript && scene.a11y.transcript.length > 0
    ? scene.a11y.transcript
    : scene.steps.map((s) => s.narration);
}
