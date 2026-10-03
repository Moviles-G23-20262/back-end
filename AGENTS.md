# Campus Swap - main back-end

NestJS + Prisma API behind the Campus Swap mobile app (a peer-to-peer marketplace for university course materials). It is the **only writer** to the PostgreSQL database and the **source of truth for the schema**. A separate read-only Django service (`../analytics-back-end`) reads the same database to answer the business questions; see `../analytics-back-end/docs/analytics-pipeline.drawio` for the whole pipeline.

## Stack and commands

- NestJS 11, TypeScript, Prisma 7 with the `@prisma/adapter-pg` driver adapter, PostgreSQL, `class-validator` DTOs, JWT auth, Swagger at `/api`.
- `npm run start:dev` runs the API (port `PORT`, default 3000). `npm test` runs unit and HTTP specs, `npm run test:e2e` the e2e suite, `npm run lint` runs ESLint with `--fix`.
- `postinstall` runs `prisma generate`. The client is generated into `src/generated/prisma` (git-ignored output, import from `../generated/prisma/client`).
- Environment variables (in `.env`, never commit it): `DATABASE_URL`, `JWT_SECRET` (the app refuses to start without it), `JWT_EXPIRES_IN` (default `7d`), `ADMIN_API_KEY`, `BLOB_READ_WRITE_TOKEN` (image uploads to Vercel Blob), `PORT`.
- Schema changes: edit `prisma/schema.prisma`, then `npx prisma migrate dev --name <what_changed>`. Migrations live in `prisma/migrations`. Always tell the analytics team (see "Schema changes affect Django" below).

## How it is organised

One Nest module per entity under `src/`, each with `controller`, `service`, `dto/`, and specs next to the code: `auth`, `users`, `materials`, `chatrooms`, `messages`, `exchanges`, `meeting-points`, `meeting-proposals`, `schedule-blocks`, `wishlist-items`, `notifications`, `ratings`, `analytics-events`, `uploads`, `sql`. `PrismaModule` / `PrismaService` is the shared database client.

Conventions to follow when adding code:

- **Controllers stay thin.** Validation lives in DTOs (the global `ValidationPipe` uses `whitelist: true, transform: true`, so unknown body fields are dropped). Business rules live in services.
- **Identity comes from the token, not the body.** Handlers take `@Auth() auth: AuthContext`. Helpers in `src/auth/auth-context.ts` (`requireUserId`, `actingUserId`, `assertSelfOrAdmin`, `participantWhere`) enforce per-user scoping. An app user always acts as themselves, so a `sellerId` or `senderId` sent in a body is ignored; only admins must say who they act as.
- **Responses never include password hashes.** Use `userSummarySelect` (`src/users/public-user.select.ts`) when embedding users.
- **Multi-row state changes use `prisma.$transaction`.** Example: placing an order does a conditional `updateMany` (`AVAILABLE` to `RESERVED`) so two buyers ordering at the same time cannot both win.

## Authentication and access

`AuthGuard` is registered globally (`APP_GUARD` in `auth.module.ts`). Every route needs one of:

1. A **user JWT** (`Authorization: Bearer <token>`), issued by `POST /auth/register` or `POST /auth/login`. The payload carries `sub` (user id) and `email`.
2. The **admin key** (`X-Admin-Key: <ADMIN_API_KEY>`), used by the developer dashboard (`../back-end-dashboard`). It is compared in constant time and gives `isAdmin: true` with no `userId`.

Decorators in `auth.decorators.ts`: `@Public()` (register, login, health check) and `@AdminOnly()` (list-everything and mutate-anything routes, and the whole `/sql` controller). Anything not marked is available to any signed-in user, scoped to their own data.

`POST /sql/query` runs arbitrary SQL, including writes. It is admin-key only on purpose (it powers the dashboard's SQL console). Never relax that and never expose the admin key to the mobile app.

## Domain model, in short

- **Material** is a listing (`AVAILABLE` / `RESERVED` / `SOLD`) with category, condition, price, edition and model, image URLs, and a seller.
- **Exchange** is an order: `PENDING` (buyer placed it, listing becomes `RESERVED`, seller gets an `ORDER_PLACED` notification), then `COMPLETED` (`completedAt` set, listing becomes `SOLD`) or `CANCELLED` (listing goes back to `AVAILABLE`). A material can have several exchanges over time (a cancelled one, then a new order); only one is active at once.
- **ChatRoom / Message** are per buyer, seller and material. A `MEETING` message points at a **MeetingProposal** (time window plus a safe **MeetingPoint**) that the other side accepts or declines.
- **ScheduleBlock** stores each user's weekly class schedule in campus local time (`America/Bogota`) and is used to find free slots shared by two people.
- **Rating** is one per rater per exchange, only after the exchange is `COMPLETED`; it updates `User.rating`.
- **WishlistItem**, **Notification** (`SMART_MATCH`, `ORDER_PLACED`, `OTHER`) and **AnalyticsEvent**.

## Analytics design decisions

These are deliberate. Do not "fix" them without talking to the team.

- **One database, no ETL.** Almost every business question joins operational data (materials, exchanges, users, wishlist, notifications) with usage events, so the analytics service needs both. Instead of copying data into a second database, the analytics Django service reads this one. This is a university-project trade-off; in production, events would go to a dedicated store.
- **Events are one table: `AnalyticsEvent`** (`eventType`, optional `userId` and `materialId`, a free-form `metadata` JSON, `occurredAt`). Event types: `LISTING_VIEW`, `SEARCH`, `CONTACT_SELLER`, `WISHLIST_ADD`, `WISHLIST_REMOVE`, `NOTIFICATION_SENT`, `NOTIFICATION_OPENED`. User and material references use `onDelete: SetNull` so history survives deletions.
- **The app sends events here** with `POST /analytics-events`. For app users the `userId` is forced to the signed-in user. Reading, updating and deleting events is admin-only. This service never computes analytics itself; it only stores raw data.
- **Crashes and device telemetry are not stored here.** Firebase Crashlytics collects them (BQ1) and is intentionally not connected to this API or to Django.

## Schema changes affect Django

The Django service mirrors this schema by hand with unmanaged models (`../analytics-back-end/analytics/models.py`). Prisma migrations do not update it, and the two drift silently. After any change to `schema.prisma` (new column, new enum value, a relation that goes from 1-1 to 1-many):

1. Say so to whoever owns the analytics back-end, or update `analytics/models.py` yourself in the same change.
2. Prefer adding nullable columns over renaming or dropping, since the Django side reads by exact column name (`db_column`).

Known drift at the time of writing: `MEETING_CONFIRMED` exists in Django's `AnalyticsEventType` but not in the Prisma enum (so this API rejects that event type), and Django has no models yet for `Rating`, `MeetingProposal` or `ScheduleBlock`.

## Testing

Specs sit beside the code (`*.spec.ts`). Service specs mock Prisma; `*.http.spec.ts` files boot a Nest app and exercise guards and validation over HTTP (`auth`, `access-control`, `uploads`). Add a spec when you add a rule, especially for access control.
