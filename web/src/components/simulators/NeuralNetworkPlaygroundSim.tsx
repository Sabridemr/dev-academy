'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { seededRandom } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { Field, Range, Select, SimShell, Stat } from './ui';
import { numParam, strParam, type SimulatorProps } from './types';

type TfModule = typeof import('@tensorflow/tfjs');
type TfModel = import('@tensorflow/tfjs').Sequential;
type TfTensor2D = import('@tensorflow/tfjs').Tensor2D;

type Dataset = 'xor' | 'circle' | 'spiral';
type Activation = 'relu' | 'tanh' | 'sigmoid' | 'linear';
const DATASETS: Dataset[] = ['xor', 'circle', 'spiral'];
const ACTIVATIONS: Activation[] = ['relu', 'tanh', 'sigmoid', 'linear'];
const GRID = 28;
const POINTS = 200;
const MAX_LOSS_HISTORY = 240;

interface Pt {
  x: number;
  y: number;
  label: 0 | 1;
}

const L = {
  tr: {
    title: 'Sinir ağı oyun alanı (TensorFlow.js)',
    dataset: 'Veri seti',
    datasets: { xor: 'XOR (çapraz)', circle: 'Daire', spiral: 'Spiral' },
    activation: 'Aktivasyon',
    hidden: 'Gizli katmanlar (ör. 4,4)',
    hiddenHint: '1–3 katman, katman başına 1–8 nöron',
    noise: 'Gürültü (yanlış etiket oranı)',
    epoch: 'Epoch',
    loss: 'Kayıp',
    accuracy: 'Doğruluk',
    pause: 'Duraklat',
    train: 'Eğit',
    loading: 'TensorFlow.js yükleniyor…',
    loadError: 'TensorFlow.js yüklenemedi.',
    boundary: 'Karar sınırı',
    network: 'Ağ (kenar kalınlığı = |ağırlık|, mavi +, kırmızı −)',
    lossChart: 'Kayıp (binary cross-entropy)',
  },
  en: {
    title: 'Neural network playground (TensorFlow.js)',
    dataset: 'Dataset',
    datasets: { xor: 'XOR', circle: 'Circle', spiral: 'Spiral' },
    activation: 'Activation',
    hidden: 'Hidden layers (e.g. 4,4)',
    hiddenHint: '1–3 layers, 1–8 neurons each',
    noise: 'Noise (label flip rate)',
    epoch: 'Epoch',
    loss: 'Loss',
    accuracy: 'Accuracy',
    pause: 'Pause',
    train: 'Train',
    loading: 'Loading TensorFlow.js…',
    loadError: 'Failed to load TensorFlow.js.',
    boundary: 'Decision boundary',
    network: 'Network (edge width = |weight|, blue +, red −)',
    lossChart: 'Loss (binary cross-entropy)',
  },
};

/** Deterministik veri üretimi: koordinatlar [-1, 1] aralığında; noise oranında etiket ters çevrilir */
function makeDataset(kind: Dataset, noise = 0, seed = 7): Pt[] {
  const rnd = seededRandom(seed);
  const pts: Pt[] = [];
  const flip = (label: 0 | 1): 0 | 1 =>
    noise > 0 && rnd() < noise ? (label === 1 ? 0 : 1) : label;
  for (let i = 0; i < POINTS; i++) {
    if (kind === 'xor') {
      const x = rnd() * 2 - 1;
      const y = rnd() * 2 - 1;
      const pad = (v: number) => (v > 0 ? Math.max(v, 0.05) : Math.min(v, -0.05));
      pts.push({ x: pad(x), y: pad(y), label: flip(x * y > 0 ? 1 : 0) });
    } else if (kind === 'circle') {
      const inner = i % 2 === 0;
      const r = inner ? rnd() * 0.4 : 0.6 + rnd() * 0.35;
      const a = rnd() * Math.PI * 2;
      pts.push({ x: r * Math.cos(a), y: r * Math.sin(a), label: flip(inner ? 1 : 0) });
    } else {
      const label: 0 | 1 = i % 2 === 0 ? 1 : 0;
      // İki kol: açı 1.5 tur boyunca artar, yarıçap doğrusal büyür
      const k = Math.floor(i / 2) / (POINTS / 2);
      const r = 0.08 + 0.85 * k;
      const a = k * 3 * Math.PI + (label ? 0 : Math.PI);
      pts.push({
        x: r * Math.cos(a) + (rnd() - 0.5) * 0.08,
        y: r * Math.sin(a) + (rnd() - 0.5) * 0.08,
        label: flip(label),
      });
    }
  }
  return pts;
}

function parseLayers(s: string): number[] | null {
  const parts = s
    .split(',')
    .map((p) => Number(p.trim()))
    .filter((n) => Number.isFinite(n));
  if (parts.length < 1 || parts.length > 3) return null;
  if (parts.some((n) => n < 1 || n > 8 || !Number.isInteger(n))) return null;
  return parts;
}

