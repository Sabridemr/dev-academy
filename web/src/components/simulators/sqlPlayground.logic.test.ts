import type { Database, SqlJsStatic } from 'sql.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadTestSqlJs } from '@/test/sqljs';
import { DATASETS, SQL_DATASETS } from './sqlPlayground.datasets';
import {
  buildSteps,
  compareResults,
  describeSchema,
  guardSelect,
  makeRunner,
  parseSelect,
  type Runner,
} from './sqlPlayground.logic';

// Testler gerçek SQLite'ı (sql.js WebAssembly) Node'da çalıştırır
let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadTestSqlJs();
});

function open(id: keyof typeof DATASETS): { db: Database; run: Runner } {
  const db = new SQL.Database();
  db.run(DATASETS[id].script);
  return { db, run: makeRunner(db) };
}

describe('guardSelect', () => {
  it('tek SELECT ve WITH sorgularına izin verir, sondaki ; serbest', () => {
    expect(guardSelect('SELECT 1;').ok).toBe(true);
    expect(guardSelect('  with t as (select 1 as x) select x from t').ok).toBe(true);
    expect(guardSelect("SELECT replace(name, 'a', 'b') FROM customers").ok).toBe(true);
    expect(guardSelect("SELECT 'DROP TABLE x' AS s").ok).toBe(true);
    expect(guardSelect('SELECT 1 -- DELETE FROM x').ok).toBe(true);
  });

  it('DDL/DML ve çoklu ifadeleri reddeder', () => {
    expect(guardSelect('DELETE FROM customers')).toMatchObject({ ok: false, reason: 'forbidden' });
    expect(guardSelect('drop table orders')).toMatchObject({ ok: false, keyword: 'DROP' });
    expect(guardSelect('SELECT 1; DELETE FROM customers')).toMatchObject({ reason: 'multiple' });
    expect(guardSelect('PRAGMA table_info(customers)')).toMatchObject({ reason: 'forbidden' });
    expect(guardSelect('EXPLAIN SELECT 1')).toMatchObject({ reason: 'not-select' });
    expect(guardSelect('   ')).toMatchObject({ reason: 'empty' });
    expect(guardSelect('WITH x AS (SELECT 1) INSERT INTO customers SELECT * FROM x')).toMatchObject(
      { reason: 'forbidden', keyword: 'INSERT' },
    );
  });
});

describe('parseSelect', () => {
  it('JOIN, WHERE, GROUP BY, HAVING, ORDER BY ve LIMIT cümleciklerini ayırır', () => {
    const q = parseSelect(`SELECT c.name, SUM(oi.quantity * oi.unit_price) AS total
      FROM customers c
      JOIN orders o ON o.customer_id = c.id
      LEFT OUTER JOIN order_items AS oi ON oi.order_id = o.id AND oi.quantity > 0
      WHERE o.status <> 'cancelled'
      GROUP BY c.id, c.name
      HAVING COUNT(*) > 1
      ORDER BY total DESC
      LIMIT 3 OFFSET 1;`);
    expect(q).not.toBeNull();
    expect(q!.from).toEqual({ table: 'customers', alias: 'c' });
    expect(q!.joins).toEqual([
      { table: 'orders', alias: 'o', type: 'inner', on: 'o.customer_id = c.id' },
      {
        table: 'order_items',
        alias: 'oi',
        type: 'left',
        on: 'oi.order_id = o.id AND oi.quantity > 0',
      },
    ]);
    expect(q!.where).toBe("o.status <> 'cancelled'");
    expect(q!.groupBy).toEqual(['c.id', 'c.name']);
    expect(q!.having).toBe('COUNT(*) > 1');
    expect(q!.orderBy).toBe('total DESC');
    expect(q!.limit).toEqual({ count: 3, offset: 1 });
  });

  it('LIMIT ofset, sayı biçimini ve tek tabloyu destekler', () => {
    expect(parseSelect('SELECT * FROM products LIMIT 2, 5')!.limit).toEqual({
      count: 5,
      offset: 2,
    });
    const q = parseSelect('select name from products where price > 500');
    expect(q!.joins).toEqual([]);
    expect(q!.from.alias).toBe('products');
  });

  it('desteklenmeyen yapılar için null döner', () => {
    expect(
      parseSelect('SELECT * FROM customers WHERE id IN (SELECT customer_id FROM orders)'),
    ).toBeNull();
    expect(parseSelect('SELECT * FROM customers, orders')).toBeNull();
    expect(parseSelect('SELECT * FROM a RIGHT JOIN b ON a.id = b.id')).toBeNull();
    expect(parseSelect('SELECT * FROM a JOIN b USING (id)')).toBeNull();
    expect(parseSelect('SELECT 1 UNION SELECT 2')).toBeNull();
    expect(parseSelect('WITH t AS (SELECT 1) SELECT * FROM t')).toBeNull();
    expect(parseSelect('SELECT 1')).toBeNull();
    expect(parseSelect('SELECT * FROM t LIMIT ?')).toBeNull();
    expect(parseSelect('DELETE FROM customers')).toBeNull();
  });
});

