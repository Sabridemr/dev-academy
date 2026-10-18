'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, RotateCcw, Square } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { LogList, Range, Select, SimShell, Stat } from './ui';
import { numParam, strParam, type SimulatorProps } from './types';

type Strategy = 'rolling' | 'blue-green' | 'canary';
type StageStatus = 'idle' | 'running' | 'success' | 'failed' | 'skipped' | 'rolledback';

const DEFAULT_STAGES = ['commit', 'build', 'test', 'lint', 'image-push', 'staging', 'canary', 'prod'];
const CANARY_THRESHOLD = 2; // %
const INSTANCES = 8;
const DEPLOY_TICKS = 6;

const L = {
  tr: {
    title: 'CI/CD pipeline',
    run: 'Pipeline’ı çalıştır',
    stop: 'Durdur',
    strategy: 'Dağıtım stratejisi',
    strategies: { rolling: 'Rolling update', 'blue-green': 'Blue-green', canary: 'Canary' } satisfies Record<Strategy, string>,
    inject: 'Hata enjekte et',
    injectAt: 'Hata aşaması',
    none: 'yok',
    canaryErr: 'Canary hata oranı',
    retries: 'Yeniden deneme',
    duration: 'Süre',
    status: 'Durum',
    statuses: { idle: 'bekliyor', running: 'çalışıyor', success: 'başarılı', failed: 'başarısız', skipped: 'atlandı', rolledback: 'geri alındı' } satisfies Record<StageStatus, string>,
    fleet: 'Üretim filosu',
    traffic: 'Trafik',
    result: 'Sonuç',
    ok: 'Dağıtım tamamlandı ✓',
    failed: (s: string) => `Pipeline “${s}” aşamasında durdu; sonraki aşamalar çalışmadı.`,
    rolled: (e: number) => `Canary hata oranı %${e} > %${CANARY_THRESHOLD} → otomatik geri alma (rollback). Kullanıcıların çoğu etkilenmedi.`,
    logStart: (s: string) => `▶ ${s} başladı`,
    logOk: (s: string) => `✓ ${s} başarılı`,
    logRetry: (s: string, n: number) => `↻ ${s} başarısız, yeniden deneme ${n}`,
    logFail: (s: string) => `✗ ${s} başarısız`,
    logRollback: 'Rollback: trafik v1’e döndürüldü',
  },
  en: {
    title: 'CI/CD pipeline',
    run: 'Run pipeline',
    stop: 'Stop',
    strategy: 'Deploy strategy',
    strategies: { rolling: 'Rolling update', 'blue-green': 'Blue-green', canary: 'Canary' } satisfies Record<Strategy, string>,
    inject: 'Inject failure',
    injectAt: 'Failure stage',
    none: 'none',
    canaryErr: 'Canary error rate',
    retries: 'Retries',
    duration: 'Duration',
    status: 'Status',
    statuses: { idle: 'pending', running: 'running', success: 'passed', failed: 'failed', skipped: 'skipped', rolledback: 'rolled back' } satisfies Record<StageStatus, string>,
    fleet: 'Production fleet',
    traffic: 'Traffic',
    result: 'Result',
    ok: 'Deployment completed ✓',
    failed: (s: string) => `Pipeline stopped at “${s}”; later stages did not run.`,
    rolled: (e: number) => `Canary error rate ${e}% > ${CANARY_THRESHOLD}% → automatic rollback. Most users were unaffected.`,
    logStart: (s: string) => `▶ ${s} started`,
    logOk: (s: string) => `✓ ${s} passed`,
    logRetry: (s: string, n: number) => `↻ ${s} failed, retry ${n}`,
    logFail: (s: string) => `✗ ${s} failed`,
    logRollback: 'Rollback: traffic returned to v1',
  },
};

const isCanaryStage = (s: string) => /canary|flag/.test(s);

