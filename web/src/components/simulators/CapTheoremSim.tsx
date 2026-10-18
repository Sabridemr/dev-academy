'use client';

import { useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, PenLine, RotateCcw, Unplug } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { LogList, Range, SimShell, Stat } from './ui';
import { boolParam, numParam, strParam, type SimulatorProps } from './types';

type Mode = 'cp' | 'ap';

interface Replica {
  id: number;
  value: string;
  version: number;
  /** Bu değeri yazan taraf (AP çakışmalarını göstermek için) */
  writtenAt: number;
}

interface LogItem {
  id: number;
  text: string;
  tone: 'success' | 'danger' | 'muted';
}

const L = {
  tr: {
    title: 'CAP teoremi: bölünme anında tutarlılık mı, erişilebilirlik mi?',
    partition: 'Ağ bölünmesi (partition)',
    heal: 'Bölünmeyi onar',
    split: 'Ağı böl',
    mode: 'Mod',
    cp: 'CP — tutarlılık öncelikli',
    ap: 'AP — erişilebilirlik öncelikli',
    replicas: 'Replika sayısı',
    quorum: 'Çoğunluk (quorum)',
    write: 'Yaz',
    read: 'Oku',
    ok: 'Başarılı',
    stale: 'Bayat',
    errors: 'Hata',
    latest: 'En güncel sürüm',
    sideA: 'Taraf A',
    sideB: 'Taraf B',
    explainCp: 'CP: Bir düğüm çoğunluğa ulaşamıyorsa yazma ve okumayı REDDEDER. Veri hiç bayat dönmez ama azınlık tarafı erişilemez olur.',
    explainAp: 'AP: Her düğüm bölünmede de yanıt verir. Yazmalar yerelde kabul edilir; diğer taraf BAYAT veri okuyabilir. Onarımda çakışmalar (ör. last-write-wins) çözülür.',
    explainNoPartition: 'Bölünme yokken (P yok) sistem hem tutarlı hem erişilebilir olabilir: yazma tüm replikalara yayılır.',
    logWriteOk: (n: number, v: string, k: number) => `N${n}'e yazma "${v}" → ${k} replikaya yayıldı`,
    logWriteErr: (n: number, k: number, q: number) => `N${n}'e yazma REDDEDİLDİ: yalnızca ${k} düğüme ulaşılıyor, quorum ${q}`,
    logReadOk: (n: number, v: string, ver: number) => `N${n}'den okuma → "${v}" (v${ver}) güncel`,
    logReadStale: (n: number, v: string, ver: number, latest: number) => `N${n}'den okuma → "${v}" (v${ver}) BAYAT! en güncel v${latest}`,
    logReadErr: (n: number) => `N${n}'den okuma REDDEDİLDİ: quorum yok (CP erişilebilirlikten ödün verdi)`,
    logHeal: (c: number) => `Bölünme onarıldı, replikalar eşitlendi${c ? ` · ${c} çakışma last-write-wins ile çözüldü` : ''}`,
  },
  en: {
    title: 'CAP theorem: consistency or availability during a partition?',
    partition: 'Network partition',
    heal: 'Heal partition',
    split: 'Partition network',
    mode: 'Mode',
    cp: 'CP — consistency first',
    ap: 'AP — availability first',
    replicas: 'Replicas',
    quorum: 'Majority (quorum)',
    write: 'Write',
    read: 'Read',
    ok: 'Success',
    stale: 'Stale',
    errors: 'Error',
    latest: 'Latest version',
    sideA: 'Side A',
    sideB: 'Side B',
    explainCp: 'CP: If a node cannot reach a majority it REJECTS reads and writes. Data is never stale, but the minority side becomes unavailable.',
    explainAp: 'AP: Every node keeps answering during the partition. Writes are accepted locally; the other side may read STALE data. Conflicts are resolved on heal (e.g. last-write-wins).',
    explainNoPartition: 'Without a partition (no P) the system can be both consistent and available: writes propagate to every replica.',
    logWriteOk: (n: number, v: string, k: number) => `Write "${v}" to N${n} → propagated to ${k} replicas`,
    logWriteErr: (n: number, k: number, q: number) => `Write to N${n} REJECTED: only ${k} nodes reachable, quorum ${q}`,
    logReadOk: (n: number, v: string, ver: number) => `Read from N${n} → "${v}" (v${ver}) fresh`,
    logReadStale: (n: number, v: string, ver: number, latest: number) => `Read from N${n} → "${v}" (v${ver}) STALE! latest is v${latest}`,
    logReadErr: (n: number) => `Read from N${n} REJECTED: no quorum (CP gave up availability)`,
    logHeal: (c: number) => `Partition healed, replicas synced${c ? ` · ${c} conflict resolved by last-write-wins` : ''}`,
  },
};

const VALUES = ['🍎', '🍌', '🍒', '🍇', '🍋', '🥝', '🍑', '🍐'];

function makeReplicas(n: number): Replica[] {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, value: '🍎', version: 1, writtenAt: 0 }));
}

