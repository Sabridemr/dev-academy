'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import {
  DEFAULT_CAPACITY_INPUT,
  estimateCapacity,
  formatBytes,
  formatNumber,
  type CapacityInput,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { Range, SimShell, Stat } from './ui';
import { numParam, type SimulatorProps } from './types';

type FieldKey = keyof CapacityInput;

const FIELDS: { key: FieldKey; min: number; max: number; step: number; ratio?: boolean }[] = [
  { key: 'dau', min: 1, max: 5_000_000_000, step: 1 },
  { key: 'readsPerUserPerDay', min: 0, max: 100_000, step: 0.01 },
  { key: 'writesPerUserPerDay', min: 0, max: 100_000, step: 0.01 },
  { key: 'avgWriteSizeBytes', min: 1, max: 10_000_000_000, step: 1 },
  { key: 'avgReadSizeBytes', min: 1, max: 10_000_000_000, step: 1 },
  { key: 'retentionYears', min: 0.1, max: 50, step: 0.1 },
  { key: 'peakMultiplier', min: 1, max: 50, step: 0.5 },
  { key: 'hotDataRatio', min: 0, max: 1, step: 0.01, ratio: true },
  { key: 'replicationFactor', min: 1, max: 10, step: 1 },
];

const L = {
  tr: {
    title: 'Kapasite tahmini (arka zarf hesabı)',
    inputs: 'Girdiler',
    results: 'Sonuçlar',
    serverQps: 'Sunucu başına QPS kapasitesi',
    fields: {
      dau: 'Günlük aktif kullanıcı (DAU)',
      readsPerUserPerDay: 'Kullanıcı başına günlük okuma',
      writesPerUserPerDay: 'Kullanıcı başına günlük yazma',
      avgWriteSizeBytes: 'Ortalama yazma boyutu (byte)',
      avgReadSizeBytes: 'Ortalama okuma yanıtı (byte)',
      retentionYears: 'Saklama süresi (yıl)',
      peakMultiplier: 'Tepe trafik çarpanı',
      hotDataRatio: 'Sıcak veri oranı (cache)',
      replicationFactor: 'Replikasyon faktörü',
    } satisfies Record<FieldKey, string>,
    readQps: 'Okuma QPS',
    writeQps: 'Yazma QPS',
    peakRead: 'Tepe okuma QPS',
    peakWrite: 'Tepe yazma QPS',
    daily: 'Günlük yeni veri',
    storage: 'Toplam depolama',
    storageRep: 'Replikasyonlu depolama',
    ingress: 'Giriş bant genişliği',
    egress: 'Çıkış bant genişliği',
    peakEgress: 'Tepe çıkış',
    cache: 'Cache belleği (7 gün sıcak veri)',
    servers: 'Uygulama sunucusu',
    qpsBars: 'QPS karşılaştırması (log ölçek)',
    ratio: 'Okuma/yazma oranı',
    formula: 'QPS = DAU × istek/gün ÷ 86.400 · Depolama = günlük yazma × 365 × yıl',
  },
  en: {
    title: 'Capacity estimate (back-of-the-envelope)',
    inputs: 'Inputs',
    results: 'Results',
    serverQps: 'QPS capacity per server',
    fields: {
      dau: 'Daily active users (DAU)',
      readsPerUserPerDay: 'Reads per user per day',
      writesPerUserPerDay: 'Writes per user per day',
      avgWriteSizeBytes: 'Average write size (bytes)',
      avgReadSizeBytes: 'Average read response (bytes)',
      retentionYears: 'Retention (years)',
      peakMultiplier: 'Peak traffic multiplier',
      hotDataRatio: 'Hot data ratio (cache)',
      replicationFactor: 'Replication factor',
    } satisfies Record<FieldKey, string>,
    readQps: 'Read QPS',
    writeQps: 'Write QPS',
    peakRead: 'Peak read QPS',
    peakWrite: 'Peak write QPS',
    daily: 'New data per day',
    storage: 'Total storage',
    storageRep: 'Storage with replication',
    ingress: 'Ingress bandwidth',
    egress: 'Egress bandwidth',
    peakEgress: 'Peak egress',
    cache: 'Cache memory (7 days hot data)',
    servers: 'App servers',
    qpsBars: 'QPS comparison (log scale)',
    ratio: 'Read/write ratio',
    formula: 'QPS = DAU × requests/day ÷ 86,400 · Storage = daily writes × 365 × years',
  },
};

function initialInput(params: Record<string, unknown>): CapacityInput {
  const out = { ...DEFAULT_CAPACITY_INPUT };
  for (const f of FIELDS)
    out[f.key] = numParam(params, f.key, DEFAULT_CAPACITY_INPUT[f.key], f.min, f.max);
  return out;
}

