'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Database as DbIcon,
  Lightbulb,
  Loader2,
  Play,
  X,
} from 'lucide-react';
import type { Database } from 'sql.js';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Select, SimShell, Stat } from './ui';
import { strParam, type SimulatorProps } from './types';
import { loadSqlEngine } from './sqlEngine';
import { DATASETS, SQL_DATASETS, type SqlDatasetId } from './sqlPlayground.datasets';
import {
  buildSteps,
  compareResults,
  describeSchema,
  guardSelect,
  makeRunner,
  parseSelect,
  type Cell,
  type GuardResult,
  type QueryResult,
  type QueryStep,
  type Runner,
  type StepKind,
  type StepRow,
  type TaskVerdict,
} from './sqlPlayground.logic';

/** Ekranda bir tabloda gösterilecek en fazla satır */
const VISIBLE_ROWS = 120;

/** GROUP BY grup renkleri (Tailwind sınıfları sabit yazılmalı) */
const GROUP_BG = [
  'bg-primary/15',
  'bg-accent/20',
  'bg-success/15',
  'bg-warning/20',
  'bg-danger/15',
  'bg-primary/30',
  'bg-accent/35',
  'bg-success/30',
];
const GROUP_BAR = [
  'border-l-primary',
  'border-l-accent',
  'border-l-success',
  'border-l-warning',
  'border-l-danger',
  'border-l-primary',
  'border-l-accent',
  'border-l-success',
];

