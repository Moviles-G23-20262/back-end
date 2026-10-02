/** A user's own profile, or what an admin sees. Never includes `passwordHash`. */
export const publicUserSelect = {
  id: true,
  email: true,
  fullName: true,
  major: true,
  faculty: true,
  rating: true,
  createdAt: true,
} as const;

/**
 * What other users may see of someone (seller on a listing, chat counterpart…).
 * No email, and above all no `passwordHash`: always use this instead of `include: { user: true }`.
 */
export const userSummarySelect = {
  id: true,
  fullName: true,
  major: true,
  faculty: true,
  rating: true,
} as const;
