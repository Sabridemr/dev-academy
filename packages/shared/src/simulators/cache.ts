/**
 * CACHE SİMÜLATÖRÜ (saf mantık)
 * -----------------------------
 * LRU / LFU / FIFO eviction, TTL, cache-aside / write-through / write-back yazma stratejileri.
 */

export type EvictionPolicy = 'lru' | 'lfu' | 'fifo';
export type WritePolicy = 'cache-aside' | 'write-through' | 'write-back';

export interface CacheEntry {
  key: string;
  value: string;
  insertedAt: number;
  lastAccess: number;
  hits: number;
  /** TTL (ms) — 0 ise süresiz */
  ttlMs: number;
  /** write-back için: DB'ye yazılmamış kirli veri */
  dirty: boolean;
}

export interface CacheEvent {
  seq: number;
  op: 'get' | 'set' | 'evict' | 'expire' | 'flush';
  key: string;
  result: 'hit' | 'miss' | 'stored' | 'evicted' | 'expired' | 'flushed';
  detail: string;
}

export interface CacheState {
  capacity: number;
  policy: EvictionPolicy;
  writePolicy: WritePolicy;
  defaultTtlMs: number;
  entries: CacheEntry[];
  /** "Veritabanı" — kalıcı depo */
  db: Record<string, string>;
  hits: number;
  misses: number;
  dbReads: number;
  dbWrites: number;
  events: CacheEvent[];
  seq: number;
}

export function createCacheState(
  partial: Partial<Pick<CacheState, 'capacity' | 'policy' | 'writePolicy' | 'defaultTtlMs'>> = {},
): CacheState {
  return {
    capacity: partial.capacity ?? 4,
    policy: partial.policy ?? 'lru',
    writePolicy: partial.writePolicy ?? 'cache-aside',
    defaultTtlMs: partial.defaultTtlMs ?? 0,
    entries: [],
    db: {},
    hits: 0,
    misses: 0,
    dbReads: 0,
    dbWrites: 0,
    events: [],
    seq: 0,
  };
}

function pushEvent(state: CacheState, ev: Omit<CacheEvent, 'seq'>): void {
  state.seq += 1;
  state.events.push({ seq: state.seq, ...ev });
  if (state.events.length > 100) state.events.splice(0, state.events.length - 100);
}

function clone(state: CacheState): CacheState {
  return {
    ...state,
    entries: state.entries.map((e) => ({ ...e })),
    db: { ...state.db },
    events: [...state.events],
  };
}

function expireEntries(state: CacheState, now: number): void {
  const alive: CacheEntry[] = [];
  for (const e of state.entries) {
    if (e.ttlMs > 0 && now - e.insertedAt >= e.ttlMs) {
      if (e.dirty) {
        state.db[e.key] = e.value;
        state.dbWrites += 1;
      }
      pushEvent(state, {
        op: 'expire',
        key: e.key,
        result: 'expired',
        detail: `TTL doldu (${e.ttlMs}ms)`,
      });
    } else {
      alive.push(e);
    }
  }
  state.entries = alive;
}

/** Politikaya göre çıkarılacak girdiyi seçer */
export function pickVictim(entries: CacheEntry[], policy: EvictionPolicy): CacheEntry | undefined {
  if (entries.length === 0) return undefined;
  switch (policy) {
    case 'lru':
      return entries.reduce((a, b) => (b.lastAccess < a.lastAccess ? b : a));
    case 'lfu':
      return entries.reduce((a, b) =>
        b.hits < a.hits || (b.hits === a.hits && b.lastAccess < a.lastAccess) ? b : a,
      );
    case 'fifo':
      return entries.reduce((a, b) => (b.insertedAt < a.insertedAt ? b : a));
  }
}

function ensureCapacity(state: CacheState, now: number): void {
  while (state.entries.length >= state.capacity) {
    const victim = pickVictim(state.entries, state.policy);
    if (!victim) break;
    if (victim.dirty) {
      state.db[victim.key] = victim.value;
      state.dbWrites += 1;
    }
    state.entries = state.entries.filter((e) => e !== victim);
    const why =
      state.policy === 'lru'
        ? `en uzun süredir erişilmeyen (t=${victim.lastAccess})`
        : state.policy === 'lfu'
          ? `en az erişilen (${victim.hits} hit)`
          : 'ilk giren';
    pushEvent(state, {
      op: 'evict',
      key: victim.key,
      result: 'evicted',
      detail: `${state.policy.toUpperCase()} eviction: ${why}${victim.dirty ? ', kirli veri DB’ye yazıldı' : ''}`,
    });
    void now;
  }
}

