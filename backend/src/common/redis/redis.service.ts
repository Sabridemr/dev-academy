import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Env } from '../../config/env';

/**
 * Redis istemcisi: cache, rate limit sayaçları ve pub/sub için.
 * Redis erişilemezse uygulama çalışmaya devam eder (cache bypass), ancak loglar.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;
  private available = true;

  constructor(config: ConfigService<Env, true>) {
    this.client = new Redis(config.get('REDIS_URL'), {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    });
    this.client.on('error', (err) => {
      if (this.available) this.logger.warn(`Redis erişilemiyor, cache atlanıyor: ${err.message}`);
      this.available = false;
    });
    this.client.on('ready', () => {
      this.available = true;
      this.logger.log('Redis bağlantısı hazır');
    });
  }

  get isAvailable(): boolean {
    return this.available && this.client.status === 'ready';
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.isAvailable) return null;
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.isAvailable) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      /* cache yazımı kritik değil */
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.isAvailable || keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch {
      /* yoksay */
    }
  }

  /** Desene uyan anahtarları SCAN ile siler (KEYS kullanmadan) */
  async delByPattern(pattern: string): Promise<number> {
    if (!this.isAvailable) return 0;
    let cursor = '0';
    let count = 0;
    try {
      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = next;
        if (keys.length) {
          await this.client.del(...keys);
          count += keys.length;
        }
      } while (cursor !== '0');
    } catch {
      /* yoksay */
    }
    return count;
  }

  /**
   * Dağıtık tek seferlik kilit (SET NX PX). Birden fazla API örneğinde zamanlanmış işin yalnızca birinde
   * çalışması için. Redis yoksa true döner: tek örnekte iş yine çalışır (çoklu örnekte kopya riski loglanır).
   */
  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    if (!this.isAvailable) {
      this.logger.warn(`Redis yok; "${key}" kilidi alınamadan devam ediliyor`);
      return true;
    }
    try {
      return (await this.client.set(key, String(process.pid), 'PX', ttlMs, 'NX')) === 'OK';
    } catch {
      return true;
    }
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
