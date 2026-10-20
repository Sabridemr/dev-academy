'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { cn, formatPercent } from '@/lib/utils';
import { Range, Select, SimShell, Stat } from './ui';
import { numParam, type SimulatorProps } from './types';
import {
  crackProbability,
  expectedCrackSeconds,
  formatDuration,
  spaceFromLength,
  timeline,
  worstCaseSeconds,
  type BruteforceConfig,
} from './bruteforceLogin.logic';

type SpaceMode = 'space' | 'length';
type Charset = '10' | '26' | '62' | '94';

const L = {
  tr: {
    title: 'Kaba kuvvet ve hesap kilitleme',
    disclaimer:
      'Eğitim amaçlı matematiksel model: yalnızca savunma ayarlarının beklenen kırılma süresine etkisini hesaplar. Hiçbir sisteme istek göndermez.',
    rate: 'Deneme hızı (deneme/sn)',
    lockAfter: 'Kilitleme eşiği (başarısız deneme, 0 = kapalı)',
    lockSec: 'Kilit süresi (sn)',
    backoff: 'Artan gecikme (her kilit 2×, en fazla 24 sa)',
    mfa: 'MFA (6 haneli kod)',
    mode: 'Parola uzayı',
    modes: { space: 'Doğrudan büyüklük', length: 'Uzunluk ve karakter seti' } satisfies Record<
      SpaceMode,
      string
    >,
    space: 'Olası parola sayısı',
    length: 'Parola uzunluğu',
    charset: 'Karakter seti',
    charsets: {
      '10': 'Rakam (10)',
      '26': 'Küçük harf (26)',
      '62': 'Harf + rakam (62)',
      '94': 'Tüm yazdırılabilir (94)',
    } satisfies Record<Charset, string>,
    expected: 'Beklenen kırılma süresi',
    worst: 'En kötü durum',
    p1d: '1 günde kırılma olasılığı',
    p30d: '30 günde kırılma olasılığı',
    timeline: 'Zaman çizelgesi: ilk döngüler',
    attack: 'deneme',
    lock: 'kilit',
    noLock: 'Kilit yok: saldırgan durmadan dener (ilk 60 saniye).',
    compare: 'Savunma katmanlarının karşılaştırması (log ölçek)',
    layers: {
      none: 'Savunmasız',
      lock: 'Kilit',
      backoff: 'Kilit + artan gecikme',
      mfa: '+ MFA',
    },
    current: 'mevcut ayar',
    spaceInfo: 'Etkin uzay',
  },
  en: {
    title: 'Brute force and account lockout',
    disclaimer:
      'Educational mathematical model: it only computes how defensive settings change the expected time to crack. It sends no requests anywhere.',
    rate: 'Attempt rate (attempts/s)',
    lockAfter: 'Lockout threshold (failed attempts, 0 = off)',
    lockSec: 'Lockout duration (s)',
    backoff: 'Exponential backoff (each lock 2×, max 24 h)',
    mfa: 'MFA (6-digit code)',
    mode: 'Password space',
    modes: { space: 'Size directly', length: 'Length and charset' } satisfies Record<
      SpaceMode,
      string
    >,
    space: 'Possible passwords',
    length: 'Password length',
    charset: 'Character set',
    charsets: {
      '10': 'Digits (10)',
      '26': 'Lowercase (26)',
      '62': 'Letters + digits (62)',
      '94': 'All printable (94)',
    } satisfies Record<Charset, string>,
    expected: 'Expected time to crack',
    worst: 'Worst case',
    p1d: 'Chance of crack in 1 day',
    p30d: 'Chance of crack in 30 days',
    timeline: 'Timeline: first cycles',
    attack: 'attempts',
    lock: 'lock',
    noLock: 'No lockout: the attacker never pauses (first 60 seconds).',
    compare: 'Defense layers compared (log scale)',
    layers: {
      none: 'Unprotected',
      lock: 'Lockout',
      backoff: 'Lockout + backoff',
      mfa: '+ MFA',
    },
    current: 'current',
    spaceInfo: 'Effective space',
  },
};

const sci = (v: number) => {
  const e = Math.floor(Math.log10(v));
  const m = v / 10 ** e;
  return e < 4
    ? String(Math.round(v))
    : `${m >= 9.95 ? '1' : m.toFixed(1).replace(/\.0$/, '')}×10^${m >= 9.95 ? e + 1 : e}`;
};