/** Okuma: cache'te varsa hit, yoksa DB'den okur ve cache'e koyar (cache-aside / read-through davranışı) */
export function cacheGet(
  state: CacheState,
  key: string,
  now: number,
): { state: CacheState; hit: boolean; value: string | undefined } {
  const s = clone(state);
  expireEntries(s, now);
  const entry = s.entries.find((e) => e.key === key);
  if (entry) {
    entry.lastAccess = now;
    entry.hits += 1;
    s.hits += 1;
    pushEvent(s, { op: 'get', key, result: 'hit', detail: `Cache HIT (${entry.hits}. erişim)` });
    return { state: s, hit: true, value: entry.value };
  }
  s.misses += 1;
  s.dbReads += 1;
  const value = s.db[key];
  if (value === undefined) {
    pushEvent(s, { op: 'get', key, result: 'miss', detail: 'Cache MISS → DB’de de yok' });
    return { state: s, hit: false, value: undefined };
  }
  ensureCapacity(s, now);
  s.entries.push({
    key,
    value,
    insertedAt: now,
    lastAccess: now,
    hits: 1,
    ttlMs: s.defaultTtlMs,
    dirty: false,
  });
  pushEvent(s, {
    op: 'get',
    key,
    result: 'miss',
    detail: 'Cache MISS → DB’den okundu ve cache’e yazıldı',
  });
  return { state: s, hit: false, value };
}

/** Yazma: yazma politikasına göre cache ve DB güncellenir */
export function cacheSet(state: CacheState, key: string, value: string, now: number): CacheState {
  const s = clone(state);
  expireEntries(s, now);
  const existing = s.entries.find((e) => e.key === key);
  switch (s.writePolicy) {
    case 'cache-aside':
      // Uygulama DB'ye yazar, cache'teki kopyayı geçersiz kılar
      s.db[key] = value;
      s.dbWrites += 1;
      if (existing) s.entries = s.entries.filter((e) => e !== existing);
      pushEvent(s, {
        op: 'set',
        key,
        result: 'stored',
        detail: 'Cache-aside: DB’ye yazıldı, cache girdisi invalidate edildi',
      });
      return s;
    case 'write-through':
      s.db[key] = value;
      s.dbWrites += 1;
      if (existing) {
        existing.value = value;
        existing.lastAccess = now;
        existing.dirty = false;
      } else {
        ensureCapacity(s, now);
        s.entries.push({
          key,
          value,
          insertedAt: now,
          lastAccess: now,
          hits: 0,
          ttlMs: s.defaultTtlMs,
          dirty: false,
        });
      }
      pushEvent(s, {
        op: 'set',
        key,
        result: 'stored',
        detail: 'Write-through: cache ve DB eş zamanlı yazıldı',
      });
      return s;
    case 'write-back':
      if (existing) {
        existing.value = value;
        existing.lastAccess = now;
        existing.dirty = true;
      } else {
        ensureCapacity(s, now);
        s.entries.push({
          key,
          value,
          insertedAt: now,
          lastAccess: now,
          hits: 0,
          ttlMs: s.defaultTtlMs,
          dirty: true,
        });
      }
      pushEvent(s, {
        op: 'set',
        key,
        result: 'stored',
        detail: 'Write-back: yalnızca cache’e yazıldı (dirty); DB sonra güncellenecek',
      });
      return s;
  }
}

/** Write-back için kirli verileri DB'ye yazar */
export function cacheFlush(state: CacheState): CacheState {
  const s = clone(state);
  let count = 0;
  for (const e of s.entries) {
    if (e.dirty) {
      s.db[e.key] = e.value;
      s.dbWrites += 1;
      e.dirty = false;
      count += 1;
    }
  }
  pushEvent(s, {
    op: 'flush',
    key: '*',
    result: 'flushed',
    detail: `${count} kirli girdi DB’ye yazıldı`,
  });
  return s;
}

export function hitRatio(state: CacheState): number {
  const total = state.hits + state.misses;
  return total === 0 ? 0 : state.hits / total;
}

/** Seed: DB'yi örnek anahtarlarla doldurur */
export function seedCacheDb(state: CacheState, keys: string[]): CacheState {
  const s = clone(state);
  for (const k of keys) s.db[k] = `value(${k})`;
  return s;
}
