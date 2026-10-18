/**
 * YÜK DENGELEYİCİ SİMÜLATÖRÜ (saf mantık)
 * ----------------------------------------
 * Web ve mobil bileşenler bu fonksiyonları çağırır; UI yalnızca sonucu çizer.
 */

export type LbAlgorithm =
  'round-robin' | 'weighted-round-robin' | 'least-connections' | 'ip-hash' | 'random';

export interface LbServer {
  id: string;
  weight: number;
  healthy: boolean;
  /** Aktif bağlantı sayısı */
  activeConnections: number;
  /** Toplam alınan istek */
  served: number;
  /** ms cinsinden ortalama işlem süresi (simülasyon için) */
  latencyMs: number;
}

export interface LbRequest {
  id: number;
  clientIp: string;
  /** Sticky session için oturum kimliği */
  sessionId?: string;
}

export interface LbState {
  algorithm: LbAlgorithm;
  servers: LbServer[];
  rrIndex: number;
  /** Weighted RR için akıllı ağırlık sayacı (nginx smooth weighted round robin) */
  currentWeights: Record<string, number>;
  stickyTable: Record<string, string>;
  stickySessions: boolean;
  totalRequests: number;
  rejected: number;
  log: LbDecision[];
}

export interface LbDecision {
  requestId: number;
  serverId: string | null;
  reason: string;
  clientIp: string;
}

export function createServer(id: string, overrides: Partial<LbServer> = {}): LbServer {
  return {
    id,
    weight: 1,
    healthy: true,
    activeConnections: 0,
    served: 0,
    latencyMs: 50,
    ...overrides,
  };
}

export function createLbState(
  algorithm: LbAlgorithm,
  serverCount = 3,
  stickySessions = false,
): LbState {
  const servers = Array.from({ length: serverCount }, (_, i) =>
    createServer(`s${i + 1}`, { weight: i + 1 <= 1 ? 3 : 1 }),
  );
  return {
    algorithm,
    servers,
    rrIndex: 0,
    currentWeights: Object.fromEntries(servers.map((s) => [s.id, 0])),
    stickyTable: {},
    stickySessions,
    totalRequests: 0,
    rejected: 0,
    log: [],
  };
}

