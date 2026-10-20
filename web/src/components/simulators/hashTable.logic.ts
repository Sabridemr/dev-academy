/**
 * Hash tablosu simülatörünün saf mantığı. Tablo değişmezdir; her işlem yeni bir tablo ve
 * görselleştirme için bir iz (trace) döndürür.
 */

export const COLLISION_MODES = ['chaining', 'linear-probing'] as const;
export type CollisionMode = (typeof COLLISION_MODES)[number];

/** Açık adreslemede silinen yuva (tombstone) */
export const TOMBSTONE = { deleted: true } as const;
export type Slot = string | null | typeof TOMBSTONE;

export const MAX_CAPACITY = 64;

export interface HashTable {
  mode: CollisionMode;
  capacity: number;
  maxLoad: number;
  /** chaining: kova başına liste */
  chains: string[][];
  /** linear-probing: yuva dizisi */
  slots: Slot[];
  size: number;
  /** Kullanıcı eklemelerinde yaşanan toplam çakışma */
  collisions: number;
}

export interface OpTrace {
  op: 'insert' | 'search' | 'delete';
  key: string;
  hash: number;
  home: number;
  /** Sırayla bakılan kova/yuva indeksleri */
  probes: number[];
  result: 'inserted' | 'exists' | 'found' | 'not-found' | 'deleted';
  /** Sonucun bulunduğu/yazıldığı indeks */
  index: number | null;
  collision: boolean;
  resized: { from: number; to: number } | null;
}

/** djb2 türevi, 32-bit işaretsiz string hash */
export function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) + s.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

export function createTable(capacity: number, mode: CollisionMode, maxLoad: number): HashTable {
  return {
    mode,
    capacity,
    maxLoad,
    chains: Array.from({ length: capacity }, () => []),
    slots: Array(capacity).fill(null),
    size: 0,
    collisions: 0,
  };
}

export const loadFactor = (t: HashTable) => t.size / t.capacity;

export function tableKeys(t: HashTable): string[] {
  return t.mode === 'chaining'
    ? t.chains.flat()
    : t.slots.filter((s): s is string => typeof s === 'string');
}

/** Anahtarı arar; açık adreslemede boş yuvaya (null) gelince durur, tombstone'ları atlar */
function locate(t: HashTable, key: string): { probes: number[]; index: number | null } {
  const home = hashString(key) % t.capacity;
  if (t.mode === 'chaining') {
    return { probes: [home], index: t.chains[home].includes(key) ? home : null };
  }
  const probes: number[] = [];
  for (let k = 0; k < t.capacity; k++) {
    const i = (home + k) % t.capacity;
    probes.push(i);
    const s = t.slots[i];
    if (s === null) return { probes, index: null };
    if (s === key) return { probes, index: i };
  }
  return { probes, index: null };
}

/** Çakışma sayacını değiştirmeden ham ekleme (yeniden boyutlandırmada da kullanılır) */
function rawInsert(
  t: HashTable,
  key: string,
): { probes: number[]; index: number; collision: boolean } {
  const home = hashString(key) % t.capacity;
  if (t.mode === 'chaining') {
    const collision = t.chains[home].length > 0;
    t.chains[home] = [...t.chains[home], key];
    t.size++;
    return { probes: [home], index: home, collision };
  }
  const probes: number[] = [];
  for (let k = 0; k < t.capacity; k++) {
    const i = (home + k) % t.capacity;
    probes.push(i);
    if (typeof t.slots[i] !== 'string') {
      t.slots[i] = key;
      t.size++;
      return { probes, index: i, collision: k > 0 };
    }
  }
  throw new Error('hash table full');
}

/** Kapasiteyi ikiye katlar ve tüm anahtarları yeniden hash'ler */
export function rehash(t: HashTable, capacity = Math.min(MAX_CAPACITY, t.capacity * 2)): HashTable {
  const next = createTable(capacity, t.mode, t.maxLoad);
  next.collisions = t.collisions;
  for (const k of tableKeys(t)) rawInsert(next, k);
  return next;
}

const clone = (t: HashTable): HashTable => ({
  ...t,
  chains: t.chains.map((c) => [...c]),
  slots: [...t.slots],
});

export function insertKey(t: HashTable, key: string): { table: HashTable; trace: OpTrace } {
  const hash = hashString(key);
  const home = hash % t.capacity;
  const found = locate(t, key);
  if (found.index !== null) {
    return {
      table: t,
      trace: {
        op: 'insert',
        key,
        hash,
        home,
        probes: found.probes,
        result: 'exists',
        index: found.index,
        collision: false,
        resized: null,
      },
    };
  }
  let next = clone(t);
  const r = rawInsert(next, key);
  if (r.collision) next.collisions++;
  let resized: OpTrace['resized'] = null;
  const overLoad = loadFactor(next) > next.maxLoad;
  const full = next.mode === 'linear-probing' && next.size >= next.capacity;
  if ((overLoad || full) && next.capacity < MAX_CAPACITY) {
    const from = next.capacity;
    next = rehash(next);
    resized = { from, to: next.capacity };
  }
  return {
    table: next,
    trace: {
      op: 'insert',
      key,
      hash,
      home,
      probes: r.probes,
      result: 'inserted',
      index: r.index,
      collision: r.collision,
      resized,
    },
  };
}

/** Tablo tamamen dolu ve büyütülemiyorsa eklemeye izin verilmez */
export const canInsert = (t: HashTable) => t.mode === 'chaining' || t.size < t.capacity;

export function searchKey(t: HashTable, key: string): OpTrace {
  const hash = hashString(key);
  const found = locate(t, key);
  return {
    op: 'search',
    key,
    hash,
    home: hash % t.capacity,
    probes: found.probes,
    result: found.index !== null ? 'found' : 'not-found',
    index: found.index,
    collision: false,
    resized: null,
  };
}

export function deleteKey(t: HashTable, key: string): { table: HashTable; trace: OpTrace } {
  const trace = { ...searchKey(t, key), op: 'delete' as const };
  if (trace.index === null) return { table: t, trace: { ...trace, result: 'not-found' } };
  const next = clone(t);
  if (next.mode === 'chaining')
    next.chains[trace.index] = next.chains[trace.index].filter((k) => k !== key);
  else next.slots[trace.index] = TOMBSTONE;
  next.size--;
  return { table: next, trace: { ...trace, result: 'deleted' } };
}

/**
 * Verilen anahtarlarla sıfırdan tablo kurar (parametre değişiminde). Yük sınırı aşılırsa
 * kapasite yeterli olana kadar ikiye katlanır.
 */
export function buildTable(
  keys: readonly string[],
  capacity: number,
  mode: CollisionMode,
  maxLoad: number,
): HashTable {
  let cap = capacity;
  const fits = (c: number) =>
    keys.length / c <= maxLoad && (mode === 'chaining' || keys.length < c);
  while (!fits(cap) && cap < MAX_CAPACITY) cap = Math.min(MAX_CAPACITY, cap * 2);
  const t = createTable(cap, mode, maxLoad);
  for (const k of keys) {
    if (!canInsert(t)) break;
    rawInsert(t, k);
  }
  return t;
}