export default function NeuralNetworkPlaygroundSim({ params, onInteract }: SimulatorProps) {
  const { t, locale } = useI18n();
  const l = L[locale];
  const [dataset, setDataset] = useState<Dataset>(() =>
    strParam(params, 'dataset', 'xor', DATASETS),
  );
  const [activation, setActivation] = useState<Activation>(() =>
    strParam(params, 'activation', 'tanh', ACTIVATIONS),
  );
  const initialLayers = typeof params.hiddenLayers === 'string' ? params.hiddenLayers : '4,4';
  const [layersText, setLayersText] = useState(() =>
    parseLayers(initialLayers) ? initialLayers : '4,4',
  );
  const layers = useMemo(() => parseLayers(layersText) ?? [4, 4], [layersText]);
  const [lrExp, setLrExp] = useState(() =>
    Math.log10(numParam(params, 'learningRate', 0.03, 0.001, 1)),
  );
  const lr = Math.pow(10, lrExp);
  const lrRef = useRef(lr);
  lrRef.current = lr;
  const [noise, setNoise] = useState(() => numParam(params, 'noise', 0, 0, 0.5));

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [playing, setPlaying] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [losses, setLosses] = useState<number[]>([]);
  const [grid, setGrid] = useState<Float32Array | null>(null);
  const [weights, setWeights] = useState<number[][][]>([]);
  const [accuracy, setAccuracy] = useState(0);

  const tfRef = useRef<TfModule | null>(null);
  const modelRef = useRef<TfModel | null>(null);
  const xsRef = useRef<TfTensor2D | null>(null);
  const ysRef = useRef<TfTensor2D | null>(null);
  const gridRef = useRef<TfTensor2D | null>(null);
  const epochRef = useRef(0);
  const busyRef = useRef(false);

  const points = useMemo(() => makeDataset(dataset, noise), [dataset, noise]);

  // TensorFlow.js'i yalnızca bu bileşen açıldığında yükle (ayrı bundle)
  useEffect(() => {
    let alive = true;
    import('@tensorflow/tfjs')
      .then(async (tf) => {
        await tf.ready();
        if (!alive) return;
        tfRef.current = tf;
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
    };
  }, []);

  /** Görselleştirmeyi günceller: ızgara tahmini, ağırlıklar ve doğruluk */
  const refreshViz = useCallback(() => {
    const tf = tfRef.current;
    const model = modelRef.current;
    if (!tf || !model || !gridRef.current || !xsRef.current) return;
    const g = tf.tidy(
      () => (model.predict(gridRef.current as TfTensor2D) as TfTensor2D).dataSync() as Float32Array,
    );
    setGrid(new Float32Array(g));
    const preds = tf.tidy(
      () => (model.predict(xsRef.current as TfTensor2D) as TfTensor2D).dataSync() as Float32Array,
    );
    let correct = 0;
    points.forEach((p, i) => {
      if ((preds[i] > 0.5 ? 1 : 0) === p.label) correct += 1;
    });
    setAccuracy(correct / points.length);
    // getWeights() değişkenlerin kendisini döndürür; dispose edilmemeli
    const ws = model.getWeights();
    const kernels: number[][][] = [];
    for (let i = 0; i < ws.length; i += 2) kernels.push(ws[i].arraySync() as number[][]);
    setWeights(kernels);
  }, [points]);

  /** Modeli ve tensörleri (yeniden) oluşturur; eskilerini serbest bırakır */
  const build = useCallback(() => {
    const tf = tfRef.current;
    if (!tf) return;
    // Optimizer örneğini biz verdiğimiz için model.dispose() onu serbest bırakmaz
    modelRef.current?.optimizer?.dispose();
    modelRef.current?.dispose();
    xsRef.current?.dispose();
    ysRef.current?.dispose();
    gridRef.current?.dispose();
    const model = tf.sequential();
    layers.forEach((units, i) => {
      model.add(
        tf.layers.dense({
          units,
          activation,
          inputShape: i === 0 ? [2] : undefined,
          kernelInitializer: 'glorotUniform',
        }),
      );
    });
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
    model.compile({ optimizer: tf.train.adam(lrRef.current), loss: 'binaryCrossentropy' });
    modelRef.current = model;
    xsRef.current = tf.tensor2d(points.map((p) => [p.x, p.y]));
    ysRef.current = tf.tensor2d(points.map((p) => [p.label]));
    const cells: number[][] = [];
    for (let r = 0; r < GRID; r++)
      for (let c = 0; c < GRID; c++)
        cells.push([-1 + (2 * (c + 0.5)) / GRID, 1 - (2 * (r + 0.5)) / GRID]);
    gridRef.current = tf.tensor2d(cells);
    epochRef.current = 0;
    setEpoch(0);
    setLosses([]);
    refreshViz();
    // lr ref üzerinden okunur: öğrenme oranı değişimi modeli sıfırlamaz, aşağıda yeniden derlenir
  }, [layers, activation, points, refreshViz]);

  useEffect(() => {
    if (status !== 'ready') return;
    setPlaying(false);
    build();
  }, [status, build]);

  // Öğrenme oranı değişince yalnızca optimizer'ı değiştir (ağırlıklar korunur)
  useEffect(() => {
    const tf = tfRef.current;
    const model = modelRef.current;
    if (!tf || !model) return;
    model.optimizer?.dispose();
    model.compile({ optimizer: tf.train.adam(lr), loss: 'binaryCrossentropy' });
  }, [lr]);

  /** Birkaç mini-epoch eğitir (tam veri tek batch) */
  const trainSteps = useCallback(
    async (n: number) => {
      const model = modelRef.current;
      if (!model || !xsRef.current || !ysRef.current || busyRef.current) return;
      busyRef.current = true;
      try {
        let last = 0;
        for (let i = 0; i < n; i++) {
          const r = await model.trainOnBatch(xsRef.current, ysRef.current);
          last = Array.isArray(r) ? r[0] : r;
          epochRef.current += 1;
        }
        setEpoch(epochRef.current);
        setLosses((h) => [...h, last].slice(-MAX_LOSS_HISTORY));
        refreshViz();
      } catch {
        // Model yeniden kurulurken (dispose sonrası) gelen adım sessizce iptal edilir
      } finally {
        busyRef.current = false;
      }
    },
    [refreshViz],
  );

  // Eğitim döngüsü: her animasyon karesinde birkaç adım; unmount ya da duraklatmada durur
  useEffect(() => {
    if (!playing || status !== 'ready') return;
    let cancelled = false;
    let raf = 0;
    const loop = async () => {
      if (cancelled) return;
      await trainSteps(5);
      if (!cancelled) raf = requestAnimationFrame(() => void loop());
    };
    void loop();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [playing, status, trainSteps]);

  // Unmount: tüm tensörleri serbest bırak
  useEffect(
    () => () => {
      modelRef.current?.optimizer?.dispose();
      modelRef.current?.dispose();
      xsRef.current?.dispose();
      ysRef.current?.dispose();
      gridRef.current?.dispose();
    },
    [],
  );

  // ---------- Ağ diyagramı geometrisi ----------
  const arch = [2, ...layers, 1];
  const nx = (li: number) => 30 + (li * 240) / (arch.length - 1);
  const ny = (li: number, ni: number) => 20 + ((ni + 0.5) * 200) / arch[li];
  const lastLoss = losses[losses.length - 1];
  const maxLoss = Math.max(0.01, ...losses);
  const lossPath = losses
    .map((v, i) => `${(i / Math.max(1, losses.length - 1)) * 280},${80 - (v / maxLoss) * 72}`)
    .join(' ');
  const cellSize = 260 / GRID;
  const px = (x: number) => ((x + 1) / 2) * 260;
  const py = (y: number) => ((1 - y) / 2) * 260;

  const toggle = () => {
    onInteract();
    setPlaying((p) => !p);
  };

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button
            type="button"
            className="btn-primary"
            onClick={toggle}
            disabled={status !== 'ready'}
            aria-pressed={playing}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? l.pause : l.train}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              onInteract();
              void trainSteps(1);
            }}
            disabled={status !== 'ready' || playing}
          >
            <StepForward size={14} /> {t('sim.step')}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setPlaying(false);
              build();
            }}
            disabled={status !== 'ready'}
          >
            <RotateCcw size={14} /> {t('sim.reset')}
          </button>
        </>
      }
      aside={
        <>
          <Select
            label={l.dataset}
            value={dataset}
            options={DATASETS.map((d) => ({ id: d, label: l.datasets[d] }))}
            onChange={(v) => {
              onInteract();
              setDataset(v);
            }}
          />
          <Select
            label={l.activation}
            value={activation}
            options={ACTIVATIONS.map((a) => ({ id: a, label: a }))}
            onChange={(v) => {
              onInteract();
              setActivation(v);
            }}
          />
          <Field label={l.hidden}>
            <input
              className="input font-mono"
              defaultValue={layersText}
              aria-invalid={parseLayers(layersText) === null}
              onBlur={(e) => {
                if (parseLayers(e.target.value)) {
                  onInteract();
                  setLayersText(e.target.value);
                } else e.target.value = layersText;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
            />
          </Field>
          <p className="text-[11px] text-muted">{l.hiddenHint}</p>
          <Range
            label={t('sim.learningRate')}
            value={lrExp}
            min={-3}
            max={0}
            step={0.05}
            format={(v) => Math.pow(10, v).toPrecision(2)}
            onChange={(v) => {
              onInteract();
              setLrExp(v);
            }}
          />
          <Range
            label={l.noise}
            value={noise}
            min={0}
            max={0.5}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => {
              onInteract();
              setNoise(v);
            }}
          />
          <div className="grid grid-cols-2 gap-2" aria-live="polite">
            <Stat label={l.epoch} value={epoch} />
            <Stat
              label={l.loss}
              value={lastLoss !== undefined ? lastLoss.toFixed(3) : '—'}
              tone="primary"
            />
            <Stat
              label={l.accuracy}
              value={`${(accuracy * 100).toFixed(0)}%`}
              tone={accuracy > 0.9 ? 'success' : accuracy > 0.7 ? 'warning' : 'danger'}
            />
          </div>
          <figure>
            <figcaption className="label">{l.lossChart}</figcaption>
            <svg viewBox="0 0 280 84" className="h-auto w-full" role="img" aria-label={l.lossChart}>
              <rect width={280} height={84} fill="var(--da-bg)" stroke="var(--da-border)" />
              <polyline
                points={lossPath}
                fill="none"
                stroke="var(--da-primary)"
                strokeWidth={1.5}
              />
            </svg>
          </figure>
        </>
      }
    >
      {status === 'loading' && (
        <p className="flex items-center gap-2 text-sm text-muted" role="status">
          <Loader2 size={14} className="animate-spin" /> {l.loading}
        </p>
      )}
      {status === 'error' && (
        <p className="text-sm text-danger" role="alert">
          {l.loadError}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <figure>
          <figcaption className="label">{l.boundary}</figcaption>
          <svg viewBox="0 0 260 260" className="h-auto w-full" role="img" aria-label={l.boundary}>
            <rect width={260} height={260} fill="var(--da-elevated)" />
            {grid &&
              Array.from(grid).map((p, i) => {
                const r = Math.floor(i / GRID);
                const c = i % GRID;
                const pct = Math.round(Math.abs(p - 0.5) * 2 * 55);
                return (
                  <rect
                    key={i}
                    x={c * cellSize}
                    y={r * cellSize}
                    width={cellSize + 0.4}
                    height={cellSize + 0.4}
                    fill={`color-mix(in srgb, ${p > 0.5 ? 'var(--da-primary)' : 'var(--da-danger)'} ${pct}%, var(--da-surface))`}
                  />
                );
              })}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={px(p.x)}
                cy={py(p.y)}
                r={3}
                fill={p.label ? 'var(--da-primary)' : 'var(--da-danger)'}
                stroke="var(--da-surface)"
                strokeWidth={1}
              />
            ))}
          </svg>
        </figure>
        <figure>
          <figcaption className="label">{l.network}</figcaption>
          <svg viewBox="0 0 300 240" className="h-auto w-full" role="img" aria-label={l.network}>
            {weights.map((kernel, li) =>
              kernel.map((row, i) =>
                row.map((w, j) => (
                  <line
                    key={`${li}-${i}-${j}`}
                    x1={nx(li)}
                    y1={ny(li, i)}
                    x2={nx(li + 1)}
                    y2={ny(li + 1, j)}
                    stroke={w >= 0 ? 'var(--da-primary)' : 'var(--da-danger)'}
                    strokeWidth={Math.min(5, 0.3 + Math.abs(w) * 1.6)}
                    opacity={Math.min(1, 0.25 + Math.abs(w) * 0.5)}
                  />
                )),
              ),
            )}
            {arch.map((count, li) =>
              Array.from({ length: count }, (_, ni) => (
                <g key={`${li}-${ni}`}>
                  <circle
                    cx={nx(li)}
                    cy={ny(li, ni)}
                    r={9}
                    fill="var(--da-surface)"
                    stroke={
                      li === 0 || li === arch.length - 1 ? 'var(--da-accent)' : 'var(--da-fg)'
                    }
                    strokeWidth={1.5}
                  />
                  {li === 0 && (
                    <text
                      x={nx(li) - 14}
                      y={ny(li, ni) + 4}
                      textAnchor="end"
                      fontSize={10}
                      fill="var(--da-muted)"
                    >
                      {ni === 0 ? 'x₁' : 'x₂'}
                    </text>
                  )}
                  {li === arch.length - 1 && (
                    <text x={nx(li) + 14} y={ny(li, ni) + 4} fontSize={10} fill="var(--da-muted)">
                      ŷ
                    </text>
                  )}
                </g>
              )),
            )}
            {layers.map((u, i) => (
              <text
                key={i}
                x={nx(i + 1)}
                y={236}
                textAnchor="middle"
                fontSize={9}
                fill="var(--da-muted)"
              >
                {u} · {activation}
              </text>
            ))}
          </svg>
        </figure>
      </div>
    </SimShell>
  );
}
