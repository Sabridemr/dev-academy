'use client';

import { useMemo, useState } from 'react';
import { FastForward, RotateCcw, StepForward } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Select, SimShell, Stat } from './ui';
import { strParam, type SimulatorProps } from './types';

type Level = 'read-uncommitted' | 'read-committed' | 'repeatable-read' | 'serializable';
type ScenarioId = 'dirty-read' | 'non-repeatable-read' | 'phantom' | 'lost-update' | 'deadlock';
type TxName = 'T1' | 'T2';

type Op =
  | { kind: 'read'; key: string }
  | { kind: 'count' }
  | { kind: 'update'; key: string; delta: number; fromRead?: boolean }
  | { kind: 'insert'; key: string; value: number }
  | { kind: 'commit' }
  | { kind: 'rollback' };

interface Step {
  tx: TxName;
  op: Op;
  sql: string;
}

const LEVELS: Level[] = ['read-uncommitted', 'read-committed', 'repeatable-read', 'serializable'];
const LEVEL_LABEL: Record<Level, string> = {
  'read-uncommitted': 'READ UNCOMMITTED',
  'read-committed': 'READ COMMITTED',
  'repeatable-read': 'REPEATABLE READ',
  serializable: 'SERIALIZABLE',
};
const SCENARIO_IDS: ScenarioId[] = ['dirty-read', 'non-repeatable-read', 'phantom', 'lost-update', 'deadlock'];
const INITIAL: Record<string, number> = { A: 500, B: 300 };

const SCENARIOS: Record<ScenarioId, Step[]> = {
  'dirty-read': [
    { tx: 'T1', op: { kind: 'update', key: 'A', delta: -100 }, sql: 'UPDATE acc SET bal = bal - 100 WHERE id = A' },
    { tx: 'T2', op: { kind: 'read', key: 'A' }, sql: 'SELECT bal FROM acc WHERE id = A' },
    { tx: 'T1', op: { kind: 'rollback' }, sql: 'ROLLBACK' },
    { tx: 'T2', op: { kind: 'read', key: 'A' }, sql: 'SELECT bal FROM acc WHERE id = A' },
    { tx: 'T2', op: { kind: 'commit' }, sql: 'COMMIT' },
  ],
  'non-repeatable-read': [
    { tx: 'T1', op: { kind: 'read', key: 'A' }, sql: 'SELECT bal FROM acc WHERE id = A' },
    { tx: 'T2', op: { kind: 'update', key: 'A', delta: -100 }, sql: 'UPDATE acc SET bal = bal - 100 WHERE id = A' },
    { tx: 'T2', op: { kind: 'commit' }, sql: 'COMMIT' },
    { tx: 'T1', op: { kind: 'read', key: 'A' }, sql: 'SELECT bal FROM acc WHERE id = A' },
    { tx: 'T1', op: { kind: 'commit' }, sql: 'COMMIT' },
  ],
  phantom: [
    { tx: 'T1', op: { kind: 'count' }, sql: 'SELECT COUNT(*) FROM acc WHERE bal >= 100' },
    { tx: 'T2', op: { kind: 'insert', key: 'C', value: 250 }, sql: "INSERT INTO acc VALUES ('C', 250)" },
    { tx: 'T2', op: { kind: 'commit' }, sql: 'COMMIT' },
    { tx: 'T1', op: { kind: 'count' }, sql: 'SELECT COUNT(*) FROM acc WHERE bal >= 100' },
    { tx: 'T1', op: { kind: 'commit' }, sql: 'COMMIT' },
  ],
  'lost-update': [
    { tx: 'T1', op: { kind: 'read', key: 'A' }, sql: 'SELECT bal FROM acc WHERE id = A' },
    { tx: 'T2', op: { kind: 'read', key: 'A' }, sql: 'SELECT bal FROM acc WHERE id = A' },
    { tx: 'T1', op: { kind: 'update', key: 'A', delta: -100, fromRead: true }, sql: 'UPDATE acc SET bal = :read - 100 WHERE id = A' },
    { tx: 'T1', op: { kind: 'commit' }, sql: 'COMMIT' },
    { tx: 'T2', op: { kind: 'update', key: 'A', delta: 50, fromRead: true }, sql: 'UPDATE acc SET bal = :read + 50 WHERE id = A' },
    { tx: 'T2', op: { kind: 'commit' }, sql: 'COMMIT' },
  ],
  deadlock: [
    { tx: 'T1', op: { kind: 'update', key: 'A', delta: -100 }, sql: 'UPDATE acc SET bal = bal - 100 WHERE id = A' },
    { tx: 'T2', op: { kind: 'update', key: 'B', delta: -50 }, sql: 'UPDATE acc SET bal = bal - 50 WHERE id = B' },
    { tx: 'T1', op: { kind: 'update', key: 'B', delta: 100 }, sql: 'UPDATE acc SET bal = bal + 100 WHERE id = B' },
    { tx: 'T2', op: { kind: 'update', key: 'A', delta: 50 }, sql: 'UPDATE acc SET bal = bal + 50 WHERE id = A' },
    { tx: 'T1', op: { kind: 'commit' }, sql: 'COMMIT' },
  ],
};

