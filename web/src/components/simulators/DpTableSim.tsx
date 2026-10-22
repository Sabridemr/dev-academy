'use client';

import { useMemo, useState, type KeyboardEvent } from 'react';
import { ChevronsRight, Pause, Play, RotateCcw, StepBack, StepForward } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { Field, Range, Select, SimShell, Stat } from './ui';
import { numParam, strParam, type SimulatorProps } from './types';
import {
  DEFAULT_A,
  DEFAULT_B,
  DEFAULT_COINS,
  DEFAULT_ITEMS,
  DP_PROBLEMS,
  DP_SIZE,
  buildDpTable,
  cellKey,
  cleanSeq,
  fmt,
  parseCoins,
  parseItems,
  type DpCell,
  type DpProblem,
} from './dp.logic';
import { useStepPlayer } from './useStepPlayer';

const STEP_MS = 420;

const L = {
  tr: {
    title: 'Dinamik programlama tablosu',
    problems: {
      fibonacci: 'Fibonacci',
      knapsack: '0/1 sırt çantası',
      lcs: 'En uzun ortak alt dizi (LCS)',
      'coin-change': 'Madeni para bozdurma (en az para)',
    } satisfies Record<DpProblem, string>,
    hint: {
      fibonacci:
        'dp[i], i. Fibonacci sayısıdır. Her hücre soldaki iki hücreden gelir; tablo soldan sağa bir kez doldurulur.',
      knapsack:
        'dp[i][w]: ilk i eşya ve w kapasiteyle elde edilebilecek en büyük değer. Her hücre ya üstündeki hücreyi (eşyayı alma) ya da üst satırda wᵢ sola kaymış hücre + vᵢ değerini (eşyayı al) seçer.',
      lcs: 'dp[i][j]: A’nın ilk i ve B’nin ilk j karakterinin en uzun ortak alt dizisi. Karakterler eşitse çapraz hücre + 1, değilse üst ve sol hücrenin büyüğü.',
      'coin-change':
        'dp[a]: a tutarını oluşturmak için gereken en az madeni para. Her hücre, her para c için a−c hücresine bakar ve en küçüğüne 1 ekler.',
    } satisfies Record<DpProblem, string>,
    size: {
      fibonacci: 'n',
      knapsack: 'Kapasite (W)',
      lcs: '',
      'coin-change': 'Tutar',
    } satisfies Record<DpProblem, string>,
    problem: 'Problem',
    items: 'Eşyalar (ağırlık:değer)',
    seqA: 'Dizgi A (satırlar)',
    seqB: 'Dizgi B (sütunlar)',
    coins: 'Madeni paralar',
    play: 'Oynat',
    pause: 'Duraklat',
    step: 'Adım',
    back: 'Geri',
    toEnd: 'Sona git',
    reset: 'Sıfırla',
    filled: 'Dolu hücre',
    answer: 'Cevap',
    recurrence: 'Yineleme',
    current: 'Bu adım',
    base: 'taban durum',
    idle: '“Adım” ile ilk hücreyi doldur.',
    solution: 'Geri izleme (çözüm)',
    noSolution: 'Bu tutar verilen paralarla oluşturulamaz.',
    emptySolution: 'boş',
    solutionLabel: {
      fibonacci: 'Sonuç',
      knapsack: 'Seçilen eşyalar',
      lcs: 'Ortak alt dizi',
      'coin-change': 'Kullanılan paralar',
    } satisfies Record<DpProblem, string>,
    keys: 'Tablo odaktayken ← / → ile geri ve ileri adım atabilirsin.',
    legend: {
      current: 'yazılan hücre',
      dep: 'okunan hücre',
      from: 'kazanan kaynak',
      path: 'çözüm yolu',
    },
    tableLabel: (p: string) => `${p} DP tablosu`,
  },
  en: {
    title: 'Dynamic programming table',
    problems: {
      fibonacci: 'Fibonacci',
      knapsack: '0/1 knapsack',
      lcs: 'Longest common subsequence (LCS)',
      'coin-change': 'Coin change (fewest coins)',
    } satisfies Record<DpProblem, string>,
    hint: {
      fibonacci:
        'dp[i] is the i-th Fibonacci number. Each cell comes from the two cells to its left; the table is filled once, left to right.',
      knapsack:
        'dp[i][w]: the best value using the first i items with capacity w. Each cell picks either the cell above (skip the item) or the cell one row up and wᵢ to the left + vᵢ (take it).',
      lcs: 'dp[i][j]: LCS of the first i characters of A and first j of B. Equal characters take the diagonal + 1, otherwise the larger of the cells above and to the left.',
      'coin-change':
        'dp[a]: the fewest coins that make amount a. Each cell looks at a−c for every coin c and adds 1 to the smallest.',
    } satisfies Record<DpProblem, string>,
    size: {
      fibonacci: 'n',
      knapsack: 'Capacity (W)',
      lcs: '',
      'coin-change': 'Amount',
    } satisfies Record<DpProblem, string>,
    problem: 'Problem',
    items: 'Items (weight:value)',
    seqA: 'String A (rows)',
    seqB: 'String B (columns)',
    coins: 'Coins',
    play: 'Play',
    pause: 'Pause',
    step: 'Step',
    back: 'Back',
    toEnd: 'Jump to end',
    reset: 'Reset',
    filled: 'Filled cells',
    answer: 'Answer',
    recurrence: 'Recurrence',
    current: 'This step',
    base: 'base case',
    idle: 'Press “Step” to fill the first cell.',
    solution: 'Backtracking (solution)',
    noSolution: 'This amount cannot be made with the given coins.',
    emptySolution: 'empty',
    solutionLabel: {
      fibonacci: 'Result',
      knapsack: 'Chosen items',
      lcs: 'Common subsequence',
      'coin-change': 'Coins used',
    } satisfies Record<DpProblem, string>,
    keys: 'With the table focused, use ← / → to step back and forward.',
    legend: {
      current: 'cell written',
      dep: 'cell read',
      from: 'winning source',
      path: 'solution path',
    },
    tableLabel: (p: string) => `${p} DP table`,
  },
};

