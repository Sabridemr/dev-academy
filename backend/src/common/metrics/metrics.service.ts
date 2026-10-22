import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';
import type { Env } from '../../config/env';

/** Eşleşen bir route bulunamayan istekler (404) tek etiket altında toplanır: kardinalite sabit kalır */
export const UNMATCHED_ROUTE = 'unmatched';

/**
 * Prometheus metrikleri. Uygulamaya özel bir Registry kullanılır (global kayıt değil): testlerde
 * ve aynı süreçte açılan birden fazla Nest uygulamasında metrikler birbirine karışmaz.
 * METRICS_ENABLED=false iken hiçbir şey kaydedilmez ve Node varsayılan metrikleri toplanmaz.
 */
@Injectable()
export class MetricsService {
  readonly enabled: boolean;
  readonly registry = new Registry();

  private readonly httpRequests = new Counter({
    name: 'http_requests_total',
    help: 'Tamamlanan HTTP istekleri',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });

  private readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP istek süresi (saniye)',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  private readonly wsConnections = new Gauge({
    name: 'ws_connections_active',
    help: 'Bu örneğe bağlı aktif WebSocket (socket.io) bağlantıları',
    registers: [this.registry],
  });

  private readonly cacheLookups = new Counter({
    name: 'cache_lookups_total',
    help: 'Redis cache okumaları (result: hit | miss)',
    labelNames: ['cache', 'result'] as const,
    registers: [this.registry],
  });

  constructor(config: ConfigService<Env, true>) {
    this.enabled = config.get('METRICS_ENABLED', { infer: true }) !== false;
    if (this.enabled) collectDefaultMetrics({ register: this.registry });
  }

  /** route: Express route deseni (ör. /api/v1/lessons/:id), ham URL değil */
  observeHttp(method: string, route: string, status: number, seconds: number): void {
    if (!this.enabled) return;
    const labels = { method, route, status: String(status) };
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, seconds);
  }

  wsConnected(): void {
    if (this.enabled) this.wsConnections.inc();
  }

  wsDisconnected(): void {
    if (this.enabled) this.wsConnections.dec();
  }

  cacheLookup(cache: string, hit: boolean): void {
    if (this.enabled) this.cacheLookups.inc({ cache, result: hit ? 'hit' : 'miss' });
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  render(): Promise<string> {
    return this.registry.metrics();
  }
}
