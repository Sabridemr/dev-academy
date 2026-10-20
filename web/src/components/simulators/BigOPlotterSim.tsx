'use client';

import { useId, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Range, Select, SimShell } from './ui';
import { numParam, type SimulatorProps } from './types';
import {
  BIG_O_FUNCTIONS,
  BIG_O_LABELS,
  bigOLog10,
  bigOValue,
  formatBig,
  formatDuration,
  formatLog10,
  maxSolvableN,
  parseFunctions,
  samplePoints,
  type BigOFn,
} from './bigO.logic';

const COLORS: Record<BigOFn, string> = {
  '1': 'var(--da-success)',
  logn: 'color-mix(in srgb, var(--da-success) 50%, var(--da-primary))',
  n: 'var(--da-primary)',
  nlogn: 'var(--da-accent)',
  n2: 'var(--da-warning)',
  '2n': 'var(--da-danger)',
  nfact: 'color-mix(in srgb, var(--da-danger) 55%, var(--da-fg))',
};
const POLY: BigOFn[] = ['1', 'logn', 'n', 'nlogn', 'n2'];
const W = 600;
const H = 320;
const M = { l: 64, r: 16, t: 14, b: 34 };
const PW = W - M.l - M.r;
const PH = H - M.t - M.b;
const YEAR_MS = 31_557_600_000;
const BUDGETS = [
  { id: 's', ms: 1000 },
  { id: 'min', ms: 60_000 },
  { id: 'h', ms: 3_600_000 },
  { id: 'd', ms: 86_400_000 },
] as const;
type BudgetId = (typeof BUDGETS)[number]['id'];

const L = {
  tr: {
    title: 'Big-O çizici',
    hint: 'Eğrileri açıp kapat, n kaydırıcısıyla aynı girdi boyutunda fonksiyonları karşılaştır. Logaritmik ölçek, hızla büyüyen eğrileri aynı grafikte gösterir.',
    functions: 'Fonksiyonlar',
    logScale: 'Logaritmik y ekseni',
    maxN: 'En büyük n',
    n: 'n',
    fn: 'Fonksiyon',
    ops: 'İşlem sayısı',
    time: 'Süre (1 ms/işlem)',
    budget: 'Zaman bütçesi',
    budgets: { s: '1 saniye', min: '1 dakika', h: '1 saat', d: '1 gün' } satisfies Record<
      BudgetId,
      string
    >,
    cardTitle: (b: string) => `Her işlem 1 ms sürerse ${b} içinde çözülebilecek en büyük n`,
    unlimited: 'sınırsız',
    huge: '> 10^15',
    none: 'n = 1 bile sığmaz',
    years: 'yıl',
    hidden: 'Gizli',
    shown: 'Görünür',
    xLabel: 'girdi boyutu n',
    yLabel: 'işlem',
    clipped: 'Grafiğin üstünden taşan eğriler kırpılır.',
  },
  en: {
    title: 'Big-O plotter',
    hint: 'Toggle curves and use the n slider to compare functions at the same input size. Log scale fits fast-growing curves on one chart.',
    functions: 'Functions',
    logScale: 'Logarithmic y axis',
    maxN: 'Max n',
    n: 'n',
    fn: 'Function',
    ops: 'Operations',
    time: 'Time (1 ms/op)',
    budget: 'Time budget',
    budgets: { s: '1 second', min: '1 minute', h: '1 hour', d: '1 day' } satisfies Record<
      BudgetId,
      string
    >,
    cardTitle: (b: string) => `Largest n solvable in ${b} if each operation takes 1 ms`,
    unlimited: 'unlimited',
    huge: '> 10^15',
    none: 'not even n = 1',
    years: 'years',
    hidden: 'Hidden',
    shown: 'Shown',
    xLabel: 'input size n',
    yLabel: 'operations',
    clipped: 'Curves leaving the top of the chart are clipped.',
  },
};

