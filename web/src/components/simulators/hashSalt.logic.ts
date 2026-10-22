/**
 * Şifre hash'leme ve salt simülatörünün saf mantığı. Her şey tarayıcıda çalışır; şifre hiçbir yere
 * gönderilmez. SHA-256 ve PBKDF2 gerçek (Web Crypto: crypto.subtle.digest / deriveBits);
 * bcrypt/scrypt/argon2 süreleri kaba bir maliyet modeliyle TAHMİN edilir (donanıma göre değişir).
 */

const enc = new TextEncoder();

function subtle(): SubtleCrypto | null {
  return typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle
    ? globalThis.crypto.subtle
    : null;
}

export function hasWebCrypto(): boolean {
  return subtle() !== null;
}

export function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** n baytlık rastgele salt (hex). Test için rastgele kaynak verilebilir */
export function randomSalt(
  n = 16,
  fill: (a: Uint8Array) => Uint8Array = (a) => globalThis.crypto.getRandomValues(a),
): string {
  return toHex(fill(new Uint8Array(n)));
}

export async function sha256Hex(text: string): Promise<string> {
  const s = subtle();
  if (!s) throw new Error('Web Crypto unavailable');
  return toHex(await s.digest('SHA-256', enc.encode(text)));
}

/** Basit tuzlu hash: SHA-256(salt ‖ şifre). Salt'ı göstermek için; gerçek sistemde yavaş hash kullan */
export function saltedSha256(password: string, salt: string): Promise<string> {
  return sha256Hex(salt + password);
}

/** PBKDF2-HMAC-SHA256, 32 bayt çıktı (hex) */
export async function pbkdf2Hex(
  password: string,
  salt: string,
  iterations: number,
): Promise<string> {
  const s = subtle();
  if (!s) throw new Error('Web Crypto unavailable');
  const key = await s.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await s.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations },
    key,
    256,
  );
  return toHex(bits);
}

/** Bir işlemi çalıştırıp süresini (ms) ölçer */
export async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t0 = performance.now();
  const value = await fn();
  return { value, ms: performance.now() - t0 };
}

/* ------------------------------------------------------------------ yavaş hash tahmini */

export type SlowAlgo = 'bcrypt' | 'scrypt' | 'argon2id';

/**
 * Kaba maliyet modeli (tek çekirdek, sunucu sınıfı işlemci; yalnızca büyüklük sırası için):
 *  - bcrypt: süre 2^cost ile katlanır; cost 10 ≈ 75 ms kabulü.
 *  - scrypt: süre N·r ile doğrusal; N=2^15, r=8 ≈ 50 ms kabulü.
 *  - argon2id: süre bellek(MiB)·t ile doğrusal; 19 MiB, t=2 ≈ 40 ms kabulü.
 */
export function estimateSlowHashMs(algo: SlowAlgo, cost: number): number {
  switch (algo) {
    case 'bcrypt':
      return 75 * 2 ** (cost - 10);
    case 'scrypt':
      // cost = log2(N), r = 8
      return 50 * 2 ** (cost - 15);
    case 'argon2id':
      // cost = bellek (MiB), t = 2
      return (40 * cost) / 19;
  }
}

export const SLOW_COST: Record<SlowAlgo, { min: number; max: number; def: number; label: string }> =
  {
    bcrypt: { min: 4, max: 16, def: 12, label: 'cost' },
    scrypt: { min: 10, max: 20, def: 17, label: 'log2 N' },
    argon2id: { min: 8, max: 256, def: 19, label: 'MiB' },
  };

/* ------------------------------------------------------------------ saldırgan modeli */

const BASE_WORDS = [
  '123456',
  'password',
  'qwerty',
  'abc123',
  'letmein',
  'monkey',
  'dragon',
  'iloveyou',
  'admin',
  'welcome',
  'sunshine',
  'football',
  'master',
  'shadow',
  'superman',
  'trustno1',
  'princess',
  'baseball',
  'starwars',
  'hello',
  'freedom',
  'whatever',
  'qazwsx',
  'michael',
  'login',
  'passw0rd',
  'charlie',
  'donald',
  'ninja',
  'mustang',
  'parola',
  'sifre',
  'galatasaray',
  'fenerbahce',
  'besiktas',
  'trabzonspor',
  'istanbul',
  'ankara',
  'izmir',
  'turkiye',
  'askim',
  'canim',
  'bebegim',
  'kartal',
  'aslan',
  'yildiz',
  'deniz',
  'mehmet',
  'ahmet',
  'ayse',
];
const SUFFIXES = [
  '',
  '1',
  '12',
  '123',
  '1234',
  '!',
  '2023',
  '2024',
  '2025',
  '01',
  '07',
  '34',
  '00',
  '99',
  '1!',
  '.',
  '_1',
  '06',
  '35',
  '?',
];

/** 50 yaygın kelime × 20 yaygın son ek = 1000 adaylık deterministik sözlük */
export function buildDictionary(): string[] {
  const out: string[] = [];
  for (const s of SUFFIXES) for (const w of BASE_WORDS) out.push(w + s);
  return out;
}

let dictCache: Set<string> | null = null;
export function inDictionary(password: string): boolean {
  dictCache ??= new Set(buildDictionary());
  return dictCache.has(password.toLowerCase());
}

export interface AttackInput {
  /** Sözlükteki aday sayısı */
  dictionary: number;
  /** Sızan hesap sayısı */
  users: number;
  salted: boolean;
  /** Saldırganın hızlı hash (tek SHA-256) için saniyedeki deneme sayısı */
  fastGuessesPerSecond: number;
  /** Bir denemenin tek SHA-256'ya göre kaç kat pahalı olduğu (SHA-256 = 1) */
  workFactor: number;
}

/** Saldırganın tüm hesaplar için sözlüğü tamamen denemesi gereken süre (sn) */
export function attackSeconds(a: AttackInput): number {
  const hashes = a.dictionary * (a.salted ? a.users : 1);
  return (hashes * a.workFactor) / a.fastGuessesPerSecond;
}

/** Bir hash'in kaç SHA-256'ya denk geldiği: PBKDF2-HMAC-SHA256 her iterasyonda 2 SHA-256 sıkıştırması */
export function pbkdf2WorkFactor(iterations: number): number {
  return 2 * iterations;
}

/** Yavaş hash'in iş katsayısı: tahmini süre / tek SHA-256 süresi (≈ 1 µs kabulü, tek çekirdek) */
export function slowWorkFactor(algo: SlowAlgo, cost: number): number {
  return estimateSlowHashMs(algo, cost) / 0.001;
}

export function formatDuration(sec: number, locale: 'tr' | 'en'): string {
  const tr = locale === 'tr';
  if (!Number.isFinite(sec)) return '∞';
  if (sec < 0.001) return tr ? 'anında' : 'instant';
  if (sec < 1) return `${Math.round(sec * 1000)} ms`;
  const units: [number, string, string][] = [
    [31_536_000, 'yıl', 'years'],
    [86_400, 'gün', 'days'],
    [3_600, 'saat', 'hours'],
    [60, 'dk', 'min'],
    [1, 'sn', 's'],
  ];
  for (const [n, t, e] of units) {
    if (sec >= n) {
      const v = sec / n;
      const shown =
        v >= 1e6
          ? v.toExponential(1)
          : v >= 100
            ? Math.round(v).toLocaleString(locale)
            : v.toFixed(1);
      return `${shown} ${tr ? t : e}`;
    }
  }
  return `${sec.toFixed(1)} s`;
}
