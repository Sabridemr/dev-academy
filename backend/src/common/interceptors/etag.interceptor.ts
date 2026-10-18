import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { Observable, map } from 'rxjs';

/**
 * GET yanıtları için zayıf ETag üretir. İstemci If-None-Match gönderir ve içerik
 * değişmediyse 304 döner (gövde yok) — yayınlanmış içerik için bant genişliği tasarrufu.
 * Authorization başlığı olan isteklerde `public` Cache-Control `private`'a çevrilir.
 */
@Injectable()
export class EtagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    if (req.method !== 'GET') return next.handle();

    return next.handle().pipe(
      map((body) => {
        if (body === undefined || body === null || res.headersSent) return body;
        const json = JSON.stringify(body);
        const etag = `W/"${createHash('sha1').update(json).digest('base64url').slice(0, 27)}"`;
        res.setHeader('ETag', etag);
        // Yanıt token'a göre değişebilir (ilerleme eklenir): paylaşılan cache'ler ayırt etsin
        res.setHeader('Vary', 'Authorization');
        const cacheControl = String(res.getHeader('Cache-Control') ?? '');
        // Token'lı yanıt kullanıcıya özel veri içerebilir; CDN/proxy'de saklanmamalı
        if (!cacheControl || (req.headers.authorization && /\bpublic\b/.test(cacheControl))) {
          res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
        }
        const inm = req.headers['if-none-match'];
        if (
          inm &&
          inm
            .split(',')
            .map((s) => s.trim())
            .includes(etag)
        ) {
          res.status(HttpStatus.NOT_MODIFIED);
          return undefined;
        }
        return body;
      }),
    );
  }
}