/** Bağımlı hücreden yazılan hücreye doğru ok */
function arrowTo(from: DpCell, to: DpCell): string {
  const dr = Math.sign(to.r - from.r);
  const dc = Math.sign(to.c - from.c);
  if (dr > 0 && dc > 0) return '↘';
  if (dr > 0 && dc === 0) return '↓';
  if (dr > 0 && dc < 0) return '↙';
  if (dr === 0 && dc > 0) return '→';
  return '·';
}

const itemsText = (items: typeof DEFAULT_ITEMS) => items.map((i) => `${i.w}:${i.v}`).join(', ');

export default function DpTableSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const [problem, setProblem] = useState<DpProblem>(() =>
    strParam(params, 'problem', 'fibonacci', DP_PROBLEMS),
  );
  const [sizes, setSizes] = useState<Record<DpProblem, number>>(() => {
    const out = {} as Record<DpProblem, number>;
    for (const p of DP_PROBLEMS) out[p] = DP_SIZE[p].fallback;
    const initial = strParam(params, 'problem', 'fibonacci', DP_PROBLEMS);
    const { min, max, fallback } = DP_SIZE[initial];
    out[initial] = Math.round(numParam(params, 'size', fallback, min, max));
    return out;
  });
  const [items, setItems] = useState(() => itemsText(DEFAULT_ITEMS));
  const [a, setA] = useState(DEFAULT_A);
  const [b, setB] = useState(DEFAULT_B);
  const [coins, setCoins] = useState(DEFAULT_COINS.join(', '));

  const size = sizes[problem];
  const table = useMemo(
    () =>
      buildDpTable({
        problem,
        size,
        items: parseItems(items),
        a,
        b,
        coins: parseCoins(coins),
      }),
    [problem, size, items, a, b, coins],
  );
  const player = useStepPlayer(table.steps.length, STEP_MS, table);
  const { cursor, finished, playing } = player;

  const values = new Map<string, number>();
  for (let k = 0; k < cursor; k++) values.set(cellKey(table.steps[k]), table.steps[k].value);
  const current = cursor > 0 && !finished ? table.steps[cursor - 1] : null;
  const depKeys = new Set(current?.deps.map(cellKey));
  const fromKey = current?.from ? cellKey(current.from) : null;
  const pathKeys = new Set(finished ? table.path.map(cellKey) : []);
  const answerValue = values.get(cellKey(table.answer));

  const touch = () => onInteract();
  const onTableKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      touch();
      player.next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      player.prev();
    }
  };

  const lastStep = cursor > 0 ? table.steps[cursor - 1] : null;
  const status = lastStep
    ? lastStep.base
      ? `${lastStep.formula} (${l.base})`
      : lastStep.formula
    : l.idle;

  const cellClass = (key: string) => {
    if (current && cellKey(current) === key)
      return 'bg-warning/25 ring-2 ring-inset ring-[var(--da-warning)] font-semibold';
    if (key === fromKey) return 'bg-primary/20 ring-2 ring-inset ring-[var(--da-primary)]';
    if (depKeys.has(key)) return 'bg-accent/20';
    if (pathKeys.has(key)) return 'bg-success/25 font-semibold text-success';
    return values.has(key) ? 'bg-elevated/60' : 'bg-bg/40 text-muted';
  };

  const showSize = problem !== 'lcs';
  const { min, max } = DP_SIZE[problem];

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              touch();
              player.togglePlay();
            }}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? l.pause : l.play}
          </button>
          <button type="button" className="btn-ghost" onClick={player.prev} disabled={cursor === 0}>
            <StepBack size={14} /> {l.back}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              touch();
              player.next();
            }}
            disabled={finished}
          >
            <StepForward size={14} /> {l.step}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              touch();
              player.end();
            }}
            disabled={finished}
          >
            <ChevronsRight size={14} /> {l.toEnd}
          </button>
          <button type="button" className="btn-ghost" onClick={player.reset}>
            <RotateCcw size={14} /> {l.reset}
          </button>
        </>
      }
      aside={
        <>
          <Select
            label={l.problem}
            value={problem}
            options={DP_PROBLEMS.map((id) => ({ id, label: l.problems[id] }))}
            onChange={(v) => {
              touch();
              setProblem(v);
            }}
          />
          {showSize && (
            <Range
              label={l.size[problem]}
              value={size}
              min={min}
              max={max}
              onChange={(v) => {
                touch();
                setSizes((s) => ({ ...s, [problem]: v }));
              }}
            />
          )}
          {problem === 'knapsack' && (
            <Field label={l.items}>
              <input
                className="input font-mono"
                value={items}
                maxLength={60}
                onChange={(e) => {
                  touch();
                  setItems(e.target.value);
                }}
              />
            </Field>
          )}
          {problem === 'lcs' && (
            <>
              <Field label={l.seqA}>
                <input
                  className="input font-mono uppercase"
                  value={a}
                  maxLength={8}
                  onChange={(e) => {
                    touch();
                    setA(cleanSeq(e.target.value));
                  }}
                />
              </Field>
              <Field label={l.seqB}>
                <input
                  className="input font-mono uppercase"
                  value={b}
                  maxLength={8}
                  onChange={(e) => {
                    touch();
                    setB(cleanSeq(e.target.value));
                  }}
                />
              </Field>
            </>
          )}
          {problem === 'coin-change' && (
            <Field label={l.coins}>
              <input
                className="input font-mono"
                value={coins}
                maxLength={30}
                onChange={(e) => {
                  touch();
                  setCoins(e.target.value);
                }}
              />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Stat label={l.filled} value={`${cursor}/${table.steps.length}`} tone="primary" />
            <Stat
              label={l.answer}
              value={answerValue === undefined ? '—' : fmt(answerValue)}
              tone={answerValue === undefined ? undefined : 'success'}
            />
          </div>
          {finished && (
            <div className="rounded-xl border border-border bg-elevated/40 p-3 text-sm">
              <p className="label">{l.solution}</p>
              {problem === 'coin-change' && table.path.length === 0 ? (
                <p className="text-danger">{l.noSolution}</p>
              ) : (
                <>
                  <p className="text-xs text-muted">{l.solutionLabel[problem]}</p>
                  <p className="font-mono text-success">
                    {table.solution.length
                      ? table.solution.join(problem === 'coin-change' ? ' + ' : ', ')
                      : l.emptySolution}
                  </p>
                </>
              )}
            </div>
          )}
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">{l.hint[problem]}</p>
      <div className="mb-3 space-y-1 rounded-xl border border-border bg-bg/60 p-3 font-mono text-xs">
        <p>
          <span className="text-muted">{l.recurrence}: </span>
          {table.recurrence}
        </p>
        <p aria-live="polite" className="text-fg">
          <span className="text-muted">{l.current}: </span>
          {status}
        </p>
      </div>
      <div
        className="overflow-x-auto rounded-xl border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--da-primary)]"
        tabIndex={0}
        role="group"
        aria-label={l.tableLabel(l.problems[problem])}
        onKeyDown={onTableKey}
      >
        <table className="w-full border-collapse text-center font-mono text-xs">
          <thead>
            <tr>
              <th scope="col" className="bg-surface px-2 py-1 text-muted" />
              {table.colLabels.map((c, j) => (
                <th key={j} scope="col" className="min-w-8 bg-surface px-1.5 py-1 text-muted">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rowLabels.map((rl, r) => (
              <tr key={r}>
                <th scope="row" className="whitespace-nowrap bg-surface px-2 py-1 text-muted">
                  {rl}
                </th>
                {table.colLabels.map((_, c) => {
                  const key = `${r}:${c}`;
                  const v = values.get(key);
                  const isDep = depKeys.has(key) && current;
                  return (
                    <td
                      key={c}
                      className={cn(
                        'relative h-8 min-w-8 border border-border/60 px-1.5 tabular-nums motion-safe:transition-colors',
                        cellClass(key),
                      )}
                    >
                      {v === undefined ? '·' : fmt(v)}
                      {isDep && (
                        <span
                          aria-hidden
                          className="absolute right-0.5 top-0 text-[10px] leading-none text-accent-fg"
                        >
                          {arrowTo({ r, c }, current)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">{l.keys}</p>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        {(
          [
            ['var(--da-warning)', l.legend.current],
            ['var(--da-accent)', l.legend.dep],
            ['var(--da-primary)', l.legend.from],
            ['var(--da-success)', l.legend.path],
          ] as const
        ).map(([c, label]) => (
          <span key={label} className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm" style={{ background: c }} /> {label}
          </span>
        ))}
      </div>
    </SimShell>
  );
}
