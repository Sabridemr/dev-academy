'use client';

import { useEffect, useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { seededRandom } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { Select, SimShell, Stat } from './ui';
import { numParam, strParam, type SimulatorProps } from './types';

const SAMPLE_ROWS = 1000;
const STATUSES = ['paid', 'pending', 'shipped', 'cancelled'] as const;
type Status = (typeof STATUSES)[number];

interface Row {
  id: number;
  customer_id: number;
  status: Status;
  created_at: number; // yılın günü
  total_amount: number;
}

type QueryId = 'eq' | 'range' | 'composite' | 'second-col';
type IndexId = 'none' | 'btree-customer' | 'btree-created' | 'composite' | 'composite-status';
type Projection = 'star' | 'covered';
type PlanKind = 'Seq Scan' | 'Index Scan' | 'Index Only Scan' | 'Bitmap Heap Scan';

const QUERIES: Record<
  QueryId,
  {
    sql: (p: Projection) => string;
    match: (r: Row) => boolean;
    cols: string[];
    eqCols: string[];
    rangeCol?: string;
  }
> = {
  eq: {
    sql: (p) =>
      `SELECT ${p === 'star' ? '*' : 'customer_id, status'} FROM orders WHERE customer_id = 42`,
    match: (r) => r.customer_id === 42,
    cols: ['customer_id'],
    eqCols: ['customer_id'],
  },
  range: {
    sql: (p) =>
      `SELECT ${p === 'star' ? '*' : 'created_at'} FROM orders WHERE created_at BETWEEN 100 AND 130`,
    match: (r) => r.created_at >= 100 && r.created_at <= 130,
    cols: ['created_at'],
    eqCols: [],
    rangeCol: 'created_at',
  },
  composite: {
    sql: (p) =>
      `SELECT ${p === 'star' ? '*' : 'customer_id, status'} FROM orders WHERE customer_id = 42 AND status = 'paid'`,
    match: (r) => r.customer_id === 42 && r.status === 'paid',
    cols: ['customer_id', 'status'],
    eqCols: ['customer_id', 'status'],
  },
  'second-col': {
    sql: (p) =>
      `SELECT ${p === 'star' ? '*' : 'customer_id, status'} FROM orders WHERE status = 'paid'`,
    match: (r) => r.status === 'paid',
    cols: ['status'],
    eqCols: ['status'],
  },
};

const INDEXES: Record<IndexId, string[]> = {
  none: [],
  'btree-customer': ['customer_id'],
  'btree-created': ['created_at'],
  composite: ['customer_id', 'status'],
  'composite-status': ['status', 'customer_id'],
};

/** Bir satırın, sorgudaki sabitlerle verilen kolon koşulunu sağlayıp sağlamadığı */
const colMatch = (r: Row, c: string) =>
  c === 'customer_id'
    ? r.customer_id === 42
    : c === 'status'
      ? r.status === 'paid'
      : r.created_at >= 100 && r.created_at <= 130;

const L = {
  tr: {
    title: 'İndeks ve sorgu planı (EXPLAIN)',
    query: 'Sorgu',
    index: 'İndeks',
    projection: 'Seçilen kolonlar',
    star: 'SELECT * (tüm kolonlar)',
    covered: 'Yalnızca indeksli kolonlar',
    queries: {
      eq: 'Eşitlik: customer_id = 42',
      range: 'Aralık: created_at 100–130',
      composite: 'Bileşik: customer_id + status',
      'second-col': 'İkinci kolon: status = paid',
    } satisfies Record<QueryId, string>,
    indexes: {
      none: 'İndeks yok',
      'btree-customer': 'B-tree (customer_id)',
      'btree-created': 'B-tree (created_at)',
      composite: 'Bileşik (customer_id, status)',
      'composite-status': 'Bileşik (status, customer_id)',
    } satisfies Record<IndexId, string>,
    plan: 'Plan',
    examined: 'İncelenen satır',
    returned: 'Dönen satır',
    cost: 'Tahmini maliyet',
    seqCost: 'Seq Scan maliyeti',
    idxCost: 'İndeks maliyeti',
    descent: 'B-tree inişi',
    run: 'EXPLAIN ANALYZE',
    scaled: (n: string) => `Tablo ${n} satıra ölçeklenmiş tahmin`,
    reasons: {
      noIndex: 'Uygun indeks yok → tüm tablo sırayla taranır.',
      prefix:
        'Bileşik indeks yalnızca en soldaki kolon(lar) ile kullanılabilir (leftmost prefix). Sorgu indeksin ilk kolonunu filtrelemediği için indeks işe yaramaz.',
      seqCheaper:
        'İndeks var ama sorgu tablonun büyük kısmını döndürüyor; rastgele heap erişimi pahalı olduğundan planlayıcı Seq Scan seçti.',
      indexOnly: 'Gereken tüm kolonlar indekste → heap’e hiç gidilmez (Index Only Scan).',
      index:
        'İndeks ağacında inilir, eşleşen yapraklar taranır, her satır için heap’ten veri okunur.',
      filter:
        'İndeks yalnızca customer_id’yi daraltır; status koşulu heap satırlarında filtre olarak uygulanır.',
    },
  },
  en: {
    title: 'Index and query plan (EXPLAIN)',
    query: 'Query',
    index: 'Index',
    projection: 'Selected columns',
    star: 'SELECT * (all columns)',
    covered: 'Only indexed columns',
    queries: {
      eq: 'Equality: customer_id = 42',
      range: 'Range: created_at 100–130',
      composite: 'Composite: customer_id + status',
      'second-col': 'Second column: status = paid',
    } satisfies Record<QueryId, string>,
    indexes: {
      none: 'No index',
      'btree-customer': 'B-tree (customer_id)',
      'btree-created': 'B-tree (created_at)',
      composite: 'Composite (customer_id, status)',
      'composite-status': 'Composite (status, customer_id)',
    } satisfies Record<IndexId, string>,
    plan: 'Plan',
    examined: 'Rows examined',
    returned: 'Rows returned',
    cost: 'Estimated cost',
    seqCost: 'Seq Scan cost',
    idxCost: 'Index cost',
    descent: 'B-tree descent',
    run: 'EXPLAIN ANALYZE',
    scaled: (n: string) => `Estimate scaled to a ${n}-row table`,
    reasons: {
      noIndex: 'No usable index → the whole table is scanned sequentially.',
      prefix:
        'A composite index is usable only via its leftmost column(s) (leftmost prefix). The query does not filter on the index’s first column, so the index is useless here.',
      seqCheaper:
        'An index exists but the query returns a large share of the table; random heap access is expensive, so the planner chose a Seq Scan.',
      indexOnly:
        'All needed columns are in the index → the heap is never touched (Index Only Scan).',
      index: 'Descend the index tree, scan matching leaves, fetch each row from the heap.',
      filter:
        'The index narrows only customer_id; the status condition is applied as a filter on heap rows.',
    },
  },
};

function makeRows(): Row[] {
  const rnd = seededRandom(2024);
  return Array.from({ length: SAMPLE_ROWS }, (_, i) => ({
    id: i + 1,
    customer_id: 1 + Math.floor(rnd() * 120),
    status: STATUSES[Math.floor(Math.pow(rnd(), 0.7) * 4)] ?? 'paid',
    created_at: 1 + Math.floor(rnd() * 365),
    total_amount: Math.round(rnd() * 50000) / 100,
  }));
}

export default function IndexQueryPlanSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const rows = useMemo(makeRows, []);
  const tableRows = numParam(params, 'rows', SAMPLE_ROWS, 100, 1e10);
  const queryParam = strParam<string>(params, 'query', '');
  const [query, setQuery] = useState<QueryId>(() =>
    queryParam.includes('status') && queryParam.includes('customer_id')
      ? 'composite'
      : queryParam.includes('created_at')
        ? 'range'
        : 'eq',
  );
  const [index, setIndex] = useState<IndexId>('none');
  const [projection, setProjection] = useState<Projection>('star');
  const [level, setLevel] = useState(3);

  const q = QUERIES[query];
  const idxCols = INDEXES[index];
  const matched = useMemo(() => rows.filter(q.match), [rows, q]);

  // ---------- Planlayıcı (basitleştirilmiş PostgreSQL maliyet modeli) ----------
  const plan = useMemo(() => {
    const pages = SAMPLE_ROWS / 10; // ~10 satır/sayfa (geniş satırlar)
    const seqCost = pages * 1 + SAMPLE_ROWS * 0.01;
    const leading = idxCols[0];
    const usable = !!leading && (q.eqCols.includes(leading) || q.rangeCol === leading);
    const none: string[] = [];
    if (!usable) {
      // Sorgu indeksin ilk kolonunu değil de sonraki bir kolonunu filtreliyorsa: en-soldaki önek kuralı
      const touchesNonLeading = idxCols.length > 1 && q.cols.some((c) => idxCols.includes(c));
      const reason = touchesNonLeading ? l.reasons.prefix : l.reasons.noIndex;
      return {
        kind: 'Seq Scan' as PlanKind,
        examined: SAMPLE_ROWS,
        cost: seqCost,
        seqCost,
        idxCost: null as number | null,
        reason,
        narrowed: none,
      };
    }
    // İndeksin daraltabildiği kolonlar: soldan ardışık eşitlik kolonları (+ aralık)
    const narrowed: string[] = [];
    for (const c of idxCols) {
      if (q.eqCols.includes(c) || q.rangeCol === c) narrowed.push(c);
      else break;
    }
    const indexMatches = rows.filter((r) => narrowed.every((c) => colMatch(r, c))).length;
    const covered = projection === 'covered' && q.cols.every((c) => idxCols.includes(c));
    const descend = 3 * 4;
    const idxCost =
      descend + indexMatches * 0.005 + (covered ? indexMatches * 0.01 : indexMatches * 4 * 0.25);
    if (!covered && idxCost > seqCost) {
      return {
        kind: 'Seq Scan' as PlanKind,
        examined: SAMPLE_ROWS,
        cost: seqCost,
        seqCost,
        idxCost,
        reason: l.reasons.seqCheaper,
        narrowed: none,
      };
    }
    const filtered = narrowed.length < q.eqCols.length + (q.rangeCol ? 1 : 0);
    return {
      kind: (covered ? 'Index Only Scan' : 'Index Scan') as PlanKind,
      examined: indexMatches,
      cost: idxCost,
      seqCost,
      idxCost,
      reason: covered ? l.reasons.indexOnly : filtered ? l.reasons.filter : l.reasons.index,
      narrowed,
    };
  }, [idxCols, q, rows, projection, l]);

  // B-tree seviyeleri: indekslenen kolonun sıralı değerlerinden anahtarlar (status sırasız kategori → ağaç çizilmez)
  const tree = useMemo(() => {
    const col = idxCols[0];
    if (!col || col === 'status') return null;
    const vals = rows
      .map((r) => (col === 'customer_id' ? r.customer_id : col === 'created_at' ? r.created_at : 0))
      .sort((a, b) => a - b);
    const target = col === 'customer_id' ? 42 : 100;
    const q4 = (from: number, to: number) =>
      [1, 2, 3].map((k) => vals[Math.floor(from + ((to - from) * k) / 4)]);
    const root = q4(0, vals.length - 1);
    const ri = root.findIndex((k) => target < k);
    const rIdx = ri < 0 ? 3 : ri;
    const span = vals.length / 4;
    const internal = q4(rIdx * span, (rIdx + 1) * span - 1);
    const ii = internal.findIndex((k) => target < k);
    const iIdx = ii < 0 ? 3 : ii;
    const leafFrom = rIdx * span + (iIdx * span) / 4;
    const leaf = vals.slice(Math.floor(leafFrom), Math.floor(leafFrom) + 6);
    return { col, target, root, rIdx, internal, iIdx, leaf };
  }, [idxCols, rows]);

  const run = () => {
    onInteract();
    if (reduced) {
      setLevel(3);
      return;
    }
    setLevel(0);
  };
  useEffect(() => {
    if (level >= 3) return;
    const id = setTimeout(() => setLevel((v) => v + 1), 550);
    return () => clearTimeout(id);
  }, [level]);

  const scale = tableRows / SAMPLE_ROWS;
  const fmt = (n: number) => Math.round(n).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US');
  const planTone =
    plan.kind === 'Seq Scan' ? 'danger' : plan.kind === 'Index Only Scan' ? 'success' : 'primary';

  const nodeBox = (
    x: number,
    y: number,
    keys: (number | string)[],
    activeLevel: boolean,
    hi: number,
  ) => (
    <g>
      <rect
        x={x}
        y={y}
        width={keys.length * 40 + 8}
        height={30}
        rx={6}
        fill={
          activeLevel
            ? 'color-mix(in srgb, var(--da-accent) 18%, var(--da-surface))'
            : 'var(--da-surface)'
        }
        stroke={activeLevel ? 'var(--da-accent)' : 'var(--da-border)'}
        strokeWidth={activeLevel ? 2 : 1}
      />
      {keys.map((k, i) => (
        <text
          key={i}
          x={x + 24 + i * 40}
          y={y + 20}
          textAnchor="middle"
          fontSize={11}
          fontWeight={i === hi && activeLevel ? 700 : 400}
          fill={i === hi && activeLevel ? 'var(--da-accent)' : 'var(--da-fg)'}
        >
          {k}
        </text>
      ))}
    </g>
  );

  return (
    <SimShell
      title={l.title}
      toolbar={
        <button type="button" className="btn-primary" onClick={run}>
          <Play size={14} /> {l.run}
        </button>
      }
      aside={
        <>
          <Select
            label={l.query}
            value={query}
            options={(Object.keys(QUERIES) as QueryId[]).map((k) => ({
              id: k,
              label: l.queries[k],
            }))}
            onChange={(v) => {
              onInteract();
              setQuery(v);
            }}
          />
          <Select
            label={l.index}
            value={index}
            options={(Object.keys(INDEXES) as IndexId[]).map((k) => ({
              id: k,
              label: l.indexes[k],
            }))}
            onChange={(v) => {
              onInteract();
              setIndex(v);
              run();
            }}
          />
          <Select
            label={l.projection}
            value={projection}
            options={[
              { id: 'star', label: l.star },
              { id: 'covered', label: l.covered },
            ]}
            onChange={(v) => {
              onInteract();
              setProjection(v);
            }}
          />
          <div className="grid grid-cols-2 gap-2" aria-live="polite">
            <Stat
              label={l.examined}
              value={fmt(plan.examined * scale)}
              tone={plan.examined > 300 ? 'danger' : 'success'}
            />
            <Stat label={l.returned} value={fmt(matched.length * scale)} />
            <Stat label={l.seqCost} value={fmt(plan.seqCost * scale)} />
            <Stat
              label={l.idxCost}
              value={plan.idxCost === null ? '—' : fmt(plan.idxCost * scale)}
            />
          </div>
          {scale !== 1 && <p className="text-xs text-muted">{l.scaled(fmt(tableRows))}</p>}
        </>
      }
    >
      <pre className="overflow-x-auto rounded-xl border border-border bg-bg/60 p-3 font-mono text-xs">
        {q.sql(projection)};
      </pre>
      <div className="mt-3 rounded-xl border border-border p-3" aria-live="polite">
        <p className="label">{l.plan}</p>
        <p
          className={`font-mono text-sm font-semibold ${planTone === 'danger' ? 'text-danger' : planTone === 'success' ? 'text-success' : 'text-primary'}`}
        >
          → {plan.kind}
          {plan.kind !== 'Seq Scan' && ` using idx_orders_${idxCols.join('_')}`} on orders
          (cost=0.00..{fmt(plan.cost * scale)} rows={fmt(matched.length * scale)})
        </p>
        <p className="mt-1 text-sm text-muted">{plan.reason}</p>
      </div>

      {/* Taranan satırların görselleştirmesi: 1000 satır = 40×25 ızgara */}
      <svg
        viewBox="0 0 600 100"
        className="mt-3 h-auto w-full"
        role="img"
        aria-label={`${l.examined}: ${plan.examined}`}
      >
        {rows.map((r, i) => {
          const isMatch = q.match(r);
          const examined = plan.kind === 'Seq Scan' || plan.narrowed.every((c) => colMatch(r, c));
          return (
            <rect
              key={r.id}
              x={(i % 100) * 6}
              y={Math.floor(i / 100) * 10}
              width={5}
              height={9}
              fill={
                isMatch
                  ? 'var(--da-success)'
                  : examined
                    ? 'color-mix(in srgb, var(--da-danger) 55%, var(--da-surface))'
                    : 'var(--da-elevated)'
              }
            />
          );
        })}
      </svg>
      <p className="text-xs text-muted">
        <span className="text-success">■</span> {l.returned} ·{' '}
        <span className="text-danger">■</span> {l.examined} · 1 ■ = 1{' '}
        {locale === 'tr' ? 'satır' : 'row'}
      </p>

      {tree && plan.kind !== 'Seq Scan' && (
        <figure className="mt-3">
          <figcaption className="label">
            {l.descent} ({tree.col} = {tree.target}
            {tree.col === 'created_at' ? '…130' : ''})
          </figcaption>
          <svg viewBox="0 0 600 170" className="h-auto w-full" role="img" aria-label={l.descent}>
            {nodeBox(236, 6, tree.root, level >= 0, tree.rIdx)}
            {[0, 1, 2, 3].map((i) => (
              <line
                key={i}
                x1={240 + i * 40}
                y1={36}
                x2={i === tree.rIdx ? 236 : 60 + i * 140}
                y2={66}
                stroke={i === tree.rIdx && level >= 1 ? 'var(--da-accent)' : 'var(--da-border)'}
                strokeWidth={i === tree.rIdx && level >= 1 ? 2 : 1}
              />
            ))}
            {nodeBox(236, 66, tree.internal, level >= 1, tree.iIdx)}
            {[0, 1, 2, 3].map((i) => (
              <line
                key={`b${i}`}
                x1={240 + i * 40}
                y1={96}
                x2={i === tree.iIdx ? 186 : 40 + i * 150}
                y2={126}
                stroke={i === tree.iIdx && level >= 2 ? 'var(--da-accent)' : 'var(--da-border)'}
                strokeWidth={i === tree.iIdx && level >= 2 ? 2 : 1}
              />
            ))}
            {nodeBox(
              186,
              126,
              tree.leaf,
              level >= 2,
              tree.leaf.findIndex((v) => v >= tree.target),
            )}
            <text x={186 + tree.leaf.length * 40 + 20} y={146} fontSize={10} fill="var(--da-muted)">
              {level >= 3
                ? plan.kind === 'Index Only Scan'
                  ? '✓ index only'
                  : '→ heap fetch'
                : ''}
            </text>
            <text x={10} y={24} fontSize={10} fill="var(--da-muted)">
              root
            </text>
            <text x={10} y={84} fontSize={10} fill="var(--da-muted)">
              internal
            </text>
            <text x={10} y={144} fontSize={10} fill="var(--da-muted)">
              leaf ↔
            </text>
          </svg>
        </figure>
      )}
    </SimShell>
  );
}
