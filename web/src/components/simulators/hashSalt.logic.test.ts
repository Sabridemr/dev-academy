import { describe, expect, it } from 'vitest';
import {
  attackSeconds,
  buildDictionary,
  estimateSlowHashMs,
  formatDuration,
  hasWebCrypto,
  inDictionary,
  pbkdf2Hex,
  pbkdf2WorkFactor,
  randomSalt,
  saltedSha256,
  sha256Hex,
  slowWorkFactor,
  toHex,
} from './hashSalt.logic';

const crypto = hasWebCrypto() ? it : it.skip;

describe('hashSalt.logic', () => {
  it('hex ve salt üretimi', () => {
    expect(toHex(new Uint8Array([0, 15, 255]))).toBe('000fff');
    const fixed = randomSalt(4, (a) => a.fill(0xab));
    expect(fixed).toBe('abababab');
  });

  crypto('SHA-256 ve PBKDF2-HMAC-SHA256 bilinen test vektörleri', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(await pbkdf2Hex('password', 'salt', 1)).toBe(
      '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b',
    );
    expect(await pbkdf2Hex('password', 'salt', 2)).toBe(
      'ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43',
    );
  });

  crypto('aynı şifre: tuzsuz aynı hash, farklı salt ile farklı hash', async () => {
    expect(await sha256Hex('parola123')).toBe(await sha256Hex('parola123'));
    const a = await saltedSha256('parola123', 'aa');
    const b = await saltedSha256('parola123', 'bb');
    expect(a).not.toBe(b);
    expect(await saltedSha256('parola123', 'aa')).toBe(a);
  });

  it('1000 adaylık deterministik sözlük', () => {
    const d = buildDictionary();
    expect(d).toHaveLength(1000);
    expect(new Set(d).size).toBe(1000);
    expect(buildDictionary()).toEqual(d);
    expect(inDictionary('galatasaray1')).toBe(true);
    expect(inDictionary('Password123')).toBe(true);
    expect(inDictionary('k8#Qz!v2-mL0')).toBe(false);
  });

  it('saldırı süresi: salt hesap sayısıyla, yavaş hash iş katsayısıyla çarpar', () => {
    const base = { dictionary: 1000, users: 10_000, fastGuessesPerSecond: 1e9, workFactor: 1 };
    const plain = attackSeconds({ ...base, salted: false });
    expect(plain).toBeCloseTo(1e-6);
    // tuzsuzda hesap sayısı süreyi değiştirmez
    expect(attackSeconds({ ...base, users: 1, salted: false })).toBe(plain);
    expect(attackSeconds({ ...base, salted: true })).toBeCloseTo(plain * 10_000);
    const pb = attackSeconds({ ...base, salted: true, workFactor: pbkdf2WorkFactor(600_000) });
    expect(pb).toBeCloseTo(plain * 10_000 * 1_200_000);
  });

  it('yavaş hash tahmini: bcrypt cost +1 süreyi ikiye katlar, argon2 bellekle doğrusal', () => {
    expect(estimateSlowHashMs('bcrypt', 11) / estimateSlowHashMs('bcrypt', 10)).toBeCloseTo(2);
    expect(estimateSlowHashMs('scrypt', 16) / estimateSlowHashMs('scrypt', 15)).toBeCloseTo(2);
    expect(estimateSlowHashMs('argon2id', 38) / estimateSlowHashMs('argon2id', 19)).toBeCloseTo(2);
    expect(slowWorkFactor('bcrypt', 10)).toBeCloseTo(75_000);
  });

  it('süre biçimlendirme', () => {
    expect(formatDuration(0, 'tr')).toBe('anında');
    expect(formatDuration(0.25, 'en')).toBe('250 ms');
    expect(formatDuration(90, 'tr')).toBe('1.5 dk');
    expect(formatDuration(3 * 86_400, 'en')).toBe('3.0 days');
    expect(formatDuration(Infinity, 'tr')).toBe('∞');
    expect(formatDuration(1e15, 'tr')).toMatch(/yıl$/);
  });
});
