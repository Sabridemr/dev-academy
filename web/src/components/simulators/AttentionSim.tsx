'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { computeSelfAttention, topAttended } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { Field, Range, SimShell, Stat } from './ui';
import { boolParam, numParam, strParam, type SimulatorProps } from './types';

/** Her "kafa" farklı boyutlu projeksiyon kullanır → farklı dikkat desenleri (eğitim amaçlı yaklaşım) */
const HEAD_DIMS = [8, 6, 10, 4];

const L = {
  tr: {
    title: 'Self-attention ısı haritası',
    head: 'Kafa (head)',
    query: 'Sorgu token',
    clickHint:
      'Bir token’a ya da satıra tıkla/üzerine gel: o sorgunun en çok dikkat ettiği token’lar oklarla gösterilir.',
    top: 'En çok dikkat edilenler',
    rowsCols: 'Satır = sorgu (Q), sütun = anahtar (K). Her satır toplamı 1.',
    maxTokens: 'En fazla 12 token kullanılır.',
    entropy: 'Satır entropisi',
  },
  en: {
    title: 'Self-attention heatmap',
    head: 'Head',
    query: 'Query token',
    clickHint: 'Click/hover a token or row: arrows show the tokens that query attends to most.',
    top: 'Most attended',
    rowsCols: 'Row = query (Q), column = key (K). Each row sums to 1.',
    maxTokens: 'At most 12 tokens are used.',
    entropy: 'Row entropy',
  },
};

