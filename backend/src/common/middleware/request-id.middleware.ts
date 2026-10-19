import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Gelen X-Request-Id yalnızca makul biçimdeyse (≤128 karakter, harf/rakam . _ -) korunur; aksi halde yenisi
 * üretilir. pino'nun genReqId'si ve bu middleware aynı kuralı kullanır (loglar ile yanıt başlığı tutarlı).
 */
export function resolveRequestId(incoming: unknown): string {
  return typeof incoming === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(incoming)
    ? incoming
    : randomUUID();
}

/** Her isteğe bir X-Request-Id atar (gelen başlık varsa onu korur) — loglar ve hata gövdeleri bunu taşır. */
export function requestIdMiddleware(
  req: Request & { id?: string },
  res: Response,
  next: NextFunction,
): void {
  const id = req.id ?? resolveRequestId(req.headers['x-request-id']);
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
