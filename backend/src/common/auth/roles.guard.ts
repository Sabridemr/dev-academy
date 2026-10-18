import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import { ROLES_KEY, type AuthUser } from './decorators';

/** @Roles('admin','editor') ile işaretlenmiş uç noktalar için rol kontrolü. admin her yere girebilir. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user) throw new ForbiddenException('Yetki yok');
    if (user.role === 'admin' || required.includes(user.role)) return true;
    throw new ForbiddenException('Bu işlem için yetkiniz yok');
  }
}
