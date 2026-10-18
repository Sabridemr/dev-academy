import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

export const IS_PUBLIC_KEY = 'isPublic';
/** Uç noktayı kimlik doğrulamasız eriştirilebilir yapar. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const OPTIONAL_AUTH_KEY = 'optionalAuth';
/** Token varsa kullanıcıyı çözer, yoksa anonim devam eder (örn. ilerleme bilgisi eklenmiş içerik). */
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

/** İstekteki kimliği doğrulanmış kullanıcıyı verir. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
