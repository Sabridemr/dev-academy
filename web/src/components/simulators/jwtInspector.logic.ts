/**
 * JWT inceleyicinin saf yardımcıları: base64url kodlama/çözme, ayrıştırma, süre kontrolü ve
 * Web Crypto (crypto.subtle) ile HS256 imzalama/doğrulama. Yalnızca HS256 desteklenir.
 */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_INDEX = new Map(Array.from(B64, (c, i) => [c, i]));

/** Byte dizisini dolgusuz base64url'e çevirir */
export function base64urlEncode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

/** base64url (dolgulu ya da dolgusuz; standart + / da kabul edilir) → byte. Geçersizse hata fırlatır */
export function base64urlDecode(input: string): Uint8Array {
  const s = input.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  if (s.length % 4 === 1) throw new Error('invalid base64url length');
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const c of s) {
    const v = B64_INDEX.get(c);
    if (v === undefined) throw new Error(`invalid base64url character: ${c}`);
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

export function base64urlEncodeString(text: string): string {
  return base64urlEncode(new TextEncoder().encode(text));
}

export function base64urlDecodeString(input: string): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(base64urlDecode(input));
}

export interface ParsedJwt {
  ok: boolean;
  parts: [string, string, string];
  header: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  headerJson: string;
  payloadJson: string;
  error?: string;
}

function parseJsonPart(part: string): {
  obj: Record<string, unknown> | null;
  json: string;
  error?: string;
} {
  try {
    const json = base64urlDecodeString(part);
    const obj = JSON.parse(json) as unknown;
    if (!obj || typeof obj !== 'object' || Array.isArray(obj))
      return { obj: null, json, error: 'not an object' };
    return { obj: obj as Record<string, unknown>, json };
  } catch (e) {
    return { obj: null, json: '', error: e instanceof Error ? e.message : String(e) };
  }
}

/** JWT'yi üç parçaya ayırır ve başlık/gövdeyi çözer (imzayı doğrulamaz) */
export function parseJwt(token: string): ParsedJwt {
  const raw = token.trim().split('.');
  const parts: [string, string, string] = [raw[0] ?? '', raw[1] ?? '', raw.slice(2).join('.')];
  if (raw.length !== 3) {
    return {
      ok: false,
      parts,
      header: null,
      payload: null,
      headerJson: '',
      payloadJson: '',
      error: `expected 3 parts, got ${raw.length}`,
    };
  }
  const h = parseJsonPart(parts[0]);
  const p = parseJsonPart(parts[1]);
  return {
    ok: !!h.obj && !!p.obj,
    parts,
    header: h.obj,
    payload: p.obj,
    headerJson: h.obj ? JSON.stringify(h.obj, null, 2) : h.json,
    payloadJson: p.obj ? JSON.stringify(p.obj, null, 2) : p.json,
    error: h.error ? `header: ${h.error}` : p.error ? `payload: ${p.error}` : undefined,
  };
}

/** JSON metnini sıkıştırıp base64url'e çevirir; geçersiz JSON'da null */
export function encodeJsonPart(json: string): string | null {
  try {
    return base64urlEncodeString(JSON.stringify(JSON.parse(json)));
  } catch {
    return null;
  }
}

export type ExpStatus = 'none' | 'valid' | 'expired' | 'not-yet-valid';

export function expStatus(payload: Record<string, unknown> | null, nowSec: number): ExpStatus {
  if (!payload) return 'none';
  const nbf = payload.nbf;
  const exp = payload.exp;
  if (typeof nbf === 'number' && nowSec < nbf) return 'not-yet-valid';
  if (typeof exp !== 'number') return 'none';
  return nowSec >= exp ? 'expired' : 'valid';
}

export type AlgCheck = 'ok' | 'none' | 'unsupported' | 'missing';

/** Sunucu algoritmayı token'dan değil kendi yapılandırmasından almalı: burada yalnızca HS256 kabul edilir */
export function checkAlg(header: Record<string, unknown> | null): AlgCheck {
  const alg = header?.alg;
  if (typeof alg !== 'string') return 'missing';
  if (alg.toLowerCase() === 'none') return 'none';
  return alg === 'HS256' ? 'ok' : 'unsupported';
}

/** Sabit zamanlı karşılaştırma (zamanlama saldırısına karşı) */
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function subtle(): SubtleCrypto | null {
  return typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle
    ? globalThis.crypto.subtle
    : null;
}

export function hasWebCrypto(): boolean {
  return subtle() !== null;
}

/** HMAC-SHA256(secret, signingInput) → base64url */
export async function hs256(signingInput: string, secret: string): Promise<string> {
  const s = subtle();
  if (!s) throw new Error('Web Crypto unavailable');
  const enc = new TextEncoder();
  const key = await s.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await s.sign('HMAC', key, enc.encode(signingInput));
  return base64urlEncode(new Uint8Array(sig));
}

/** Başlık ve gövde JSON'larından imzalı HS256 token üretir */
export async function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const input = `${base64urlEncodeString(JSON.stringify(header))}.${base64urlEncodeString(JSON.stringify(payload))}`;
  return `${input}.${await hs256(input, secret)}`;
}

export type VerifyResult =
  | { status: 'valid' }
  | { status: 'invalid-signature'; expected: string }
  | { status: 'rejected-none' }
  | { status: 'unsupported-alg'; alg: string }
  | { status: 'malformed'; error: string };

/** İmza doğrulama: alg=none ve HS256 dışındaki algoritmalar reddedilir */
export async function verifyJwt(token: string, secret: string): Promise<VerifyResult> {
  const p = parseJwt(token);
  if (!p.ok) return { status: 'malformed', error: p.error ?? 'malformed' };
  const alg = checkAlg(p.header);
  if (alg === 'none') return { status: 'rejected-none' };
  if (alg !== 'ok') return { status: 'unsupported-alg', alg: String(p.header?.alg ?? '?') };
  const expected = await hs256(`${p.parts[0]}.${p.parts[1]}`, secret);
  return constantTimeEqual(expected, p.parts[2])
    ? { status: 'valid' }
    : { status: 'invalid-signature', expected };
}

/** "alg: none" hilesi: başlığı none yapar, rolü yükseltir, imzayı boşaltır */
export function forgeNoneToken(token: string): string {
  const p = parseJwt(token);
  const payload = { ...(p.payload ?? {}), role: 'admin' };
  return `${base64urlEncodeString(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${base64urlEncodeString(JSON.stringify(payload))}.`;
}

export function samplePayload(nowSec: number): Record<string, unknown> {
  return { sub: '1234567890', name: 'Ada Lovelace', role: 'user', iat: nowSec, exp: nowSec + 3600 };
}

export const SAMPLE_HEADER = { alg: 'HS256', typ: 'JWT' } as const;
export const DEFAULT_SECRET = 'devacademy-demo-secret';
