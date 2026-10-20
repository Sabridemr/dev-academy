'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Send } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { Range, Select, SimShell } from './ui';
import { boolParam, numParam, strParam, type SimulatorProps } from './types';

type Mode = 'write' | 'read' | 'hybrid';
const DOTS = 48;
const WRITES_PER_SEC = 200_000; // fan-out işçilerinin toplam timeline yazma hızı

const L = {
  tr: {
    title: 'Fan-out: yazarken mi, okurken mi?',
    mode: 'Strateji',
    modes: {
      write: 'Fan-out on write (push)',
      read: 'Fan-out on read (pull)',
      hybrid: 'Hibrit (ünlüler pull)',
    } satisfies Record<Mode, string>,
    followers: 'Gönderi sahibinin takipçi sayısı',
    following: 'Okuyucunun takip ettiği hesap',
    celebs: 'Okuyucunun takip ettiği ünlü',
    celebrity: 'Ünlü hesap (çok takipçi)',
    threshold: 'Ünlü eşiği',
    post: 'Gönderi paylaş',
    read: 'Akışı oku',
    writeAmp: 'Yazma çoğaltma (timeline yazımı)',
    propagation: 'Yayılma süresi',
    readLat: 'Okuma gecikmesi',
    readFetches: 'Okuma başına sorgu',
    cacheWrites: 'Timeline cache yazımları',
    compare: 'Strateji karşılaştırması',
    best: 'önerilen',
    note: 'Push: okuma çok hızlı ama ünlü bir hesap milyonlarca yazıma yol açar. Pull: yazma ucuz ama her okuma birçok kaynağı birleştirir. Hibrit (Twitter/X): sıradan hesaplar push, ünlüler okuma anında pull.',
    poster: 'Yazar',
    reader: 'Okuyucu',
  },
  en: {
    title: 'Fan-out: on write or on read?',
    mode: 'Strategy',
    modes: {
      write: 'Fan-out on write (push)',
      read: 'Fan-out on read (pull)',
      hybrid: 'Hybrid (celebrities pull)',
    } satisfies Record<Mode, string>,
    followers: 'Poster follower count',
    following: 'Accounts the reader follows',
    celebs: 'Celebrities the reader follows',
    celebrity: 'Celebrity account (huge following)',
    threshold: 'Celebrity threshold',
    post: 'Publish post',
    read: 'Read feed',
    writeAmp: 'Write amplification (timeline writes)',
    propagation: 'Propagation time',
    readLat: 'Read latency',
    readFetches: 'Queries per read',
    cacheWrites: 'Timeline cache writes',
    compare: 'Strategy comparison',
    best: 'recommended',
    note: 'Push: reads are very fast, but a celebrity triggers millions of writes. Pull: writes are cheap, but every read merges many sources. Hybrid (Twitter/X): regular accounts push, celebrities are pulled at read time.',
    poster: 'Poster',
    reader: 'Reader',
  },
};

interface Metrics {
  writeAmp: number;
  propagationSec: number;
  readMs: number;
  fetches: number;
}

/** Strateji başına maliyet modeli */
function metrics(
  mode: Mode,
  followers: number,
  following: number,
  celebsFollowed: number,
  threshold: number,
): Metrics {
  const isCeleb = followers >= threshold;
  if (mode === 'write')
    return {
      writeAmp: followers,
      propagationSec: followers / WRITES_PER_SEC,
      readMs: 5,
      fetches: 1,
    };
  if (mode === 'read')
    return { writeAmp: 1, propagationSec: 0, readMs: 4 + following * 0.35, fetches: following };
  const amp = isCeleb ? 1 : followers;
  return {
    writeAmp: amp,
    propagationSec: amp / WRITES_PER_SEC,
    readMs: 5 + celebsFollowed * 2.5,
    fetches: 1 + celebsFollowed,
  };
}