export default function CapacityEstimatorSim({ params, onInteract }: SimulatorProps) {
  const { t, locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const numLocale = locale === 'tr' ? 'tr-TR' : 'en-US';
  const [input, setInput] = useState<CapacityInput>(() => initialInput(params));
  const [serverQps, setServerQps] = useState(1000);
  const est = useMemo(() => estimateCapacity(input, serverQps), [input, serverQps]);
  const fmt = (v: number) => formatNumber(v, numLocale);

  const update = (key: FieldKey, raw: string) => {
    onInteract();
    const f = FIELDS.find((x) => x.key === key);
    const n = Number(raw);
    if (!f || !Number.isFinite(n)) return;
    setInput((s) => ({ ...s, [key]: Math.max(f.min, Math.min(f.max, n)) }));
  };

  const bars = [
    { label: l.readQps, v: est.readQps, color: 'var(--da-primary)' },
    {
      label: l.peakRead,
      v: est.peakReadQps,
      color: 'color-mix(in srgb, var(--da-primary) 60%, var(--da-danger))',
    },
    { label: l.writeQps, v: est.writeQps, color: 'var(--da-success)' },
    {
      label: l.peakWrite,
      v: est.peakWriteQps,
      color: 'color-mix(in srgb, var(--da-success) 60%, var(--da-danger))',
    },
  ];
  const maxLog = Math.max(1, ...bars.map((b) => Math.log10(b.v + 1)));
  const rwRatio = est.writeQps > 0 ? est.readQps / est.writeQps : Infinity;

  return (
    <SimShell
      title={l.title}
      toolbar={
        <button type="button" className="btn-ghost" onClick={() => setInput(initialInput(params))}>
          <RotateCcw size={14} /> {t('sim.reset')}
        </button>
      }
      aside={
        <>
          <p className="label">{l.inputs}</p>
          {FIELDS.map((f) =>
            f.ratio ? (
              <Range
                key={f.key}
                label={l.fields[f.key]}
                value={input[f.key]}
                min={0}
                max={1}
                step={0.01}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => update(f.key, String(v))}
              />
            ) : (
              <label key={f.key} className="block">
                <span className="label flex justify-between gap-2">
                  <span className="normal-case">{l.fields[f.key]}</span>
                  <span className="tabular-nums text-fg">
                    {f.key.endsWith('Bytes') ? formatBytes(input[f.key]) : fmt(input[f.key])}
                  </span>
                </span>
                <input
                  type="number"
                  className="input"
                  value={input[f.key]}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  onChange={(e) => update(f.key, e.target.value)}
                />
              </label>
            ),
          )}
          <Range
            label={l.serverQps}
            value={serverQps}
            min={100}
            max={20000}
            step={100}
            onChange={(v) => {
              onInteract();
              setServerQps(v);
            }}
          />
        </>
      }
    >
      <p className="label">{l.results}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-live="polite">
        <Stat label={l.readQps} value={fmt(est.readQps)} tone="primary" />
        <Stat label={l.writeQps} value={fmt(est.writeQps)} tone="success" />
        <Stat label={l.ratio} value={Number.isFinite(rwRatio) ? `${fmt(rwRatio)} : 1` : '∞'} />
        <Stat label={l.peakRead} value={fmt(est.peakReadQps)} tone="warning" />
        <Stat label={l.peakWrite} value={fmt(est.peakWriteQps)} tone="warning" />
        <Stat label={l.servers} value={fmt(est.appServers)} tone="primary" />
        <Stat label={l.daily} value={formatBytes(est.dailyWriteBytes)} />
        <Stat label={l.storage} value={formatBytes(est.totalStorageBytes)} />
        <Stat
          label={l.storageRep}
          value={formatBytes(est.totalStorageWithReplicationBytes)}
          tone="danger"
        />
        <Stat label={l.ingress} value={`${formatBytes(est.ingressBytesPerSec)}/s`} />
        <Stat label={l.egress} value={`${formatBytes(est.egressBytesPerSec)}/s`} />
        <Stat
          label={l.peakEgress}
          value={`${formatBytes(est.peakEgressBytesPerSec)}/s`}
          tone="warning"
        />
        <Stat label={l.cache} value={formatBytes(est.cacheBytes)} />
      </div>

      <figure className="mt-4">
        <figcaption className="label">{l.qpsBars}</figcaption>
        <svg viewBox="0 0 600 150" className="h-auto w-full" role="img" aria-label={l.qpsBars}>
          {bars.map((b, i) => {
            const w = (Math.log10(b.v + 1) / maxLog) * 400;
            return (
              <g key={b.label} transform={`translate(0, ${i * 36 + 4})`}>
                <text x={0} y={18} fontSize={12} fill="var(--da-fg)">
                  {b.label}
                </text>
                <rect x={130} y={4} width={400} height={20} rx={6} fill="var(--da-elevated)" />
                <motion.rect
                  x={130}
                  y={4}
                  height={20}
                  rx={6}
                  fill={b.color}
                  animate={{ width: Math.max(2, w) }}
                  transition={{ duration: reduced ? 0 : 0.35 }}
                />
                <text x={540} y={18} fontSize={12} fill="var(--da-muted)">
                  {fmt(b.v)}
                </text>
              </g>
            );
          })}
        </svg>
      </figure>
      <p className="mt-2 font-mono text-xs text-muted">{l.formula}</p>
    </SimShell>
  );
}