describe('buildSteps (gerçek sql.js)', () => {
  it('JOIN adımı eşleşen çiftleri ve eşleşmeyen satırları işaretler', () => {
    const { run, db } = open('shop');
    const steps = buildSteps(
      run,
      parseSelect('SELECT c.name, o.id FROM customers c JOIN orders o ON o.customer_id = c.id')!,
    )!;
    expect(steps.map((s) => s.kind)).toEqual(['from', 'join', 'select']);
    const [from, join, select] = steps;
    expect(from!.rows).toHaveLength(10);
    expect(from!.columns[0]).toBe('c.id');
    // 15 sipariş eşleşir; hiç siparişi olmayan 3 müşteri (8, 9, 10) INNER JOIN'de elenir
    expect(join!.stats).toMatchObject({ input: 10, matched: 15, unmatched: 3, output: 15 });
    expect(join!.rows.filter((r) => r.state === 'dropped')).toHaveLength(3);
    expect(join!.highlight.map((i) => join!.columns[i])).toEqual(['c.id', 'o.customer_id']);
    expect(select!.rows).toHaveLength(15);
    db.close();
  });

  it('LEFT JOIN eşleşmeyenleri NULL ile korur', () => {
    const { run, db } = open('shop');
    const steps = buildSteps(
      run,
      parseSelect('SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id')!,
    )!;
    const join = steps[1]!;
    expect(join.stats.output).toBe(18);
    const padded = join.rows.filter((r) => r.state === 'padded');
    expect(padded).toHaveLength(3);
    expect(padded.every((r) => r.cells.slice(4).every((c) => c === null))).toBe(true);
    db.close();
  });

  it('WHERE elenen satırları, GROUP BY grupları, HAVING ve LIMIT kesilenleri işaretler', () => {
    const { run, db } = open('shop');
    const sql = `SELECT c.name, COUNT(*) AS n FROM customers c
      JOIN orders o ON o.customer_id = c.id
      WHERE o.status <> 'cancelled'
      GROUP BY c.id, c.name HAVING COUNT(*) >= 2
      ORDER BY n DESC, c.name LIMIT 2`;
    const steps = buildSteps(run, parseSelect(sql)!)!;
    expect(steps.map((s) => s.kind)).toEqual([
      'from',
      'join',
      'where',
      'group',
      'having',
      'select',
      'order',
      'limit',
    ]);
    const byKind = Object.fromEntries(steps.map((s) => [s.kind, s]));
    // 2 iptal edilmiş sipariş soluklaşır
    expect(byKind.where!.stats).toEqual({ input: 15, output: 13 });
    expect(byKind.where!.rows.filter((r) => r.state === 'dropped')).toHaveLength(2);
    // 13 satır → 7 müşteri grubu; satırlar grup sırasıyla dizilir
    expect(byKind.group!.stats.groups).toBe(7);
    const groups = byKind.group!.rows.map((r) => r.group!);
    expect(groups).toEqual([...groups].sort((a, b) => a - b));
    // En az 2 siparişi olan: Ayşe (3), Mehmet, Zeynep, Elif, Selin (2'şer)
    expect(byKind.having!.stats).toEqual({ input: 7, output: 5 });
    expect(byKind.select!.rows).toHaveLength(5);
    expect(byKind.order!.rows[0]!.cells).toEqual(['Ayşe Yılmaz', 3]);
    expect(byKind.limit!.rows.map((r) => r.state)).toEqual(['kept', 'kept', 'cut', 'cut', 'cut']);
    // Adımların son çıktısı gerçek sorgunun sonucu ile aynı
    const real = run(sql);
    expect(byKind.limit!.rows.filter((r) => r.state === 'kept').map((r) => r.cells)).toEqual(
      real.rows,
    );
    db.close();
  });

  it('yardımcı sorgu hata verirse null döner (adım görünümü yok)', () => {
    const { run, db } = open('shop');
    expect(
      buildSteps(run, parseSelect('SELECT * FROM nope n JOIN orders o ON o.id = n.id')!),
    ).toBeNull();
    db.close();
  });
});

