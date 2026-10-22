import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService, UNMATCHED_ROUTE } from './metrics.service';

/**
 * Her HTTP isteğinin sayısını ve süresini yanıt bittiğinde kaydeder. Interceptor yerine middleware:
 * guard'ların reddettiği (401/403/429) ve hiçbir route'a uymayan (404) istekler de sayılır.
 */
@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.metrics.enabled || isMetricsPath(req.originalUrl)) return next();
    const start = process.hrtime.bigint();
    res.once('finish', () => {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.observeHttp(req.method, routeLabel(req), res.statusCode, seconds);
    });
    next();
  }
}

/**
 * Route etiketi Express'in eşleştirdiği desenden gelir (`/api/v1/lessons/:id`); ham URL'deki id'ler
 * etikete girmez, böylece seri sayısı route sayısıyla sınırlı kalır.
 */
export function routeLabel(req: { baseUrl?: string; route?: { path?: unknown } }): string {
  const path = req.route?.path;
  if (typeof path !== 'string') return UNMATCHED_ROUTE;
  return `${req.baseUrl ?? ''}${path}`;
}

function isMetricsPath(url: string): boolean {
  const path = url.split('?')[0];
  return path === '/metrics' || path === '/metrics/';
}