/** Beklenen anomali tablosu (SQL standardı; PostgreSQL farkları notta) */
const MATRIX: Record<Level, Record<Exclude<ScenarioId, 'deadlock'>, boolean>> = {
  'read-uncommitted': { 'dirty-read': true, 'non-repeatable-read': true, phantom: true, 'lost-update': true },
  'read-committed': { 'dirty-read': false, 'non-repeatable-read': true, phantom: true, 'lost-update': true },
  'repeatable-read': { 'dirty-read': false, 'non-repeatable-read': false, phantom: true, 'lost-update': false },
  serializable: { 'dirty-read': false, 'non-repeatable-read': false, phantom: false, 'lost-update': false },
};

interface Result {
  text: string;
  tone: 'ok' | 'warn' | 'error' | 'wait';
}

interface Tx {
  name: TxName;
  status: 'active' | 'committed' | 'aborted';
  writes: Record<string, number>;
  snapshot: Record<string, number> | null;
  snapVersions: Record<string, number> | null;
  readCache: Record<string, number>;
  seenVersion: Record<string, number>;
  lastRead: Record<string, number>;
  reads: { key: string; v: number }[];
  counts: number[];
  waiting: { stepIndex: number; op: Op } | null;
}

interface World {
  committed: Record<string, number>;
  versions: Record<string, number>;
  locks: Record<string, TxName>;
  txs: Record<TxName, Tx>;
  results: Result[];
  deadlock: boolean;
  serializationFailure: boolean;
}

function newTx(name: TxName): Tx {
  return { name, status: 'active', writes: {}, snapshot: null, snapVersions: null, readCache: {}, seenVersion: {}, lastRead: {}, reads: [], counts: [], waiting: null };
}

/**
 * Basit izolasyon motoru: senaryoyu baştan `upTo` adıma kadar oynatır (saf fonksiyon).
 * Yazmalar her seviyede satır kilidi alır; okumalar seviyeye göre görünürlük kuralı uygular.
 */