export default function FanOutSim({ params, onInteract }: SimulatorProps) {
  const { t, locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const initialMode = strParam<string>(params, 'mode', 'hybrid');
  const [mode, setMode] = useState<Mode>(
    initialMode === 'push' || initialMode === 'write'
      ? 'write'
      : initialMode === 'pull' || initialMode === 'read'
        ? 'read'
        : 'hybrid',
  );
  const avgFollowers = numParam(params, 'avgFollowers', 150, 1, 1e7);
  const celebFollowers = Math.max(
    numParam(params, 'celebrityFollowers', 5_000_000, 1000, 1e8),
    1000,
  );
  const [threshold, setThreshold] = useState(() =>
    numParam(params, 'celebrityThreshold', 10_000, 100, 1e7),
  );
  const [celebrity, setCelebrity] = useState(() => boolParam(params, 'celebrity', false));
  const [followersExp, setFollowersExp] = useState(() => Math.log10(avgFollowers));
  const [following, setFollowing] = useState(200);
  const [celebsFollowed, setCelebsFollowed] = useState(() =>
    numParam(params, 'celebrities', 5, 0, 50),
  );
  const [anim, setAnim] = useState<{ kind: 'post' | 'read'; id: number } | null>(null);
  const [cacheWrites, setCacheWrites] = useState(0);
  const seq = useRef(0);
  const raf = useRef(0);

  const followers = celebrity ? celebFollowers : Math.round(Math.pow(10, followersExp));
  const m = metrics(mode, followers, following, celebsFollowed, threshold);
  const all = (['write', 'read', 'hybrid'] as const).map((md) => ({
    md,
    m: metrics(md, followers, following, celebsFollowed, threshold),
  }));
  // Basit puan: okuma gecikmesi (×100) + yayılma süresi (sn ×1000) — düşük olan iyidir
  const best = all.reduce((a, b) =>
    b.m.readMs * 100 + b.m.propagationSec * 1000 < a.m.readMs * 100 + a.m.propagationSec * 1000
      ? b
      : a,
  ).md;

  // Timeline yazım sayacını animasyonlu artır
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const post = () => {
    onInteract();
    setAnim({ kind: 'post', id: ++seq.current });
    cancelAnimationFrame(raf.current);
    const startVal = cacheWrites;
    const target = startVal + m.writeAmp;
    if (reduced) {
      setCacheWrites(target);
      return;
    }
    const t0 = performance.now();
    const dur = Math.min(2000, 300 + m.propagationSec * 400);
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      setCacheWrites(Math.round(startVal + (target - startVal) * p));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  const read = () => {
    onInteract();
    setAnim({ kind: 'read', id: ++seq.current });
  };

  const fmt = (n: number) =>
    n >= 1e6
      ? `${(n / 1e6).toFixed(1)}M`
      : n >= 1e3
        ? `${(n / 1e3).toFixed(1)}K`
        : `${Math.round(n)}`;
  const fmtSec = (s: number) =>
    s < 0.001 ? '≈0' : s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(1)} s`;
  const isCeleb = followers >= threshold;
  const pushes = mode === 'write' || (mode === 'hybrid' && !isCeleb);

  // Takipçi noktaları (temsilî örnek)
  const dot = (i: number) => {
    const ring = i % 2;
    const a = (i / DOTS) * Math.PI * 2;
    const r = 70 + ring * 34;
    return { x: 170 + Math.cos(a) * r, y: 140 + Math.sin(a) * r };
  };

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button type="button" className="btn-primary" onClick={post}>
            <Send size={14} /> {l.post}
          </button>
          <button type="button" className="btn-ghost" onClick={read}>
            <BookOpen size={14} /> {l.read}
          </button>
        </>
      }
      aside={
        <>
          <Select
            label={l.mode}
            value={mode}
            options={(['write', 'read', 'hybrid'] as const).map((md) => ({
              id: md,
              label: l.modes[md],
            }))}
            onChange={(v) => {
              onInteract();
              setMode(v);
            }}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={celebrity}
              onChange={(e) => {
                onInteract();
                setCelebrity(e.target.checked);
              }}
            />{' '}
            {l.celebrity} ({fmt(celebFollowers)})
          </label>
          {!celebrity && (
            <Range
              label={l.followers}
              value={followersExp}
              min={0}
              max={7}
              step={0.1}
              format={(v) => fmt(Math.pow(10, v))}
              onChange={(v) => {
                onInteract();
                setFollowersExp(v);
              }}
            />
          )}
          <Range
            label={l.following}
            value={following}
            min={10}
            max={2000}
            step={10}
            onChange={(v) => {
              onInteract();
              setFollowing(v);
            }}
          />
          {mode === 'hybrid' && (
            <>
              <Range
                label={l.celebs}
                value={celebsFollowed}
                min={0}
                max={50}
                onChange={(v) => {
                  onInteract();
                  setCelebsFollowed(v);
                }}
              />
              <Range
                label={l.threshold}
                value={Math.log10(threshold)}
                min={2}
                max={7}
                step={0.5}
                format={(v) => fmt(Math.pow(10, v))}
                onChange={(v) => {
                  onInteract();
                  setThreshold(Math.round(Math.pow(10, v)));
                }}
              />
            </>
          )}
          <p className="text-xs text-muted">{l.note}</p>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <svg viewBox="0 0 340 290" className="h-auto w-full" role="img" aria-label={l.modes[mode]}>
          {/* Yazar merkezde */}
          <circle
            cx={170}
            cy={140}
            r={26}
            fill="color-mix(in srgb, var(--da-accent) 20%, var(--da-surface))"
            stroke="var(--da-accent)"
            strokeWidth={2}
          />
          <text
            x={170}
            y={137}
            textAnchor="middle"
            fontSize={10}
            fontWeight={600}
            fill="var(--da-fg)"
          >
            {l.poster}
          </text>
          <text x={170} y={150} textAnchor="middle" fontSize={9} fill="var(--da-muted)">
            {fmt(followers)}
          </text>
          {Array.from({ length: DOTS }, (_, i) => {
            const p = dot(i);
            const lit = anim?.kind === 'post' && pushes;
            const isReader = i === 0;
            return (
              <g key={i}>
                {lit && !reduced && (
                  <motion.line
                    key={`l-${anim.id}`}
                    x1={170}
                    y1={140}
                    x2={p.x}
                    y2={p.y}
                    stroke="var(--da-primary)"
                    strokeWidth={0.8}
                    initial={{ pathLength: 0, opacity: 0.8 }}
                    animate={{ pathLength: 1, opacity: 0 }}
                    transition={{
                      duration: 0.6,
                      delay: (i / DOTS) * Math.min(1.5, 0.2 + m.propagationSec),
                    }}
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isReader ? 7 : 4.5}
                  fill={
                    lit
                      ? 'var(--da-primary)'
                      : isReader
                        ? 'var(--da-success)'
                        : 'var(--da-elevated)'
                  }
                  stroke="var(--da-border)"
                  style={{
                    transition: reduced ? 'none' : 'fill 0.3s',
                    transitionDelay: reduced
                      ? '0s'
                      : `${(i / DOTS) * Math.min(1.5, 0.2 + m.propagationSec)}s`,
                  }}
                />
              </g>
            );
          })}
          <text x={dot(0).x + 10} y={dot(0).y + 4} fontSize={10} fill="var(--da-success)">
            {l.reader}
          </text>
          {/* Okuma: pull modunda okuyucu birçok kaynaktan çeker */}
          {anim?.kind === 'read' &&
            !reduced &&
            Array.from({ length: Math.min(12, m.fetches) }, (_, k) => {
              const src = { x: 20 + (k % 6) * 60, y: k < 6 ? 14 : 276 };
              const r0 = dot(0);
              return (
                <motion.circle
                  key={`${anim.id}-${k}`}
                  r={3.5}
                  fill="var(--da-accent)"
                  initial={{ cx: src.x, cy: src.y, opacity: 1 }}
                  animate={{ cx: r0.x, cy: r0.y, opacity: 0.2 }}
                  transition={{ duration: 0.4 + m.readMs / 400, delay: k * 0.05 }}
                />
              );
            })}
          {anim?.kind === 'post' && !pushes && (
            <text x={170} y={186} textAnchor="middle" fontSize={10} fill="var(--da-muted)">
              {locale === 'tr'
                ? 'push yok — okuma anında çekilecek'
                : 'no push — pulled at read time'}
            </text>
          )}
        </svg>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2" aria-live="polite">
            {[
              {
                label: l.writeAmp,
                v: fmt(m.writeAmp),
                tone: m.writeAmp > 1e5 ? 'text-danger' : '',
              },
              {
                label: l.propagation,
                v: fmtSec(m.propagationSec),
                tone: m.propagationSec > 5 ? 'text-danger' : '',
              },
              {
                label: l.readLat,
                v: `${m.readMs.toFixed(0)} ms`,
                tone: m.readMs > 100 ? 'text-danger' : 'text-success',
              },
              { label: l.readFetches, v: fmt(m.fetches), tone: '' },
              { label: l.cacheWrites, v: fmt(cacheWrites), tone: 'text-primary' },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-border bg-elevated/50 px-3 py-2"
              >
                <p className="text-xs uppercase tracking-wide text-muted">{s.label}</p>
                <p className={`text-lg font-semibold tabular-nums ${s.tone}`}>{s.v}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="label">{l.compare}</p>
            <table className="w-full text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="text-left font-normal" />
                  <th className="text-right font-normal">{l.writeAmp.split(' (')[0]}</th>
                  <th className="text-right font-normal">{l.readLat}</th>
                </tr>
              </thead>
              <tbody>
                {all.map(({ md, m: mm }) => (
                  <tr key={md} className={md === mode ? 'font-semibold' : ''}>
                    <td className="py-0.5">
                      {l.modes[md].split(' (')[0]}{' '}
                      {md === best && <span className="chip ml-1 text-success">{l.best}</span>}
                    </td>
                    <td className="text-right tabular-nums">{fmt(mm.writeAmp)}</td>
                    <td className="text-right tabular-nums">{mm.readMs.toFixed(0)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              className="btn-ghost mt-2 px-2 py-1 text-xs"
              onClick={() => setCacheWrites(0)}
            >
              {t('sim.reset')}
            </button>
          </div>
        </div>
      </div>
    </SimShell>
  );
}
