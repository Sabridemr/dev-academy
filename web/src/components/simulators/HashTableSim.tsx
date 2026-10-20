'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { Dices, Plus, Search, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { LogList, Range, Select, SimShell, Stat } from './ui';
import { numParam, strParam, type SimulatorProps } from './types';
import {
  COLLISION_MODES,
  buildTable,
  canInsert,
  deleteKey,
  hashString,
  insertKey,
  loadFactor,
  searchKey,
  tableKeys,
  type CollisionMode,
  type HashTable,
  type OpTrace,
} from './hashTable.logic';

const PROBE_MS = 280;
const REHASH_MS = 1400;
const SAMPLE_KEYS = [
  'elma',
  'armut',
  'kiraz',
  'muz',
  'ayva',
  'erik',
  'incir',
  'nar',
  'kavun',
  'üzüm',
  'cat',
  'dog',
  'owl',
  'fox',
  'bee',
  'ant',
  'yak',
  'emu',
  'koi',
  'eel',
];

const L = {
  tr: {
    title: 'Hash tablosu',
    modes: {
      chaining: 'Zincirleme (chaining)',
      'linear-probing': 'Doğrusal sondalama',
    } satisfies Record<CollisionMode, string>,
    hint: {
      chaining: 'Her kova bir liste tutar; aynı kovaya düşen anahtarlar listeye eklenir.',
      'linear-probing':
        'Tek dizi kullanılır; kova doluysa bir sonraki boş yuvaya bakılır (i+1, i+2, …). Silinen yuvalar “mezar taşı” (⌫) olarak kalır.',
    } satisfies Record<CollisionMode, string>,
    key: 'Anahtar',
    placeholder: 'ör. elma',
    insert: 'Ekle',
    search: 'Ara',
    remove: 'Sil',
    random: 'Rastgele ekle',
    buckets: 'Kova sayısı',
    collision: 'Çakışma çözümü',
    maxLoad: 'Yük faktörü sınırı',
    size: 'Anahtar',
    capacity: 'Kapasite',
    load: 'Yük faktörü',
    collisions: 'Çakışma',
    log: 'İşlem günlüğü',
    full: 'Tablo dolu',
    rehashing: (a: number, b: number) =>
      `Yük faktörü sınırı aşıldı → yeniden boyutlandırma: ${a} → ${b} kova, tüm anahtarlar yeniden hash'lendi.`,
    lines: {
      inserted: (k: string, h: number, i: number, home: number, c: boolean) =>
        `put("${k}") hash=${h} → kova ${home}${c ? ` · çakışma, yuva ${i}` : ''}`,
      exists: (k: string) => `put("${k}") zaten var`,
      found: (k: string, i: number, p: number) => `get("${k}") → kova ${i} (${p} sonda)`,
      'not-found': (k: string, p: number) => `get("${k}") bulunamadı (${p} sonda)`,
      deleted: (k: string, i: number) => `delete("${k}") → kova ${i} temizlendi`,
      notDeleted: (k: string) => `delete("${k}") bulunamadı`,
      rehash: (a: number, b: number) => `rehash ${a} → ${b}`,
    },
    hashOf: 'hash',
    empty: 'boş',
  },
  en: {
    title: 'Hash table',
    modes: { chaining: 'Separate chaining', 'linear-probing': 'Linear probing' } satisfies Record<
      CollisionMode,
      string
    >,
    hint: {
      chaining: 'Each bucket keeps a list; keys landing in the same bucket are appended to it.',
      'linear-probing':
        'A single array; if a slot is taken, the next one is tried (i+1, i+2, …). Deleted slots stay as tombstones (⌫).',
    } satisfies Record<CollisionMode, string>,
    key: 'Key',
    placeholder: 'e.g. apple',
    insert: 'Insert',
    search: 'Search',
    remove: 'Delete',
    random: 'Insert random',
    buckets: 'Buckets',
    collision: 'Collision resolution',
    maxLoad: 'Max load factor',
    size: 'Keys',
    capacity: 'Capacity',
    load: 'Load factor',
    collisions: 'Collisions',
    log: 'Operation log',
    full: 'Table is full',
    rehashing: (a: number, b: number) =>
      `Load factor exceeded → resizing: ${a} → ${b} buckets, every key was rehashed.`,
    lines: {
      inserted: (k: string, h: number, i: number, home: number, c: boolean) =>
        `put("${k}") hash=${h} → bucket ${home}${c ? ` · collision, slot ${i}` : ''}`,
      exists: (k: string) => `put("${k}") already present`,
      found: (k: string, i: number, p: number) => `get("${k}") → bucket ${i} (${p} probes)`,
      'not-found': (k: string, p: number) => `get("${k}") not found (${p} probes)`,
      deleted: (k: string, i: number) => `delete("${k}") → bucket ${i} cleared`,
      notDeleted: (k: string) => `delete("${k}") not found`,
      rehash: (a: number, b: number) => `rehash ${a} → ${b}`,
    },
    hashOf: 'hash',
    empty: 'empty',
  },
};