function replay(steps: Step[], level: Level, upTo: number, tr: boolean): World {
  const w: World = {
    committed: { ...INITIAL },
    versions: Object.fromEntries(Object.keys(INITIAL).map((k) => [k, 1])),
    locks: {},
    txs: { T1: newTx('T1'), T2: newTx('T2') },
    results: [],
    deadlock: false,
    serializationFailure: false,
  };
  const other = (n: TxName): TxName => (n === 'T1' ? 'T2' : 'T1');
  const msg = (trText: string, enText: string) => (tr ? trText : enText);

  const ensureSnapshot = (tx: Tx) => {
    if (level === 'serializable' && !tx.snapshot) {
      tx.snapshot = { ...w.committed };
      tx.snapVersions = { ...w.versions };
    }
  };

  const view = (tx: Tx, key: string): number | undefined => {
    if (key in tx.writes) return tx.writes[key];
    if (level === 'read-uncommitted') {
      const o = w.txs[other(tx.name)];
      if (o.status === 'active' && key in o.writes) return o.writes[key];
      return w.committed[key];
    }
    if (level === 'read-committed') return w.committed[key];
    if (level === 'repeatable-read') return key in tx.readCache ? tx.readCache[key] : w.committed[key];
    return tx.snapshot?.[key];
  };

  const countView = (tx: Tx): number => {
    let base: Record<string, number>;
    if (level === 'serializable') base = { ...(tx.snapshot ?? w.committed) };
    else base = { ...w.committed };
    if (level === 'read-uncommitted') {
      const o = w.txs[other(tx.name)];
      if (o.status === 'active') Object.assign(base, o.writes);
    }
    Object.assign(base, tx.writes);
    return Object.values(base).filter((v) => v >= 100).length;
  };

  const release = (tx: Tx) => {
    for (const k of Object.keys(w.locks)) if (w.locks[k] === tx.name) delete w.locks[k];
    // Bekleyen işlemi uyandır
    const o = w.txs[other(tx.name)];
    if (o.waiting && o.status === 'active') {
      const { stepIndex, op } = o.waiting;
      o.waiting = null;
      const r = exec(o, op, stepIndex);
      w.results[stepIndex] = { text: `${msg('(kilit açıldı) ', '(unblocked) ')}${r.text}`, tone: r.tone };
    }
  };

  const abort = (tx: Tx) => {
    tx.status = 'aborted';
    tx.writes = {};
    tx.waiting = null;
    release(tx);
  };

  function exec(tx: Tx, op: Op, stepIndex: number): Result {
    if (tx.status === 'aborted') return { text: msg('atlandı (işlem iptal edildi)', 'skipped (transaction aborted)'), tone: 'error' };
    if (tx.status === 'committed') return { text: msg('atlandı', 'skipped'), tone: 'error' };
    if (tx.waiting) return { text: msg('hâlâ kilit bekliyor', 'still waiting for lock'), tone: 'wait' };
    ensureSnapshot(tx);
    switch (op.kind) {
      case 'read': {
        const v = view(tx, op.key) ?? 0;
        if (level === 'repeatable-read' && !(op.key in tx.readCache)) {
          tx.readCache[op.key] = v;
          tx.seenVersion[op.key] = w.versions[op.key];
        }
        if (level === 'serializable' && tx.snapVersions) tx.seenVersion[op.key] = tx.snapVersions[op.key];
        tx.lastRead[op.key] = v;
        tx.reads.push({ key: op.key, v });
        const dirty = level === 'read-uncommitted' && v !== w.committed[op.key] && !(op.key in tx.writes);
        return { text: `→ ${v}${dirty ? msg(' (commit edilmemiş veri!)', ' (uncommitted data!)') : ''}`, tone: dirty ? 'warn' : 'ok' };
      }
      case 'count': {
        const c = countView(tx);
        tx.counts.push(c);
        return { text: `→ ${c}`, tone: 'ok' };
      }
      case 'insert': {
        tx.writes[op.key] = op.value;
        return { text: msg(`${op.key} eklendi (commit edilmedi)`, `${op.key} inserted (uncommitted)`), tone: 'ok' };
      }
      case 'update': {
        const holder = w.locks[op.key];
        if (holder && holder !== tx.name) {
          const h = w.txs[holder];
          // Kilitlenme tespiti: karşı işlem de bizim tuttuğumuz bir kilidi bekliyorsa döngü var
          if (h.waiting && h.waiting.op.kind === 'update' && w.locks[h.waiting.op.key] === tx.name) {
            w.deadlock = true;
            abort(tx);
            return { text: msg(`KİLİTLENME (deadlock) tespit edildi → ${tx.name} kurban seçildi ve geri alındı`, `DEADLOCK detected → ${tx.name} chosen as victim and rolled back`), tone: 'error' };
          }
          tx.waiting = { stepIndex, op };
          return { text: msg(`${op.key} kilidi ${holder}’de → bekliyor…`, `lock on ${op.key} held by ${holder} → waiting…`), tone: 'wait' };
        }
        // RR/SERIALIZABLE: okuduktan sonra başkası değiştirip commit ettiyse serileştirme hatası (first-updater-wins)
        if (level === 'repeatable-read' || level === 'serializable') {
          const seen = tx.seenVersion[op.key] ?? tx.snapVersions?.[op.key];
          if (seen !== undefined && w.versions[op.key] !== seen) {
            w.serializationFailure = true;
            abort(tx);
            return { text: msg('HATA: eşzamanlı güncelleme nedeniyle serileştirilemedi → geri alındı', 'ERROR: could not serialize access due to concurrent update → rolled back'), tone: 'error' };
          }
        }
        w.locks[op.key] = tx.name;
        const base = op.fromRead ? tx.lastRead[op.key] ?? view(tx, op.key) ?? 0 : (op.key in tx.writes ? tx.writes[op.key] : level === 'serializable' ? view(tx, op.key) : w.committed[op.key]) ?? 0;
        const nv = base + op.delta;
        tx.writes[op.key] = nv;
        return { text: `${op.key} = ${nv} ${msg('(kilit alındı)', '(lock acquired)')}`, tone: 'ok' };
      }
      case 'commit': {
        for (const [k, v] of Object.entries(tx.writes)) {
          w.committed[k] = v;
          w.versions[k] = (w.versions[k] ?? 0) + 1;
        }
        tx.status = 'committed';
        release(tx);
        return { text: 'COMMIT ✓', tone: 'ok' };
      }
      case 'rollback': {
        abort(tx);
        return { text: 'ROLLBACK ↺', tone: 'warn' };
      }
    }
  }

  for (let i = 0; i < Math.min(upTo, steps.length); i++) {
    const s = steps[i];
    w.results[i] = exec(w.txs[s.tx], s.op, i);
  }
  return w;
}

