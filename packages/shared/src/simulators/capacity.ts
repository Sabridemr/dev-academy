/**
 * KAPASİTE TAHMİN HESAPLAYICISI
 * -----------------------------
 * Vaka çalışmalarında (Modül E) "arka zarf" hesapları: QPS, depolama, bant genişliği, cache boyutu.
 */

export interface CapacityInput {
  /** Günlük aktif kullanıcı */
  dau: number;
  /** Kullanıcı başına günlük okuma isteği */
  readsPerUserPerDay: number;
  /** Kullanıcı başına günlük yazma isteği */
  writesPerUserPerDay: number;
  /** Bir yazma kaydının ortalama boyutu (byte) */
  avgWriteSizeBytes: number;
  /** Bir okuma yanıtının ortalama boyutu (byte) */
  avgReadSizeBytes: number;
  /** Veri saklama süresi (yıl) */
  retentionYears: number;
  /** Tepe trafik çarpanı (ör. 3x) */
  peakMultiplier: number;
  /** Cache'lenecek sıcak veri oranı (0..1) — 80/20 kuralı için 0.2 */
  hotDataRatio: number;
  /** Replikasyon faktörü */
  replicationFactor: number;
}

export interface CapacityEstimate {
  readQps: number;
  writeQps: number;
  peakReadQps: number;
  peakWriteQps: number;
  dailyWriteBytes: number;
  totalStorageBytes: number;
  totalStorageWithReplicationBytes: number;
  ingressBytesPerSec: number;
  egressBytesPerSec: number;
  peakEgressBytesPerSec: number;
  cacheBytes: number;
  /** Tahmini sunucu sayısı: her sunucu ~ serverQpsCapacity istek/sn */
  appServers: number;
}

export const SECONDS_PER_DAY = 86_400;

export const DEFAULT_CAPACITY_INPUT: CapacityInput = {
  dau: 100_000_000,
  readsPerUserPerDay: 50,
  writesPerUserPerDay: 2,
  avgWriteSizeBytes: 1_000,
  avgReadSizeBytes: 5_000,
  retentionYears: 5,
  peakMultiplier: 3,
  hotDataRatio: 0.2,
  replicationFactor: 3,
};

export function estimateCapacity(
  input: CapacityInput,
  serverQpsCapacity = 1_000,
): CapacityEstimate {
  const readQps = (input.dau * input.readsPerUserPerDay) / SECONDS_PER_DAY;
  const writeQps = (input.dau * input.writesPerUserPerDay) / SECONDS_PER_DAY;
  const dailyWriteBytes = input.dau * input.writesPerUserPerDay * input.avgWriteSizeBytes;
  const totalStorageBytes = dailyWriteBytes * 365 * input.retentionYears;
  const ingressBytesPerSec = writeQps * input.avgWriteSizeBytes;
  const egressBytesPerSec = readQps * input.avgReadSizeBytes;
  return {
    readQps,
    writeQps,
    peakReadQps: readQps * input.peakMultiplier,
    peakWriteQps: writeQps * input.peakMultiplier,
    dailyWriteBytes,
    totalStorageBytes,
    totalStorageWithReplicationBytes: totalStorageBytes * input.replicationFactor,
    ingressBytesPerSec,
    egressBytesPerSec,
    peakEgressBytesPerSec: egressBytesPerSec * input.peakMultiplier,
    cacheBytes: dailyWriteBytes * input.hotDataRatio * 7, // son bir haftanın sıcak verisi
    appServers: Math.max(
      1,
      Math.ceil(((readQps + writeQps) * input.peakMultiplier) / serverQpsCapacity),
    ),
  };
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];

export function formatBytes(bytes: number, fractionDigits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const i = Math.min(UNITS.length - 1, Math.floor(Math.log10(bytes) / 3));
  return `${(bytes / Math.pow(1000, i)).toFixed(fractionDigits)} ${UNITS[i]}`;
}

export function formatNumber(value: number, locale = 'tr-TR'): string {
  if (!Number.isFinite(value)) return '∞';
  if (value >= 1_000_000_000)
    return `${(value / 1_000_000_000).toLocaleString(locale, { maximumFractionDigits: 2 })} Mia`;
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 2 })} Mn`;
  if (value >= 1_000)
    return `${(value / 1_000).toLocaleString(locale, { maximumFractionDigits: 1 })} B`;
  return value.toLocaleString(locale, { maximumFractionDigits: 1 });
}