/** Basit, deterministik string hash (FNV-1a) */
export function hashString(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function healthyServers(state: LbState): LbServer[] {
  return state.servers.filter((s) => s.healthy);
}

/** Bir isteği uygun sunucuya atar ve yeni durumu döner (immutable). */
export function routeRequest(
  state: LbState,
  request: LbRequest,
  rng: () => number = Math.random,
): LbState {
  const healthy = healthyServers(state);
  const next: LbState = {
    ...state,
    servers: state.servers.map((s) => ({ ...s })),
    currentWeights: { ...state.currentWeights },
    stickyTable: { ...state.stickyTable },
    log: [...state.log],
    totalRequests: state.totalRequests + 1,
  };

  if (healthy.length === 0) {
    next.rejected += 1;
    next.log.push({
      requestId: request.id,
      serverId: null,
      reason: 'Sağlıklı sunucu yok (503)',
      clientIp: request.clientIp,
    });
    return next;
  }

  let chosen: LbServer | undefined;
  let reason = '';

  // Sticky session: daha önce eşlenmiş ve hâlâ sağlıklı ise aynı sunucu
  if (state.stickySessions && request.sessionId) {
    const stuck = state.stickyTable[request.sessionId];
    const s = stuck ? healthy.find((h) => h.id === stuck) : undefined;
    if (s) {
      chosen = s;
      reason = `Sticky session → ${s.id}`;
    }
  }

  if (!chosen) {
    switch (state.algorithm) {
      case 'round-robin': {
        const idx = state.rrIndex % healthy.length;
        chosen = healthy[idx];
        next.rrIndex = state.rrIndex + 1;
        reason = `Round-robin sıradaki: ${chosen.id}`;
        break;
      }
      case 'weighted-round-robin': {
        // Smooth weighted round-robin (nginx algoritması)
        const total = healthy.reduce((a, s) => a + s.weight, 0);
        let best: LbServer | undefined;
        for (const s of healthy) {
          next.currentWeights[s.id] = (next.currentWeights[s.id] ?? 0) + s.weight;
          if (!best || next.currentWeights[s.id] > next.currentWeights[best.id]) best = s;
        }
        chosen = best!;
        next.currentWeights[chosen.id] -= total;
        reason = `Ağırlıklı RR (w=${chosen.weight}): ${chosen.id}`;
        break;
      }
      case 'least-connections': {
        chosen = healthy.reduce((min, s) =>
          s.activeConnections / s.weight < min.activeConnections / min.weight ? s : min,
        );
        reason = `En az bağlantı (${chosen.activeConnections}): ${chosen.id}`;
        break;
      }
      case 'ip-hash': {
        const idx = hashString(request.clientIp) % healthy.length;
        chosen = healthy[idx];
        reason = `hash(${request.clientIp}) mod ${healthy.length} = ${idx} → ${chosen.id}`;
        break;
      }
      case 'random': {
        chosen = healthy[Math.floor(rng() * healthy.length)];
        reason = `Rastgele: ${chosen.id}`;
        break;
      }
    }
  }

  const target = next.servers.find((s) => s.id === chosen!.id)!;
  target.activeConnections += 1;
  target.served += 1;
  if (state.stickySessions && request.sessionId) next.stickyTable[request.sessionId] = target.id;
  next.log.push({ requestId: request.id, serverId: target.id, reason, clientIp: request.clientIp });
  if (next.log.length > 200) next.log.splice(0, next.log.length - 200);
  return next;
}

/** Bir isteğin tamamlandığını işaretler (aktif bağlantı düşer) */
export function completeRequest(state: LbState, serverId: string): LbState {
  return {
    ...state,
    servers: state.servers.map((s) =>
      s.id === serverId ? { ...s, activeConnections: Math.max(0, s.activeConnections - 1) } : s,
    ),
  };
}

export function setServerHealth(state: LbState, serverId: string, healthy: boolean): LbState {
  return {
    ...state,
    servers: state.servers.map((s) => (s.id === serverId ? { ...s, healthy } : s)),
  };
}

export function setServerWeight(state: LbState, serverId: string, weight: number): LbState {
  return {
    ...state,
    servers: state.servers.map((s) =>
      s.id === serverId ? { ...s, weight: Math.max(1, weight) } : s,
    ),
  };
}

export function addServer(state: LbState): LbState {
  const id = `s${state.servers.length + 1}`;
  return {
    ...state,
    servers: [...state.servers, createServer(id)],
    currentWeights: { ...state.currentWeights, [id]: 0 },
  };
}

export function removeServer(state: LbState): LbState {
  if (state.servers.length <= 1) return state;
  const removed = state.servers[state.servers.length - 1];
  const stickyTable = Object.fromEntries(
    Object.entries(state.stickyTable).filter(([, v]) => v !== removed.id),
  );
  return { ...state, servers: state.servers.slice(0, -1), stickyTable };
}

/** Dağılım istatistikleri: yüzde ve standart sapma (dengesizlik göstergesi) */
export function distributionStats(state: LbState): {
  perServer: Record<string, number>;
  stdDev: number;
} {
  const total = state.servers.reduce((a, s) => a + s.served, 0);
  if (total === 0) {
    return { perServer: Object.fromEntries(state.servers.map((s) => [s.id, 0])), stdDev: 0 };
  }
  const perServer = Object.fromEntries(state.servers.map((s) => [s.id, (s.served / total) * 100]));
  const mean = 100 / (state.servers.length || 1);
  const variance =
    state.servers.reduce((a, s) => a + Math.pow(perServer[s.id] - mean, 2), 0) /
    (state.servers.length || 1);
  return { perServer, stdDev: Math.sqrt(variance) };
}

export const LB_ALGORITHMS: { id: LbAlgorithm; label: { tr: string; en: string } }[] = [
  { id: 'round-robin', label: { tr: 'Round Robin', en: 'Round Robin' } },
  {
    id: 'weighted-round-robin',
    label: { tr: 'Ağırlıklı Round Robin', en: 'Weighted Round Robin' },
  },
  { id: 'least-connections', label: { tr: 'En Az Bağlantı', en: 'Least Connections' } },
  { id: 'ip-hash', label: { tr: 'IP Hash', en: 'IP Hash' } },
  { id: 'random', label: { tr: 'Rastgele', en: 'Random' } },
];