export default function AttentionSim({ params, onInteract }: SimulatorProps) {
  const { t, locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const [sentence, setSentence] = useState(() =>
    strParam<string>(params, 'sentence', 'The cat sat on the mat because it was tired'),
  );
  const [temperature, setTemperature] = useState(() => numParam(params, 'temperature', 1, 0.1, 3));
  const [causal, setCausal] = useState(() => boolParam(params, 'causal', false));
  const headCount = numParam(params, 'heads', 1, 1, HEAD_DIMS.length);
  const [head, setHead] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const result = useMemo(
    () => computeSelfAttention(sentence, HEAD_DIMS[head], temperature, causal),
    [sentence, head, temperature, causal],
  );
  const n = result.tokens.length;
  const active = hovered ?? selected ?? (n > 0 ? n - 1 : null);
  const top = active !== null && active < n ? topAttended(result, active, 3) : [];
  const entropy =
    active !== null && active < n
      ? -result.weights[active].reduce((a, w) => a + (w > 0 ? w * Math.log2(w) : 0), 0)
      : 0;

  // Token şeridi geometrisi
  const stripW = 600;
  const tokW = n > 0 ? stripW / n : stripW;
  const tokX = (i: number) => i * tokW + tokW / 2;

  // Isı haritası geometrisi
  const cell = Math.min(40, 420 / Math.max(1, n));
  const labelW = 90;
  const gridSize = cell * n;

  const pick = (i: number) => {
    onInteract();
    setSelected((s) => (s === i ? null : i));
  };

  return (
    <SimShell
      title={l.title}
      aside={
        <>
          <Field label={t('sim.sentence')}>
            <input
              className="input"
              value={sentence}
              maxLength={120}
              onChange={(e) => {
                onInteract();
                setSentence(e.target.value);
                setSelected(null);
              }}
            />
          </Field>
          <p className="text-[11px] text-muted">{l.maxTokens}</p>
          <Range
            label={t('sim.temperature')}
            value={temperature}
            min={0.1}
            max={3}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(v) => {
              onInteract();
              setTemperature(v);
            }}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={causal}
              onChange={(e) => {
                onInteract();
                setCausal(e.target.checked);
              }}
            />
            {t('sim.causal')}
          </label>
          {headCount > 1 && (
            <div>
              <p className="label">{l.head}</p>
              <div className="flex gap-1" role="group" aria-label={l.head}>
                {Array.from({ length: headCount }, (_, h) => (
                  <button
                    key={h}
                    type="button"
                    className={h === head ? 'btn-primary px-3 py-1' : 'btn-ghost px-3 py-1'}
                    aria-pressed={h === head}
                    onClick={() => {
                      onInteract();
                      setHead(h);
                    }}
                  >
                    {h + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label={l.query}
              value={active !== null && active < n ? result.tokens[active] : '—'}
              tone="primary"
            />
            <Stat label={l.entropy} value={`${entropy.toFixed(2)} bit`} />
          </div>
          <div aria-live="polite">
            <p className="label">{l.top}</p>
            <ol className="space-y-1 text-sm">
              {top.map((tk) => (
                <li key={tk.index} className="flex items-center gap-2">
                  <span className="w-20 truncate font-mono">{tk.token}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded bg-elevated">
                    <span
                      className="block h-full bg-primary"
                      style={{ width: `${tk.weight * 100}%` }}
                    />
                  </span>
                  <span className="w-12 text-right tabular-nums text-xs">
                    {(tk.weight * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </>
      }
    >
      <p className="mb-2 text-sm text-muted">{l.clickHint}</p>
      {/* Token şeridi ve dikkat yayları */}
      <svg viewBox={`0 0 ${stripW} 150`} className="h-auto w-full" role="img" aria-label={l.top}>
        {active !== null &&
          top.map((tk, rank) => {
            const x1 = tokX(active);
            const x2 = tokX(tk.index);
            const h = 20 + Math.abs(x2 - x1) * 0.35;
            const d =
              tk.index === active
                ? `M ${x1 - 8} 104 C ${x1 - 30} 50, ${x1 + 30} 50, ${x1 + 8} 104`
                : `M ${x1} 104 Q ${(x1 + x2) / 2} ${104 - h} ${x2} 104`;
            return (
              <motion.path
                key={`${active}-${tk.index}`}
                d={d}
                fill="none"
                stroke="var(--da-primary)"
                strokeWidth={1 + tk.weight * 10}
                strokeLinecap="round"
                opacity={1 - rank * 0.25}
                initial={reduced ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: reduced ? 0 : 0.4 }}
              />
            );
          })}
        {result.tokens.map((tk, i) => {
          const isActive = i === active;
          const w = active !== null ? result.weights[active][i] : 0;
          return (
            <g
              key={i}
              role="button"
              tabIndex={0}
              aria-pressed={selected === i}
              aria-label={`${l.query}: ${tk}`}
              className="cursor-pointer"
              onClick={() => pick(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') pick(i);
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <rect
                x={i * tokW + 3}
                y={108}
                width={tokW - 6}
                height={32}
                rx={8}
                fill={
                  isActive
                    ? 'var(--da-primary)'
                    : `color-mix(in srgb, var(--da-primary) ${Math.round(w * 100)}%, var(--da-surface))`
                }
                stroke={isActive ? 'var(--da-primary)' : 'var(--da-border)'}
              />
              <text
                x={tokX(i)}
                y={129}
                textAnchor="middle"
                fontSize={Math.min(13, tokW / 5)}
                fill={isActive ? 'white' : 'var(--da-fg)'}
                fontWeight={isActive ? 600 : 400}
              >
                {tk.length > 10 ? `${tk.slice(0, 9)}…` : tk}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Ağırlık matrisi */}
      <p className="mt-3 text-xs text-muted">{l.rowsCols}</p>
      <svg
        viewBox={`0 0 ${labelW + gridSize + 10} ${labelW + gridSize + 10}`}
        className="mx-auto h-auto w-full max-w-lg"
        role="img"
        aria-label={l.title}
      >
        {result.tokens.map((tk, j) => (
          <text
            key={`c${j}`}
            x={0}
            y={0}
            fontSize={10}
            fill={j === active ? 'var(--da-primary)' : 'var(--da-muted)'}
            transform={`translate(${labelW + j * cell + cell / 2 + 3}, ${labelW - 6}) rotate(-50)`}
          >
            {tk.slice(0, 10)}
          </text>
        ))}
        {result.weights.map((row, i) => (
          <g
            key={`r${i}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => pick(i)}
            className="cursor-pointer"
          >
            <text
              x={labelW - 6}
              y={labelW + i * cell + cell / 2 + 4}
              textAnchor="end"
              fontSize={10}
              fill={i === active ? 'var(--da-primary)' : 'var(--da-fg)'}
              fontWeight={i === active ? 600 : 400}
            >
              {result.tokens[i].slice(0, 12)}
            </text>
            {row.map((w, j) => {
              const masked = causal && j > i;
              return (
                <g key={j}>
                  <title>{`${result.tokens[i]} → ${result.tokens[j]}: ${(w * 100).toFixed(1)}%`}</title>
                  <rect
                    x={labelW + j * cell}
                    y={labelW + i * cell}
                    width={cell - 1}
                    height={cell - 1}
                    rx={3}
                    fill={
                      masked
                        ? 'var(--da-elevated)'
                        : `color-mix(in srgb, var(--da-primary) ${Math.round(Math.sqrt(w) * 100)}%, var(--da-surface))`
                    }
                    stroke={i === active ? 'var(--da-accent)' : 'none'}
                    strokeWidth={i === active ? 1.5 : 0}
                  />
                  {cell >= 30 && !masked && (
                    <text
                      x={labelW + j * cell + cell / 2}
                      y={labelW + i * cell + cell / 2 + 3}
                      textAnchor="middle"
                      fontSize={8}
                      fill={w > 0.4 ? 'white' : 'var(--da-muted)'}
                    >
                      {(w * 100).toFixed(0)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </SimShell>
  );
}
