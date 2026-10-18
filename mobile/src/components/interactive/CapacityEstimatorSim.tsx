import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DEFAULT_CAPACITY_INPUT, estimateCapacity, formatBytes, formatNumber, type CapacityInput } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { spacing, useTheme } from '@/theme';
import { Button, ProgressBar, Row, SegmentedControl, Stepper, Text, TextField } from '@/components/ui';
import { Stat, StatRow, paramNumber, type SimProps } from './common';

export type CapacityField = keyof CapacityInput;

export const CAPACITY_FIELDS: { key: CapacityField; min: number; max: number; ratio?: boolean }[] = [
  { key: 'dau', min: 1, max: 5_000_000_000 },
  { key: 'readsPerUserPerDay', min: 0, max: 100_000 },
  { key: 'writesPerUserPerDay', min: 0, max: 100_000 },
  { key: 'avgWriteSizeBytes', min: 1, max: 10_000_000_000 },
  { key: 'avgReadSizeBytes', min: 1, max: 10_000_000_000 },
  { key: 'retentionYears', min: 0.1, max: 50 },
  { key: 'peakMultiplier', min: 1, max: 50 },
  { key: 'hotDataRatio', min: 0, max: 1, ratio: true },
  { key: 'replicationFactor', min: 1, max: 10 },
];

/** Sunucu başına QPS kapasitesi için hazır seçenekler (web: 100–20.000 kaydırıcı) */
const SERVER_QPS_OPTIONS = [100, 500, 1000, 2000, 5000, 10000, 20000];

/** Ders parametrelerinden (sınırlandırılmış) girdi; eksik alanlar shared varsayılanlarına düşer */
export function initialCapacityInput(params: Record<string, unknown>): CapacityInput {
  const out = { ...DEFAULT_CAPACITY_INPUT };
  for (const f of CAPACITY_FIELDS) out[f.key] = Math.max(f.min, Math.min(f.max, paramNumber(params, f.key, DEFAULT_CAPACITY_INPUT[f.key])));
  return out;
}

const toDrafts = (input: CapacityInput) => Object.fromEntries(CAPACITY_FIELDS.map((f) => [f.key, String(input[f.key])])) as Record<CapacityField, string>;