export default function PipelineSim({ params, onInteract }: SimulatorProps) {
  const { t, locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const stages = typeof params.stages === 'string' && params.stages.trim() ? params.stages.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12) : DEFAULT_STAGES;
  const failureParam = strParam(params, 'failureStage', '');
  const [failAt, setFailAt] = useState<string>(stages.includes(failureParam) ? failureParam : stages.find((s) => s.includes('test')) ?? stages[1] ?? stages[0]);
  const [inject, setInject] = useState(false);
  const [canaryErr, setCanaryErr] = useState(0.5);
  const [retries, setRetries] = useState(() => numParam(params, 'retries', 1, 0, 3));
  const [strategy, setStrategy] = useState<Strategy>('canary');
  const [status, setStatus] = useState<StageStatus[]>(() => stages.map(() => 'idle'));
  const [running, setRunning] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [log, setLog] = useState<{ id: number; text: string; tone: 'success' | 'danger' | 'muted' }[]>([]);
  const [outcome, setOutcome] = useState<'ok' | 'failed' | 'rolledback' | null>(null);
  const cursor = useRef({ stage: 0, tick: 0, attempt: 0 });
  const seq = useRef(0);
  const cfg = useRef({ inject, failAt, canaryErr, retries, strategy });
  cfg.current = { inject, failAt, canaryErr, retries, strategy };
  const stagesKey = stages.join(',');

  const push = (text: string, tone: 'success' | 'danger' | 'muted') => setLog((lg) => [...lg, { id: ++seq.current, text, tone }].slice(-30));

  const reset = () => {
    setRunning(false);
    setStatus(stages.map(() => 'idle'));
    setDeployProgress(0);
    setElapsed(0);
    setOutcome(null);
    cursor.current = { stage: 0, tick: 0, attempt: 0 };
  };

  const start = () => {
    onInteract();
    reset();
    setLog([]);
    setRunning(true);
  };

  // Pipeline motoru: her tikte mevcut aşamayı ilerletir
  useEffect(() => {
    if (!running) return;
    const lastIdx = stages.length - 1;
    const id = setInterval(() => {
      const c = cursor.current;
      const cf = cfg.current;
      const name = stages[c.stage];
      setElapsed((e) => e + 1);
      if (c.tick === 0) {
        setStatus((st) => st.map((s, i) => (i === c.stage ? 'running' : s)));
        if (c.attempt === 0) push(l.logStart(name), 'muted');
      }
      c.tick += 1;
      const isDeploy = c.stage === lastIdx;
      const needed = isDeploy ? DEPLOY_TICKS : 2;
      if (isDeploy) setDeployProgress(Math.min(1, c.tick / DEPLOY_TICKS));
      // Canary analizi: canary aşamasında ya da canary stratejisiyle son aşamanın ortasında
      const canaryCheck = (isCanaryStage(name) && c.tick === needed) || (isDeploy && cf.strategy === 'canary' && !stages.some(isCanaryStage) && c.tick === 2);
      if (canaryCheck && cf.canaryErr > CANARY_THRESHOLD) {
        setStatus((st) => st.map((s, i) => (i === c.stage ? 'rolledback' : i > c.stage ? 'skipped' : s)));
        setDeployProgress(0);
        push(l.logFail(name), 'danger');
        push(l.logRollback, 'danger');
        setOutcome('rolledback');
        setRunning(false);
        return;
      }
      if (c.tick < needed) return;
      if (cf.inject && cf.failAt === name) {
        if (c.attempt < cf.retries) {
          c.attempt += 1;
          c.tick = 0;
          push(l.logRetry(name, c.attempt), 'danger');
          return;
        }
        setStatus((st) => st.map((s, i) => (i === c.stage ? 'failed' : i > c.stage ? 'skipped' : s)));
        push(l.logFail(name), 'danger');
        setOutcome('failed');
        setRunning(false);
        return;
      }
      setStatus((st) => st.map((s, i) => (i === c.stage ? 'success' : s)));
      push(l.logOk(name), 'success');
      if (c.stage >= lastIdx) {
        setOutcome('ok');
        setRunning(false);
        return;
      }
      cursor.current = { stage: c.stage + 1, tick: 0, attempt: 0 };
    }, reduced ? 200 : 600);
    return () => clearInterval(id);
    // stagesKey: aşama listesi değişirse motor yeniden kurulur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, stagesKey, reduced, l]);

  const color = (s: StageStatus) =>
    s === 'success' ? 'var(--da-success)' : s === 'failed' || s === 'rolledback' ? 'var(--da-danger)' : s === 'running' ? 'var(--da-primary)' : s === 'skipped' ? 'var(--da-muted)' : 'var(--da-border)';

  const stageW = 600 / stages.length;
  const deployStatus = status[stages.length - 1];
  const p = deployStatus === 'success' ? 1 : deployProgress;
  const rolledBack = outcome === 'rolledback';

  // Strateji görselleştirmesi: her örnek v1 (gri) veya v2 (mavi)
  const instanceVersion = (i: number): 1 | 2 => {
    if (rolledBack) return 1;
    if (strategy === 'rolling') return i < Math.round(p * INSTANCES) ? 2 : 1;
    if (strategy === 'blue-green') return i >= INSTANCES / 2 ? 2 : 1; // yeşil grup hazırlanır
    const canaryShare = p < 0.34 ? 0.125 : p < 0.67 ? 0.25 : p < 1 ? 0.5 : 1;
    return p > 0 && i < Math.max(1, Math.round(canaryShare * INSTANCES)) ? 2 : 1;
  };
  const v2Traffic = rolledBack ? 0 : strategy === 'blue-green' ? (p >= 1 ? 100 : 0) : strategy === 'rolling' ? Math.round(p * 100) : p > 0 ? (p < 0.34 ? 5 : p < 0.67 ? 25 : p < 1 ? 50 : 100) : 0;

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button type="button" className="btn-primary" onClick={running ? () => setRunning(false) : start}>
            {running ? <Square size={14} /> : <Play size={14} />} {running ? l.stop : l.run}
          </button>
          <button type="button" className="btn-ghost" onClick={() => { reset(); setLog([]); }}>
            <RotateCcw size={14} /> {t('sim.reset')}
          </button>
        </>
      }
      aside={
        <>
          <Select label={l.strategy} value={strategy} options={(['rolling', 'blue-green', 'canary'] as const).map((s) => ({ id: s, label: l.strategies[s] }))} onChange={(v) => { onInteract(); setStrategy(v); }} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={inject} onChange={(e) => { onInteract(); setInject(e.target.checked); }} />
            {l.inject}
          </label>
          {inject && <Select label={l.injectAt} value={failAt} options={stages.map((s) => ({ id: s, label: s }))} onChange={setFailAt} />}
          <Range label={l.retries} value={retries} min={0} max={3} onChange={setRetries} />
          <Range label={l.canaryErr} value={canaryErr} min={0} max={10} step={0.5} format={(v) => `${v}%`} onChange={(v) => { onInteract(); setCanaryErr(v); }} />
          <div className="grid grid-cols-2 gap-2">
            <Stat label={l.duration} value={`${elapsed * 30}s`} />
            <Stat label={l.traffic} value={`v2 ${v2Traffic}%`} tone={rolledBack ? 'danger' : 'primary'} />
          </div>
          <LogList items={log.slice().reverse().map((x) => ({ key: x.id, text: x.text, tone: x.tone }))} />
        </>
      }
    >
      <svg viewBox="0 0 600 120" className="h-auto w-full" role="img" aria-label={l.title}>
        {stages.map((s, i) => {
          const x = i * stageW;
          const st = status[i];
          return (
            <g key={s}>
              {i > 0 && <line x1={x - 6} y1={44} x2={x + 6} y2={44} stroke={status[i - 1] === 'success' ? 'var(--da-success)' : 'var(--da-border)'} strokeWidth={2} />}
              <rect x={x + 6} y={22} width={stageW - 12} height={44} rx={10} fill={`color-mix(in srgb, ${color(st)} ${st === 'idle' ? 0 : 18}%, var(--da-surface))`} stroke={color(st)} strokeWidth={st === 'running' ? 2.5 : 1.5} />
              {st === 'running' && !reduced && (
                <motion.rect x={x + 6} y={62} height={4} rx={2} fill="var(--da-primary)" initial={{ width: 0 }} animate={{ width: stageW - 12 }} transition={{ duration: 1.2, repeat: Infinity }} />
              )}
              <text x={x + stageW / 2} y={42} textAnchor="middle" fontSize={Math.min(11, stageW / 8)} fontWeight={600} fill="var(--da-fg)">{s.length > 14 ? `${s.slice(0, 13)}…` : s}</text>
              <text x={x + stageW / 2} y={57} textAnchor="middle" fontSize={9} fill={color(st)}>
                {st === 'success' ? '✓' : st === 'failed' || st === 'rolledback' ? '✗' : st === 'running' ? '…' : ''} {l.statuses[st]}
              </text>
            </g>
          );
        })}
        <text x={0} y={100} fontSize={11} fill="var(--da-muted)">{l.status}:</text>
        <text x={50} y={100} fontSize={11} fontWeight={600} fill={outcome === 'ok' ? 'var(--da-success)' : outcome ? 'var(--da-danger)' : 'var(--da-muted)'}>
          {outcome === 'ok' ? l.ok : outcome === 'failed' ? l.failed(failAt) : outcome === 'rolledback' ? l.rolled(canaryErr) : running ? '…' : '—'}
        </text>
      </svg>

      <figure className="mt-3">
        <figcaption className="label">{l.fleet} · {l.strategies[strategy]}</figcaption>
        <svg viewBox="0 0 600 150" className="h-auto w-full" role="img" aria-label={`${l.fleet}: v2 ${v2Traffic}%`}>
          {strategy === 'blue-green' && (
            <>
              <rect x={4} y={4} width={292} height={92} rx={10} fill="none" stroke="var(--da-muted)" strokeDasharray="4 4" />
              <rect x={304} y={4} width={292} height={92} rx={10} fill="none" stroke="var(--da-success)" strokeDasharray="4 4" />
              <text x={14} y={20} fontSize={10} fill="var(--da-muted)">blue (v1)</text>
              <text x={314} y={20} fontSize={10} fill="var(--da-success)">green (v2)</text>
            </>
          )}
          {Array.from({ length: INSTANCES }, (_, i) => {
            const v = instanceVersion(i);
            const x = 20 + i * 72;
            const ready = strategy !== 'blue-green' || v === 1 || p > 0;
            return (
              <motion.g key={i} initial={false} animate={{ opacity: ready ? 1 : 0.3 }} transition={{ duration: reduced ? 0 : 0.3 }}>
                <rect x={x} y={30} width={56} height={52} rx={8} fill={v === 2 ? 'color-mix(in srgb, var(--da-primary) 25%, var(--da-surface))' : 'var(--da-elevated)'} stroke={v === 2 ? 'var(--da-primary)' : 'var(--da-border)'} strokeWidth={1.5} />
                <text x={x + 28} y={60} textAnchor="middle" fontSize={12} fontWeight={600} fill={v === 2 ? 'var(--da-primary)' : 'var(--da-muted)'}>v{v}</text>
              </motion.g>
            );
          })}
          {/* Trafik dağılımı çubuğu */}
          <rect x={20} y={110} width={560} height={14} rx={7} fill="var(--da-elevated)" />
          <motion.rect x={20} y={110} height={14} rx={7} fill={rolledBack ? 'var(--da-danger)' : 'var(--da-primary)'} animate={{ width: Math.max(0, 5.6 * v2Traffic) }} transition={{ duration: reduced ? 0 : 0.4 }} />
          <text x={20} y={142} fontSize={10} fill="var(--da-muted)">{l.traffic}: v1 {100 - v2Traffic}% · v2 {v2Traffic}%</text>
        </svg>
      </figure>
    </SimShell>
  );
}