const L = {
  tr: {
    title: 'İzolasyon seviyeleri: iki işlem yan yana',
    level: 'İzolasyon seviyesi',
    scenario: 'Senaryo',
    scenarios: { 'dirty-read': 'Kirli okuma (dirty read)', 'non-repeatable-read': 'Tekrarlanamayan okuma', phantom: 'Hayalet satır (phantom)', 'lost-update': 'Kayıp güncelleme (banka transferi)', deadlock: 'Kilitlenme (deadlock)' } satisfies Record<ScenarioId, string>,
    next: 'Sonraki adım',
    all: 'Hepsini oynat',
    committed: 'Commit edilmiş veri',
    verdict: 'Sonuç',
    matrix: 'Beklenen anomaliler (SQL standardı)',
    pgNote: 'Not: PostgreSQL’de REPEATABLE READ anlık görüntü (snapshot) kullanır ve phantom’u da engeller; READ UNCOMMITTED aslında READ COMMITTED gibi davranır.',
    pending: 'Senaryoyu adım adım oynat.',
    anomaly: {
      'dirty-read': (yes: boolean) => (yes ? 'ANOMALİ: T2 hiç commit edilmemiş (sonra geri alınan) 400 değerini okudu.' : 'Kirli okuma yok: T2 yalnızca commit edilmiş veriyi gördü.'),
      'non-repeatable-read': (yes: boolean) => (yes ? 'ANOMALİ: T1 aynı satırı iki kez okudu ve farklı değerler gördü.' : 'Okumalar tekrarlanabilir: T1 iki kez aynı değeri gördü.'),
      phantom: (yes: boolean) => (yes ? 'ANOMALİ: Aynı COUNT sorgusu farklı satır sayısı döndürdü (hayalet satır).' : 'Phantom yok: T1 tutarlı bir anlık görüntü gördü.'),
      'lost-update': (yes: boolean) => (yes ? 'ANOMALİ: T1’in −100 güncellemesi kayboldu; bakiye 450 olmalıydı.' : 'Kayıp güncelleme önlendi: çakışan işlem geri alındı, uygulama yeniden denemeli.'),
      deadlock: (yes: boolean) => (yes ? 'Kilitlenme tespit edildi: veritabanı bir işlemi kurban seçip geri aldı; diğeri devam etti. Her seviyede olabilir — kilitleri hep aynı sırada alın.' : 'Henüz kilitlenme yok.'),
    },
  },
  en: {
    title: 'Isolation levels: two transactions side by side',
    level: 'Isolation level',
    scenario: 'Scenario',
    scenarios: { 'dirty-read': 'Dirty read', 'non-repeatable-read': 'Non-repeatable read', phantom: 'Phantom read', 'lost-update': 'Lost update (bank transfer)', deadlock: 'Deadlock' } satisfies Record<ScenarioId, string>,
    next: 'Next step',
    all: 'Play all',
    committed: 'Committed data',
    verdict: 'Verdict',
    matrix: 'Expected anomalies (SQL standard)',
    pgNote: 'Note: In PostgreSQL, REPEATABLE READ uses a snapshot and also prevents phantoms; READ UNCOMMITTED actually behaves like READ COMMITTED.',
    pending: 'Play the scenario step by step.',
    anomaly: {
      'dirty-read': (yes: boolean) => (yes ? 'ANOMALY: T2 read 400, a value that was never committed (later rolled back).' : 'No dirty read: T2 saw only committed data.'),
      'non-repeatable-read': (yes: boolean) => (yes ? 'ANOMALY: T1 read the same row twice and saw different values.' : 'Reads are repeatable: T1 saw the same value twice.'),
      phantom: (yes: boolean) => (yes ? 'ANOMALY: The same COUNT query returned a different number of rows (phantom).' : 'No phantom: T1 saw a consistent snapshot.'),
      'lost-update': (yes: boolean) => (yes ? 'ANOMALY: T1’s −100 update was lost; the balance should be 450.' : 'Lost update prevented: the conflicting transaction was rolled back; the app should retry.'),
      deadlock: (yes: boolean) => (yes ? 'Deadlock detected: the database picked a victim and rolled it back; the other continued. Possible at any level — always lock in the same order.' : 'No deadlock yet.'),
    },
  },
};