/** Kapasite tahmini (arka zarf hesabı) — hesap shared/capacity estimateCapacity'den */
export function CapacityEstimatorSim({ params, onInteract }: SimProps) {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const numLocale = locale === 'tr' ? 'tr-TR' : 'en-US';
  const [input, setInput] = useState<CapacityInput>(() => initialCapacityInput(params));
  const [drafts, setDrafts] = useState<Record<CapacityField, string>>(() => toDrafts(input));
  const [serverQps, setServerQps] = useState(1000);
  const est = useMemo(() => estimateCapacity(input, serverQps), [input, serverQps]);
  const fmt = (v: number) => formatNumber(v, numLocale);

  const update = (key: CapacityField, raw: string) => {
    onInteract();
    setDrafts((d) => ({ ...d, [key]: raw }));
    const f = CAPACITY_FIELDS.find((x) => x.key === key);
    const n = Number(raw.replace(',', '.'));
    if (!f || raw.trim() === '' || !Number.isFinite(n)) return;
    setInput((s) => ({ ...s, [key]: Math.max(f.min, Math.min(f.max, n)) }));
  };

  const reset = () => {
    const next = initialCapacityInput(params);
    setInput(next);
    setDrafts(toDrafts(next));
  };

  const bars = [
    { label: t('sim.estimator.readQps'), v: est.readQps, color: colors.primary },
    { label: t('sim.estimator.peakRead'), v: est.peakReadQps, color: colors.warning },
    { label: t('sim.estimator.writeQps'), v: est.writeQps, color: colors.success },
    { label: t('sim.estimator.peakWrite'), v: est.peakWriteQps, color: colors.accent },
  ];
  const maxLog = Math.max(1, ...bars.map((b) => Math.log10(b.v + 1)));
  const rwRatio = est.writeQps > 0 ? est.readQps / est.writeQps : Infinity;

  return (
    <View style={{ gap: spacing.md }} testID="sim-capacity-estimator">
      <Text variant="label">{t('sim.estimator.inputs')}</Text>
      {CAPACITY_FIELDS.map((f) => {
        const label = t(`sim.estimator.fields.${f.key}`);
        if (f.ratio) {
          return (
            <Stepper
              key={f.key}
              label={label}
              value={input[f.key]}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => update(f.key, String(Math.round(v * 100) / 100))}
            />
          );
        }
        return (
          <View key={f.key} style={{ gap: 2 }}>
            <TextField
              label={label}
              value={drafts[f.key]}
              onChangeText={(v) => update(f.key, v)}
              keyboardType="decimal-pad"
              inputMode="decimal"
              testID={`cap-${f.key}`}
            />
            <Text variant="caption" muted style={{ textAlign: 'right' }}>
              {f.key.endsWith('Bytes') ? formatBytes(input[f.key]) : fmt(input[f.key])}
            </Text>
          </View>
        );
      })}
      <SegmentedControl
        label={t('sim.estimator.serverQps')}
        wrap
        value={serverQps}
        onChange={(v) => {
          onInteract();
          setServerQps(v);
        }}
        options={SERVER_QPS_OPTIONS.map((v) => ({ value: v, label: fmt(v) }))}
      />
      <Button compact variant="ghost" title={t('sim.reset')} icon="refresh" onPress={reset} />

      <Text variant="label">{t('sim.estimator.results')}</Text>
      <View accessibilityLiveRegion="polite">
        <StatRow>
          <Stat label={t('sim.estimator.readQps')} value={fmt(est.readQps)} color={colors.primary} />
          <Stat label={t('sim.estimator.writeQps')} value={fmt(est.writeQps)} color={colors.success} />
          <Stat label={t('sim.estimator.ratio')} value={Number.isFinite(rwRatio) ? `${fmt(rwRatio)} : 1` : '∞'} />
          <Stat label={t('sim.estimator.peakRead')} value={fmt(est.peakReadQps)} color={colors.warning} />
          <Stat label={t('sim.estimator.peakWrite')} value={fmt(est.peakWriteQps)} color={colors.warning} />
          <Stat label={t('sim.estimator.servers')} value={fmt(est.appServers)} color={colors.primary} />
          <Stat label={t('sim.estimator.daily')} value={formatBytes(est.dailyWriteBytes)} />
          <Stat label={t('sim.estimator.storage')} value={formatBytes(est.totalStorageBytes)} />
          <Stat label={t('sim.estimator.storageRep')} value={formatBytes(est.totalStorageWithReplicationBytes)} color={colors.danger} />
          <Stat label={t('sim.estimator.ingress')} value={`${formatBytes(est.ingressBytesPerSec)}/s`} />
          <Stat label={t('sim.estimator.egress')} value={`${formatBytes(est.egressBytesPerSec)}/s`} />
          <Stat label={t('sim.estimator.peakEgress')} value={`${formatBytes(est.peakEgressBytesPerSec)}/s`} color={colors.warning} />
          <Stat label={t('sim.estimator.cache')} value={formatBytes(est.cacheBytes)} />
        </StatRow>
      </View>

      <Text variant="label">{t('sim.estimator.qpsBars')}</Text>
      {bars.map((b) => (
        <Row key={b.label}>
          <Text variant="caption" style={styles.barLabel} numberOfLines={1}>
            {b.label}
          </Text>
          <View style={{ flex: 1 }}>
            <ProgressBar value={Math.log10(b.v + 1) / maxLog} color={b.color} height={10} label={b.label} />
          </View>
          <Text variant="caption" muted style={styles.barValue}>
            {fmt(b.v)}
          </Text>
        </Row>
      ))}
      <Text variant="mono" muted style={{ fontSize: 11 }}>
        {t('sim.estimator.formula')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  barLabel: { width: 104 },
  barValue: { width: 64, textAlign: 'right' },
});
