/**
 * Çevrimiçi kaba kuvvet saldırısına karşı savunma ayarlarının etkisini gösteren MATEMATİKSEL model.
 * Eğitim amaçlıdır: tek bir hesaba yapılan tahminlerin süresini hesaplar, hiçbir istek göndermez.
 *
 * Model: saldırgan `rate` deneme/sn yapar. `lockoutAfter` başarısız denemeden sonra hesap
 * `lockoutSeconds` süre kilitlenir (0 = kilit yok). Artan gecikmede (exponential backoff) her yeni
 * kilit bir öncekinin iki katıdır ve `maxLockSeconds` ile sınırlanır. MFA (6 haneli kod) etkin arama
 * uzayını 10^6 ile çarpar. Ortalama kırılma, uzayın yarısı kadar denemede gerçekleşir.
 */

export interface BruteforceConfig {
  attemptsPerSecond: number;
  lockoutAfter: number;
  lockoutSeconds: number;
  passwordSpace: number;
  backoff: boolean;
  mfa: boolean;
  maxLockSeconds?: number;
}

export const MFA_FACTOR = 1e6;
export const DEFAULT_MAX_LOCK = 86_400;

export function effectiveSpace(c: BruteforceConfig): number {
  return Math.max(1, c.passwordSpace) * (c.mfa ? MFA_FACTOR : 1);
}

export function lockoutEnabled(c: BruteforceConfig): boolean {
  return c.lockoutAfter > 0 && c.lockoutSeconds > 0;
}

/** k. kilidin süresi (1'den başlar) */
export function lockDuration(c: BruteforceConfig, k: number): number {
  if (!c.backoff) return c.lockoutSeconds;
  const cap = Math.max(c.maxLockSeconds ?? DEFAULT_MAX_LOCK, c.lockoutSeconds);
  return Math.min(cap, c.lockoutSeconds * 2 ** (k - 1));
}

/** İlk k kilidin toplam süresi (backoff'ta kapalı biçim: geometrik kısım + sınırda sabit kısım) */
export function totalLockTime(c: BruteforceConfig, k: number): number {
  if (k <= 0 || !lockoutEnabled(c)) return 0;
  if (!c.backoff) return k * c.lockoutSeconds;
  const cap = Math.max(c.maxLockSeconds ?? DEFAULT_MAX_LOCK, c.lockoutSeconds);
  // T·2^(i-1) < cap olan kilit sayısı
  const growing = Math.min(k, Math.max(0, Math.ceil(Math.log2(cap / c.lockoutSeconds))));
  const geometric = c.lockoutSeconds * (2 ** growing - 1);
  return geometric + (k - growing) * cap;
}

/** `attempts` denemeyi yapmak için geçen süre (sn). Son denemeden sonraki kilit sayılmaz */
export function timeForAttempts(c: BruteforceConfig, attempts: number): number {
  const rate = Math.max(1e-9, c.attemptsPerSecond);
  if (attempts <= 0) return 0;
  const locks = lockoutEnabled(c) ? Math.ceil(attempts / c.lockoutAfter) - 1 : 0;
  return attempts / rate + totalLockTime(c, locks);
}

/** Beklenen (ortalama) kırılma süresi: uzayın yarısı kadar deneme */
export function expectedCrackSeconds(c: BruteforceConfig): number {
  return timeForAttempts(c, effectiveSpace(c) / 2);
}

/** En kötü durum: tüm uzayı tara */
export function worstCaseSeconds(c: BruteforceConfig): number {
  return timeForAttempts(c, effectiveSpace(c));
}

/** Verilen sürede yapılabilecek deneme sayısı (timeForAttempts'in tersi, ikili arama) */
export function attemptsWithin(c: BruteforceConfig, seconds: number): number {
  if (seconds <= 0) return 0;
  let lo = 0;
  let hi = Math.max(1, c.attemptsPerSecond * seconds);
  for (let i = 0; i < 200 && hi - lo > Math.max(1e-6, lo * 1e-9); i++) {
    const mid = (lo + hi) / 2;
    if (timeForAttempts(c, mid) <= seconds) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Belirli sürede kırılma olasılığı: deneme / etkin uzay (≤1) */
export function crackProbability(c: BruteforceConfig, seconds: number): number {
  return Math.min(1, attemptsWithin(c, seconds) / effectiveSpace(c));
}

export interface TimelineSegment {
  kind: 'attack' | 'lock';
  start: number;
  duration: number;
  attempts: number;
}

/** İlk `cycles` döngünün zaman çizelgesi (saldırı patlaması + kilit) */
export function timeline(c: BruteforceConfig, cycles = 6): TimelineSegment[] {
  const rate = Math.max(1e-9, c.attemptsPerSecond);
  if (!lockoutEnabled(c)) {
    const attempts = Math.min(effectiveSpace(c), rate * 60);
    return [{ kind: 'attack', start: 0, duration: attempts / rate, attempts }];
  }
  const segs: TimelineSegment[] = [];
  let t = 0;
  for (let k = 1; k <= cycles; k++) {
    const d = c.lockoutAfter / rate;
    segs.push({ kind: 'attack', start: t, duration: d, attempts: c.lockoutAfter });
    t += d;
    const lock = lockDuration(c, k);
    segs.push({ kind: 'lock', start: t, duration: lock, attempts: 0 });
    t += lock;
  }
  return segs;
}

/** Karakter seti büyüklüğü ve uzunluktan arama uzayı */
export function spaceFromLength(charset: number, length: number): number {
  return charset ** length;
}

export const AGE_OF_UNIVERSE_SECONDS = 4.35e17;

export function formatDuration(seconds: number, locale: 'tr' | 'en'): string {
  const u =
    locale === 'tr'
      ? { s: 'sn', m: 'dk', h: 'sa', d: 'gün', y: 'yıl', inf: 'evrenin yaşından uzun' }
      : {
          s: 's',
          m: 'min',
          h: 'h',
          d: 'days',
          y: 'years',
          inf: 'longer than the age of the universe',
        };
  if (!Number.isFinite(seconds) || seconds > AGE_OF_UNIVERSE_SECONDS) return u.inf;
  const nf = (v: number, digits = 1) =>
    new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
      maximumFractionDigits: digits,
      notation: v >= 1e6 ? 'compact' : 'standard',
    }).format(v);
  if (seconds < 1) return `${nf(seconds, 2)} ${u.s}`;
  if (seconds < 60) return `${nf(seconds)} ${u.s}`;
  if (seconds < 3600) return `${nf(seconds / 60)} ${u.m}`;
  if (seconds < 86_400) return `${nf(seconds / 3600)} ${u.h}`;
  if (seconds < 365 * 86_400) return `${nf(seconds / 86_400)} ${u.d}`;
  return `${nf(seconds / (365 * 86_400))} ${u.y}`;
}
