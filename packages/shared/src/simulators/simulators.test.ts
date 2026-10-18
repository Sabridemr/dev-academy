import { describe, expect, it } from 'vitest';
import { createLbState, routeRequest, setServerHealth, distributionStats, completeRequest } from './loadBalancer';
import { cacheGet, cacheSet, createCacheState, seedCacheDb, hitRatio, cacheFlush } from './cache';
import { createRateLimiter, tryAcquire, advanceRateLimiter } from './rateLimiter';
import { createRing, locateKey, addRingNode, movedKeys, generateKeys, modHashMoved, ringDistribution } from './consistentHashing';
import { generateLinearData, runGradientDescent, closedFormSolution, sampleLossSurface } from './gradientDescent';
import { computeSelfAttention, softmax } from './attention';
import { estimateCapacity, DEFAULT_CAPACITY_INPUT, formatBytes } from './capacity';

describe('Load balancer', () => {
  it('round-robin sırayla dağıtır', () => {
    let s = createLbState('round-robin', 3);
    for (let i = 0; i < 6; i++) s = routeRequest(s, { id: i, clientIp: '1.1.1.1' });
    expect(s.servers.map((x) => x.served)).toEqual([2, 2, 2]);
    expect(s.log.map((l) => l.serverId)).toEqual(['s1', 's2', 's3', 's1', 's2', 's3']);
  });

  it('sağlıksız sunucuya istek gitmez', () => {
    let s = setServerHealth(createLbState('round-robin', 3), 's2', false);
    for (let i = 0; i < 4; i++) s = routeRequest(s, { id: i, clientIp: '1.1.1.1' });
    expect(s.servers[1].served).toBe(0);
    expect(s.servers[0].served + s.servers[2].served).toBe(4);
  });

  it('ağırlıklı RR ağırlığa orantılı dağıtır', () => {
    let s = createLbState('weighted-round-robin', 3); // s1 ağırlık 3, diğerleri 1
    for (let i = 0; i < 10; i++) s = routeRequest(s, { id: i, clientIp: '1.1.1.1' });
    expect(s.servers[0].served).toBe(6);
    expect(s.servers[1].served).toBe(2);
    expect(s.servers[2].served).toBe(2);
  });

  it('least-connections en boş sunucuyu seçer', () => {
    let s = createLbState('least-connections', 3);
    s = { ...s, servers: s.servers.map((x) => ({ ...x, weight: 1 })) };
    s = routeRequest(s, { id: 1, clientIp: 'a' }); // s1
    s = routeRequest(s, { id: 2, clientIp: 'a' }); // s2
    s = routeRequest(s, { id: 3, clientIp: 'a' }); // s3 (tek boş sunucu)
    expect(s.log.at(-1)?.serverId).toBe('s3');
    s = completeRequest(s, 's2'); // s2 boşaldı
    s = routeRequest(s, { id: 4, clientIp: 'a' });
    expect(s.log.at(-1)?.serverId).toBe('s2');
  });

  it('ip-hash aynı IP’yi aynı sunucuya gönderir', () => {
    let s = createLbState('ip-hash', 3);
    for (let i = 0; i < 5; i++) s = routeRequest(s, { id: i, clientIp: '10.0.0.7' });
    expect(new Set(s.log.map((l) => l.serverId)).size).toBe(1);
  });

  it('sticky session önceki eşleşmeyi korur', () => {
    let s = createLbState('round-robin', 3, true);
    s = routeRequest(s, { id: 1, clientIp: 'a', sessionId: 'sess-1' });
    s = routeRequest(s, { id: 2, clientIp: 'b', sessionId: 'sess-2' });
    s = routeRequest(s, { id: 3, clientIp: 'a', sessionId: 'sess-1' });
    expect(s.log[2].serverId).toBe(s.log[0].serverId);
  });

  it('hiç sağlıklı sunucu yoksa reddeder', () => {
    let s = createLbState('round-robin', 1);
    s = setServerHealth(s, 's1', false);
    s = routeRequest(s, { id: 1, clientIp: 'a' });
    expect(s.rejected).toBe(1);
    expect(distributionStats(s).stdDev).toBe(0);
  });
});

