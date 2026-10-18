'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { Select, SimShell, Stat } from './ui';
import { numParam, strParam, type SimulatorProps } from './types';

const N = 12;
type KernelId = 'identity' | 'edge' | 'sobel-x' | 'sobel-y' | 'blur' | 'sharpen' | 'custom';
type Padding = 'same' | 'valid';

const KERNELS: Record<Exclude<KernelId, 'custom'>, number[]> = {
  identity: [0, 0, 0, 0, 1, 0, 0, 0, 0],
  edge: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
  'sobel-x': [-1, 0, 1, -2, 0, 2, -1, 0, 1],
  'sobel-y': [-1, -2, -1, 0, 0, 0, 1, 2, 1],
  blur: [1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9],
  sharpen: [0, -1, 0, -1, 5, -1, 0, -1, 0],
};
const KERNEL_IDS: KernelId[] = [
  'identity',
  'edge',
  'sobel-x',
  'sobel-y',
  'blur',
  'sharpen',
  'custom',
];

const L = {
  tr: {
    title: 'Konvolüsyon (evrişim) katmanı',
    kernel: 'Çekirdek (kernel)',
    kernels: {
      identity: 'Kimlik',
      edge: 'Kenar (Laplace)',
      'sobel-x': 'Sobel X (dikey kenar)',
      'sobel-y': 'Sobel Y (yatay kenar)',
      blur: 'Bulanıklaştır',
      sharpen: 'Keskinleştir',
      custom: 'Özel (düzenlenebilir)',
    } satisfies Record<KernelId, string>,
    stride: 'Adım (stride)',
    padding: 'Dolgu (padding)',
    same: 'same (sıfır dolgu)',
    valid: 'valid (dolgu yok)',
    input: 'Girdi görüntüsü (tıkla: piksel değiştir)',
    output: 'Çıktı öznitelik haritası',
    calc: 'Bu konumdaki hesap',
    outSize: 'Çıktı boyutu',
    pause: 'Duraklat',
    pattern: 'Desen',
    clear: 'Temizle',
    hint: 'Çıktıdaki bir hücreye tıklayarak pencereyi oraya taşı.',
  },
  en: {
    title: 'Convolution layer',
    kernel: 'Kernel',
    kernels: {
      identity: 'Identity',
      edge: 'Edge (Laplacian)',
      'sobel-x': 'Sobel X (vertical edges)',
      'sobel-y': 'Sobel Y (horizontal edges)',
      blur: 'Blur',
      sharpen: 'Sharpen',
      custom: 'Custom (editable)',
    } satisfies Record<KernelId, string>,
    stride: 'Stride',
    padding: 'Padding',
    same: 'same (zero padding)',
    valid: 'valid (no padding)',
    input: 'Input image (click: toggle pixel)',
    output: 'Output feature map',
    calc: 'Calculation at this position',
    outSize: 'Output size',
    pause: 'Pause',
    pattern: 'Pattern',
    clear: 'Clear',
    hint: 'Click an output cell to move the window there.',
  },
};

/** Sınır dışı pikseller sıfır (zero padding) */
const pixelAt = (img: number[], r: number, c: number) =>
  r < 0 || c < 0 || r >= N || c >= N ? 0 : img[r * N + c];

/** Yerleşik desen: içi boş kare + köşegen + parlak nokta */
function makeImage(): number[] {
  const img = new Array(N * N).fill(0);
  for (let i = 2; i <= 8; i++) {
    img[2 * N + i] = 1;
    img[8 * N + i] = 1;
    img[i * N + 2] = 1;
    img[i * N + 8] = 1;
  }
  for (let i = 0; i < N; i++) if (i > 3 && i < 11) img[i * N + i] = Math.max(img[i * N + i], 0.6);
  img[10 * N + 3] = 1;
  return img;
}