describe('veri kümeleri ve görevler', () => {
  for (const id of SQL_DATASETS) {
    it(`${id}: betik yüklenir, başlangıç sorgusu adımlara ayrılır, referanslar çalışır`, () => {
      const { run, db } = open(id);
      const schema = describeSchema(run);
      expect(schema.length).toBeGreaterThanOrEqual(3);
      for (const t of schema) expect(t.rows).toBeGreaterThanOrEqual(7);
      const ds = DATASETS[id];
      expect(guardSelect(ds.starter).ok).toBe(true);
      expect(buildSteps(run, parseSelect(ds.starter)!)?.length).toBeGreaterThan(3);
      expect(ds.tasks.length).toBeGreaterThanOrEqual(4);
      expect(ds.tasks.length).toBeLessThanOrEqual(6);
      for (const task of ds.tasks) {
        expect(guardSelect(task.reference).ok).toBe(true);
        const res = run(task.reference);
        expect(res.rows.length, task.id).toBeGreaterThan(0);
        expect(compareResults(res, run(task.reference), task.ordered)).toEqual({ ok: true });
      }
      db.close();
    });
  }
});

describe('compareResults', () => {
  it('sırayı (ordered değilse) ve sütun adlarını önemsemez, kayan noktayı yuvarlar', () => {
    const exp = {
      columns: ['a', 'b'],
      rows: [
        [1, 0.1 + 0.2],
        ['x', null],
      ],
    };
    const act = {
      columns: ['x', 'y'],
      rows: [
        ['x', null],
        [1, 0.3],
      ],
    };
    expect(compareResults(exp, act)).toEqual({ ok: true });
    expect(compareResults(exp, act, true)).toMatchObject({ ok: false, reason: 'order' });
  });

  it('sütun ve satır sayısı farkını ayrı nedenlerle bildirir', () => {
    const exp = { columns: ['a'], rows: [[1], [2]] };
    expect(compareResults(exp, { columns: ['a', 'b'], rows: [] })).toMatchObject({
      reason: 'columns',
    });
    expect(compareResults(exp, { columns: ['a'], rows: [[1]] })).toMatchObject({ reason: 'rows' });
    expect(compareResults(exp, { columns: ['a'], rows: [[1], [3]] })).toMatchObject({
      reason: 'values',
    });
    // Metin '1' ile sayı 1 farklıdır
    expect(
      compareResults({ columns: ['a'], rows: [[1]] }, { columns: ['a'], rows: [['1']] }).ok,
    ).toBe(false);
  });
});
