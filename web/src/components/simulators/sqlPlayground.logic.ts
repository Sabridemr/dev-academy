/**
 * SQL oyun alanının saf mantığı:
 *  - yalnızca-SELECT koruması (DDL/DML reddedilir),
 *  - basit SELECT sorguları için küçük bir cümlecik ayrıştırıcısı,
 *  - ayrıştırılan sorgunun mantıksal değerlendirme adımları (FROM → JOIN → WHERE → GROUP BY → HAVING →
 *    SELECT → ORDER BY → LIMIT). İfadeleri kendimiz değerlendirmiyoruz: her adım için SQLite'a (sql.js)
 *    yardımcı bir sorgu gönderip ara sonucu alıyoruz; ayrıştırıcı yalnızca cümlecikleri ayırır.
 *  - görev kontrolü: referans sorgu ile kullanıcı sorgusunun satır kümesi eşitliği.
 *
 * Motor bağımlılığı yalnızca `Runner` arayüzüdür; testlerde Node'da gerçek sql.js ile çalışır.
 */
import type { Database } from 'sql.js';

export type Cell = string | number | null;
export interface QueryResult {
  columns: string[];
  rows: Cell[][];
  /** Satır sınırına takılıp kesildi mi */
  truncated?: boolean;
}
export type Runner = (sql: string) => QueryResult;

/** Bir sorgudan en fazla bu kadar satır okunur (yanlışlıkla yazılan kartezyen çarpımlara karşı) */
export const MAX_ROWS = 2000;

/** sql.js veritabanını Runner'a çevirir; sütun adları sonuç boş olsa da döner */
export function makeRunner(db: Database, maxRows = MAX_ROWS): Runner {
  return (sql) => {
    const stmt = db.prepare(sql);
    try {
      const columns = stmt.getColumnNames();
      const rows: Cell[][] = [];
      let truncated = false;
      while (stmt.step()) {
        if (rows.length >= maxRows) {
          truncated = true;
          break;
        }
        rows.push(
          stmt.get().map((v) => (v instanceof Uint8Array ? `<blob ${v.length} B>` : (v as Cell))),
        );
      }
      return { columns, rows, truncated };
    } finally {
      stmt.free();
    }
  };
}

/* ------------------------------------------------------------------ */
/* Sözcük çözümleyici                                                  */
/* ------------------------------------------------------------------ */

export interface Token {
  kind: 'word' | 'string' | 'ident' | 'number' | 'punct';
  /** Büyük harfe çevrilmiş anahtar sözcük karşılaştırması için (word) */
  upper: string;
  start: number;
  end: number;
  /** Parantez derinliği (token'ın kendisi açılış parantezi ise dışarıdaki derinlik) */
  depth: number;
}