export default function BruteforceLoginSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const [rate, setRate] = useState(() => numParam(params, 'attemptsPerSecond', 10, 1, 1000));
  const [lockAfter, setLockAfter] = useState(() => numParam(params, 'lockoutAfter', 5, 0, 20));
  const [lockSec, setLockSec] = useState(() => numParam(params, 'lockoutSeconds', 60, 0, 3600));
  const [spaceExp, setSpaceExp] = useState(() =>
    Math.log10(numParam(params, 'passwordSpace', 1e8, 1e3, 1e12)),
  );
  const [mode, setMode] = useState<SpaceMode>('space');
  const [length, setLength] = useState(8);
  const [charset, setCharset] = useState<Charset>('62');
  const [backoff, setBackoff] = useState(false);
  const [mfa, setMfa] = useState(false);

  const touch =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      onInteract();
      set(v);
    };

  const passwordSpace =
    mode === 'space' ? 10 ** spaceExp : spaceFromLength(Number(charset), length);
  const cfg: BruteforceConfig = useMemo(
    () => ({
      attemptsPerSecond: rate,
      lockoutAfter: lockAfter,
      lockoutSeconds: lockSec,
      passwordSpace,
      backoff,
      mfa,
    }),
    [rate, lockAfter, lockSec, passwordSpace, backoff, mfa],
  );
  const expected = expectedCrackSeconds(cfg);
  const worst = worstCaseSeconds(cfg);
  const p1 = crackProbability(cfg, 86_400);
  const p30 = crackProbability(cfg, 30 * 86_400);
  const segs = useMemo(() => timeline(cfg), [cfg]);
  const segTotal = segs.reduce((a, s) => a + s.duration, 0) || 1;
  const pct = (v: number) =>
    v > 0 && v < 0.01 ? `<${formatPercent(1, locale)}` : formatPercent(v * 100, locale);

  // Katmanlar: savunmasız → kilit → kilit + backoff → + MFA (kilit ayarı 0 ise makul varsayılan)
  const lockA = lockAfter || 5;
  const lockS = lockSec || 60;
  const layers = [
    { id: 'none' as const, c: { ...cfg, lockoutAfter: 0, backoff: false, mfa: false } },
    {
      id: 'lock' as const,
      c: { ...cfg, lockoutAfter: lockA, lockoutSeconds: lockS, backoff: false, mfa: false },
    },
    {
      id: 'backoff' as const,
      c: { ...cfg, lockoutAfter: lockA, lockoutSeconds: lockS, backoff: true, mfa: false },
    },
    {
      id: 'mfa' as const,
      c: { ...cfg, lockoutAfter: lockA, lockoutSeconds: lockS, backoff: true, mfa: true },
    },
  ].map((x) => ({ ...x, t: expectedCrackSeconds(x.c) }));
  const currentLayer =
    lockAfter === 0 || lockSec === 0
      ? mfa
        ? null
        : 'none'
      : mfa
        ? backoff
          ? 'mfa'
          : null
        : backoff
          ? 'backoff'
          : 'lock';
  const logMax = 18;
  const barW = (t: number) => Math.max(4, (Math.max(0, Math.log10(Math.max(1, t))) / logMax) * 300);

  const checkbox = (label: string, value: boolean, set: (v: boolean) => void) => (
    <label className="flex cursor-pointer items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        className="h-4 w-4 accent-[var(--da-primary)]"
        checked={value}
        onChange={(e) => {
          onInteract();
          set(e.target.checked);
        }}
      />
    </label>
  );

  return (
    <SimShell
      title={l.title}
      aside={
        <>
          <Range label={l.rate} value={rate} min={1} max={1000} onChange={touch(setRate)} />
          <Range
            label={l.lockAfter}
            value={lockAfter}
            min={0}
            max={20}
            onChange={touch(setLockAfter)}
          />
          <Range
            label={l.lockSec}
            value={lockSec}
            min={0}
            max={3600}
            step={10}
            format={(v) => formatDuration(v, locale)}
            onChange={touch(setLockSec)}
          />
          {checkbox(l.backoff, backoff, setBackoff)}
          {checkbox(l.mfa, mfa, setMfa)}
          <Select
            label={l.mode}
            value={mode}
            options={(['space', 'length'] as const).map((m) => ({ id: m, label: l.modes[m] }))}
            onChange={touch(setMode)}
          />
          {mode === 'space' ? (
            <Range
              label={l.space}
              value={spaceExp}
              min={3}
              max={12}
              step={0.5}
              format={(v) => sci(10 ** v)}
              onChange={touch(setSpaceExp)}
            />
          ) : (
            <>
              <Range label={l.length} value={length} min={4} max={16} onChange={touch(setLength)} />
              <Select
                label={l.charset}
                value={charset}
                options={(['10', '26', '62', '94'] as const).map((c) => ({
                  id: c,
                  label: l.charsets[c],
                }))}
                onChange={touch(setCharset)}
              />
            </>
          )}
          <p className="text-xs text-muted">
            {l.spaceInfo}:{' '}
            <span className="font-mono text-fg">{sci(passwordSpace * (mfa ? 1e6 : 1))}</span>
          </p>
        </>
      }
    >
      <p className="mb-3 flex items-start gap-2 rounded-xl border border-border bg-surface/80 px-3 py-2 text-xs text-muted">
        <Info size={14} className="mt-0.5 shrink-0" /> {l.disclaimer}
      </p>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat
          label={l.expected}
          value={<span data-testid="bf-expected">{formatDuration(expected, locale)}</span>}
          tone={expected < 86_400 ? 'danger' : expected < 365 * 86_400 ? 'warning' : 'success'}
        />
        <Stat label={l.worst} value={formatDuration(worst, locale)} />
        <Stat label={l.p1d} value={pct(p1)} tone={p1 > 0.01 ? 'danger' : undefined} />
        <Stat label={l.p30d} value={pct(p30)} tone={p30 > 0.1 ? 'danger' : undefined} />
      </div>

      <p className="label">{l.timeline}</p>
      <svg viewBox="0 0 600 92" className="mb-1 h-auto w-full" role="img" aria-label={l.timeline}>
        <rect x={0} y={16} width={600} height={36} rx={8} fill="var(--da-elevated)" />
        {segs.map((s, i) => {
          const x = (s.start / segTotal) * 600;
          const w = Math.max(1.5, (s.duration / segTotal) * 600);
          return (
            <motion.rect
              key={`${i}-${s.kind}`}
              y={16}
              height={36}
              fill={s.kind === 'attack' ? 'var(--da-danger)' : 'var(--da-primary)'}
              opacity={s.kind === 'attack' ? 0.85 : 0.35}
              initial={false}
              animate={{ x, width: w }}
              transition={{ duration: reduced ? 0 : 0.3 }}
            >
              <title>
                {s.kind === 'attack'
                  ? `${Math.round(s.attempts)} ${l.attack} · ${formatDuration(s.duration, locale)}`
                  : `${l.lock} · ${formatDuration(s.duration, locale)}`}
              </title>
            </motion.rect>
          );
        })}
        <text x={0} y={70} fontSize={12} fill="var(--da-muted)">
          0
        </text>
        <text x={600} y={70} fontSize={12} textAnchor="end" fill="var(--da-muted)">
          {formatDuration(segTotal, locale)}
        </text>
        <g transform="translate(0, 86)">
          <rect width={12} height={12} y={-10} fill="var(--da-danger)" opacity={0.85} rx={2} />
          <text x={18} fontSize={12} fill="var(--da-fg)">
            {l.attack}
          </text>
          <rect
            x={110}
            width={12}
            height={12}
            y={-10}
            fill="var(--da-primary)"
            opacity={0.35}
            rx={2}
          />
          <text x={128} fontSize={12} fill="var(--da-fg)">
            {l.lock}
          </text>
        </g>
      </svg>
      {segs.length === 1 && <p className="mb-3 text-xs text-muted">{l.noLock}</p>}

      <p className="label mt-3">{l.compare}</p>
      <ul className="space-y-1.5">
        {layers.map((x) => (
          <li
            key={x.id}
            className={cn(
              'grid grid-cols-[150px_1fr] items-center gap-2 text-xs',
              currentLayer === x.id && 'font-semibold',
            )}
          >
            <span>
              {l.layers[x.id]}
              {currentLayer === x.id && <span className="ml-1 text-primary">({l.current})</span>}
            </span>
            <span className="flex items-center gap-2">
              <svg viewBox="0 0 300 14" className="h-3.5 w-full max-w-[300px]" aria-hidden>
                <rect width={300} height={14} rx={7} fill="var(--da-elevated)" />
                <motion.rect
                  height={14}
                  rx={7}
                  fill={
                    x.id === 'none'
                      ? 'var(--da-danger)'
                      : x.id === 'mfa'
                        ? 'var(--da-success)'
                        : 'var(--da-primary)'
                  }
                  initial={false}
                  animate={{ width: barW(x.t) }}
                  transition={{ duration: reduced ? 0 : 0.3 }}
                />
              </svg>
              <span className="w-40 shrink-0 tabular-nums">{formatDuration(x.t, locale)}</span>
            </span>
          </li>
        ))}
      </ul>
    </SimShell>
  );
}