const L = {
  tr: {
    title: 'SQL oyun alanı',
    loading: 'SQL motoru (SQLite/WebAssembly) yükleniyor…',
    loadError: 'SQL motoru yüklenemedi. Sayfayı yenileyip tekrar dene.',
    dataset: 'Veri kümesi',
    editor: 'SQL sorgusu',
    run: 'Çalıştır',
    runHint: 'Ctrl/⌘ + Enter ile de çalıştırabilirsin. Yalnızca SELECT sorguları çalışır.',
    tabResult: 'Sonuç',
    tabSteps: 'Adım adım',
    rows: (n: number) => `${n} satır`,
    truncated: 'Sonuç uzun; ilk satırlar gösteriliyor.',
    more: (n: number) => `… ve ${n} satır daha`,
    noRows: 'Sorgu satır döndürmedi.',
    noResult: 'Bir sorgu yazıp “Çalıştır”a bas.',
    guard: {
      empty: 'Sorgu boş.',
      multiple: 'Aynı anda yalnızca tek bir sorgu çalıştırılabilir.',
      'not-select': 'Burada yalnızca okuma sorguları (SELECT / WITH … SELECT) çalışır.',
      forbidden: (kw?: string) =>
        `${kw ?? 'Bu komut'} reddedildi: oyun alanı yalnızca SELECT çalıştırır (DDL/DML kapalı).`,
    },
    sqlError: 'SQLite hatası',
    noSteps:
      'Bu sorgu için adım görünümü yok. Adım görünümü alt sorgu, UNION, WITH, virgüllü FROM ve RIGHT/FULL JOIN içermeyen basit SELECT … FROM … [JOIN … ON …] [WHERE] [GROUP BY] [HAVING] [ORDER BY] [LIMIT] sorgularında çalışır; sonuç sekmesi her zaman gerçek sonucu gösterir.',
    prev: 'Önceki adım',
    next: 'Sonraki adım',
    stepOf: (i: number, n: number) => `Adım ${i}/${n}`,
    stepsKeys: '← → tuşlarıyla adımlar arasında gezinebilirsin.',
    kind: {
      from: 'FROM',
      join: 'JOIN',
      where: 'WHERE',
      group: 'GROUP BY',
      having: 'HAVING',
      select: 'SELECT',
      order: 'ORDER BY',
      limit: 'LIMIT',
    } satisfies Record<StepKind, string>,
    explain: (s: QueryStep): string => {
      const st = s.stats;
      switch (s.kind) {
        case 'from':
          return `Kaynak tablonun tüm satırları (${st.output}) okunur. Sorgu mantıksal olarak FROM'dan başlar; SELECT en sonda değerlendirilir.`;
        case 'join':
          return s.clause.startsWith('LEFT')
            ? `${st.input} satırın her biri ON koşuluna göre eşleştirildi: ${st.matched} eşleşen çift. Eşleşmeyen ${st.unmatched} satır LEFT JOIN'de korunur, sağ taraf NULL ile doldurulur → ${st.output} satır.`
            : `${st.input} satırın her biri ON koşuluna göre eşleştirildi: ${st.matched} eşleşen çift (vurgulu sütunlar ON'da karşılaştırılanlar). Eşleşmeyen ${st.unmatched} satır INNER JOIN'de elenir (soluk) → ${st.output} satır.`;
        case 'where':
          return `Koşul her satır için ayrı değerlendirilir: ${st.input - st.output} satır elendi (soluk), ${st.output} satır kaldı. WHERE gruplamadan önce çalışır; toplama fonksiyonu kullanamaz.`;
        case 'group':
          return `${st.input} satır, GROUP BY ifadelerinin değerine göre ${st.groups} gruba ayrıldı (her renk bir grup). Bundan sonra her grup tek satıra iner; SELECT'te yalnızca grup sütunları ve toplama fonksiyonları anlamlıdır.`;
        case 'having':
          return `HAVING grupları süzer: ${st.input} gruptan ${st.output} tanesi koşulu sağladı. COUNT(*) sütunu her grubun satır sayısıdır.`;
        case 'select':
          return `SELECT listesi hesaplanır (ifadeler, takma adlar, toplama fonksiyonları): ${st.output} satır.`;
        case 'order':
          return `Satırlar ORDER BY'a göre sıralandı. Sıralama SELECT'ten sonra geldiği için takma adlar burada kullanılabilir.`;
        case 'limit':
          return `LIMIT/OFFSET yalnızca istenen aralığı bırakır: ${st.input} satırdan ${st.output} tanesi döner, kesilenler soluk.`;
      }
    },
    legend: {
      matched: 'eşleşen çift',
      padded: 'NULL ile dolduruldu',
      dropped: 'elendi',
      cut: 'LIMIT dışında',
      group: 'aynı renk = aynı grup',
    },
    schema: 'Şema',
    insertQuery: (t: string) => `${t} tablosunun ilk satırlarını sorgula`,
    tasks: 'Görevler',
    check: 'Kontrol et',
    hint: 'İpucu',
    verdict: {
      ok: 'Doğru! Sonucun beklenen sonuçla birebir aynı.',
      columns: (e: number, a: number) =>
        `Sütun sayısı tutmuyor: beklenen ${e}, senin sorgunda ${a}.`,
      rows: (e: number, a: number) => `Satır sayısı tutmuyor: beklenen ${e}, senin sonucunda ${a}.`,
      order: 'Satırlar doğru ama sıra yanlış: bu görev ORDER BY istiyor.',
      values: 'Satır sayısı doğru ama değerler farklı. Koşulları ve JOIN’leri kontrol et.',
    },
    solved: (n: number, total: number) => `${n}/${total}`,
    solvedLabel: 'Çözülen',
    resultRows: 'Satır',
  },
  en: {
    title: 'SQL playground',
    loading: 'Loading the SQL engine (SQLite/WebAssembly)…',
    loadError: 'The SQL engine could not be loaded. Refresh the page and try again.',
    dataset: 'Dataset',
    editor: 'SQL query',
    run: 'Run',
    runHint: 'You can also run with Ctrl/⌘ + Enter. Only SELECT queries run.',
    tabResult: 'Result',
    tabSteps: 'Step by step',
    rows: (n: number) => `${n} rows`,
    truncated: 'Long result; showing the first rows.',
    more: (n: number) => `… and ${n} more rows`,
    noRows: 'The query returned no rows.',
    noResult: 'Write a query and press “Run”.',
    guard: {
      empty: 'The query is empty.',
      multiple: 'Only a single statement can run at a time.',
      'not-select': 'Only read queries (SELECT / WITH … SELECT) run here.',
      forbidden: (kw?: string) =>
        `${kw ?? 'This command'} rejected: the playground only runs SELECT (DDL/DML disabled).`,
    },
    sqlError: 'SQLite error',
    noSteps:
      'No step view for this query. The step view works for simple SELECT … FROM … [JOIN … ON …] [WHERE] [GROUP BY] [HAVING] [ORDER BY] [LIMIT] queries without subqueries, UNION, WITH, comma joins or RIGHT/FULL JOIN; the result tab always shows the real result.',
    prev: 'Previous step',
    next: 'Next step',
    stepOf: (i: number, n: number) => `Step ${i}/${n}`,
    stepsKeys: 'Use the ← → keys to move between steps.',
    kind: {
      from: 'FROM',
      join: 'JOIN',
      where: 'WHERE',
      group: 'GROUP BY',
      having: 'HAVING',
      select: 'SELECT',
      order: 'ORDER BY',
      limit: 'LIMIT',
    } satisfies Record<StepKind, string>,
    explain: (s: QueryStep): string => {
      const st = s.stats;
      switch (s.kind) {
        case 'from':
          return `All rows of the source table (${st.output}) are read. Logically the query starts at FROM; SELECT is evaluated last.`;
        case 'join':
          return s.clause.startsWith('LEFT')
            ? `Each of the ${st.input} rows was matched with the ON condition: ${st.matched} matching pairs. The ${st.unmatched} unmatched rows are kept by LEFT JOIN, padded with NULL → ${st.output} rows.`
            : `Each of the ${st.input} rows was matched with the ON condition: ${st.matched} matching pairs (highlighted columns are compared in ON). The ${st.unmatched} unmatched rows are dropped by INNER JOIN (faded) → ${st.output} rows.`;
        case 'where':
          return `The condition is evaluated per row: ${st.input - st.output} rows dropped (faded), ${st.output} remain. WHERE runs before grouping; it cannot use aggregates.`;
        case 'group':
          return `${st.input} rows were split into ${st.groups} groups by the GROUP BY values (one colour per group). Each group then collapses to one row; only group columns and aggregates make sense in SELECT.`;
        case 'having':
          return `HAVING filters groups: ${st.output} of ${st.input} groups satisfied it. The COUNT(*) column is each group's row count.`;
        case 'select':
          return `The SELECT list is computed (expressions, aliases, aggregates): ${st.output} rows.`;
        case 'order':
          return `Rows were sorted by ORDER BY. Sorting comes after SELECT, so aliases can be used here.`;
        case 'limit':
          return `LIMIT/OFFSET keeps only the requested range: ${st.output} of ${st.input} rows are returned, cut rows are faded.`;
      }
    },
    legend: {
      matched: 'matching pair',
      padded: 'padded with NULL',
      dropped: 'dropped',
      cut: 'outside LIMIT',
      group: 'same colour = same group',
    },
    schema: 'Schema',
    insertQuery: (t: string) => `Query the first rows of ${t}`,
    tasks: 'Tasks',
    check: 'Check',
    hint: 'Hint',
    verdict: {
      ok: 'Correct! Your result matches the expected result exactly.',
      columns: (e: number, a: number) =>
        `Column count differs: expected ${e}, your query has ${a}.`,
      rows: (e: number, a: number) => `Row count differs: expected ${e}, your result has ${a}.`,
      order: 'Right rows, wrong order: this task asks for ORDER BY.',
      values: 'Row count is right but values differ. Check your conditions and JOINs.',
    },
    solved: (n: number, total: number) => `${n}/${total}`,
    solvedLabel: 'Solved',
    resultRows: 'Rows',
  },
};
type Lang = (typeof L)['tr'];

