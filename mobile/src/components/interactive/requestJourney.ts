/**
 * İSTEK YOLCULUĞU — saf mantık (web/src/components/simulators/RequestJourneySim.tsx'ten birebir taşındı).
 * Bileşenden bağımsızdır; testlerde doğrudan kullanılır.
 */

export type HopKind = 'client' | 'dns' | 'cdn' | 'lb' | 'gateway' | 'service' | 'cache' | 'db' | 'net' | 'generic';

export interface Hop {
  id: string;
  label: string;
  kind: HopKind;
  /** Bu katmanın kendi işlem süresi (ms) */
  ms: number;
}

export interface Journey {
  visited: { hop: Hop; ms: number }[];
  /** Yanıtın döndüğü (ya da hatanın oluştuğu) katmanın indeksi */
  terminal: number;
  failed: boolean;
  total: number;
}

export const DEFAULT_LAYERS = ['user', 'dns', 'cdn', 'lb', 'gateway', 'service', 'cache', 'db'];
/** Soğuk başlangıç: lambda katmanına eklenen süre (ms) */
export const COLD_START_MS = 770;

/** "ad:ms" biçimini ayırır: `ranking:30` → { id: 'ranking', ms: 30 } */
export function splitSpec(spec: string): { id: string; ms?: number } {
  const i = spec.lastIndexOf(':');
  if (i > 0) {
    const ms = Number(spec.slice(i + 1));
    if (Number.isFinite(ms)) return { id: spec.slice(0, i), ms };
  }
  return { id: spec };
}

/** Ders parametresindeki serbest katman adını bilinen bir türe eşler */
export function classify(name: string): { kind: HopKind; ms: number } {
  const n = name.toLowerCase();
  if (/^(user|client|browser|sender)/.test(n)) return { kind: 'client', ms: 2 };
  if (n.includes('dns')) return { kind: 'dns', ms: 40 };
  if (n.includes('cdn') || n.includes('edge')) return { kind: 'cdn', ms: 15 };
  if (n === 'lb' || n.includes('load')) return { kind: 'lb', ms: 2 };
  if (n.includes('gateway') || n === 'bff' || n.includes('routing') || n.includes('auth') || n.includes('rate')) return { kind: 'gateway', ms: 5 };
  if (n.includes('cache') || n.includes('redis')) return { kind: 'cache', ms: 2 };
  if (n === 'db' || n.includes('database') || n.includes('postgres')) return { kind: 'db', ms: 25 };
  if (['tcp', 'tls', 'http', 'websocket', 'quic'].some((k) => n.includes(k))) return { kind: 'net', ms: 0 };
  if (n.includes('lambda-cold')) return { kind: 'service', ms: 800 };
  if (n.includes('service') || n.includes('lambda') || ['orders', 'catalog', 'payments', 'aggregation', 'circuit-breaker'].some((k) => n.includes(k))) return { kind: 'service', ms: 30 };
  return { kind: 'generic', ms: 8 };
}

/**
 * Ders parametrelerinden katman listesini çıkarır (layers | path | stages | services, en fazla 10);
 * ilk katman bir istemci değilse başa "user" eklenir.
 */
export function parseLayers(params: Record<string, unknown>): string[] {
  const raw = ['layers', 'path', 'stages', 'services'].map((k) => params[k]).find((v): v is string => typeof v === 'string' && v.trim().length > 0);
  const names = raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10)
    : DEFAULT_LAYERS;
  return classify(splitSpec(names[0]).id).kind === 'client' ? names : ['user', ...names];
}

export interface HopOptions {
  slowService: string;
  slowPenaltyMs: number;
  /** showColdStart parametresi verildi mi */
  coldToggle: boolean;
  coldStart: boolean;
}

export function buildHops(layers: string[], o: HopOptions): Hop[] {
  return layers.map((spec) => {
    const { id, ms: override } = splitSpec(spec);
    const c = classify(id);
    const lower = id.toLowerCase();
    const lambdaCold = o.coldToggle && o.coldStart && lower.includes('lambda') && !lower.includes('lambda-cold');
    return { id, label: id, kind: c.kind, ms: (override ?? c.ms) + (id === o.slowService ? o.slowPenaltyMs : 0) + (lambdaCold ? COLD_START_MS : 0) };
  });
}

export interface JourneyOptions {
  dns: boolean;
  cdn: boolean;
  cache: boolean;
  rttMs: number;
  http3: boolean;
  injectFail: boolean;
  failureStage: string;
}

/** Bir isteğin yolunu ve gecikmesini hesaplar (ağ: katmanlar arası RTT'nin bir kısmı) */
export function computeJourney(hops: Hop[], o: JourneyOptions): Journey {
  const visited: { hop: Hop; ms: number }[] = [];
  let terminal = hops.length - 1;
  let failed = false;
  for (let i = 0; i < hops.length; i++) {
    const h = hops[i];
    let ms = h.ms;
    if (h.kind === 'dns' && o.dns) ms = 1;
    if (h.kind === 'net') ms = o.rttMs; // tcp/tls/http el sıkışmaları birer RTT
    if (h.kind === 'net' && o.http3 && h.id.toLowerCase() === 'tcp') ms = 0; // QUIC: taşıma + TLS 1.3 tek RTT'de
    // Katmana ulaşmak için ağ gecikmesi: istemciden ilk sıçrama uzun, iç ağ kısa
    const hopNet = i === 0 ? 0 : i === 1 ? o.rttMs / 2 : 1;
    visited.push({ hop: h, ms: ms + hopNet });
    if (o.injectFail && h.id === o.failureStage) {
      failed = true;
      terminal = i;
      break;
    }
    if ((h.kind === 'cdn' && o.cdn) || (h.kind === 'cache' && o.cache)) {
      terminal = i;
      break;
    }
  }
  const total = visited.reduce((a, v) => a + v.ms, 0) + o.rttMs / 2; // yanıtın dönüşü
  return { visited, terminal, failed, total };
}

/** 20 isteklik toplu gönderim: DNS %80 önbellekte, cache hit oranı hitRate (%) */
export function batchJourney(hops: Hop[], o: JourneyOptions, hitRate: number, rng: () => number = Math.random, count = 20): { avg: number; p95: number } {
  const totals = Array.from({ length: count }, () => computeJourney(hops, { ...o, dns: rng() < 0.8, cache: rng() * 100 < hitRate }).total).sort((a, b) => a - b);
  return {
    avg: totals.reduce((a, b) => a + b, 0) / totals.length,
    p95: totals[Math.floor(totals.length * 0.95) - 1] ?? totals[totals.length - 1],
  };
}
