import { describe, expect, it } from 'vitest';
import {
  TOMBSTONE,
  buildTable,
  createTable,
  deleteKey,
  hashString,
  insertKey,
  searchKey,
  tableKeys,
} from './hashTable.logic';

/** Belirli bir kovaya düşen farklı anahtarlar bulur */
function keysInBucket(bucket: number, cap: number, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; out.length < count; i++)
    if (hashString(`k${i}`) % cap === bucket) out.push(`k${i}`);
  return out;
}

describe('hashTable.logic', () => {
  it('hashString deterministik ve işaretsiz', () => {
    expect(hashString('elma')).toBe(hashString('elma'));
    expect(hashString('elma')).not.toBe(hashString('armut'));
    expect(hashString('x')).toBeGreaterThanOrEqual(0);
  });

  it('zincirleme: aynı kovaya düşenler listede tutulur ve çakışma sayılır', () => {
    const [a, b] = keysInBucket(2, 8, 2);
    let t = createTable(8, 'chaining', 1);
    t = insertKey(t, a).table;
    const r = insertKey(t, b);
    expect(r.trace.collision).toBe(true);
    expect(r.table.chains[2]).toEqual([a, b]);
    expect(r.table.collisions).toBe(1);
    expect(searchKey(r.table, b).result).toBe('found');
  });

  it('doğrusal sondalama: çakışan anahtar sonraki yuvaya yazılır, silinince tombstone kalır', () => {
    const [a, b] = keysInBucket(3, 8, 2);
    let t = createTable(8, 'linear-probing', 1);
    t = insertKey(t, a).table;
    const r = insertKey(t, b);
    expect(r.trace.probes).toEqual([3, 4]);
    expect(r.table.slots[4]).toBe(b);
    const d = deleteKey(r.table, a);
    expect(d.table.slots[3]).toBe(TOMBSTONE);
    // tombstone arama zincirini kırmaz
    expect(searchKey(d.table, b)).toMatchObject({ result: 'found', index: 4, probes: [3, 4] });
  });

  it('yük faktörü aşılınca kapasite ikiye katlanır', () => {
    let t = createTable(4, 'chaining', 0.5);
    t = insertKey(t, 'a').table;
    t = insertKey(t, 'b').table;
    const r = insertKey(t, 'c');
    expect(r.trace.resized).toEqual({ from: 4, to: 8 });
    expect(r.table.capacity).toBe(8);
    expect(tableKeys(r.table).sort()).toEqual(['a', 'b', 'c']);
  });

  it('var olan anahtar ikinci kez eklenmez', () => {
    const t = insertKey(createTable(4, 'chaining', 1), 'a').table;
    const r = insertKey(t, 'a');
    expect(r.trace.result).toBe('exists');
    expect(r.table.size).toBe(1);
  });

  it('buildTable mod değişiminde anahtarları korur', () => {
    const t = buildTable(['a', 'b', 'c', 'd'], 4, 'linear-probing', 0.75);
    expect(t.capacity).toBe(8);
    expect(tableKeys(t).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});