export default function CapTheoremSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const initialN = numParam(params, 'replicas', numParam(params, 'nodes', 3, 2, 5), 2, 5);
  const consistency = strParam(params, 'consistency', '');
  const [mode, setMode] = useState<Mode>(() => strParam(params, 'mode', consistency === 'eventual' ? 'ap' : 'cp', ['cp', 'ap'] as const));
  const [replicas, setReplicas] = useState<Replica[]>(() => makeReplicas(initialN));
  const [partition, setPartition] = useState(() => boolParam(params, 'partition', false));
  const [log, setLog] = useState<LogItem[]>([]);
  const [counts, setCounts] = useState({ ok: 0, stale: 0, error: 0 });
  const [pulse, setPulse] = useState<{ from: number; to: number[]; id: number } | null>(null);
  const seq = useRef(0);
  const radioName = useId();
  const valueIdx = useRef(1);
  const clock = useRef(1);

  const n = replicas.length;
  const quorum = Math.floor(n / 2) + 1;
  // Bölünme: N1 (ve 5 düğümde N2) azınlık tarafında kalır
  const minoritySize = Math.max(1, Math.floor((n - 1) / 2));
  const sideOf = (id: number) => (partition && id <= minoritySize ? 'A' : 'B');
  const reachable = (id: number) => replicas.filter((r) => !partition || sideOf(r.id) === sideOf(id));
  const latestVersion = Math.max(...replicas.map((r) => r.version));

  const push = (text: string, tone: LogItem['tone']) => setLog((lg) => [...lg, { id: ++seq.current, text, tone }].slice(-30));

  const write = (id: number) => {
    onInteract();
    const reach = reachable(id);
    if (mode === 'cp' && reach.length < quorum) {
      push(l.logWriteErr(id, reach.length, quorum), 'danger');
      setCounts((c) => ({ ...c, error: c.error + 1 }));
      return;
    }
    const value = VALUES[valueIdx.current++ % VALUES.length];
    const version = latestVersion + 1;
    const at = ++clock.current;
    const ids = new Set(reach.map((r) => r.id));
    setReplicas((rs) => rs.map((r) => (ids.has(r.id) ? { ...r, value, version: Math.max(version, r.version + 1), writtenAt: at } : r)));
    setPulse({ from: id, to: [...ids].filter((x) => x !== id), id: seq.current + 1 });
    push(l.logWriteOk(id, value, ids.size), 'success');
    setCounts((c) => ({ ...c, ok: c.ok + 1 }));
  };

  const read = (id: number) => {
    onInteract();
    const reach = reachable(id);
    if (mode === 'cp') {
      if (reach.length < quorum) {
        push(l.logReadErr(id), 'danger');
        setCounts((c) => ({ ...c, error: c.error + 1 }));
        return;
      }
      // Quorum okuma: ulaşılabilen çoğunluk içindeki en yüksek sürüm
      const best = reach.reduce((a, b) => (b.version > a.version ? b : a));
      push(l.logReadOk(id, best.value, best.version), 'success');
      setCounts((c) => ({ ...c, ok: c.ok + 1 }));
      return;
    }
    const local = replicas.find((r) => r.id === id)!;
    if (local.version < latestVersion) {
      push(l.logReadStale(id, local.value, local.version, latestVersion), 'danger');
      setCounts((c) => ({ ...c, stale: c.stale + 1 }));
    } else {
      push(l.logReadOk(id, local.value, local.version), 'success');
      setCounts((c) => ({ ...c, ok: c.ok + 1 }));
    }
  };

  const togglePartition = () => {
    onInteract();
    if (partition) {
      // Onarım: en son yazılan (LWW) kazanır; iki tarafta farklı yazma varsa çakışma sayılır
      const winner = replicas.reduce((a, b) => (b.writtenAt > a.writtenAt ? b : a));
      const sideVersions = new Set(replicas.filter((r) => r.writtenAt > 0).map((r) => `${sideOf(r.id)}:${r.writtenAt}`));
      const sidesWithWrites = new Set([...sideVersions].map((s) => s.split(':')[0]));
      const conflicts = mode === 'ap' && sidesWithWrites.size > 1 ? 1 : 0;
      const top = Math.max(...replicas.map((r) => r.version));
      setReplicas((rs) => rs.map((r) => ({ ...r, value: winner.value, version: top, writtenAt: winner.writtenAt })));
      push(l.logHeal(conflicts), 'muted');
    }
    setPartition((p) => !p);
  };

  const reset = () => {
    setReplicas(makeReplicas(n));
    setLog([]);
    setCounts({ ok: 0, stale: 0, error: 0 });
    setPartition(false);
  };

  // Düğüm yerleşimi: daire üzerinde
  const pos = (i: number) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2 - (n === 2 ? Math.PI / 2 : 0);
    return { x: 300 + Math.cos(a) * 170, y: 165 + Math.sin(a) * 100 };
  };

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button type="button" className={partition ? 'btn-primary' : 'btn-ghost'} aria-pressed={partition} onClick={togglePartition}>
            <Unplug size={14} /> {partition ? l.heal : l.split}
          </button>
          <button type="button" className="btn-ghost" onClick={reset}>
            <RotateCcw size={14} /> {locale === 'tr' ? 'Sıfırla' : 'Reset'}
          </button>
        </>
      }
      aside={
        <>
          <div role="radiogroup" aria-label={l.mode} className="space-y-1">
            <p className="label">{l.mode}</p>
            {(['cp', 'ap'] as const).map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <input type="radio" name={radioName} checked={mode === m} onChange={() => { onInteract(); setMode(m); }} />
                {m === 'cp' ? l.cp : l.ap}
              </label>
            ))}
          </div>
          <Range label={l.replicas} value={n} min={2} max={5} onChange={(v) => { onInteract(); setReplicas(makeReplicas(v)); setPartition(false); }} />
          <div className="grid grid-cols-3 gap-2">
            <Stat label={l.ok} value={counts.ok} tone="success" />
            <Stat label={l.stale} value={counts.stale} tone={counts.stale ? 'warning' : undefined} />
            <Stat label={l.errors} value={counts.error} tone={counts.error ? 'danger' : undefined} />
          </div>
          <p className="text-xs text-muted">{l.quorum}: {quorum}/{n} · {l.latest}: v{latestVersion}</p>
          <LogList items={log.slice().reverse().map((x) => ({ key: x.id, text: x.text, tone: x.tone }))} />
        </>
      }
    >
      <svg viewBox="0 -14 600 344" className="h-auto w-full" role="img" aria-label={l.title}>
        {/* Bağlantılar */}
        {replicas.map((a, i) =>
          replicas.slice(i + 1).map((b, jj) => {
            const j = i + 1 + jj;
            const cut = partition && sideOf(a.id) !== sideOf(b.id);
            const pa = pos(i);
            const pb = pos(j);
            return <line key={`${a.id}-${b.id}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={cut ? 'var(--da-danger)' : 'var(--da-border)'} strokeWidth={cut ? 1.5 : 2} strokeDasharray={cut ? '6 6' : undefined} opacity={cut ? 0.6 : 1} />;
          }),
        )}
        {/* Bölünme: azınlık tarafındaki düğümler kesikli çerçeveyle ayrılır */}
        {partition &&
          replicas.map((r, i) => {
            if (sideOf(r.id) !== 'A') return null;
            const p = pos(i);
            return (
              <g key={`side-${r.id}`}>
                <rect x={p.x - 80} y={p.y - 56} width={160} height={112} rx={18} fill="none" stroke="var(--da-danger)" strokeWidth={2.5} strokeDasharray="10 6" />
                <text x={p.x} y={p.y - 62} textAnchor="middle" fontSize={11} fill="var(--da-danger)">{l.sideA}</text>
              </g>
            );
          })}
        {/* Yayılım animasyonu */}
        {pulse &&
          !reduced &&
          pulse.to.map((tid) => {
            const from = pos(replicas.findIndex((r) => r.id === pulse.from));
            const to = pos(replicas.findIndex((r) => r.id === tid));
            return (
              <motion.circle key={`${pulse.id}-${tid}`} r={6} fill="var(--da-accent)" initial={{ cx: from.x, cy: from.y, opacity: 1 }} animate={{ cx: to.x, cy: to.y, opacity: 0 }} transition={{ duration: 0.7 }} />
            );
          })}
        {replicas.map((r, i) => {
          const p = pos(i);
          const stale = r.version < latestVersion;
          const unavailable = mode === 'cp' && reachable(r.id).length < quorum;
          return (
            <g key={r.id}>
              <rect x={p.x - 62} y={p.y - 40} width={124} height={80} rx={12} fill={unavailable ? 'color-mix(in srgb, var(--da-danger) 12%, var(--da-surface))' : 'var(--da-surface)'} stroke={unavailable ? 'var(--da-danger)' : stale ? 'var(--da-warning)' : 'var(--da-success)'} strokeWidth={2} />
              <text x={p.x - 50} y={p.y - 20} fontSize={12} fontWeight={600} fill="var(--da-fg)">N{r.id}</text>
              <text x={p.x + 50} y={p.y - 20} textAnchor="end" fontSize={10} fill={stale ? 'var(--da-warning)' : 'var(--da-muted)'}>v{r.version}{stale ? ' ⚠' : ''}</text>
              <text x={p.x} y={p.y + 6} textAnchor="middle" fontSize={22}>{r.value}</text>
              <foreignObject x={p.x - 58} y={p.y + 14} width={116} height={24}>
                <div className="flex justify-center gap-1">
                  <button type="button" className="inline-flex items-center gap-1 rounded-md bg-primary px-1.5 py-0.5 text-[10px] text-white" aria-label={`${l.write} N${r.id}`} onClick={() => write(r.id)}>
                    <PenLine size={10} /> {l.write}
                  </button>
                  <button type="button" className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px]" aria-label={`${l.read} N${r.id}`} onClick={() => read(r.id)}>
                    <BookOpen size={10} /> {l.read}
                  </button>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 rounded-xl border border-border bg-elevated/40 p-3 text-sm" aria-live="polite">
        {!partition ? l.explainNoPartition : mode === 'cp' ? l.explainCp : l.explainAp}
      </p>
    </SimShell>
  );
}
