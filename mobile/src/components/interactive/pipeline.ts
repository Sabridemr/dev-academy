/**
 * CI/CD PIPELINE — saf motor (web/src/components/simulators/PipelineSim.tsx'teki tik döngüsünün birebir karşılığı).
 * Her `pipelineTick` çağrısı bir zaman adımıdır; yan etkisizdir, günlük kayıtlarını ayrıca döner.
 */

export type Strategy = 'rolling' | 'blue-green' | 'canary';
export type StageStatus = 'idle' | 'running' | 'success' | 'failed' | 'skipped' | 'rolledback';
export type PipelineOutcome = 'ok' | 'failed' | 'rolledback' | null;

export const DEFAULT_STAGES = [
  'commit',
  'build',
  'test',
  'lint',
  'image-push',
  'staging',
  'canary',
  'prod',
];
export const STRATEGIES: Strategy[] = ['rolling', 'blue-green', 'canary'];
/** Canary hata eşiği (%) */
export const CANARY_THRESHOLD = 2;
export const INSTANCES = 8;
export const DEPLOY_TICKS = 6;

export const isCanaryStage = (s: string) => /canary|flag/.test(s);

export interface PipelineState {
  stage: number;
  tick: number;
  attempt: number;
  status: StageStatus[];
  deployProgress: number;
  elapsed: number;
  outcome: PipelineOutcome;
  running: boolean;
}

export interface PipelineConfig {
  inject: boolean;
  failAt: string;
  canaryErr: number;
  retries: number;
  strategy: Strategy;
}

export type PipelineLog =
  | { type: 'start' | 'ok' | 'fail'; stage: string }
  | { type: 'retry'; stage: string; attempt: number }
  | { type: 'rollback' };

export function parseStages(params: Record<string, unknown>): string[] {
  const v = params.stages;
  return typeof v === 'string' && v.trim()
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12)
    : DEFAULT_STAGES;
}

/** failureStage parametresi geçerliyse o, değilse "test" içeren ilk aşama */
export function defaultFailStage(stages: string[], failureParam: string): string {
  return stages.includes(failureParam)
    ? failureParam
    : (stages.find((s) => s.includes('test')) ?? stages[1] ?? stages[0]);
}

export function createPipelineState(stageCount: number, running = false): PipelineState {
  return {
    stage: 0,
    tick: 0,
    attempt: 0,
    status: Array.from({ length: stageCount }, () => 'idle'),
    deployProgress: 0,
    elapsed: 0,
    outcome: null,
    running,
  };
}

export function pipelineTick(
  prev: PipelineState,
  stages: string[],
  cfg: PipelineConfig,
): { state: PipelineState; logs: PipelineLog[] } {
  if (!prev.running) return { state: prev, logs: [] };
  const logs: PipelineLog[] = [];
  const s: PipelineState = { ...prev, status: prev.status.slice(), elapsed: prev.elapsed + 1 };
  const lastIdx = stages.length - 1;
  const name = stages[s.stage];
  const markFrom = (st: StageStatus) => {
    s.status = s.status.map((x, i) => (i === s.stage ? st : i > s.stage ? 'skipped' : x));
  };

  if (s.tick === 0) {
    s.status[s.stage] = 'running';
    if (s.attempt === 0) logs.push({ type: 'start', stage: name });
  }
  s.tick += 1;
  const isDeploy = s.stage === lastIdx;
  const needed = isDeploy ? DEPLOY_TICKS : 2;
  if (isDeploy) s.deployProgress = Math.min(1, s.tick / DEPLOY_TICKS);

  // Canary analizi: canary aşamasında ya da canary stratejisiyle son aşamanın ortasında
  const canaryCheck =
    (isCanaryStage(name) && s.tick === needed) ||
    (isDeploy && cfg.strategy === 'canary' && !stages.some(isCanaryStage) && s.tick === 2);
  if (canaryCheck && cfg.canaryErr > CANARY_THRESHOLD) {
    markFrom('rolledback');
    s.deployProgress = 0;
    logs.push({ type: 'fail', stage: name }, { type: 'rollback' });
    return { state: { ...s, outcome: 'rolledback', running: false }, logs };
  }
  if (s.tick < needed) return { state: s, logs };

  if (cfg.inject && cfg.failAt === name) {
    if (s.attempt < cfg.retries) {
      s.attempt += 1;
      s.tick = 0;
      logs.push({ type: 'retry', stage: name, attempt: s.attempt });
      return { state: s, logs };
    }
    markFrom('failed');
    logs.push({ type: 'fail', stage: name });
    return { state: { ...s, outcome: 'failed', running: false }, logs };
  }

  s.status[s.stage] = 'success';
  logs.push({ type: 'ok', stage: name });
  if (s.stage >= lastIdx) return { state: { ...s, outcome: 'ok', running: false }, logs };
  return { state: { ...s, stage: s.stage + 1, tick: 0, attempt: 0 }, logs };
}

/** Üretim filosunun görünümü: örnek sürümleri ve v2 trafiği (%) */
export function fleetView(
  state: PipelineState,
  strategy: Strategy,
): { versions: (1 | 2)[]; v2Traffic: number; progress: number } {
  const rolledBack = state.outcome === 'rolledback';
  const p = state.status[state.status.length - 1] === 'success' ? 1 : state.deployProgress;
  const versions = Array.from({ length: INSTANCES }, (_, i): 1 | 2 => {
    if (rolledBack) return 1;
    if (strategy === 'rolling') return i < Math.round(p * INSTANCES) ? 2 : 1;
    if (strategy === 'blue-green') return i >= INSTANCES / 2 ? 2 : 1; // yeşil grup hazırlanır
    const canaryShare = p < 0.34 ? 0.125 : p < 0.67 ? 0.25 : p < 1 ? 0.5 : 1;
    return p > 0 && i < Math.max(1, Math.round(canaryShare * INSTANCES)) ? 2 : 1;
  });
  let v2Traffic: number;
  if (rolledBack) v2Traffic = 0;
  else if (strategy === 'blue-green') v2Traffic = p >= 1 ? 100 : 0;
  else if (strategy === 'rolling') v2Traffic = Math.round(p * 100);
  else v2Traffic = p <= 0 ? 0 : p < 0.34 ? 5 : p < 0.67 ? 25 : p < 1 ? 50 : 100;
  return { versions, v2Traffic, progress: p };
}