/** Yorumları atlayan, dizgeleri ve tırnaklı tanımlayıcıları tek parça sayan basit SQL tokenizer'ı */
export function tokenize(sql: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let depth = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < n && sql[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && sql[i + 1] === '*') {
      const close = sql.indexOf('*/', i + 2);
      i = close === -1 ? n : close + 2;
      continue;
    }
    const start = i;
    if (ch === "'" || ch === '"' || ch === '`' || ch === '[') {
      const closeCh = ch === '[' ? ']' : ch;
      i++;
      while (i < n) {
        if (sql[i] === closeCh) {
          if (closeCh !== ']' && sql[i + 1] === closeCh) {
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      out.push({
        kind: ch === "'" ? 'string' : 'ident',
        upper: '',
        start,
        end: i,
        depth,
      });
      continue;
    }
    if (/[A-Za-z_À-￿]/.test(ch)) {
      while (i < n && /[A-Za-z0-9_$À-￿]/.test(sql[i]!)) i++;
      out.push({ kind: 'word', upper: sql.slice(start, i).toUpperCase(), start, end: i, depth });
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(sql[i + 1] ?? ''))) {
      while (i < n && /[0-9.eE]/.test(sql[i]!)) i++;
      out.push({ kind: 'number', upper: sql.slice(start, i), start, end: i, depth });
      continue;
    }
    if (ch === '(') {
      out.push({ kind: 'punct', upper: '(', start, end: i + 1, depth });
      depth++;
      i++;
      continue;
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      out.push({ kind: 'punct', upper: ')', start, end: i + 1, depth });
      i++;
      continue;
    }
    // Çok karakterli operatörler tek token olsun (<=, <>, ||, ...)
    const two = sql.slice(i, i + 2);
    const len = ['<=', '>=', '<>', '!=', '==', '||'].includes(two) ? 2 : 1;
    out.push({ kind: 'punct', upper: sql.slice(i, i + len), start, end: i + len, depth });
    i += len;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Yalnızca SELECT koruması                                             */
/* ------------------------------------------------------------------ */

const FORBIDDEN = new Set([
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'CREATE',
  'ALTER',
  'REPLACE',
  'ATTACH',
  'DETACH',
  'PRAGMA',
  'VACUUM',
  'REINDEX',
  'ANALYZE',
  'BEGIN',
  'COMMIT',
  'ROLLBACK',
  'SAVEPOINT',
  'RELEASE',
  'TRUNCATE',
  'GRANT',
]);

export type GuardResult =
  | { ok: true; sql: string }
  | { ok: false; reason: 'empty' | 'multiple' | 'not-select' | 'forbidden'; keyword?: string };

/**
 * Sorgunun tek bir okuma sorgusu (SELECT ya da WITH ... SELECT) olduğunu doğrular.
 * Veritabanı bellek içi olsa da tutarlılık için DDL/DML reddedilir; `replace(...)` dizge işlevi serbesttir.
 */
export function guardSelect(input: string): GuardResult {
  const tokens = tokenize(input);
  if (tokens.length === 0) return { ok: false, reason: 'empty' };
  // Sondaki ; serbest; ortadaki ; ikinci bir ifade demektir
  let last = tokens.length - 1;
  while (last >= 0 && tokens[last]!.upper === ';') last--;
  if (last < 0) return { ok: false, reason: 'empty' };
  if (tokens.slice(0, last + 1).some((t) => t.upper === ';'))
    return { ok: false, reason: 'multiple' };
  const first = tokens[0]!;
  if (first.kind !== 'word' || (first.upper !== 'SELECT' && first.upper !== 'WITH')) {
    const kw = first.kind === 'word' ? first.upper : undefined;
    return { ok: false, reason: kw && FORBIDDEN.has(kw) ? 'forbidden' : 'not-select', keyword: kw };
  }
  for (let k = 0; k <= last; k++) {
    const t = tokens[k]!;
    if (t.kind !== 'word' || !FORBIDDEN.has(t.upper)) continue;
    if (t.upper === 'REPLACE' && tokens[k + 1]?.upper === '(') continue;
    // "ORDER BY ... DESC" gibi yerlerde geçmez; sütun adı olarak kullanılmışsa önceki token '.' olur
    if (tokens[k - 1]?.upper === '.') continue;
    return { ok: false, reason: 'forbidden', keyword: t.upper };
  }
  return { ok: true, sql: input.slice(0, tokens[last]!.end) };
}

/* ------------------------------------------------------------------ */
/* Basit SELECT ayrıştırıcısı                                           */
/* ------------------------------------------------------------------ */

export interface TableRef {
  /** Yazıldığı gibi tablo adı */
  table: string;
  /** Takma ad; yoksa tablo adı */
  alias: string;
}
export interface JoinClause extends TableRef {
  type: 'inner' | 'left';
  on: string;
}
export interface ParsedSelect {
  /** SELECT ile FROM arasındaki metin (DISTINCT dahil) */
  select: string;
  from: TableRef;
  joins: JoinClause[];
  /** FROM'dan sonraki tüm kaynak metni (JOIN'ler dahil) — yardımcı sorgular için */
  fromText: string;
  where?: string;
  groupBy?: string[];
  having?: string;
  orderBy?: string;
  limit?: { count: number; offset: number };
}

const CLAUSE_ORDER = ['FROM', 'WHERE', 'GROUP', 'HAVING', 'ORDER', 'LIMIT'] as const;
type ClauseKw = (typeof CLAUSE_ORDER)[number];
const RESERVED = new Set([
  'ON',
  'JOIN',
  'INNER',
  'LEFT',
  'RIGHT',
  'FULL',
  'OUTER',
  'CROSS',
  'NATURAL',
  'USING',
  'WHERE',
  'GROUP',
  'HAVING',
  'ORDER',
  'LIMIT',
  'AS',
]);

/** En üst düzeydeki virgüllerden böler (fonksiyon argümanlarındaki virgüller hariç) */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let last = 0;
  for (const t of tokenize(text)) {
    if (t.depth === 0 && t.upper === ',') {
      parts.push(text.slice(last, t.start).trim());
      last = t.end;
    }
  }
  parts.push(text.slice(last).trim());
  return parts.filter(Boolean);
}

function parseFrom(sql: string, tokens: Token[]): { from: TableRef; joins: JoinClause[] } | null {
  let k = 0;
  const readTable = (): TableRef | null => {
    const t = tokens[k];
    if (!t || (t.kind !== 'word' && t.kind !== 'ident') || RESERVED.has(t.upper)) return null;
    const table = sql.slice(t.start, t.end);
    k++;
    // schema.table biçimi desteklenmez (tek veritabanı)
    if (tokens[k]?.upper === '.') return null;
    let alias = table;
    if (tokens[k]?.upper === 'AS') k++;
    const a = tokens[k];
    if (a && (a.kind === 'word' || a.kind === 'ident') && !RESERVED.has(a.upper)) {
      alias = sql.slice(a.start, a.end);
      k++;
    }
    return { table, alias };
  };
  const from = readTable();
  if (!from) return null;
  const joins: JoinClause[] = [];
  while (k < tokens.length) {
    let type: 'inner' | 'left' = 'inner';
    const t = tokens[k]!;
    if (t.upper === 'INNER') k++;
    else if (t.upper === 'LEFT') {
      type = 'left';
      k++;
      if (tokens[k]?.upper === 'OUTER') k++;
    } else if (t.upper !== 'JOIN') return null; // virgüllü FROM, RIGHT/FULL/CROSS/NATURAL, alt sorgu...
    if (tokens[k]?.upper !== 'JOIN') return null;
    k++;
    const ref = readTable();
    if (!ref || tokens[k]?.upper !== 'ON') return null;
    k++;
    const onStart = tokens[k]?.start;
    if (onStart === undefined) return null;
    while (
      k < tokens.length &&
      !(
        tokens[k]!.depth === 0 &&
        ['JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'NATURAL', ','].includes(
          tokens[k]!.upper,
        )
      )
    )
      k++;
    const onEnd = k < tokens.length ? tokens[k]!.start : sql.length;
    joins.push({ ...ref, type, on: sql.slice(onStart, onEnd).trim() });
  }
  return { from, joins };
}

/**
 * Basit bir SELECT'i cümleciklerine ayırır. Alt sorgu, UNION, WITH, virgüllü FROM, RIGHT/FULL/CROSS
 * JOIN, USING gibi yapılar desteklenmez → null (bileşen yalnızca sonucu gösterir).
 */
export function parseSelect(input: string): ParsedSelect | null {
  const guard = guardSelect(input);
  if (!guard.ok) return null;
  const sql = guard.sql;
  const tokens = tokenize(sql);
  if (tokens[0]?.upper !== 'SELECT') return null;
  // İkinci bir SELECT (alt sorgu) ya da küme işlemleri → desteklenmez
  if (
    tokens.some(
      (t, k) =>
        t.kind === 'word' &&
        ((k > 0 && t.upper === 'SELECT') ||
          ['UNION', 'INTERSECT', 'EXCEPT', 'WINDOW'].includes(t.upper)),
    )
  )
    return null;

  // Üst düzey cümlecik başlangıçları
  const marks: { kw: ClauseKw; tokenIndex: number; bodyStart: number }[] = [];
  for (let k = 1; k < tokens.length; k++) {
    const t = tokens[k]!;
    if (t.depth !== 0 || t.kind !== 'word') continue;
    if (t.upper === 'FROM' || t.upper === 'WHERE' || t.upper === 'HAVING' || t.upper === 'LIMIT') {
      marks.push({ kw: t.upper, tokenIndex: k, bodyStart: t.end });
    } else if ((t.upper === 'GROUP' || t.upper === 'ORDER') && tokens[k + 1]?.upper === 'BY') {
      marks.push({ kw: t.upper, tokenIndex: k, bodyStart: tokens[k + 1]!.end });
      k++;
    }
  }
  if (marks[0]?.kw !== 'FROM') return null;
  // Sıra ve tekillik: FROM < WHERE < GROUP < HAVING < ORDER < LIMIT
  for (let m = 1; m < marks.length; m++) {
    if (CLAUSE_ORDER.indexOf(marks[m]!.kw) <= CLAUSE_ORDER.indexOf(marks[m - 1]!.kw)) return null;
  }
  const body = (m: number) => {
    const end = m + 1 < marks.length ? tokens[marks[m + 1]!.tokenIndex]!.start : sql.length;
    return sql.slice(marks[m]!.bodyStart, end).trim();
  };
  const clause = (kw: ClauseKw) => {
    const m = marks.findIndex((x) => x.kw === kw);
    return m === -1 ? undefined : body(m);
  };

  const select = sql.slice(tokens[0]!.end, tokens[marks[0]!.tokenIndex]!.start).trim();
  if (!select) return null;
  const fromText = clause('FROM')!;
  const parsedFrom = parseFrom(fromText, tokenize(fromText));
  if (!parsedFrom) return null;

  let limit: ParsedSelect['limit'];
  const limitText = clause('LIMIT');
  if (limitText !== undefined) {
    const m =
      /^(\d+)\s*$/.exec(limitText) ?? /^(\d+)\s+OFFSET\s+(\d+)\s*$/i.exec(limitText) ?? null;
    const comma = /^(\d+)\s*,\s*(\d+)\s*$/.exec(limitText);
    if (m) limit = { count: Number(m[1]), offset: m[2] ? Number(m[2]) : 0 };
    else if (comma) limit = { count: Number(comma[2]), offset: Number(comma[1]) };
    else return null;
  }
  const where = clause('WHERE');
  const group = clause('GROUP');
  const having = clause('HAVING');
  const orderBy = clause('ORDER');
  if ([where, group, having, orderBy].some((c) => c !== undefined && c.length === 0)) return null;
  if (having !== undefined && group === undefined) return null;

  return {
    select,
    ...parsedFrom,
    fromText,
    where,
    groupBy: group !== undefined ? splitTopLevel(group) : undefined,
    having,
    orderBy,
    limit,
  };
}

/* ------------------------------------------------------------------ */
/* Adım adım değerlendirme                                              */
/* ------------------------------------------------------------------ */

export type StepKind =
  'from' | 'join' | 'where' | 'group' | 'having' | 'select' | 'order' | 'limit';

/**
 * Satır işareti:
 *  matched   — JOIN'de eşleşen satır çifti
 *  padded    — LEFT JOIN'de eşleşmedi, sağ taraf NULL ile dolduruldu (korunur)
 *  dropped   — bu adımda elendi (INNER JOIN eşleşmesi yok, WHERE/HAVING yanlış)
 *  cut       — LIMIT/OFFSET dışında kaldı
 */
export type RowState = 'kept' | 'matched' | 'padded' | 'dropped' | 'cut';

export interface StepRow {
  cells: Cell[];
  state: RowState;
  /** GROUP BY adımında grup numarası (renk); JOIN adımında sol satır bandı */
  group?: number;
}

export interface QueryStep {
  kind: StepKind;
  /** Adıma karşılık gelen cümlecik metni (ör. "JOIN orders o ON o.customer_id = c.id") */
  clause: string;
  columns: string[];
  /** Vurgulanacak sütun indeksleri (ON/WHERE/GROUP BY'da geçen sütunlar) */
  highlight: number[];
  rows: StepRow[];
  /** Adıma özgü sayılar: girdi/çıktı satırı, grup sayısı... */
  stats: { input: number; output: number; groups?: number; matched?: number; unmatched?: number };
}

function sourceText(from: TableRef, joins: JoinClause[]): string {
  const ref = (r: TableRef) => (r.alias === r.table ? r.table : `${r.table} AS ${r.alias}`);
  return [
    ref(from),
    ...joins.map((j) => `${j.type === 'left' ? 'LEFT JOIN' : 'JOIN'} ${ref(j)} ON ${j.on}`),
  ].join(' ');
}

/** Bir ifadede geçen `alias.kolon` ya da yalın kolon adlarını görüntülenen sütunlarla eşleştirir */
function highlightFor(expr: string | undefined, columns: string[]): number[] {
  if (!expr) return [];
  const toks = tokenize(expr);
  const hits = new Set<number>();
  const unq = (s: string) => s.replace(/^["`[]|["`\]]$/g, '');
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]!;
    if (t.kind !== 'word' && t.kind !== 'ident') continue;
    const name = unq(expr.slice(t.start, t.end)).toLowerCase();
    if (toks[k + 1]?.upper === '.' && toks[k + 2]) {
      const col = unq(expr.slice(toks[k + 2]!.start, toks[k + 2]!.end)).toLowerCase();
      const idx = columns.findIndex((c) => c.toLowerCase() === `${name}.${col}`);
      if (idx !== -1) hits.add(idx);
      k += 2;
      continue;
    }
    columns.forEach((c, idx) => {
      if (c.toLowerCase().split('.').pop() === name) hits.add(idx);
    });
  }
  return [...hits].sort((a, b) => a - b);
}

const keyOf = (cells: Cell[]) => JSON.stringify(cells);

/**
 * Ayrıştırılmış sorgunun mantıksal değerlendirme adımlarını üretir. Herhangi bir yardımcı sorgu hata
 * verirse (ör. WHERE'de SELECT takma adı kullanılması) null döner; bileşen "adım görünümü yok" der.
 */
export function buildSteps(run: Runner, q: ParsedSelect): QueryStep[] | null {
  try {
    return buildStepsUnsafe(run, q);
  } catch {
    return null;
  }
}

function buildStepsUnsafe(run: Runner, q: ParsedSelect): QueryStep[] {
  const steps: QueryStep[] = [];
  const refs: TableRef[] = [q.from, ...q.joins];
  // Her kaynağın sütunları "alias.kolon" olarak gösterilir
  const colsOf = refs.map((r) =>
    run(`SELECT * FROM ${r.table} LIMIT 0`).columns.map((c) => `${r.alias}.${c}`),
  );
  const starOf = (n: number) =>
    refs
      .slice(0, n)
      .map((r) => `${r.alias}.*`)
      .join(', ');
  const allCols = colsOf.flat();
  const allStar = starOf(refs.length);
  const src = sourceText(q.from, q.joins);

  // 1) FROM
  const base = run(`SELECT ${starOf(1)} FROM ${sourceText(q.from, [])}`);
  steps.push({
    kind: 'from',
    clause: `FROM ${q.from.alias === q.from.table ? q.from.table : `${q.from.table} ${q.from.alias}`}`,
    columns: colsOf[0]!,
    highlight: [],
    rows: base.rows.map((cells) => ({ cells, state: 'kept' })),
    stats: { input: base.rows.length, output: base.rows.length },
  });

  // 2) Her JOIN: önceki kaynaklar + yeni tablo, eşleşmeyenler LEFT JOIN ile görünür kılınır
  let current = base.rows.length;
  q.joins.forEach((j, idx) => {
    const n = idx + 2;
    const prefix = sourceText(q.from, q.joins.slice(0, idx));
    const res = run(
      `SELECT ${starOf(n)}, CASE WHEN ${j.alias}.rowid IS NULL THEN 0 ELSE 1 END AS __m ` +
        `FROM ${prefix} LEFT JOIN ${j.alias === j.table ? j.table : `${j.table} AS ${j.alias}`} ON ${j.on}`,
    );
    const columns = colsOf.slice(0, n).flat();
    const leftWidth = colsOf.slice(0, n - 1).flat().length;
    const bands = new Map<string, number>();
    let matched = 0;
    let unmatched = 0;
    const rows: StepRow[] = res.rows.map((r) => {
      const cells = r.slice(0, -1);
      const isMatch = r[r.length - 1] === 1;
      if (isMatch) matched++;
      else unmatched++;
      const lk = keyOf(cells.slice(0, leftWidth));
      if (!bands.has(lk)) bands.set(lk, bands.size);
      return {
        cells,
        state: isMatch ? 'matched' : j.type === 'left' ? 'padded' : 'dropped',
        group: bands.get(lk)! % 2,
      };
    });
    const output = j.type === 'left' ? matched + unmatched : matched;
    steps.push({
      kind: 'join',
      clause: `${j.type === 'left' ? 'LEFT JOIN' : 'JOIN'} ${j.alias === j.table ? j.table : `${j.table} ${j.alias}`} ON ${j.on}`,
      columns,
      highlight: highlightFor(j.on, columns),
      rows,
      stats: { input: current, output, matched, unmatched },
    });
    current = output;
  });

  // 3) WHERE: tüm satırlar + koşulun sonucu
  const whereSql = q.where ? ` WHERE ${q.where}` : '';
  if (q.where) {
    const res = run(
      `SELECT ${allStar}, CASE WHEN (${q.where}) THEN 1 ELSE 0 END AS __keep FROM ${src}`,
    );
    const rows: StepRow[] = res.rows.map((r) => ({
      cells: r.slice(0, -1),
      state: r[r.length - 1] === 1 ? 'kept' : 'dropped',
    }));
    const kept = rows.filter((r) => r.state === 'kept').length;
    steps.push({
      kind: 'where',
      clause: `WHERE ${q.where}`,
      columns: allCols,
      highlight: highlightFor(q.where, allCols),
      rows,
      stats: { input: rows.length, output: kept },
    });
    current = kept;
  }

  // 4) GROUP BY: her satırın grup anahtarı; satırlar gruplarına göre dizilir
  const groupColor = new Map<string, number>();
  if (q.groupBy) {
    const gExprs = q.groupBy.map((g, i) => `${g} AS __g${i}`).join(', ');
    const res = run(`SELECT ${allStar}, ${gExprs} FROM ${src}${whereSql}`);
    const g = q.groupBy.length;
    const tagged = res.rows.map((r, i) => {
      const key = keyOf(r.slice(-g));
      if (!groupColor.has(key)) groupColor.set(key, groupColor.size);
      return { cells: r.slice(0, -g), group: groupColor.get(key)!, i };
    });
    tagged.sort((a, b) => a.group - b.group || a.i - b.i);
    steps.push({
      kind: 'group',
      clause: `GROUP BY ${q.groupBy.join(', ')}`,
      columns: allCols,
      highlight: highlightFor(q.groupBy.join(', '), allCols),
      rows: tagged.map((t) => ({ cells: t.cells, state: 'kept', group: t.group })),
      stats: { input: tagged.length, output: groupColor.size, groups: groupColor.size },
    });
    current = groupColor.size;
  }
  const groupSql = q.groupBy ? ` GROUP BY ${q.groupBy.join(', ')}` : '';

  // 5) HAVING: grup düzeyinde süzme
  if (q.having && q.groupBy) {
    const gCols = q.groupBy.map((g, i) => `${g} AS __g${i}`).join(', ');
    const res = run(
      `SELECT ${gCols}, COUNT(*) AS __n, CASE WHEN (${q.having}) THEN 1 ELSE 0 END AS __keep ` +
        `FROM ${src}${whereSql}${groupSql}`,
    );
    const g = q.groupBy.length;
    const rows: StepRow[] = res.rows.map((r) => ({
      cells: r.slice(0, -1),
      state: r[r.length - 1] === 1 ? 'kept' : 'dropped',
      group: groupColor.get(keyOf(r.slice(0, g))),
    }));
    const kept = rows.filter((r) => r.state === 'kept').length;
    steps.push({
      kind: 'having',
      clause: `HAVING ${q.having}`,
      columns: [...q.groupBy, 'COUNT(*)'],
      highlight: [],
      rows,
      stats: { input: rows.length, output: kept },
    });
    current = kept;
  }
  const havingSql = q.having ? ` HAVING ${q.having}` : '';

  // 6) SELECT: projeksiyon (sıralama ve LIMIT olmadan)
  const core = `SELECT ${q.select} FROM ${q.fromText}${whereSql}${groupSql}${havingSql}`;
  const projected = run(core);
  steps.push({
    kind: 'select',
    clause: `SELECT ${q.select}`,
    columns: projected.columns,
    highlight: [],
    rows: projected.rows.map((cells) => ({ cells, state: 'kept' })),
    stats: { input: current, output: projected.rows.length },
  });

  // 7) ORDER BY
  let ordered = projected;
  if (q.orderBy) {
    ordered = run(`${core} ORDER BY ${q.orderBy}`);
    steps.push({
      kind: 'order',
      clause: `ORDER BY ${q.orderBy}`,
      columns: ordered.columns,
      highlight: highlightFor(q.orderBy, ordered.columns),
      rows: ordered.rows.map((cells) => ({ cells, state: 'kept' })),
      stats: { input: ordered.rows.length, output: ordered.rows.length },
    });
  }

  // 8) LIMIT / OFFSET: aralık dışındaki satırlar kesilir
  if (q.limit) {
    const { count, offset } = q.limit;
    const rows: StepRow[] = ordered.rows.map((cells, i) => ({
      cells,
      state: i >= offset && i < offset + count ? 'kept' : 'cut',
    }));
    steps.push({
      kind: 'limit',
      clause: `LIMIT ${count}${offset ? ` OFFSET ${offset}` : ''}`,
      columns: ordered.columns,
      highlight: [],
      rows,
      stats: { input: rows.length, output: rows.filter((r) => r.state === 'kept').length },
    });
  }
  return steps;
}

/* ------------------------------------------------------------------ */
/* Görev kontrolü                                                       */
/* ------------------------------------------------------------------ */

/** Ondalıkları yuvarlayarak karşılaştırılabilir hâle getirir (SUM'daki kayan nokta farkları için) */
function normCell(v: Cell): string {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return v === null ? '∅' : `s:${v}`;
}

export type TaskVerdict =
  | { ok: true }
  | {
      ok: false;
      reason: 'columns' | 'rows' | 'order' | 'values';
      expectedRows: number;
      actualRows: number;
      expectedColumns: number;
      actualColumns: number;
    };

/**
 * Kullanıcının sonucunu beklenen sonuçla karşılaştırır. Sütun adları önemsizdir (takma ad serbest),
 * sütun sayısı ve sırası önemlidir; satırlar `ordered` değilse çoklu küme olarak karşılaştırılır.
 */
export function compareResults(
  expected: QueryResult,
  actual: QueryResult,
  ordered = false,
): TaskVerdict {
  const base = {
    expectedRows: expected.rows.length,
    actualRows: actual.rows.length,
    expectedColumns: expected.columns.length,
    actualColumns: actual.columns.length,
  };
  if (expected.columns.length !== actual.columns.length)
    return { ok: false, reason: 'columns', ...base };
  if (expected.rows.length !== actual.rows.length) return { ok: false, reason: 'rows', ...base };
  const enc = (r: Cell[]) => r.map(normCell).join('\u0001');
  const e = expected.rows.map(enc);
  const a = actual.rows.map(enc);
  if (ordered) {
    if (e.every((x, i) => x === a[i])) return { ok: true };
    const sameSet = [...e].sort().join('\n') === [...a].sort().join('\n');
    return { ok: false, reason: sameSet ? 'order' : 'values', ...base };
  }
  return [...e].sort().join('\n') === [...a].sort().join('\n')
    ? { ok: true }
    : { ok: false, reason: 'values', ...base };
}

/** Veritabanındaki tabloların adları, sütunları ve satır sayıları (şema paneli için) */
export function describeSchema(run: Runner): { name: string; columns: string[]; rows: number }[] {
  const tables = run(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid",
  ).rows.map((r) => String(r[0]));
  return tables.map((name) => ({
    name,
    columns: run(`SELECT * FROM ${name} LIMIT 0`).columns,
    rows: Number(run(`SELECT COUNT(*) FROM ${name}`).rows[0]?.[0] ?? 0),
  }));
}
