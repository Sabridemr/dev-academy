/**
 * RATE LIMITER SİMÜLATÖRÜ (saf mantık)
 * ------------------------------------
 * Token bucket, leaky bucket, fixed window, sliding window log ve sliding window counter.
 * Tüm fonksiyonlar immutable; zaman (now, ms) dışarıdan verilir ki UI ve testler deterministik olsun.
 */

export type RateLimitAlgorithm =
  | 'token-bucket'
  | 'leaky-bucket'
  | 'fixed-window'
  | 'sliding-window-log'
  | 'sliding-window-counter';

export interface RateLimitDecision {
  allowed: boolean;
  reason: string;
  at: number;
}

export interface TokenBucketState {
  algorithm: 'token-bucket';
  capacity: number;
  /** saniyede eklenen token */
  refillPerSec: number;
  tokens: number;
  lastRefill: number;
}

export interface LeakyBucketState {
  algorithm: 'leaky-bucket';
  capacity: number;
  /** saniyede işlenen (sızan) istek */
  leakPerSec: number;
  queue: number[]; // kuyruktaki isteklerin geliş zamanları
  lastLeak: number;
}

export interface FixedWindowState {
  algorithm: 'fixed-window';
  limit: number;
  windowMs: number;
  windowStart: number;
  count: number;
}

export interface SlidingWindowLogState {
  algorithm: 'sliding-window-log';
  limit: number;
  windowMs: number;
  log: number[];
}

export interface SlidingWindowCounterState {
  algorithm: 'sliding-window-counter';
  limit: number;
  windowMs: number;
  currentWindowStart: number;
  currentCount: number;
  previousCount: number;
}

export type RateLimiterState =
  | TokenBucketState
  | LeakyBucketState
  | FixedWindowState
  | SlidingWindowLogState
  | SlidingWindowCounterState;

export interface RateLimiterConfig {
  algorithm: RateLimitAlgorithm;
  /** Pencere başına / kova kapasitesi */
  limit: number;
  /** Pencere süresi ms (window algoritmaları) */
  windowMs: number;
  /** Saniyede dolum/sızma hızı (bucket algoritmaları) */
  ratePerSec: number;
}

export function createRateLimiter(config: RateLimiterConfig, now: number): RateLimiterState {
  switch (config.algorithm) {
    case 'token-bucket':
      return {
        algorithm: 'token-bucket',
        capacity: config.limit,
        refillPerSec: config.ratePerSec,
        tokens: config.limit,
        lastRefill: now,
      };
    case 'leaky-bucket':
      return {
        algorithm: 'leaky-bucket',
        capacity: config.limit,
        leakPerSec: config.ratePerSec,
        queue: [],
        lastLeak: now,
      };
    case 'fixed-window':
      return {
        algorithm: 'fixed-window',
        limit: config.limit,
        windowMs: config.windowMs,
        windowStart: now,
        count: 0,
      };
    case 'sliding-window-log':
      return {
        algorithm: 'sliding-window-log',
        limit: config.limit,
        windowMs: config.windowMs,
        log: [],
      };
    case 'sliding-window-counter':
      return {
        algorithm: 'sliding-window-counter',
        limit: config.limit,
        windowMs: config.windowMs,
        currentWindowStart: now,
        currentCount: 0,
        previousCount: 0,
      };
  }
}

/** Zamanı ilerletir (dolum/sızma uygular) — istek olmadan da çağrılabilir */
export function advanceRateLimiter(state: RateLimiterState, now: number): RateLimiterState {
  switch (state.algorithm) {
    case 'token-bucket': {
      const elapsed = Math.max(0, now - state.lastRefill) / 1000;
      const tokens = Math.min(state.capacity, state.tokens + elapsed * state.refillPerSec);
      return { ...state, tokens, lastRefill: now };
    }
    case 'leaky-bucket': {
      const elapsed = Math.max(0, now - state.lastLeak) / 1000;
      const leaked = Math.floor(elapsed * state.leakPerSec);
      if (leaked <= 0) return state;
      const queue = state.queue.slice(leaked);
      // Sızma zamanını tam sayı sızıntıya göre ilerlet (kalan kesirleri kaybetmemek için)
      const lastLeak = state.lastLeak + (leaked / state.leakPerSec) * 1000;
      return { ...state, queue, lastLeak };
    }
    case 'fixed-window': {
      if (now - state.windowStart >= state.windowMs) {
        const windowsPassed = Math.floor((now - state.windowStart) / state.windowMs);
        return {
          ...state,
          windowStart: state.windowStart + windowsPassed * state.windowMs,
          count: 0,
        };
      }
      return state;
    }
    case 'sliding-window-log':
      return { ...state, log: state.log.filter((ts) => now - ts < state.windowMs) };
    case 'sliding-window-counter': {
      if (now - state.currentWindowStart >= state.windowMs) {
        const windowsPassed = Math.floor((now - state.currentWindowStart) / state.windowMs);
        return {
          ...state,
          currentWindowStart: state.currentWindowStart + windowsPassed * state.windowMs,
          previousCount: windowsPassed === 1 ? state.currentCount : 0,
          currentCount: 0,
        };
      }
      return state;
    }
  }
}