function mapScenarioParam(s: string): ScenarioId {
  if (s === 'bank-transfer') return 'lost-update';
  return (SCENARIO_IDS as string[]).includes(s) ? (s as ScenarioId) : 'dirty-read';
}

export default function IsolationLevelsSim({ params, onInteract }: SimulatorProps) {
  const { t, locale } = useI18n();
  const l = L[locale];
  const [level, setLevel] = useState<Level>(() => strParam(params, 'level', 'read-committed', LEVELS));
  const [scenario, setScenario] = useState<ScenarioId>(() => mapScenarioParam(strParam<string>(params, 'scenario', 'dirty-read')));
  const [cursor, setCursor] = useState(0);

  const steps = SCENARIOS[scenario];
  const world = useMemo(() => replay(steps, level, cursor, locale === 'tr'), [steps, level, cursor, locale]);
  const done = cursor >= steps.length;

  // Senaryo bitince anomali var mı?
  const anomaly = useMemo(() => {
    if (!done) return null;
    const { T1, T2 } = world.txs;
    switch (scenario) {
      case 'dirty-read':
        return T2.reads.length > 0 && T2.reads[0].v !== INITIAL.A;
      case 'non-repeatable-read':
        return T1.reads.length >= 2 && T1.reads[0].v !== T1.reads[1].v;
      case 'phantom':
        return T1.counts.length >= 2 && T1.counts[0] !== T1.counts[1];
      case 'lost-update':
        return T1.status === 'committed' && T2.status === 'committed' && world.committed.A !== INITIAL.A - 100 + 50;
      case 'deadlock':
        return world.deadlock;
    }
  }, [done, world, scenario]);

  const advance = () => {
    onInteract();
    setCursor((c) => Math.min(steps.length, c + 1));
  };

  const toneClass = (tone: Result['tone']) => (tone === 'error' ? 'text-danger' : tone === 'warn' ? 'text-warning' : tone === 'wait' ? 'text-accent' : 'text-success');
  const txStatus = (tx: Tx) => (tx.status === 'aborted' ? 'aborted' : tx.status === 'committed' ? 'committed' : tx.waiting ? 'waiting' : 'active');

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button type="button" className="btn-primary" onClick={advance} disabled={done}>
            <StepForward size={14} /> {l.next}
          </button>
          <button type="button" className="btn-ghost" onClick={() => { onInteract(); setCursor(steps.length); }} disabled={done}>
            <FastForward size={14} /> {l.all}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setCursor(0)}>
            <RotateCcw size={14} /> {t('sim.reset')}
          </button>
        </>
      }
      aside={
        <>
          <Select label={l.level} value={level} options={LEVELS.map((v) => ({ id: v, label: LEVEL_LABEL[v] }))} onChange={(v) => { onInteract(); setLevel(v); setCursor(0); }} />
          <Select label={l.scenario} value={scenario} options={SCENARIO_IDS.map((v) => ({ id: v, label: l.scenarios[v] }))} onChange={(v) => { onInteract(); setScenario(v); setCursor(0); }} />
          <div>
            <p className="label">{l.committed}</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(world.committed).map(([k, v]) => (
                <Stat key={k} label={k} value={v} />
              ))}
            </div>
          </div>
          <div>
            <p className="label">{l.matrix}</p>
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-muted">
                  <th />
                  <th className="px-0.5">Dirty</th>
                  <th className="px-0.5">Non-rep.</th>
                  <th className="px-0.5">Phantom</th>
                  <th className="px-0.5">Lost</th>
                </tr>
              </thead>
              <tbody>
                {LEVELS.map((lv) => (
                  <tr key={lv} className={lv === level ? 'bg-primary/10 font-semibold' : ''}>
                    <td className="py-0.5 pr-1">{LEVEL_LABEL[lv].replace('READ ', 'R. ')}</td>
                    {(['dirty-read', 'non-repeatable-read', 'phantom', 'lost-update'] as const).map((sc) => (
                      <td key={sc} className={`text-center ${MATRIX[lv][sc] ? 'text-danger' : 'text-success'} ${sc === scenario && lv === level ? 'underline' : ''}`}>
                        {MATRIX[lv][sc] ? '✗' : '✓'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[10px] text-muted">{l.pgNote}</p>
          </div>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {(['T1', 'T2'] as const).map((name) => {
          const tx = world.txs[name];
          const st = txStatus(tx);
          return (
            <div key={name} className="flex items-center justify-between rounded-xl border border-border bg-elevated/40 px-3 py-2">
              <span className="font-semibold">{name}</span>
              <span className={`chip ${st === 'aborted' ? 'text-danger' : st === 'committed' ? 'text-success' : st === 'waiting' ? 'text-accent' : ''}`}>{st}</span>
            </div>
          );
        })}
      </div>
      <ol className="mt-3 space-y-1.5" aria-live="polite">
        {steps.map((s, i) => {
          const r = world.results[i];
          const isNext = i === cursor;
          return (
            <li key={i} className={`grid grid-cols-2 gap-2 rounded-xl border p-2 text-xs transition ${isNext ? 'border-primary bg-primary/5' : 'border-transparent'} ${i > cursor ? 'opacity-50' : ''}`}>
              {(['T1', 'T2'] as const).map((name) => (
                <div key={name} className="min-w-0">
                  {s.tx === name ? (
                    <>
                      <p className="break-words font-mono">
                        <span className="text-muted">{i + 1}.</span> {s.sql}
                      </p>
                      {r && <p className={`mt-0.5 font-medium ${toneClass(r.tone)}`}>{r.text}</p>}
                    </>
                  ) : (
                    <span className="block h-full border-l-2 border-dashed border-border" aria-hidden />
                  )}
                </div>
              ))}
            </li>
          );
        })}
      </ol>
      <div className="mt-3 rounded-xl border border-border p-3 text-sm" role="status">
        <p className="label">{l.verdict}</p>
        {anomaly === null ? (
          <p className="text-muted">{l.pending}</p>
        ) : (
          <p className={anomaly && scenario !== 'deadlock' ? 'text-danger' : anomaly ? 'text-warning' : 'text-success'}>{l.anomaly[scenario](anomaly)}</p>
        )}
      </div>
    </SimShell>
  );
}