describe('Cache', () => {
  it('LRU en eski erişileni çıkarır', () => {
    let s = seedCacheDb(createCacheState({ capacity: 2, policy: 'lru' }), ['a', 'b', 'c']);
    s = cacheGet(s, 'a', 1).state;
    s = cacheGet(s, 'b', 2).state;
    s = cacheGet(s, 'a', 3).state; // a yenilendi
    s = cacheGet(s, 'c', 4).state; // b çıkmalı
    expect(s.entries.map((e) => e.key).sort()).toEqual(['a', 'c']);
    expect(s.events.some((e) => e.op === 'evict' && e.key === 'b')).toBe(true);
  });

  it('LFU en az kullanılanı çıkarır', () => {
    let s = seedCacheDb(createCacheState({ capacity: 2, policy: 'lfu' }), ['a', 'b', 'c']);
    s = cacheGet(s, 'a', 1).state;
    s = cacheGet(s, 'a', 2).state;
    s = cacheGet(s, 'b', 3).state;
    s = cacheGet(s, 'c', 4).state; // b (1 hit) çıkmalı
    expect(s.entries.map((e) => e.key).sort()).toEqual(['a', 'c']);
  });

  it('TTL dolunca girdi süresi dolar', () => {
    let s = seedCacheDb(createCacheState({ capacity: 4, defaultTtlMs: 100 }), ['a']);
    s = cacheGet(s, 'a', 0).state;
    const r = cacheGet(s, 'a', 50);
    expect(r.hit).toBe(true);
    const r2 = cacheGet(r.state, 'a', 200);
    expect(r2.hit).toBe(false);
    expect(hitRatio(r2.state)).toBeCloseTo(1 / 3);
  });

  it('yazma politikaları doğru davranır', () => {
    const aside = cacheSet(seedCacheDb(createCacheState({ writePolicy: 'cache-aside' }), []), 'k', 'v', 1);
    expect(aside.db.k).toBe('v');
    expect(aside.entries).toHaveLength(0);

    const through = cacheSet(createCacheState({ writePolicy: 'write-through' }), 'k', 'v', 1);
    expect(through.db.k).toBe('v');
    expect(through.entries[0].dirty).toBe(false);

    let back = cacheSet(createCacheState({ writePolicy: 'write-back' }), 'k', 'v', 1);
    expect(back.db.k).toBeUndefined();
    expect(back.entries[0].dirty).toBe(true);
    back = cacheFlush(back);
    expect(back.db.k).toBe('v');
  });
});

describe('Rate limiter', () => {
  it('token bucket kapasiteyi aşınca reddeder ve zamanla dolar', () => {
    let s = createRateLimiter({ algorithm: 'token-bucket', limit: 3, windowMs: 1000, ratePerSec: 1 }, 0);
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const r = tryAcquire(s, 0);
      s = r.state;
      results.push(r.decision.allowed);
    }
    expect(results).toEqual([true, true, true, false]);
    const later = tryAcquire(s, 1000);
    expect(later.decision.allowed).toBe(true);
  });

  it('leaky bucket sabit hızda sızar', () => {
    let s = createRateLimiter({ algorithm: 'leaky-bucket', limit: 2, windowMs: 1000, ratePerSec: 2 }, 0);
    s = tryAcquire(s, 0).state;
    s = tryAcquire(s, 0).state;
    expect(tryAcquire(s, 0).decision.allowed).toBe(false);
    s = advanceRateLimiter(s, 500); // 1 istek sızdı
    expect(tryAcquire(s, 500).decision.allowed).toBe(true);
  });

  it('fixed window sınırda patlama (burst) problemine izin verir', () => {
    let s = createRateLimiter({ algorithm: 'fixed-window', limit: 2, windowMs: 1000, ratePerSec: 0 }, 0);
    s = tryAcquire(s, 900).state;
    s = tryAcquire(s, 950).state;
    expect(tryAcquire(s, 980).decision.allowed).toBe(false);
    // yeni pencere: 1000ms
    const r = tryAcquire(s, 1000);
    expect(r.decision.allowed).toBe(true);
  });

  it('sliding window log pencere boyunca sayar', () => {
    let s = createRateLimiter({ algorithm: 'sliding-window-log', limit: 2, windowMs: 1000, ratePerSec: 0 }, 0);
    s = tryAcquire(s, 900).state;
    s = tryAcquire(s, 950).state;
    expect(tryAcquire(s, 1000).decision.allowed).toBe(false); // hâlâ pencere içinde
    expect(tryAcquire(s, 1900).decision.allowed).toBe(true); // 900 düştü
  });

  it('sliding window counter önceki pencereyi ağırlıklandırır', () => {
    let s = createRateLimiter({ algorithm: 'sliding-window-counter', limit: 10, windowMs: 1000, ratePerSec: 0 }, 0);
    for (let i = 0; i < 10; i++) s = tryAcquire(s, 100).state;
    // yeni pencerenin %10'unda: önceki ağırlık 0.9 → tahmini 9 → 1 istek daha kabul
    const r1 = tryAcquire(s, 1100);
    expect(r1.decision.allowed).toBe(true);
    const r2 = tryAcquire(r1.state, 1100);
    expect(r2.decision.allowed).toBe(false);
  });
});

