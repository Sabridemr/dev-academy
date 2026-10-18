'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, RotateCcw, Save, Shuffle } from 'lucide-react';
import {
  cacheFlush,
  cacheGet,
  cacheSet,
  createCacheState,
  hitRatio,
  pickVictim,
  seedCacheDb,
  type CacheState,
  type EvictionPolicy,
  type WritePolicy,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { LogList, Range, Select, SimShell, Stat } from './ui';
import { numParam, strParam, type SimulatorProps } from './types';

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const POLICIES: EvictionPolicy[] = ['lru', 'lfu', 'fifo'];
const WRITE_POLICIES: WritePolicy[] = ['cache-aside', 'write-through', 'write-back'];

const L = {
  tr: {
    title: 'Cache simülatörü',
    slots: 'Cache slotları',
    db: 'Veritabanı',
    empty: 'boş',
    hits: 'Hit',
    misses: 'Miss',
    dbReads: 'DB okuma',
    dbWrites: 'DB yazma',
    dirty: 'kirli',
    noTtl: 'TTL yok (0 = süresiz)',
    randomTraffic: 'Rastgele 10 okuma',
    lastOp: 'Son işlem',
    readHint: 'Okumak için anahtara tıkla',
    writeHint: 'Yaz (yeni değer)',
    expired: 'süresi doldu',
    policies: {
      lru: 'LRU (en uzun süre kullanılmayan)',
      lfu: 'LFU (en az kullanılan)',
      fifo: 'FIFO (ilk giren ilk çıkar)',
    },
    writes: {
      'cache-aside': 'Cache-aside',
      'write-through': 'Write-through',
      'write-back': 'Write-back',
    },
  },
  en: {
    title: 'Cache simulator',
    slots: 'Cache slots',
    db: 'Database',
    empty: 'empty',
    hits: 'Hits',
    misses: 'Misses',
    dbReads: 'DB reads',
    dbWrites: 'DB writes',
    dirty: 'dirty',
    noTtl: 'No TTL (0 = never expires)',
    randomTraffic: '10 random reads',
    lastOp: 'Last op',
    readHint: 'Click a key to read',
    writeHint: 'Write (new value)',
    expired: 'expired',
    policies: {
      lru: 'LRU (least recently used)',
      lfu: 'LFU (least frequently used)',
      fifo: 'FIFO (first in first out)',
    },
    writes: {
      'cache-aside': 'Cache-aside',
      'write-through': 'Write-through',
      'write-back': 'Write-back',
    },
  },
};

/** Başlangıç durumunu ders parametrelerinden üretir (CDN varyantında ttlSec gelebilir) */
function initialState(params: Record<string, unknown>): CacheState {
  const ttlFromSec = numParam(params, 'ttlSec', 0, 0, 3600) * 1000;
  const s = createCacheState({
    capacity: numParam(params, 'capacity', 4, 1, 8),
    policy: strParam(params, 'policy', 'lru', POLICIES),
    writePolicy: strParam(params, 'writePolicy', 'cache-aside', WRITE_POLICIES),
    defaultTtlMs: numParam(params, 'ttlMs', ttlFromSec, 0, 120_000),
  });
  return seedCacheDb(s, KEYS);
}

/**
 * Cache simülatörü: shared/simulators/cache mantığını kullanır. Saat olarak Date.now() kullanılır;
 * TTL kalan süresi her 250ms'de yeniden çizilir.
 */
export default function CacheSim({ params, onInteract }: SimulatorProps) {
  const { t, locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const [state, setState] = useState<CacheState>(() => initialState(params));
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState<{ key: string; hit: boolean; id: number } | null>(null);
  const writeSeq = useRef(0);
  const flashSeq = useRef(0);

  // TTL göstergeleri için saat
  useEffect(() => {
    if (state.defaultTtlMs <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [state.defaultTtlMs]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), reduced ? 400 : 900);
    return () => clearTimeout(id);
  }, [flash, reduced]);

  const read = (key: string) => {
    onInteract();
    const r = cacheGet(state, key, Date.now());
    setState(r.state);
    setNow(Date.now());
    setFlash({ key, hit: r.hit, id: ++flashSeq.current });
  };

  const write = (key: string) => {
    onInteract();
    writeSeq.current += 1;
    setState((s) => cacheSet(s, key, `v${writeSeq.current}`, Date.now()));
    setNow(Date.now());
  };

  const randomReads = () => {
    onInteract();
    // Zipf benzeri dağılım: A, B, C daha sık okunur — eviction politikalarının farkı görünür olsun
    let s = state;
    const t0 = Date.now();
    for (let i = 0; i < 10; i++) {
      const r = Math.random();
      const idx = Math.min(KEYS.length - 1, Math.floor(Math.pow(r, 2.2) * KEYS.length));
      s = cacheGet(s, KEYS[idx], t0 + i).state;
    }
    setState(s);
    setNow(Date.now());
  };

  /** Kapasite küçülürse fazla girdileri politikaya göre çıkar (kirli olanlar DB'ye yazılır) */
  const changeCapacity = (capacity: number) => {
    onInteract();
    setState((s) => {
      const next: CacheState = { ...s, capacity, entries: [...s.entries], db: { ...s.db } };
      while (next.entries.length > capacity) {
        const victim = pickVictim(next.entries, next.policy);
        if (!victim) break;
        if (victim.dirty) {
          next.db[victim.key] = victim.value;
          next.dbWrites += 1;
        }
        next.entries = next.entries.filter((e) => e !== victim);
      }
      return next;
    });
  };

  const reset = () => {
    setState((s) =>
      seedCacheDb(
        createCacheState({
          capacity: s.capacity,
          policy: s.policy,
          writePolicy: s.writePolicy,
          defaultTtlMs: s.defaultTtlMs,
        }),
        KEYS,
      ),
    );
    setFlash(null);
  };

  const ratio = hitRatio(state);
  const dirtyCount = state.entries.filter((e) => e.dirty).length;
  const slotW = 600 / state.capacity;

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button type="button" className="btn-ghost" onClick={randomReads}>
            <Shuffle size={14} /> {l.randomTraffic}
          </button>
          {state.writePolicy === 'write-back' && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                onInteract();
                setState(cacheFlush);
              }}
              disabled={dirtyCount === 0}
            >
              <Save size={14} /> {t('sim.flush')}
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={reset}>
            <RotateCcw size={14} /> {t('sim.reset')}
          </button>
        </>
      }
      aside={
        <>
          <Range
            label={t('sim.capacity')}
            value={state.capacity}
            min={1}
            max={8}
            onChange={changeCapacity}
          />
          <Select
            label={t('sim.eviction')}
            value={state.policy}
            options={POLICIES.map((p) => ({ id: p, label: l.policies[p] }))}
            onChange={(v) => {
              onInteract();
              setState((s) => ({ ...s, policy: v }));
            }}
          />
          <Select
            label={t('sim.writePolicy')}
            value={state.writePolicy}
            options={WRITE_POLICIES.map((p) => ({ id: p, label: l.writes[p] }))}
            onChange={(v) => {
              onInteract();
              setState((s) => cacheFlush({ ...s, writePolicy: v }));
            }}
          />
          <Range
            label={t('sim.ttl')}
            value={state.defaultTtlMs}
            min={0}
            max={30000}
            step={1000}
            format={(v) => (v === 0 ? '∞' : `${v / 1000}s`)}
            onChange={(v) => {
              onInteract();
              setState((s) => ({ ...s, defaultTtlMs: v }));
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label={t('sim.hitRatio')}
              value={`${(ratio * 100).toFixed(0)}%`}
              tone={ratio >= 0.6 ? 'success' : ratio > 0 ? 'warning' : undefined}
            />
            <Stat label={l.hits} value={state.hits} tone="success" />
            <Stat
              label={l.misses}
              value={state.misses}
              tone={state.misses ? 'danger' : undefined}
            />
            <Stat label={l.dbReads} value={state.dbReads} />
            <Stat label={l.dbWrites} value={state.dbWrites} />
            <Stat label={l.dirty} value={dirtyCount} tone={dirtyCount ? 'warning' : undefined} />
          </div>
          <div>
            <p className="label">{t('sim.log')}</p>
            <LogList
              items={state.events
                .slice(-12)
                .reverse()
                .map((e) => ({
                  key: e.seq,
                  text: `${e.op.toUpperCase()} ${e.key} · ${e.detail}`,
                  tone:
                    e.result === 'hit'
                      ? 'success'
                      : e.result === 'miss' || e.result === 'evicted'
                        ? 'danger'
                        : 'muted',
                }))}
            />
          </div>
        </>
      }
    >
      <div className="space-y-4">
        {/* Anahtar butonları: okuma ve yazma */}
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {KEYS.map((k) => (
            <div key={k} className="flex flex-col gap-1">
              <button
                type="button"
                className="btn-primary px-2 py-1.5"
                onClick={() => read(k)}
                aria-label={`${t('sim.read')} ${k}`}
              >
                {t('sim.read')} {k}
              </button>
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-xs"
                onClick={() => write(k)}
                aria-label={`${t('sim.write')} ${k}`}
              >
                {t('sim.write')} {k}
              </button>
            </div>
          ))}
        </div>

        <svg viewBox="0 0 600 300" className="h-auto w-full" role="img" aria-label={l.slots}>
          <text x={0} y={14} fontSize={12} fill="var(--da-muted)">
            {l.slots} ({state.entries.length}/{state.capacity})
          </text>
          {Array.from({ length: state.capacity }, (_, i) => {
            const e = state.entries[i];
            const x = i * slotW + 4;
            const w = slotW - 8;
            const ttlLeft = e && e.ttlMs > 0 ? Math.max(0, 1 - (now - e.insertedAt) / e.ttlMs) : 1;
            const isFlash = e && flash && flash.key === e.key;
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={24}
                  width={w}
                  height={96}
                  rx={10}
                  fill={e ? 'var(--da-surface)' : 'var(--da-elevated)'}
                  stroke={
                    isFlash
                      ? flash.hit
                        ? 'var(--da-success)'
                        : 'var(--da-accent)'
                      : e?.dirty
                        ? 'var(--da-warning)'
                        : 'var(--da-border)'
                  }
                  strokeWidth={isFlash ? 3 : 1.5}
                  strokeDasharray={e ? undefined : '4 4'}
                />
                {e ? (
                  <>
                    <text
                      x={x + w / 2}
                      y={60}
                      textAnchor="middle"
                      fontSize={22}
                      fontWeight={700}
                      fill="var(--da-fg)"
                      opacity={ttlLeft <= 0 ? 0.35 : 1}
                    >
                      {e.key}
                    </text>
                    <text
                      x={x + w / 2}
                      y={78}
                      textAnchor="middle"
                      fontSize={10}
                      fill="var(--da-muted)"
                    >
                      {e.value}
                    </text>
                    <text
                      x={x + w / 2}
                      y={94}
                      textAnchor="middle"
                      fontSize={10}
                      fill="var(--da-primary)"
                    >
                      {e.hits} hit
                    </text>
                    {e.dirty && (
                      <text
                        x={x + w / 2}
                        y={108}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={600}
                        fill="var(--da-warning)"
                      >
                        ● {l.dirty}
                      </text>
                    )}
                    {e.ttlMs > 0 && (
                      <>
                        <rect
                          x={x + 6}
                          y={112}
                          width={w - 12}
                          height={3}
                          rx={1.5}
                          fill="var(--da-elevated)"
                        />
                        <rect
                          x={x + 6}
                          y={112}
                          width={(w - 12) * ttlLeft}
                          height={3}
                          rx={1.5}
                          fill={ttlLeft < 0.25 ? 'var(--da-danger)' : 'var(--da-success)'}
                        />
                      </>
                    )}
                  </>
                ) : (
                  <text
                    x={x + w / 2}
                    y={76}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--da-muted)"
                  >
                    {l.empty}
                  </text>
                )}
              </g>
            );
          })}

          {/* Cache ↔ DB bağlantısı */}
          <line
            x1={300}
            y1={124}
            x2={300}
            y2={176}
            stroke="var(--da-border)"
            strokeWidth={2}
            strokeDasharray="5 4"
          />
          <AnimatePresence>
            {flash && !flash.hit && (
              <motion.circle
                key={flash.id}
                r={6}
                cx={300}
                fill="var(--da-accent)"
                initial={{ cy: reduced ? 130 : 176, opacity: 1 }}
                animate={{ cy: 130 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.6 }}
              />
            )}
          </AnimatePresence>

          <g>
            <rect
              x={4}
              y={180}
              width={592}
              height={112}
              rx={12}
              fill="color-mix(in srgb, var(--da-primary) 6%, var(--da-surface))"
              stroke="var(--da-border)"
            />
            <text x={18} y={200} fontSize={12} fontWeight={600} fill="var(--da-fg)">
              {l.db}
            </text>
            {KEYS.map((k, i) => {
              const x = 18 + i * 72;
              const cached = state.entries.find((e) => e.key === k);
              const stale = cached && cached.value !== state.db[k];
              return (
                <g key={k}>
                  <rect
                    x={x}
                    y={212}
                    width={64}
                    height={66}
                    rx={8}
                    fill="var(--da-surface)"
                    stroke={stale ? 'var(--da-warning)' : 'var(--da-border)'}
                  />
                  <text
                    x={x + 32}
                    y={236}
                    textAnchor="middle"
                    fontSize={14}
                    fontWeight={600}
                    fill="var(--da-fg)"
                  >
                    {k}
                  </text>
                  <text x={x + 32} y={254} textAnchor="middle" fontSize={9} fill="var(--da-muted)">
                    {state.db[k] ?? '—'}
                  </text>
                  {stale && (
                    <text
                      x={x + 32}
                      y={270}
                      textAnchor="middle"
                      fontSize={9}
                      fill="var(--da-warning)"
                    >
                      ≠ cache
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
        <p className="flex items-center gap-2 text-xs text-muted">
          <Database size={12} />{' '}
          {state.defaultTtlMs > 0 ? `TTL ${state.defaultTtlMs / 1000}s` : l.noTtl} · {l.readHint}
        </p>
      </div>
    </SimShell>
  );
}