export default function ConvolutionSim({ params, onInteract }: SimulatorProps) {
  const { t, locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const [image, setImage] = useState<number[]>(makeImage);
  const [kernelId, setKernelId] = useState<KernelId>(() =>
    strParam(params, 'kernel', 'sobel-x', KERNEL_IDS),
  );
  const [custom, setCustom] = useState<number[]>(() => [...KERNELS['sobel-x']]);
  const [stride, setStride] = useState(() => numParam(params, 'stride', 1, 1, 2));
  const [padding, setPadding] = useState<Padding>(() =>
    strParam(params, 'padding', 'same', ['same', 'valid'] as const),
  );
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);

  const kernel = kernelId === 'custom' ? custom : KERNELS[kernelId];
  const pad = padding === 'same' ? 1 : 0;
  const outN = Math.floor((N + 2 * pad - 3) / stride) + 1;
  const total = outN * outN;

  const px = (r: number, c: number) => pixelAt(image, r, c);

  const output = useMemo(() => {
    const out: number[] = [];
    const px = (r: number, c: number) => pixelAt(image, r, c);
    for (let orow = 0; orow < outN; orow++) {
      for (let ocol = 0; ocol < outN; ocol++) {
        const r0 = orow * stride - pad;
        const c0 = ocol * stride - pad;
        let sum = 0;
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 3; j++) sum += kernel[i * 3 + j] * px(r0 + i, c0 + j);
        out.push(sum);
      }
    }
    return out;
  }, [image, kernel, stride, pad, outN]);
  const maxAbs = Math.max(1e-6, ...output.map(Math.abs));

  useEffect(() => {
    if (pos >= total) setPos(0);
  }, [pos, total]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setPos((p) => (p + 1) % total), reduced ? 500 : 250);
    return () => clearInterval(id);
  }, [playing, total, reduced]);

  const orow = Math.floor(Math.min(pos, total - 1) / outN);
  const ocol = Math.min(pos, total - 1) % outN;
  const r0 = orow * stride - pad;
  const c0 = ocol * stride - pad;

  const cell = 24;
  const inOff = cell; // dolgu halkası için kenar boşluğu
  const toggle = (i: number) => {
    onInteract();
    setImage((img) => img.map((v, k) => (k === i ? (v >= 1 ? 0 : v >= 0.5 ? 1 : 0.5) : v)));
  };

  const fmtK = (v: number) =>
    Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(2);

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              onInteract();
              setPos((p) => (p + 1) % total);
            }}
            disabled={playing}
          >
            <StepForward size={14} /> {t('sim.step')}
          </button>
          <button
            type="button"
            className="btn-primary"
            aria-pressed={playing}
            onClick={() => {
              onInteract();
              setPlaying((p) => !p);
            }}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? l.pause : t('sim.run')}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setImage(makeImage());
              setPos(0);
            }}
          >
            <RotateCcw size={14} /> {l.pattern}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              onInteract();
              setImage(new Array(N * N).fill(0));
            }}
          >
            {l.clear}
          </button>
        </>
      }
      aside={
        <>
          <Select
            label={l.kernel}
            value={kernelId}
            options={KERNEL_IDS.map((k) => ({ id: k, label: l.kernels[k] }))}
            onChange={(v) => {
              onInteract();
              if (v === 'custom') setCustom([...kernel]);
              setKernelId(v);
            }}
          />
          <div className="grid grid-cols-3 gap-1" role="group" aria-label={l.kernel}>
            {kernel.map((v, i) =>
              kernelId === 'custom' ? (
                <input
                  key={i}
                  type="number"
                  step={0.5}
                  className="input px-1 py-1 text-center font-mono text-xs"
                  aria-label={`${l.kernel} [${Math.floor(i / 3)},${i % 3}]`}
                  value={Number.isInteger(v) ? v : Number(v.toFixed(2))}
                  onChange={(e) => {
                    onInteract();
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) setCustom((k) => k.map((x, j) => (j === i ? n : x)));
                  }}
                />
              ) : (
                <span
                  key={i}
                  className="rounded-lg border border-border bg-elevated py-1 text-center font-mono text-xs"
                >
                  {fmtK(v)}
                </span>
              ),
            )}
          </div>
          <Select
            label={l.stride}
            value={String(stride) as '1' | '2'}
            options={[
              { id: '1', label: '1' },
              { id: '2', label: '2' },
            ]}
            onChange={(v) => {
              onInteract();
              setStride(Number(v));
              setPos(0);
            }}
          />
          <Select
            label={l.padding}
            value={padding}
            options={[
              { id: 'same', label: l.same },
              { id: 'valid', label: l.valid },
            ]}
            onChange={(v) => {
              onInteract();
              setPadding(v);
              setPos(0);
            }}
          />
          <Stat label={l.outSize} value={`${outN}×${outN}`} />
          <div aria-live="polite">
            <p className="label">
              {l.calc} ({orow}, {ocol})
            </p>
            <p className="font-mono text-[11px] leading-5">
              {kernel
                .map((k, i) => `${fmtK(k)}×${px(r0 + Math.floor(i / 3), c0 + (i % 3)).toFixed(1)}`)
                .join(' + ')}
              {' = '}
              <strong className="text-primary">{output[orow * outN + ocol]?.toFixed(2)}</strong>
            </p>
          </div>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <figure>
          <figcaption className="label">{l.input}</figcaption>
          <svg
            viewBox={`0 0 ${(N + 2) * cell} ${(N + 2) * cell}`}
            className="h-auto w-full"
            role="img"
            aria-label={l.input}
          >
            {pad > 0 && (
              <rect
                x={inOff - cell}
                y={inOff - cell}
                width={(N + 2) * cell}
                height={(N + 2) * cell}
                fill="none"
                stroke="var(--da-border)"
                strokeDasharray="3 3"
              />
            )}
            {image.map((v, i) => {
              const r = Math.floor(i / N);
              const c = i % N;
              return (
                <rect
                  key={i}
                  x={inOff + c * cell}
                  y={inOff + r * cell}
                  width={cell - 1}
                  height={cell - 1}
                  fill={`color-mix(in srgb, var(--da-fg) ${Math.round(v * 90)}%, var(--da-surface))`}
                  className="cursor-pointer"
                  role="button"
                  aria-label={`(${r}, ${c}) = ${v}`}
                  onClick={() => toggle(i)}
                />
              );
            })}
            {/* Kayan pencere */}
            <rect
              x={inOff + c0 * cell - 1}
              y={inOff + r0 * cell - 1}
              width={3 * cell + 1}
              height={3 * cell + 1}
              fill="color-mix(in srgb, var(--da-accent) 18%, transparent)"
              stroke="var(--da-accent)"
              strokeWidth={2.5}
              pointerEvents="none"
              style={{ transition: reduced ? 'none' : 'x 0.2s, y 0.2s' }}
            />
          </svg>
        </figure>
        <figure>
          <figcaption className="label">{l.output}</figcaption>
          <svg
            viewBox={`0 0 ${(N + 2) * cell} ${(N + 2) * cell}`}
            className="h-auto w-full"
            role="img"
            aria-label={l.output}
          >
            {output.map((v, i) => {
              const r = Math.floor(i / outN);
              const c = i % outN;
              const size = ((N + 2) * cell - 8) / outN;
              const pct = Math.round((Math.abs(v) / maxAbs) * 90);
              return (
                <rect
                  key={i}
                  x={4 + c * size}
                  y={4 + r * size}
                  width={size - 1}
                  height={size - 1}
                  fill={`color-mix(in srgb, ${v >= 0 ? 'var(--da-primary)' : 'var(--da-danger)'} ${pct}%, var(--da-surface))`}
                  stroke={i === pos ? 'var(--da-accent)' : 'none'}
                  strokeWidth={i === pos ? 2.5 : 0}
                  className="cursor-pointer"
                  role="button"
                  aria-label={`out (${r}, ${c}) = ${v.toFixed(2)}`}
                  onClick={() => {
                    onInteract();
                    setPlaying(false);
                    setPos(i);
                  }}
                />
              );
            })}
          </svg>
          <p className="text-[11px] text-muted">
            {l.hint} <span className="text-primary">■ +</span>{' '}
            <span className="text-danger">■ −</span>
          </p>
        </figure>
      </div>
    </SimShell>
  );
}
