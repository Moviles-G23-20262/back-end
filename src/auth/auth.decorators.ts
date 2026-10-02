import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthContext } from './auth-context';

export const IS_PUBLIC_KEY = 'isPublic';
export const ADMIN_ONLY_KEY = 'adminOnly';

/** No credentials needed (register, login, health check). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Only callers with the admin key (the dashboard) may use this route. */
export const AdminOnly = () => SetMetadata(ADMIN_ONLY_KEY, true);

/** Injects the caller identity set by [AuthGuard]. */
export const Auth = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext => {
  return ctx.switchToHttp().getRequest<{ auth: AuthContext }>().auth;
});
