import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { AuthContext } from './auth-context';
import { ADMIN_ONLY_KEY, IS_PUBLIC_KEY } from './auth.decorators';

export const ADMIN_KEY_HEADER = 'x-admin-key';

type AuthedRequest = Request & { auth?: AuthContext };

/**
 * Registered globally: every route needs either a user JWT (`Authorization: Bearer`)
 * or the dashboard's admin key (`X-Admin-Key`), unless marked [Public].
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();

    if (this.hasValidAdminKey(request)) {
      request.auth = { isAdmin: true };
      return true;
    }
    if (this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, targets)) {
      throw new ForbiddenException('Admin access required');
    }

    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Missing bearer token');

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      request.auth = { isAdmin: false, userId: payload.sub };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return true;
  }

  private hasValidAdminKey(request: Request): boolean {
    const expected = process.env.ADMIN_API_KEY;
    const provided = request.headers[ADMIN_KEY_HEADER];
    if (!expected || typeof provided !== 'string') return false;

    // Hash both sides so the buffers have equal length and the comparison is constant-time.
    const digest = (value: string) => createHash('sha256').update(value).digest();
    return timingSafeEqual(digest(provided), digest(expected));
  }
}
