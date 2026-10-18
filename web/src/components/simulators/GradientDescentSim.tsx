'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';
import { AlertTriangle, Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import {
  closedFormSolution,
  generateLinearData,
  gradients,
  mseLoss,
  sampleLossSurface,
  type DataPoint,
  type GdStep,
  type RegressionParams,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { Range, Select, SimShell, Stat } from './ui';
import { numParam, strParam, type SimulatorProps } from './types';

type Surface = 'bowl' | 'valley';
type Optimizer = 'sgd' | 'momentum' | 'adam';
const OPTIMIZERS: Optimizer[] = ['sgd', 'momentum', 'adam'];
const MAX_STEPS = 400;
/** Momentum ve Adam'ın standart katsayıları */
const BETA = 0.9;
const BETA2 = 0.999;
const EPS = 1e-8;

/** Optimizer'ın adımlar arasında taşıdığı durum (hız / momentler) */
interface OptState {
  vw: number;
  vb: number;
  sw: number;
  sb: number;
}
const freshOptState = (): OptState => ({ vw: 0, vb: 0, sw: 0, sb: 0 });

/**
 * Tek optimizasyon adımı. Kayıp yüzeyi lineer regresyon MSE'si olduğu için dışbükeydir;
 * fark, dar vadide SGD'nin zikzak çizmesi, momentum'un sığ eksende hızlanması ve
 * Adam'ın adımı eksen başına ölçeklemesidir.
 */
function optimizerStep(data: DataPoint[], last: GdStep, lr: number, optimizer: Optimizer, o: OptState): GdStep {
  const { gradW, gradB } = gradients(data, last.params);
  const t = last.iteration + 1;
  let dw = gradW;
  let db = gradB;
  if (optimizer === 'momentum') {
    o.vw = BETA * o.vw + gradW;
    o.vb = BETA * o.vb + gradB;
    dw = o.vw;
    db = o.vb;
  } else if (optimizer === 'adam') {
    o.vw = BETA * o.vw + (1 - BETA) * gradW;
    o.vb = BETA * o.vb + (1 - BETA) * gradB;
    o.sw = BETA2 * o.sw + (1 - BETA2) * gradW * gradW;
    o.sb = BETA2 * o.sb + (1 - BETA2) * gradB * gradB;
    const c1 = 1 - Math.pow(BETA, t);
    const c2 = 1 - Math.pow(BETA2, t);
    dw = o.vw / c1 / (Math.sqrt(o.sw / c2) + EPS);
    db = o.vb / c1 / (Math.sqrt(o.sb / c2) + EPS);
  }
  const params = { w: last.params.w - lr * dw, b: last.params.b - lr * db };
  return { iteration: t, params, loss: mseLoss(data, params), gradW, gradB };
}
const W_RANGE: [number, number] = [-4, 6];
const B_RANGE: [number, number] = [-8, 10];
const RES = 32;

const L = {
  tr: {
    title: 'Gradient descent: lineer regresyon',
    data: 'Veri ve model',
    surface: 'Kayıp yüzeyi (w, b)',
    lossCurve: 'Kayıp eğrisi (log ölçek)',
    dataset: 'Veri seti',
    bowl: 'Kase (x merkezli)',
    valley: 'Dar vadi (x kaydırılmış)',
    optimizer: 'Optimizer',
    optimizers: { sgd: 'SGD (düz)', momentum: 'Momentum (β=0.9)', adam: 'Adam' } satisfies Record<Optimizer, string>,
    diverged: 'Iraksama! Öğrenme oranı çok büyük; kayıp patladı. Oranı düşürüp sıfırla.',
    optimum: 'OLS optimum',
    pause: 'Duraklat',
    hint: 'Isı haritasına tıklayarak başlangıç noktasını (w, b) seçebilirsin.',
    converged: 'Yakınsadı',
  },
  en: {
    title: 'Gradient descent: linear regression',
    data: 'Data and model',
    surface: 'Loss surface (w, b)',
    lossCurve: 'Loss curve (log scale)',
    dataset: 'Dataset',
    bowl: 'Bowl (centered x)',
    valley: 'Narrow valley (shifted x)',
    optimizer: 'Optimizer',
    optimizers: { sgd: 'SGD (plain)', momentum: 'Momentum (β=0.9)', adam: 'Adam' } satisfies Record<Optimizer, string>,
    diverged: 'Diverged! Learning rate too large; the loss exploded. Lower it and reset.',
    optimum: 'OLS optimum',
    pause: 'Pause',
    hint: 'Click the heatmap to pick a start point (w, b).',
    converged: 'Converged',
  },
};

/** Veri seti: "valley" varyantında x kaydırılır → w ve b ilişkili olur, yüzey uzar (koşul sayısı büyür) */
function makeData(surface: Surface): DataPoint[] {
  const base = generateLinearData(30, 2, 1, 1, 42);
  return surface === 'valley' ? base.map((d) => ({ x: d.x + 4, y: d.y + 8 })) : base;
}

export default function GradientDescentSim({ params, onInteract }: SimulatorProps) {
  const { t, locale } = useI18n();
  const l = L[locale];
  // "saddle" MSE için mümkün değil (kayıp dışbükey); en yakın öğretici varyant olan vadiye düşülür
  const initialSurface: Surface = strParam<string>(params, 'surface', 'bowl') === 'bowl' ? 'bowl' : 'valley';
  const [surface, setSurface] = useState<Surface>(initialSurface);
  const data = useMemo(() => makeData(surface), [surface]);
  const [start, setStart] = useState<RegressionParams>(() => ({ w: numParam(params, 'startX', -3, -4, 6), b: -6 }));
  const [lrExp, setLrExp] = useState(() => Math.log10(numParam(params, 'learningRate', 0.02, 0.0001, 1)));
  const lr = Math.pow(10, lrExp);
  const [optimizer, setOptimizer] = useState<Optimizer>(() => strParam(params, 'optimizer', 'sgd', OPTIMIZERS));
  const [steps, setSteps] = useState<GdStep[]>(() => [{ iteration: 0, params: start, loss: mseLoss(data, start), gradW: 0, gradB: 0 }]);
  const [running, setRunning] = useState(false);
  const stepsRef = useRef(steps);
  const optRef = useRef<OptState>(freshOptState());
  const clipId = `gd-${useId().replace(/:/g, '')}`;
  stepsRef.current = steps;

  const surfaceData = useMemo(() => sampleLossSurface(data, W_RANGE, B_RANGE, RES), [data]);
  const optimum = useMemo(() => closedFormSolution(data), [data]);
  const current = steps[steps.length - 1];
  const diverged = !Number.isFinite(current.loss) || current.loss > 1e6;
  const converged = steps.length > 2 && Math.abs(steps[steps.length - 2].loss - current.loss) < 1e-6;

  const reset = useCallback((p: RegressionParams = start, d: DataPoint[] = data) => {
    setRunning(false);
    optRef.current = freshOptState();
    const first = [{ iteration: 0, params: p, loss: mseLoss(d, p), gradW: 0, gradB: 0 }];
    stepsRef.current = first;
    setSteps(first);
  }, [start, data]);

  // Adımlar updater dışında hesaplanır: optimizer durumu (momentum/Adam) ref'te tutulur ve
  // StrictMode'un updater'ı iki kez çağırması bu durumu bozmamalıdır.
  const doStep = useCallback((n = 1) => {
    let out = stepsRef.current;
    for (let i = 0; i < n; i++) {
      const last = out[out.length - 1];
      if (!Number.isFinite(last.loss) || last.loss > 1e6) break;
      out = [...out, optimizerStep(data, last, lr, optimizer, optRef.current)];
    }
    if (out.length > MAX_STEPS) out = [out[0], ...out.slice(out.length - MAX_STEPS + 1)];
    stepsRef.current = out;
    setSteps(out);
  }, [data, lr, optimizer]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const last = stepsRef.current[stepsRef.current.length - 1];
      if (!Number.isFinite(last.loss) || last.loss > 1e6 || last.iteration >= 2000) {
        setRunning(false);
        return;
      }
      doStep(1);
    }, 60);
    return () => clearInterval(id);
  }, [running, doStep]);

  useEffect(() => {
    if (diverged || converged) setRunning(false);
  }, [diverged, converged]);

  // ---------- Saçılım grafiği ölçekleri ----------
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const xMin = Math.min(...xs) - 0.5;
  const xMax = Math.max(...xs) + 0.5;
  const yMin = Math.min(...ys) - 2;
  const yMax = Math.max(...ys) + 2;
  const sx = (x: number) => 30 + ((x - xMin) / (xMax - xMin)) * 260;
  const sy = (y: number) => 200 - ((y - yMin) / (yMax - yMin)) * 180;
  const lineY = (x: number) => current.params.w * x + current.params.b;
  const clampY = (y: number) => Math.max(10, Math.min(210, sy(y)));

  // ---------- Isı haritası ölçekleri ----------
  const hw = 260;
  const hh = 200;
  const hx = (w: number) => ((w - W_RANGE[0]) / (W_RANGE[1] - W_RANGE[0])) * hw;
  const hy = (b: number) => hh - ((b - B_RANGE[0]) / (B_RANGE[1] - B_RANGE[0])) * hh;
  const logMin = Math.log10(surfaceData.min + 1e-9);
  const logMax = Math.log10(surfaceData.max + 1e-9);
  const cellW = hw / RES;
  const cellH = hh / RES;
  const path = steps
    .filter((s) => Number.isFinite(s.params.w) && Number.isFinite(s.params.b))
    .map((s) => `${Math.max(-20, Math.min(hw + 20, hx(s.params.w))).toFixed(1)},${Math.max(-20, Math.min(hh + 20, hy(s.params.b))).toFixed(1)}`)
    .join(' ');

  // ---------- Kayıp eğrisi ----------
  const finite = steps.filter((s) => Number.isFinite(s.loss) && s.loss > 0);
  const lossLogs = finite.map((s) => Math.log10(s.loss));
  const lMin = Math.min(...lossLogs, 0);
  const lMax = Math.max(...lossLogs, 1);
  const lossPath = finite
    .map((s, i) => `${(560 * i) / Math.max(1, finite.length - 1)},${(90 - ((Math.log10(s.loss) - lMin) / Math.max(1e-6, lMax - lMin)) * 80).toFixed(1)}`)
    .join(' ');

  const onHeatmapClick = (e: MouseEvent<SVGRectElement>) => {
    onInteract();
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const p = { w: W_RANGE[0] + fx * (W_RANGE[1] - W_RANGE[0]), b: B_RANGE[1] - fy * (B_RANGE[1] - B_RANGE[0]) };
    setStart(p);
    reset(p);
  };

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button type="button" className="btn-ghost" onClick={() => { onInteract(); doStep(1); }} disabled={diverged || running}>
            <StepForward size={14} /> {t('sim.step')}
          </button>
          <button type="button" className="btn-primary" onClick={() => { onInteract(); setRunning((r) => !r); }} disabled={diverged} aria-pressed={running}>
            {running ? <Pause size={14} /> : <Play size={14} />} {running ? l.pause : t('sim.run')}
          </button>
          <button type="button" className="btn-ghost" onClick={() => reset()}>
            <RotateCcw size={14} /> {t('sim.reset')}
          </button>
        </>
      }
      aside={
        <>
          <Range label={t('sim.learningRate')} value={lrExp} min={-3} max={-0.3} step={0.05} format={(v) => Math.pow(10, v).toPrecision(2)} onChange={(v) => { onInteract(); setLrExp(v); }} />
          <Select
            label={l.dataset}
            value={surface}
            options={[{ id: 'bowl', label: l.bowl }, { id: 'valley', label: l.valley }]}
            onChange={(v) => { onInteract(); setSurface(v); reset(start, makeData(v)); }}
          />
          <Select
            label={l.optimizer}
            value={optimizer}
            options={OPTIMIZERS.map((o) => ({ id: o, label: l.optimizers[o] }))}
            onChange={(v) => { onInteract(); setOptimizer(v); reset(); }}
          />
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t('sim.iteration')} value={current.iteration} />
            <Stat label={t('sim.loss')} value={Number.isFinite(current.loss) ? (current.loss > 1e4 ? current.loss.toExponential(1) : current.loss.toFixed(3)) : '∞'} tone={diverged ? 'danger' : converged ? 'success' : 'primary'} />
            <Stat label="w" value={Number.isFinite(current.params.w) ? current.params.w.toFixed(3) : 'NaN'} />
            <Stat label="b" value={Number.isFinite(current.params.b) ? current.params.b.toFixed(3) : 'NaN'} />
          </div>
          <p className="text-xs text-muted">
            {l.optimum}: w={optimum.w.toFixed(2)}, b={optimum.b.toFixed(2)} · ∂L/∂w={current.gradW.toFixed(2)}, ∂L/∂b={current.gradB.toFixed(2)}
          </p>
          <div aria-live="polite">
            {diverged && (
              <p className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {l.diverged}
              </p>
            )}
            {converged && !diverged && <p className="text-xs text-success">✓ {l.converged}</p>}
          </div>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <figure>
          <figcaption className="label">{l.data}</figcaption>
          <svg viewBox="0 0 300 220" className="h-auto w-full" role="img" aria-label={l.data}>
            <rect x={30} y={10} width={260} height={200} fill="var(--da-bg)" stroke="var(--da-border)" />
            {xMin < 0 && xMax > 0 && <line x1={sx(0)} x2={sx(0)} y1={10} y2={210} stroke="var(--da-border)" />}
            {yMin < 0 && yMax > 0 && <line x1={30} x2={290} y1={sy(0)} y2={sy(0)} stroke="var(--da-border)" />}
            {data.map((d, i) => (
              <circle key={i} cx={sx(d.x)} cy={sy(d.y)} r={3.5} fill="var(--da-primary)" opacity={0.8} />
            ))}
            {Number.isFinite(lineY(xMin)) && (
              <line x1={sx(xMin)} y1={clampY(lineY(xMin))} x2={sx(xMax)} y2={clampY(lineY(xMax))} stroke={diverged ? 'var(--da-danger)' : 'var(--da-accent)'} strokeWidth={2.5} />
            )}
            <line x1={sx(xMin)} y1={clampY(optimum.w * xMin + optimum.b)} x2={sx(xMax)} y2={clampY(optimum.w * xMax + optimum.b)} stroke="var(--da-success)" strokeDasharray="4 4" opacity={0.6} />
            <text x={34} y={24} fontSize={10} fill="var(--da-muted)">y = {current.params.w.toFixed(2)}x + {current.params.b.toFixed(2)}</text>
          </svg>
        </figure>
        <figure>
          <figcaption className="label">{l.surface}</figcaption>
          <svg viewBox={`-30 -4 ${hw + 40} ${hh + 28}`} className="h-auto w-full" role="img" aria-label={l.surface}>
            <defs>
              <clipPath id={clipId}>
                <rect width={hw} height={hh} />
              </clipPath>
            </defs>
            {surfaceData.loss.map((row, bi) =>
              row.map((v, wi) => {
                const f = (Math.log10(v + 1e-9) - logMin) / Math.max(1e-6, logMax - logMin);
                return (
                  <rect
                    key={`${bi}-${wi}`}
                    x={wi * cellW}
                    y={hh - (bi + 1) * cellH}
                    width={cellW + 0.5}
                    height={cellH + 0.5}
                    fill={`color-mix(in srgb, var(--da-danger) ${Math.round(f * 85)}%, color-mix(in srgb, var(--da-primary) ${Math.round((1 - f) * 70)}%, var(--da-surface)))`}
                  />
                );
              }),
            )}
            <rect width={hw} height={hh} fill="transparent" className="cursor-crosshair" onClick={onHeatmapClick} aria-label={l.hint} />
            <g clipPath={`url(#${clipId})`} pointerEvents="none">
              <polyline points={path} fill="none" stroke="var(--da-fg)" strokeWidth={1.5} />
              {steps.length < 120 &&
                steps.map((s, i) => Number.isFinite(s.params.w) && <circle key={i} cx={hx(s.params.w)} cy={hy(s.params.b)} r={1.8} fill="var(--da-fg)" />)}
              <circle cx={hx(optimum.w)} cy={hy(optimum.b)} r={5} fill="none" stroke="var(--da-success)" strokeWidth={2} />
              {Number.isFinite(current.params.w) && <circle cx={hx(current.params.w)} cy={hy(current.params.b)} r={5} fill="var(--da-accent)" stroke="var(--da-surface)" />}
            </g>
            <text x={hw / 2} y={hh + 16} textAnchor="middle" fontSize={10} fill="var(--da-muted)">w ({W_RANGE[0]} … {W_RANGE[1]})</text>
            <text x={-8} y={hh / 2} textAnchor="middle" fontSize={10} fill="var(--da-muted)" transform={`rotate(-90 -8 ${hh / 2})`}>b</text>
          </svg>
          <p className="text-[11px] text-muted">{l.hint}</p>
        </figure>
      </div>
      <figure className="mt-3">
        <figcaption className="label">{l.lossCurve}</figcaption>
        <svg viewBox="-4 0 568 100" className="h-24 w-full" preserveAspectRatio="none" role="img" aria-label={l.lossCurve}>
          <rect x={0} y={5} width={560} height={90} fill="var(--da-bg)" stroke="var(--da-border)" />
          <polyline points={lossPath} fill="none" stroke={diverged ? 'var(--da-danger)' : 'var(--da-primary)'} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
      </figure>
    </SimShell>
  );
}