type Outcome =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; result: QueryResult; steps: QueryStep[] | null };

function guardMessage(l: Lang, g: Exclude<GuardResult, { ok: true }>): string {
  return g.reason === 'forbidden' ? l.guard.forbidden(g.keyword) : l.guard[g.reason];
}

function fmt(v: Cell): string {
  if (v === null) return 'NULL';
  if (typeof v === 'number' && !Number.isInteger(v)) return String(Math.round(v * 100) / 100);
  return String(v);
}

function DataTable({
  columns,
  rows,
  highlight = [],
  label,
  l,
}: {
  columns: string[];
  rows: StepRow[];
  highlight?: number[];
  label: string;
  l: Lang;
}) {
  const shown = rows.slice(0, VISIBLE_ROWS);
  return (
    <div className="max-h-80 overflow-auto rounded-xl border border-border bg-bg/60">
      <table className="w-full border-collapse text-left font-mono text-xs" aria-label={label}>
        <thead className="sticky top-0 bg-surface">
          <tr>
            {columns.map((c, i) => (
              <th
                key={`${c}-${i}`}
                scope="col"
                className={cn(
                  'whitespace-nowrap border-b border-border px-2 py-1.5 font-semibold',
                  highlight.includes(i) && 'bg-primary/15 text-primary',
                )}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr
              key={i}
              data-state={r.state}
              className={cn(
                'border-b border-border/50 border-l-4 border-l-transparent',
                r.state === 'dropped' && 'line-through opacity-40',
                r.state === 'cut' && 'opacity-35',
                r.state === 'matched' && (r.group === 1 ? 'bg-success/15' : 'bg-success/5'),
                r.state === 'padded' && 'bg-warning/10',
                r.group !== undefined &&
                  r.state !== 'matched' &&
                  r.state !== 'padded' &&
                  cn(GROUP_BG[r.group % GROUP_BG.length], GROUP_BAR[r.group % GROUP_BAR.length]),
              )}
            >
              {r.cells.map((v, j) => (
                <td
                  key={j}
                  className={cn(
                    'whitespace-nowrap px-2 py-1',
                    v === null && 'italic text-muted',
                    highlight.includes(j) && 'font-semibold',
                  )}
                >
                  {fmt(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="p-3 text-xs text-muted">{l.noRows}</p>}
      {rows.length > VISIBLE_ROWS && (
        <p className="p-2 text-xs text-muted">{l.more(rows.length - VISIBLE_ROWS)}</p>
      )}
    </div>
  );
}

function Legend({ step, l }: { step: QueryStep; l: Lang }) {
  const items: { cls: string; text: string }[] = [];
  const has = (s: StepRow['state']) => step.rows.some((r) => r.state === s);
  if (has('matched')) items.push({ cls: 'bg-success/30', text: l.legend.matched });
  if (has('padded')) items.push({ cls: 'bg-warning/30', text: l.legend.padded });
  if (has('dropped')) items.push({ cls: 'bg-muted/30 line-through', text: l.legend.dropped });
  if (has('cut')) items.push({ cls: 'bg-muted/20', text: l.legend.cut });
  if (step.kind === 'group') items.push({ cls: 'bg-primary/20', text: l.legend.group });
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-3 text-xs text-muted">
      {items.map((i) => (
        <li key={i.text} className="flex items-center gap-1.5">
          <span className={cn('inline-block h-3 w-5 rounded', i.cls)} aria-hidden />
          {i.text}
        </li>
      ))}
    </ul>
  );
}

export default function SqlPlaygroundSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const initialDataset = strParam<SqlDatasetId>(params, 'dataset', 'shop', SQL_DATASETS);
  const initialQuery =
    typeof params.query === 'string' && params.query.trim() ? params.query : null;

  const [dataset, setDataset] = useState<SqlDatasetId>(initialDataset);
  const [sql, setSql] = useState(initialQuery ?? DATASETS[initialDataset].starter);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
  const [view, setView] = useState<'result' | 'steps'>('steps');
  const [stepIndex, setStepIndex] = useState(0);
  const [schema, setSchema] = useState<ReturnType<typeof describeSchema>>([]);
  const [taskId, setTaskId] = useState(DATASETS[initialDataset].tasks[0]!.id);
  const [verdict, setVerdict] = useState<
    TaskVerdict | { ok: false; reason: 'error'; message: string } | null
  >(null);
  const [showHint, setShowHint] = useState(false);
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const dbRef = useRef<Database | null>(null);
  const runnerRef = useRef<Runner | null>(null);
  const sqlRef = useRef(sql);
  sqlRef.current = sql;
  // Dil değişince veritabanı yeniden kurulmasın: mesajlar ref üzerinden okunur
  const lRef = useRef(l);
  lRef.current = l;

  const execute = useCallback((text: string) => {
    const run = runnerRef.current;
    const l = lRef.current;
    if (!run) return;
    const g = guardSelect(text);
    if (!g.ok) {
      setOutcome({ kind: 'error', message: guardMessage(l, g) });
      return;
    }
    try {
      const result = run(g.sql);
      const parsed = parseSelect(g.sql);
      const steps = parsed ? buildSteps(run, parsed) : null;
      setOutcome({ kind: 'ok', result, steps });
      setStepIndex(0);
    } catch (e) {
      setOutcome({ kind: 'error', message: `${l.sqlError}: ${(e as Error).message}` });
    }
  }, []);

  // Motoru tembel yükle; veri kümesi değişince yeni bellek içi veritabanı kur
  useEffect(() => {
    let cancelled = false;
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    loadSqlEngine()
      .then((SQL) => {
        if (cancelled) return;
        dbRef.current?.close();
        const db = new SQL.Database();
        db.run(DATASETS[dataset].script);
        dbRef.current = db;
        runnerRef.current = makeRunner(db);
        setSchema(describeSchema(runnerRef.current));
        setStatus('ready');
        execute(sqlRef.current);
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [dataset, execute]);

  useEffect(
    () => () => {
      dbRef.current?.close();
      dbRef.current = null;
      runnerRef.current = null;
    },
    [],
  );

  const onRun = () => {
    onInteract();
    execute(sql);
  };

  const changeDataset = (id: SqlDatasetId) => {
    onInteract();
    const ds = DATASETS[id];
    setSql(ds.starter);
    sqlRef.current = ds.starter;
    setTaskId(ds.tasks[0]!.id);
    setVerdict(null);
    setShowHint(false);
    setSolved(new Set());
    setDataset(id);
  };

  const ds = DATASETS[dataset];
  const task = ds.tasks.find((t) => t.id === taskId) ?? ds.tasks[0]!;

  const checkTask = () => {
    onInteract();
    const run = runnerRef.current;
    if (!run) return;
    const g = guardSelect(sql);
    if (!g.ok) {
      setVerdict({ ok: false, reason: 'error', message: guardMessage(l, g) });
      return;
    }
    try {
      const actual = run(g.sql);
      const expected = run(task.reference);
      const v = compareResults(expected, actual, task.ordered);
      setVerdict(v);
      if (v.ok) setSolved((s) => new Set(s).add(task.id));
      execute(sql);
    } catch (e) {
      setVerdict({ ok: false, reason: 'error', message: `${l.sqlError}: ${(e as Error).message}` });
    }
  };

  const steps = outcome.kind === 'ok' ? outcome.steps : null;
  const step = steps?.[Math.min(stepIndex, steps.length - 1)];
  const go = (d: number) => {
    if (!steps) return;
    onInteract();
    setStepIndex((i) => Math.max(0, Math.min(steps.length - 1, i + d)));
  };
  const onStepsKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    }
  };
  const fade = reduced
    ? { initial: false as const, animate: { opacity: 1 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0 },
        transition: { duration: 0.2 },
      };

  return (
    <SimShell
      title={l.title}
      toolbar={
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={onRun}
          disabled={status !== 'ready'}
        >
          <Play size={14} /> {l.run}
        </button>
      }
      aside={
        <>
          <Select
            label={l.dataset}
            value={dataset}
            options={SQL_DATASETS.map((id) => ({ id, label: DATASETS[id].label[locale] }))}
            onChange={changeDataset}
          />
          <div>
            <p className="label flex items-center gap-1.5">
              <DbIcon size={13} /> {l.schema}
            </p>
            <ul className="space-y-1.5 text-xs">
              {schema.map((t) => (
                <li key={t.name}>
                  <button
                    type="button"
                    className="font-mono font-semibold text-primary hover:underline"
                    title={l.insertQuery(t.name)}
                    onClick={() => {
                      onInteract();
                      const q = `SELECT * FROM ${t.name} LIMIT 10;`;
                      setSql(q);
                      execute(q);
                    }}
                  >
                    {t.name}
                  </button>{' '}
                  <span className="text-muted">({t.rows})</span>
                  <p className="font-mono text-muted">{t.columns.join(', ')}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="label mb-0">{l.tasks}</p>
              <span className="text-xs text-muted">
                {l.solvedLabel}: {l.solved(solved.size, ds.tasks.length)}
              </span>
            </div>
            <ol className="space-y-1">
              {ds.tasks.map((t, i) => (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-pressed={t.id === task.id}
                    onClick={() => {
                      setTaskId(t.id);
                      setVerdict(null);
                      setShowHint(false);
                    }}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                      t.id === task.id ? 'bg-primary/15 text-fg' : 'text-muted hover:bg-elevated',
                    )}
                  >
                    <span className="mt-px shrink-0 tabular-nums">
                      {solved.has(t.id) ? (
                        <Check size={12} className="text-success" />
                      ) : (
                        `${i + 1}.`
                      )}
                    </span>
                    <span>{t.prompt[locale]}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-soft btn-sm"
                onClick={checkTask}
                disabled={status !== 'ready'}
              >
                <Check size={14} /> {l.check}
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setShowHint((h) => !h)}
                aria-expanded={showHint}
              >
                <Lightbulb size={14} /> {l.hint}
              </button>
            </div>
            {showHint && <p className="mt-2 text-xs text-muted">{task.hint[locale]}</p>}
            {verdict && (
              <p
                role="status"
                className={cn(
                  'mt-2 flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-xs',
                  verdict.ok ? 'bg-success/15 text-success-fg' : 'bg-danger/10 text-danger-fg',
                )}
              >
                {verdict.ok ? <Check size={14} /> : <X size={14} className="shrink-0" />}
                <span>
                  {verdict.ok
                    ? l.verdict.ok
                    : verdict.reason === 'error'
                      ? verdict.message
                      : verdict.reason === 'columns'
                        ? l.verdict.columns(verdict.expectedColumns, verdict.actualColumns)
                        : verdict.reason === 'rows'
                          ? l.verdict.rows(verdict.expectedRows, verdict.actualRows)
                          : l.verdict[verdict.reason]}
                </span>
              </p>
            )}
          </div>
        </>
      }
    >
      <label className="block">
        <span className="label">{l.editor}</span>
        <textarea
          className="input min-h-[150px] font-mono text-sm leading-6"
          value={sql}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              onRun();
            }
          }}
        />
      </label>
      <p className="mt-1 text-xs text-muted">{l.runHint}</p>

      {status === 'loading' && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted" role="status">
          <Loader2 size={14} className={reduced ? undefined : 'animate-spin'} /> {l.loading}
        </p>
      )}
      {status === 'error' && (
        <p className="mt-3 flex items-center gap-2 text-sm text-danger-fg" role="alert">
          <AlertTriangle size={14} /> {l.loadError}
        </p>
      )}

      {status === 'ready' && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2" role="group">
            {(['steps', 'result'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn('btn-sm', view === v ? 'btn-primary' : 'btn-ghost')}
              >
                {v === 'steps' ? l.tabSteps : l.tabResult}
              </button>
            ))}
            {outcome.kind === 'ok' && (
              <span className="ml-auto text-xs text-muted">
                {l.rows(outcome.result.rows.length)}
              </span>
            )}
          </div>

          {outcome.kind === 'idle' && <p className="text-sm text-muted">{l.noResult}</p>}
          {outcome.kind === 'error' && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger-fg"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {outcome.message}
            </p>
          )}

          {outcome.kind === 'ok' && view === 'result' && (
            <>
              <DataTable
                label={l.tabResult}
                l={l}
                columns={outcome.result.columns}
                rows={outcome.result.rows.map((cells) => ({ cells, state: 'kept' }))}
              />
              {outcome.result.truncated && <p className="mt-1 text-xs text-muted">{l.truncated}</p>}
            </>
          )}

          {outcome.kind === 'ok' && view === 'steps' && !steps && (
            <p className="rounded-xl border border-border bg-bg/60 p-3 text-sm text-muted">
              {l.noSteps}
            </p>
          )}

          {outcome.kind === 'ok' && view === 'steps' && steps && step && (
            <div
              tabIndex={0}
              onKeyDown={onStepsKey}
              aria-label={l.stepsKeys}
              className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className="btn-icon btn-icon-sm"
                  onClick={() => go(-1)}
                  disabled={stepIndex === 0}
                  aria-label={l.prev}
                >
                  <ChevronLeft size={14} />
                </button>
                <ol className="flex flex-wrap gap-1.5">
                  {steps.map((s, i) => (
                    <li key={`${s.kind}-${i}`}>
                      <button
                        type="button"
                        aria-current={i === stepIndex ? 'step' : undefined}
                        onClick={() => {
                          onInteract();
                          setStepIndex(i);
                        }}
                        className={cn(
                          'chip font-mono',
                          i === stepIndex
                            ? 'chip-primary'
                            : i < stepIndex
                              ? 'opacity-80'
                              : 'opacity-60',
                        )}
                      >
                        {l.kind[s.kind]}
                      </button>
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  className="btn-icon btn-icon-sm"
                  onClick={() => go(1)}
                  disabled={stepIndex >= steps.length - 1}
                  aria-label={l.next}
                >
                  <ChevronRight size={14} />
                </button>
                <span className="ml-auto text-xs text-muted">
                  {l.stepOf(stepIndex + 1, steps.length)}
                </span>
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={stepIndex} {...fade} className="space-y-2">
                  <pre className="overflow-x-auto rounded-lg bg-surface px-3 py-2 font-mono text-xs text-primary">
                    {step.clause}
                  </pre>
                  <p className="text-sm" aria-live="polite">
                    {l.explain(step)}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
                    <Stat
                      label={l.resultRows}
                      value={`${step.stats.input} → ${step.stats.output}`}
                    />
                    {step.stats.groups !== undefined && (
                      <Stat label={l.kind.group} value={step.stats.groups} tone="primary" />
                    )}
                  </div>
                  <Legend step={step} l={l} />
                  <DataTable
                    label={`${l.kind[step.kind]} — ${l.tabSteps}`}
                    l={l}
                    columns={step.columns}
                    rows={step.rows}
                    highlight={step.highlight}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </SimShell>
  );
}
