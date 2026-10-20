/**
 * Big-O çizicisinin saf mantığı: fonksiyon tanımları, taşma olmadan log10 değerleri ve
 * "bütçe içinde çözülebilecek en büyük n" hesabı.
 */

export const BIG_O_FUNCTIONS = ['1', 'logn', 'n', 'nlogn', 'n2', '2n', 'nfact'] as const;
export type BigOFn = (typeof BIG_O_FUNCTIONS)[number];

export const BIG_O_LABELS: Record<BigOFn, string> = {
  '1': 'O(1)',
  logn: 'O(log n)',
  n: 'O(n)',
  nlogn: 'O(n log n)',
  n2: 'O(n²)',
  '2n': 'O(2ⁿ)',
  nfact: 'O(n!)',
};

export const DEFAULT_FUNCTIONS: BigOFn[] = ['1', 'logn', 'n', 'nlogn', 'n2', '2n'];

/** "1,logn,n2" → geçerli fonksiyonlar (kanonik sırada, tekrarsız); boş/geçersizse varsayılan */
export function parseFunctions(v: unknown): BigOFn[] {
  if (typeof v !== 'string') return [...DEFAULT_FUNCTIONS];
  const wanted = new Set(
    v
      .split(',')
      .map((s) =>
        s
          .trim()
          .toLowerCase()
          .replace(/[\s^()*]/g, '')
          .replace(/^o/, ''),
      )
      .map((s) =>
        s === 'n!' ? 'nfact' : s === '2^n' || s === '2n' ? '2n' : s === 'n^2' ? 'n2' : s,
      ),
  );
  const list = BIG_O_FUNCTIONS.filter((f) => wanted.has(f));
  return list.length ? list : [...DEFAULT_FUNCTIONS];
}

const LOG10_FACT: number[] = [0];
function log10Factorial(n: number): number {
  const k = Math.max(0, Math.floor(n));
  // Büyük n için Stirling yaklaşımı (tablo şişmesin)
  if (k > 5000) return (k * Math.log(k) - k + 0.5 * Math.log(2 * Math.PI * k)) / Math.LN10;
  for (let i = LOG10_FACT.length; i <= k; i++) LOG10_FACT[i] = LOG10_FACT[i - 1] + Math.log10(i);
  return LOG10_FACT[k];
}

/** f(n) değeri (çok büyükse Infinity). n ≥ 1 varsayılır. */
export function bigOValue(fn: BigOFn, n: number): number {
  switch (fn) {
    case '1':
      return 1;
    case 'logn':
      return Math.log2(n);
    case 'n':
      return n;
    case 'nlogn':
      return n * Math.log2(n);
    case 'n2':
      return n * n;
    case '2n':
      return 2 ** n;
    case 'nfact':
      return n > 170 ? Infinity : 10 ** log10Factorial(n);
  }
}

/** log10 f(n), taşmadan (f(n) ≤ 0 ise -Infinity) */
export function bigOLog10(fn: BigOFn, n: number): number {
  switch (fn) {
    case '2n':
      return n * Math.log10(2);
    case 'nfact':
      return log10Factorial(n);
    default: {
      const v = bigOValue(fn, n);
      return v > 0 ? Math.log10(v) : -Infinity;
    }
  }
}

/**
 * f(n) ≤ budget olan en büyük tam sayı n. Sınırsızsa (O(1) ya da 1e15'i aşan) Infinity;
 * n = 1 bile sığmıyorsa 0.
 */
export function maxSolvableN(fn: BigOFn, budget: number): number {
  const LIMIT = 1e15;
  const fits = (n: number) => bigOLog10(fn, n) <= Math.log10(budget) + 1e-12;
  if (!fits(1)) return 0;
  if (fn === '1' || fits(LIMIT)) return Infinity;
  let lo = 1;
  let hi = 2;
  while (fits(hi)) {
    lo = hi;
    hi *= 2;
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Okunur sayı biçimi: 1 234 567 → "1.23e6" gibi; küçükler olduğu gibi */
export function formatBig(v: number, locale: string): string {
  if (!Number.isFinite(v)) return '∞';
  if (Math.abs(v) < 1e6) {
    return v.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US', {
      maximumFractionDigits: v < 100 && !Number.isInteger(v) ? 2 : 0,
    });
  }
  const exp = Math.floor(Math.log10(Math.abs(v)));
  return `${(v / 10 ** exp).toFixed(2)}×10^${exp}`;
}

/** log10 değerinden okunur biçim (2ⁿ, n! gibi devasa değerler için) */
export function formatLog10(lg: number, locale: string): string {
  if (lg === -Infinity) return '0';
  if (lg < 6) return formatBig(10 ** lg, locale);
  const exp = Math.floor(lg);
  return `${(10 ** (lg - exp)).toFixed(2)}×10^${exp}`;
}

/** Çizim için 1..maxN arasında benzersiz tam sayı örnekleri */
export function samplePoints(maxN: number, count = 160): number[] {
  const out = new Set<number>();
  for (let k = 0; k < count; k++)
    out.add(Math.max(1, Math.round(1 + ((maxN - 1) * k) / (count - 1))));
  return [...out];
}

/** Milisaniyeyi en uygun birimle yazar (ms, sn, dk, sa, gün, yıl) */
export function formatDuration(ms: number, locale: string): string {
  const units =
    locale === 'tr'
      ? (['ms', 'sn', 'dk', 'sa', 'gün', 'yıl'] as const)
      : (['ms', 's', 'min', 'h', 'days', 'years'] as const);
  const sizes = [1, 1000, 60_000, 3_600_000, 86_400_000, 31_557_600_000];
  if (!Number.isFinite(ms)) return '∞';
  let u = 0;
  for (let k = sizes.length - 1; k >= 0; k--) {
    if (ms >= sizes[k]) {
      u = k;
      break;
    }
  }
  const v = ms / sizes[u];
  return `${formatBig(v < 100 ? Math.round(v * 100) / 100 : Math.round(v), locale)} ${units[u]}`;
}