export default function BigOPlotterSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const clipId = `bigo-${useId().replace(/:/g, '')}`;
  const [visible, setVisible] = useState<Set<BigOFn>>(
    () => new Set(parseFunctions(params.functions)),
  );
  const [maxN, setMaxN] = useState(() => Math.round(numParam(params, 'maxN', 64, 16, 4096)));
  const [logScale, setLogScale] = useState(false);
  const [n, setN] = useState(() => Math.max(1, Math.round(Math.min(maxN, 16))));
  const [budget, setBudget] = useState<BudgetId>('s');

  const shown = BIG_O_FUNCTIONS.filter((f) => visible.has(f));
  const xs = useMemo(() => samplePoints(maxN), [maxN]);

  // y ekseni üst sınırı
  const yMaxLin = useMemo(() => {
    const poly = shown.filter((f) => POLY.includes(f)).map((f) => bigOValue(f, maxN));
    if (poly.length) return Math.max(1, ...poly);
    return 2 ** Math.min(maxN, 20);
  }, [shown, maxN]);
  // Log ölçekte tavan: en hızlı eğrinin uç değeri (en fazla 10^100); üstü kırpılır
  const yTopLog = Math.max(1, Math.min(100, Math.max(...shown.map((f) => bigOLog10(f, maxN)), 1)));

  const sx = (x: number) => M.l + ((x - 1) / Math.max(1, maxN - 1)) * PW;
  const sy = (fn: BigOFn, x: number) => {
    const ratio = logScale
      ? Math.max(0, bigOLog10(fn, x)) / yTopLog
      : Math.min(bigOValue(fn, x), yMaxLin * 1.2) / yMaxLin;
    return M.t + PH - Math.min(1.1, ratio) * PH;
  };
  const pathOf = (fn: BigOFn) =>
    xs.map((x, i) => `${i ? 'L' : 'M'} ${sx(x).toFixed(1)} ${sy(fn, x).toFixed(1)}`).join(' ');

  const yTicks = logScale
    ? Array.from({ length: 5 }, (_, i) => Math.round((yTopLog * i) / 4))
    : Array.from({ length: 5 }, (_, i) => (yMaxLin * i) / 4);
  const xTicks = Array.from({ length: 5 }, (_, i) => Math.round(1 + ((maxN - 1) * i) / 4));

  const toggle = (f: BigOFn) => {
    onInteract();
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  const durationOf = (fn: BigOFn, x: number) => {
    const lg = bigOLog10(fn, x);
    if (lg > 15) return `${formatLog10(lg - Math.log10(YEAR_MS), locale)} ${l.years}`;
    return formatDuration(10 ** lg, locale);
  };
  const budgetMs = BUDGETS.find((b) => b.id === budget)!.ms;

  return (
    <SimShell
      title={l.title}
      toolbar={
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--da-primary)]"
            checked={logScale}
            onChange={(e) => {
              onInteract();
              setLogScale(e.target.checked);
            }}
          />
          {l.logScale}
        </label>
      }
      aside={
        <>
          <div>
            <p className="label">{l.functions}</p>
            <div className="flex flex-wrap gap-1.5">
              {BIG_O_FUNCTIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={visible.has(f)}
                  onClick={() => toggle(f)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs transition',
                    visible.has(f)
                      ? 'border-fg/30 bg-elevated text-fg'
                      : 'border-border text-muted opacity-60',
                  )}
                  title={visible.has(f) ? l.shown : l.hidden}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[f] }} />
                  {BIG_O_LABELS[f]}
                </button>
              ))}
            </div>
          </div>
          <Range
            label={l.maxN}
            value={Math.round(Math.log2(maxN))}
            min={4}
            max={12}
            format={() => String(maxN)}
            onChange={(v) => {
              onInteract();
              const m = 2 ** v;
              setMaxN(m);
              setN((cur) => Math.min(cur, m));
            }}
          />
          <Range
            label={l.n}
            value={n}
            min={1}
            max={maxN}
            onChange={(v) => {
              onInteract();
              setN(v);
            }}
          />
          <Select
            label={l.budget}
            value={budget}
            options={BUDGETS.map((b) => ({ id: b.id, label: l.budgets[b.id] }))}
            onChange={(v) => {
              onInteract();
              setBudget(v);
            }}
          />
          <div className="rounded-xl border border-border bg-elevated/40 p-3">
            <p className="mb-2 text-xs font-medium text-muted">{l.cardTitle(l.budgets[budget])}</p>
            <ul className="space-y-1 text-sm">
              {shown.map((f) => {
                const best = maxSolvableN(f, budgetMs);
                return (
                  <li key={f} className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: COLORS[f] }}
                      />
                      {BIG_O_LABELS[f]}
                    </span>
                    <span className="font-mono text-xs font-semibold tabular-nums">
                      {best === Infinity
                        ? f === '1'
                          ? l.unlimited
                          : l.huge
                        : best === 0
                          ? l.none
                          : formatBig(best, locale)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">{l.hint}</p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${l.title}: ${shown.map((f) => BIG_O_LABELS[f]).join(', ')}`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={M.l} y={M.t} width={PW} height={PH} />
          </clipPath>
        </defs>
        <rect
          x={M.l}
          y={M.t}
          width={PW}
          height={PH}
          fill="var(--da-bg)"
          opacity={0.6}
          stroke="var(--da-border)"
        />
        {yTicks.map((t, i) => {
          const y = M.t + PH - (i / 4) * PH;
          return (
            <g key={i}>
              <line
                x1={M.l}
                x2={M.l + PW}
                y1={y}
                y2={y}
                stroke="var(--da-border)"
                strokeDasharray="3 4"
              />
              <text x={M.l - 6} y={y + 4} textAnchor="end" fontSize={12} fill="var(--da-muted)">
                {logScale ? `10^${t}` : formatBig(t, locale)}
              </text>
            </g>
          );
        })}
        {xTicks.map((t) => (
          <text
            key={t}
            x={sx(t)}
            y={H - 14}
            textAnchor="middle"
            fontSize={12}
            fill="var(--da-muted)"
          >
            {t}
          </text>
        ))}
        <text x={M.l + PW / 2} y={H - 1} textAnchor="middle" fontSize={12} fill="var(--da-muted)">
          {l.xLabel}
        </text>
        <g clipPath={`url(#${clipId})`}>
          {shown.map((f) => (
            <motion.path
              key={`${f}-${logScale}-${maxN}`}
              d={pathOf(f)}
              fill="none"
              stroke={COLORS[f]}
              strokeWidth={2.5}
              strokeLinejoin="round"
              initial={reduced ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: reduced ? 0 : 0.6 }}
            />
          ))}
          <line
            x1={sx(n)}
            x2={sx(n)}
            y1={M.t}
            y2={M.t + PH}
            stroke="var(--da-fg)"
            strokeDasharray="4 3"
            opacity={0.6}
          />
          {shown.map((f) => (
            <circle
              key={f}
              cx={sx(n)}
              cy={sy(f, n)}
              r={4}
              fill={COLORS[f]}
              stroke="var(--da-surface)"
              strokeWidth={1.5}
            />
          ))}
        </g>
        <text x={sx(n)} y={M.t + 14} dx={6} fontSize={12} fill="var(--da-fg)">
          n = {n}
        </text>
      </svg>
      {!logScale && shown.some((f) => !POLY.includes(f)) && (
        <p className="mt-1 text-xs text-muted">{l.clipped}</p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-1 pr-3 font-medium">{l.fn}</th>
              <th className="py-1 pr-3 font-medium">
                {l.ops} (n = {n})
              </th>
              <th className="py-1 font-medium">{l.time}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <tr key={f} className="border-t border-border">
                <td className="py-1 pr-3 font-mono text-xs">
                  <span
                    className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: COLORS[f] }}
                  />
                  {BIG_O_LABELS[f]}
                </td>
                <td className="py-1 pr-3 font-mono text-xs tabular-nums">
                  {formatLog10(bigOLog10(f, n), locale)}
                </td>
                <td className="py-1 font-mono text-xs tabular-nums">{durationOf(f, n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SimShell>
  );
}
