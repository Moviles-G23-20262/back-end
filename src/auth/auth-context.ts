import { BadRequestException, ForbiddenException } from '@nestjs/common';

/**
 * Who is calling. Two kinds of caller exist:
 *  - an app user, identified by the JWT (`userId` is always set);
 *  - the dashboard, identified by the admin key (`isAdmin`, no `userId`).
 */
export interface AuthContext {
  isAdmin: boolean;
  userId?: string;
}

/** The user making the request; admin-key callers have none. */
export function requireUserId(auth: AuthContext): string {
  if (!auth.userId) throw new ForbiddenException('This action needs a signed-in user');
  return auth.userId;
}

/**
 * The user an action is performed as. App users always act as themselves, so a
 * `sellerId`/`senderId`/… sent in the body is ignored; admins must say who.
 */
export function actingUserId(auth: AuthContext, provided: string | undefined, field: string): string {
  if (!auth.isAdmin) return requireUserId(auth);
  if (!provided) throw new BadRequestException(`${field} is required`);
  return provided;
}

export function assertSelfOrAdmin(auth: AuthContext, ownerId: string): void {
  if (!auth.isAdmin && auth.userId !== ownerId) {
    throw new ForbiddenException('You can only do this on your own data');
  }
}

/** Prisma filter for rows (chat rooms, exchanges) where `userId` is buyer or seller. */
export function participantWhere(userId: string) {
  return { OR: [{ buyerId: userId }, { sellerId: userId }] };
}
