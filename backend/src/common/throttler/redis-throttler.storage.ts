import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { RedisService } from '../redis/redis.service';

/**
 * @nestjs/throttler için Redis tabanlı depo: sayaçlar tüm API replikaları arasında paylaşılır.
 * Redis yoksa bellek içi haritaya düşer (tek replika için yeterli).
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly memory = new Map<
    string,
    { hits: number; expiresAt: number; blockedUntil: number }
  >();

  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const fullKey = `throttle:${throttlerName}:${key}`;
    if (this.redis.isAvailable) {
      try {
        return await this.incrementRedis(fullKey, ttl, limit, blockDuration);
      } catch {
        /* bellek içine düş */
      }
    }
    return this.incrementMemory(fullKey, ttl, limit, blockDuration);
  }

  private async incrementRedis(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    const client = this.redis.client;
    const blockKey = `${key}:blocked`;
    const blockedTtl = await client.pttl(blockKey);
    if (blockedTtl > 0) {
      return {
        totalHits: limit + 1,
        timeToExpire: Math.ceil(blockedTtl / 1000),
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockedTtl / 1000),
      };
    }
    const multi = client.multi();
    multi.incr(key);
    multi.pttl(key);
    const results = (await multi.exec()) ?? [];
    const hits = Number(results[0]?.[1] ?? 1);
    let pttl = Number(results[1]?.[1] ?? -1);
    if (pttl < 0) {
      await client.pexpire(key, ttl);
      pttl = ttl;
    }
    let isBlocked = false;
    let timeToBlockExpire = 0;
    if (hits > limit && blockDuration > 0) {
      await client.set(blockKey, '1', 'PX', blockDuration);
      isBlocked = true;
      timeToBlockExpire = Math.ceil(blockDuration / 1000);
    }
    return { totalHits: hits, timeToExpire: Math.ceil(pttl / 1000), isBlocked, timeToBlockExpire };
  }

  private incrementMemory(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): ThrottlerStorageRecord {
    const now = Date.now();
    let rec = this.memory.get(key);
    if (!rec || rec.expiresAt <= now) {
      rec = { hits: 0, expiresAt: now + ttl, blockedUntil: 0 };
    }
    if (rec.blockedUntil > now) {
      return {
        totalHits: limit + 1,
        timeToExpire: Math.ceil((rec.expiresAt - now) / 1000),
        isBlocked: true,
        timeToBlockExpire: Math.ceil((rec.blockedUntil - now) / 1000),
      };
    }
    rec.hits += 1;
    if (rec.hits > limit && blockDuration > 0) rec.blockedUntil = now + blockDuration;
    this.memory.set(key, rec);
    if (this.memory.size > 10_000) {
      for (const [k, v] of this.memory) if (v.expiresAt <= now) this.memory.delete(k);
    }
    return {
      totalHits: rec.hits,
      timeToExpire: Math.ceil((rec.expiresAt - now) / 1000),
      isBlocked: rec.blockedUntil > now,
      timeToBlockExpire: rec.blockedUntil > now ? Math.ceil((rec.blockedUntil - now) / 1000) : 0,
    };
  }
}