/** Bir isteği değerlendirir; yeni durum ve karar döner */
export function tryAcquire(
  state: RateLimiterState,
  now: number,
): { state: RateLimiterState; decision: RateLimitDecision } {
  const s = advanceRateLimiter(state, now);
  switch (s.algorithm) {
    case 'token-bucket': {
      if (s.tokens >= 1) {
        return {
          state: { ...s, tokens: s.tokens - 1 },
          decision: {
            allowed: true,
            reason: `Token alındı (kalan ${Math.floor(s.tokens - 1)})`,
            at: now,
          },
        };
      }
      return { state: s, decision: { allowed: false, reason: 'Kova boş — token yok', at: now } };
    }
    case 'leaky-bucket': {
      if (s.queue.length < s.capacity) {
        return {
          state: { ...s, queue: [...s.queue, now] },
          decision: {
            allowed: true,
            reason: `Kuyruğa alındı (${s.queue.length + 1}/${s.capacity})`,
            at: now,
          },
        };
      }
      return {
        state: s,
        decision: { allowed: false, reason: 'Kova dolu — istek düşürüldü', at: now },
      };
    }
    case 'fixed-window': {
      if (s.count < s.limit) {
        return {
          state: { ...s, count: s.count + 1 },
          decision: { allowed: true, reason: `Pencere sayacı ${s.count + 1}/${s.limit}`, at: now },
        };
      }
      return { state: s, decision: { allowed: false, reason: 'Pencere limiti doldu', at: now } };
    }
    case 'sliding-window-log': {
      if (s.log.length < s.limit) {
        return {
          state: { ...s, log: [...s.log, now] },
          decision: {
            allowed: true,
            reason: `Son ${s.windowMs}ms içinde ${s.log.length + 1}/${s.limit}`,
            at: now,
          },
        };
      }
      return { state: s, decision: { allowed: false, reason: 'Kayan pencere dolu', at: now } };
    }
    case 'sliding-window-counter': {
      const elapsedInWindow = now - s.currentWindowStart;
      const previousWeight = Math.max(0, 1 - elapsedInWindow / s.windowMs);
      const estimated = s.previousCount * previousWeight + s.currentCount;
      if (estimated + 1 <= s.limit) {
        return {
          state: { ...s, currentCount: s.currentCount + 1 },
          decision: {
            allowed: true,
            reason: `Tahmini ${(estimated + 1).toFixed(1)}/${s.limit} (önceki pencere ağırlığı ${previousWeight.toFixed(2)})`,
            at: now,
          },
        };
      }
      return {
        state: s,
        decision: {
          allowed: false,
          reason: `Tahmini ${estimated.toFixed(1)} ≥ ${s.limit}`,
          at: now,
        },
      };
    }
  }
}

/** UI için doluluk oranı 0..1 */
export function rateLimiterFill(state: RateLimiterState): number {
  switch (state.algorithm) {
    case 'token-bucket':
      return state.tokens / state.capacity;
    case 'leaky-bucket':
      return state.queue.length / state.capacity;
    case 'fixed-window':
      return state.count / state.limit;
    case 'sliding-window-log':
      return state.log.length / state.limit;
    case 'sliding-window-counter':
      return state.currentCount / state.limit;
  }
}

export const RATE_LIMIT_ALGORITHMS: {
  id: RateLimitAlgorithm;
  label: { tr: string; en: string };
}[] = [
  { id: 'token-bucket', label: { tr: 'Token Bucket', en: 'Token Bucket' } },
  { id: 'leaky-bucket', label: { tr: 'Leaky Bucket', en: 'Leaky Bucket' } },
  { id: 'fixed-window', label: { tr: 'Sabit Pencere', en: 'Fixed Window' } },
  { id: 'sliding-window-log', label: { tr: 'Kayan Pencere (Log)', en: 'Sliding Window Log' } },
  {
    id: 'sliding-window-counter',
    label: { tr: 'Kayan Pencere (Sayaç)', en: 'Sliding Window Counter' },
  },
];