interface LogItem {
  key: number;
  text: string;
  tone?: 'success' | 'danger' | 'muted';
}

export default function HashTableSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const groupId = useId();
  const [buckets, setBuckets] = useState(() => Math.round(numParam(params, 'buckets', 8, 4, 16)));
  const [mode, setMode] = useState<CollisionMode>(() =>
    strParam(params, 'collision', 'chaining', COLLISION_MODES),
  );
  const [maxLoad, setMaxLoad] = useState(() => numParam(params, 'loadFactor', 0.75, 0.5, 1));
  const [table, setTable] = useState<HashTable>(() => buildTable([], buckets, mode, maxLoad));
  const [trace, setTrace] = useState<OpTrace | null>(null);
  const [probeStep, setProbeStep] = useState(0);
  const [rehashNote, setRehashNote] = useState<{ from: number; to: number } | null>(null);
  const [input, setInput] = useState('');
  const [log, setLog] = useState<LogItem[]>([]);
  const seq = useRef(0);
  const sampleIdx = useRef(0);

  // Parametre değişince mevcut anahtarlarla tabloyu yeniden kur
  const rebuild = (cap: number, m: CollisionMode, lf: number) => {
    setTable((t) => buildTable(tableKeys(t), cap, m, lf));
    setTrace(null);
  };

  // Sondalama animasyonu: bakılan yuvalar sırayla yanar
  useEffect(() => {
    if (!trace) return;
    if (reduced) {
      setProbeStep(trace.probes.length);
      return;
    }
    setProbeStep(1);
    const id = setInterval(() => {
      setProbeStep((s) => {
        if (s >= trace.probes.length) {
          clearInterval(id);
          return s;
        }
        return s + 1;
      });
    }, PROBE_MS);
    return () => clearInterval(id);
  }, [trace, reduced]);

  useEffect(() => {
    if (!rehashNote) return;
    const id = setTimeout(() => setRehashNote(null), REHASH_MS);
    return () => clearTimeout(id);
  }, [rehashNote]);

  const push = (items: Omit<LogItem, 'key'>[]) =>
    setLog((prev) =>
      [...items.map((i) => ({ ...i, key: ++seq.current })).reverse(), ...prev].slice(0, 40),
    );

  const run = (op: 'insert' | 'search' | 'delete', raw: string) => {
    const key = raw.trim().slice(0, 16);
    if (!key) return;
    onInteract();
    if (op === 'insert') {
      if (!canInsert(table)) {
        push([{ text: l.full, tone: 'danger' }]);
        return;
      }
      const r = insertKey(table, key);
      const tr = r.trace;
      setTable(r.table);
      setTrace(tr);
      const items: Omit<LogItem, 'key'>[] = [
        tr.result === 'exists'
          ? { text: l.lines.exists(key), tone: 'muted' }
          : {
              text: l.lines.inserted(key, tr.hash, tr.index!, tr.home, tr.collision),
              tone: tr.collision ? 'danger' : 'success',
            },
      ];
      if (tr.resized) {
        items.push({ text: l.lines.rehash(tr.resized.from, tr.resized.to), tone: 'muted' });
        setRehashNote(tr.resized);
        setBuckets(Math.min(16, tr.resized.to));
      }
      push(items);
    } else if (op === 'search') {
      const tr = searchKey(table, key);
      setTrace(tr);
      push([
        tr.result === 'found'
          ? { text: l.lines.found(key, tr.index!, tr.probes.length), tone: 'success' }
          : { text: l.lines['not-found'](key, tr.probes.length), tone: 'danger' },
      ]);
    } else {
      const r = deleteKey(table, key);
      setTable(r.table);
      setTrace(r.trace);
      push([
        r.trace.result === 'deleted'
          ? { text: l.lines.deleted(key, r.trace.index!), tone: 'success' }
          : { text: l.lines.notDeleted(key), tone: 'danger' },
      ]);
    }
  };

  const insertRandom = () => {
    const existing = new Set(tableKeys(table));
    for (let k = 0; k < SAMPLE_KEYS.length; k++) {
      const cand = SAMPLE_KEYS[(sampleIdx.current + k) % SAMPLE_KEYS.length];
      if (!existing.has(cand)) {
        sampleIdx.current = (sampleIdx.current + k + 1) % SAMPLE_KEYS.length;
        run('insert', cand);
        return;
      }
    }
    run('insert', `k${seq.current + 1}`);
  };

  // Trace'in o anki görünen kısmı (tablo yeniden boyutlandıysa indeksler artık geçersiz)
  const traceValid = trace && !trace.resized;
  const shownProbes = traceValid ? trace.probes.slice(0, probeStep) : [];
  const probing = traceValid && probeStep < trace.probes.length;
  const finalIndex = traceValid && !probing ? trace.index : null;
  const resultTone =
    trace && (trace.result === 'not-found' || trace.result === 'exists') ? 'danger' : 'success';
  const lf = loadFactor(table);
  const transition = { duration: reduced ? 0 : 0.45 };

  const cellClass = (i: number) =>
    cn(
      'rounded-lg border transition-colors',
      finalIndex === i
        ? resultTone === 'success'
          ? 'border-success bg-success/15'
          : 'border-danger bg-danger/10'
        : shownProbes.includes(i)
          ? shownProbes[shownProbes.length - 1] === i && probing
            ? 'border-warning bg-warning/20'
            : 'border-warning/60 bg-warning/5'
          : 'border-border bg-bg/60',
    );

  const chip = (k: string) => (
    <motion.span
      key={k}
      layoutId={reduced ? undefined : `${groupId}-${k}`}
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={transition}
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs',
        trace?.key === k && trace.op !== 'delete'
          ? 'border-primary bg-primary/15 text-primary'
          : 'border-border bg-elevated text-fg',
      )}
      title={`${l.hashOf}(${k}) = ${hashString(k)}`}
    >
      {k}
    </motion.span>
  );

  return (
    <SimShell
      title={l.title}
      toolbar={
        <button type="button" className="btn-ghost" onClick={insertRandom}>
          <Dices size={14} /> {l.random}
        </button>
      }
      aside={
        <>
          <Range
            label={l.buckets}
            value={buckets}
            min={4}
            max={16}
            onChange={(v) => {
              onInteract();
              setBuckets(v);
              rebuild(v, mode, maxLoad);
            }}
          />
          <Select
            label={l.collision}
            value={mode}
            options={COLLISION_MODES.map((id) => ({ id, label: l.modes[id] }))}
            onChange={(v) => {
              onInteract();
              setMode(v);
              rebuild(table.capacity, v, maxLoad);
            }}
          />
          <Range
            label={l.maxLoad}
            value={maxLoad}
            min={0.5}
            max={1}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(v) => {
              onInteract();
              setMaxLoad(v);
              rebuild(table.capacity, mode, v);
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <Stat label={l.size} value={table.size} />
            <Stat label={l.capacity} value={table.capacity} />
            <Stat
              label={l.load}
              value={lf.toFixed(2)}
              tone={lf > maxLoad * 0.85 ? 'warning' : 'success'}
            />
            <Stat
              label={l.collisions}
              value={table.collisions}
              tone={table.collisions ? 'danger' : undefined}
            />
          </div>
          <div>
            <p className="label">{l.log}</p>
            <LogList items={log} />
          </div>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">{l.hint[mode]}</p>
      <form
        className="mb-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run('insert', input);
          setInput('');
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="label">{l.key}</span>
          <input
            className="input font-mono"
            value={input}
            maxLength={16}
            placeholder={l.placeholder}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <button type="submit" className="btn-primary" disabled={!input.trim()}>
          <Plus size={14} /> {l.insert}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!input.trim()}
          onClick={() => run('search', input)}
        >
          <Search size={14} /> {l.search}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!input.trim()}
          onClick={() => {
            run('delete', input);
            setInput('');
          }}
        >
          <Trash2 size={14} /> {l.remove}
        </button>
      </form>

      {trace && (
        <p className="mb-2 font-mono text-xs text-muted" aria-live="polite">
          {l.hashOf}(&quot;{trace.key}&quot;) = {trace.hash} mod{' '}
          {trace.resized ? trace.resized.from : table.capacity} ={' '}
          <span className="font-semibold text-fg">{trace.home}</span>
        </p>
      )}
      {rehashNote && (
        <motion.p
          role="status"
          initial={reduced ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-fg"
        >
          {l.rehashing(rehashNote.from, rehashNote.to)}
        </motion.p>
      )}

      <LayoutGroup id={groupId}>
        {table.mode === 'chaining' ? (
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {table.chains.map((chain, i) => (
              <li
                key={`${table.capacity}-${i}`}
                className={cn('flex items-center gap-2 p-1.5', cellClass(i))}
              >
                <span className="w-7 shrink-0 text-right font-mono text-xs text-muted">{i}</span>
                <span className="flex min-h-6 flex-wrap items-center gap-1">
                  {chain.length === 0 && <span className="text-xs text-muted">∅</span>}
                  {chain.map((k, idx) => (
                    <span key={k} className="inline-flex items-center gap-1">
                      {idx > 0 && <span className="text-xs text-muted">→</span>}
                      {chip(k)}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <ol className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
            {table.slots.map((s, i) => (
              <li
                key={`${table.capacity}-${i}`}
                className={cn(
                  'flex min-h-16 flex-col items-center justify-between p-1.5',
                  cellClass(i),
                )}
              >
                <span className="font-mono text-xs text-muted">{i}</span>
                {typeof s === 'string' ? (
                  chip(s)
                ) : s === null ? (
                  <span className="text-xs text-muted">∅</span>
                ) : (
                  <span className="text-xs text-muted" title="tombstone">
                    ⌫
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </LayoutGroup>
    </SimShell>
  );
}
