import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env } from '../../config/env';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY, type AuthUser } from './decorators';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: AuthUser['role'];
  type: 'access';
}

/**
 * Global JWT guard. @Public() ile atlanır; @OptionalAuth() ile token yoksa anonim devam eder.
 * Passport yerine doğrudan JwtService kullanıyoruz: daha az bağımlılık, aynı güvenlik.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = extractBearer(req);

    if (!token) {
      if (isPublic || optional) return true;
      throw new UnauthorizedException('Kimlik doğrulama gerekli');
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
      if (payload.type !== 'access') throw new Error('wrong token type');
      req.user = { id: payload.sub, email: payload.email, role: payload.role };
      return true;
    } catch {
      if (isPublic || optional) return true;
      throw new UnauthorizedException('Geçersiz ya da süresi dolmuş token');
    }
  }
}

export function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