describe('Consistent hashing', () => {
  it('anahtarlar deterministik düğüme düşer', () => {
    const ring = createRing(['n1', 'n2', 'n3'], 10);
    const a = locateKey(ring, 'user:1');
    const b = locateKey(ring, 'user:1');
    expect(a.owner).toBe(b.owner);
    expect(ring.points).toHaveLength(30);
  });

  it('düğüm eklenince klasik hashing’den çok daha az anahtar taşınır', () => {
    const keys = generateKeys(2000);
    const before = createRing(['n1', 'n2', 'n3', 'n4'], 50);
    const after = addRingNode(before, 'n5');
    const ch = movedKeys(before, after, keys);
    const mod = modHashMoved(['n1', 'n2', 'n3', 'n4'], ['n1', 'n2', 'n3', 'n4', 'n5'], keys);
    expect(ch.ratio).toBeLessThan(0.4);
    expect(ch.ratio).toBeLessThan(mod.ratio);
    const dist = ringDistribution(after, keys);
    expect(Object.values(dist).reduce((a, b) => a + b, 0)).toBe(keys.length);
  });
});

describe('Gradient descent', () => {
  it('kayıp azalır ve kapalı form çözüme yaklaşır', () => {
    const data = generateLinearData(50, 2, 1, 0.5, 7);
    const steps = runGradientDescent(data, { w: 0, b: 0 }, 0.05, 200);
    expect(steps.at(-1)!.loss).toBeLessThan(steps[0].loss);
    const ols = closedFormSolution(data);
    expect(steps.at(-1)!.params.w).toBeCloseTo(ols.w, 1);
    expect(steps.at(-1)!.params.b).toBeCloseTo(ols.b, 0);
  });
  it('yüksek öğrenme oranında ıraksar ve durur', () => {
    const data = generateLinearData(50, 2, 1, 0.5, 7);
    const steps = runGradientDescent(data, { w: 0, b: 0 }, 0.5, 200);
    expect(steps.length).toBeLessThan(201);
  });
  it('loss yüzeyi örneklenir', () => {
    const data = generateLinearData(20);
    const surf = sampleLossSurface(data, [-1, 4], [-2, 3], 10);
    expect(surf.loss).toHaveLength(10);
    expect(surf.min).toBeLessThan(surf.max);
  });
});

describe('Attention', () => {
  it('softmax satırları 1’e toplanır ve causal maske gelecek token’ları sıfırlar', () => {
    expect(softmax([1, 2, 3]).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    const r = computeSelfAttention('kedi minderin üstünde uyudu', 8, 1, true);
    expect(r.tokens).toHaveLength(4);
    for (const row of r.weights) expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(r.weights[0][1]).toBeCloseTo(0);
    expect(r.weights[0][0]).toBeCloseTo(1);
  });
});

describe('Kapasite tahmini', () => {
  it('varsayılan girdiyle makul değerler üretir', () => {
    const e = estimateCapacity(DEFAULT_CAPACITY_INPUT);
    expect(e.readQps).toBeCloseTo((100_000_000 * 50) / 86_400, 0);
    expect(e.totalStorageBytes).toBeGreaterThan(0);
    expect(e.appServers).toBeGreaterThan(1);
    expect(formatBytes(1_500_000)).toBe('1.5 MB');
  });
});
