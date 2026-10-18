import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import type { ApiErrorBody } from '@devacademy/shared';

/**
 * Merkezi hata formatı: tüm hatalar ApiErrorBody biçiminde döner.
 * Prisma'nın bilinen hatalarını anlamlı HTTP kodlarına çevirir.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message = 'Beklenmeyen bir hata oluştu';
    let details: ApiErrorBody['details'];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        message = Array.isArray(b.message) ? (b.message as string[]).join('; ') : String(b.message ?? exception.message);
        if (Array.isArray(b.details)) details = b.details as ApiErrorBody['details'];
      }
      error = HttpStatus[status] ?? 'Error';
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          error = 'Conflict';
          message = 'Kayıt zaten mevcut';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          error = 'Not Found';
          message = 'Kayıt bulunamadı';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          error = 'Bad Request';
          message = 'İlişkili kayıt bulunamadı';
          break;
        default:
          this.logger.error(`Prisma hatası ${exception.code}: ${exception.message}`);
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      message = 'Geçersiz sorgu';
    } else {
      this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
    }

    const body: ApiErrorBody = {
      statusCode: status,
      error,
      message,
      details,
      requestId: req.id,
      timestamp: new Date().toISOString(),
    };
    res.status(status).json(body);
  }
}
