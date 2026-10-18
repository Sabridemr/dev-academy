import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Her isteğe bir X-Request-Id atar (gelen başlık varsa onu korur) — loglar ve hata gövdeleri bunu taşır. */
export function requestIdMiddleware(req: Request & { id?: string }, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
