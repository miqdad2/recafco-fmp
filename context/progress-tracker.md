# Progress Tracker

## Current Status

- **Project:** RECAFCO Factory Management Platform
- **Short name:** RECAFCO FMP
- **Phase:** Phase 5 — Maintenance Requests
- **Last completed:** Unit 10 — Maintenance Requests Foundation (2026-07-01)
- **Next:** Unit 11 (TBD per build plan)
- **Deployment:** RECAFCO internal company server
- **SAP:** SAP Business One 9.3 for SAP HANA, build 9.30.150, PL 06, 64-bit
- **Licensing:** open-source/self-hosted-first

## Completed

- Platform name approved
- Six permanent main modules confirmed
- Open-source/self-hosted direction confirmed
- SAP product/version/database confirmed
- Architecture, standards, UI tokens, UI rules, UI registry, library rules, build plan, and progress structure prepared
- **Unit 01 — Monorepo Foundation** ✓
- **Unit 02 — Environment, Logging, Request IDs, Health** ✓
- **Unit 03 — PostgreSQL and Prisma Foundation** ✓
- **Unit 04 — Organization Reference Data** ✓
- **Unit 05 — Users and Authentication Foundation** ✓
- **Unit 06 — Roles and Permissions Foundation** ✓
- **Unit 07 — Protected Application Shell, Navigation, and Manager Demo Dashboard** ✓
- **Unit 08 — Incident Reporting Foundation** ✓
- **Unit 09 — Factory Tasks Foundation** ✓
- **Unit 10 — Maintenance Requests Foundation** ✓

## Unit 01 — Monorepo Foundation (Completed 2026-06-30)

### Acceptance Criteria — All Met

- [x] pnpm workspace (`pnpm-workspace.yaml`, `packageManager: pnpm@11.8.0`)
- [x] `apps/web` — Next.js 16.2.9 App Router, minimal page
- [x] `apps/api` — NestJS 11, `GET /health` with required response shape
- [x] `apps/worker` — TypeScript worker with controlled heartbeat and SIGINT/SIGTERM shutdown
- [x] `packages/config` — authoritative shared tsconfig (base, library, nestjs, nextjs)
- [x] `packages/database` — foundation stub (no Prisma schema)
- [x] `packages/shared` — foundation stub
- [x] `packages/ui` — foundation stub
- [x] `packages/observability` — minimal pino logger factory
- [x] `infrastructure/` — deployment, backup, monitoring, scripts stubs
- [x] `docs/` — runbooks, api, data-dictionary, sap-integration stubs
- [x] TypeScript strict mode across all workspaces
- [x] ESLint v9 flat config, Prettier, `.prettierrc`
- [x] Root scripts: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- [x] Turbo v2 task pipeline (local only, no remote cache)
- [x] Node 22 LTS engine policy, `.node-version` file
- [x] `.env.example` with `NODE_ENV`, `WEB_PORT`, `API_PORT`, `LOG_LEVEL`
- [x] Ports: web 3000, API 4000 (configurable via env)
- [x] No database, no auth, no SAP, no business workflows, no fake metrics
- [x] Useful tests only: 4 API health contract tests + 5 worker liveness tests

### Verification Results (2026-06-30)

| Command | Result |
|---|---|
| `pnpm install` | ✓ 320 packages, 9 workspaces |
| `pnpm lint` | ✓ No errors |
| `pnpm typecheck` | ✓ 8/8 workspaces |
| `pnpm test` | ✓ 9/9 tests (4 API + 5 worker) |
| `pnpm build` | ✓ 7/7 tasks (Next.js 16.2.9, NestJS 11, all packages) |

### Key Technology Versions

| Technology | Version |
|---|---|
| Node.js (running) | 24.17.0 (engine policy: ≥22.0.0) |
| pnpm | 11.8.0 |
| Next.js | 16.2.9 |
| NestJS | 11.x |
| TypeScript | 5.9.3 |
| Turbo | 2.10.0 |
| Vitest | 3.2.6 |
| Pino | 9.x |

## Unit 02 — Environment, Logging, Request IDs, Health (Completed 2026-06-30)

### Acceptance Criteria — All Met

- [x] `packages/config` — Zod v3 schemas (`ApiEnvSchema`, `WorkerEnvSchema`, `WebEnvSchema`), `EnvironmentValidationError`, `parseEnvOrThrow`, `parseEnvSafe`, TypeScript build
- [x] `packages/shared` — `ApiSuccessResponse<T>`, `ApiErrorResponse`, `ApiError`, `ApiResponse<T>` types
- [x] `packages/observability` — single `AsyncLocalStorage` instance, `runWithRequestContext()`, `getRequestContext()`, `getRequestId()`; `createLogger()` enhanced with `LoggerOptions` (level, environment) and requestId mixin
- [x] `apps/api` — env validated before NestJS boots; `process.exitCode = 1` pattern; CORS from validated env (no wildcard in prod); NestJS 11 `*splat` wildcard middleware; `RequestIdMiddleware` → `RequestLogMiddleware` order; pure `resolveRequestId()` (64-char, alphanumeric/hyphen/underscore); one request-completion log event; `GlobalExceptionFilter` (preserves HTTP status codes, no stack leak); `GET /ready` reflects actual `RuntimeStateService` state
- [x] `apps/worker` — env validated at startup; `WorkerApp` accepts `WorkerConfig`; tracks `startedAt`, `lastHeartbeatAt`; `isStale()` uses `STALE >= HEARTBEAT*2` invariant; `SIGINT`/`SIGTERM` graceful shutdown with `process.exitCode`
- [x] `apps/web` — `@recafco/config` soft env validation; `getApiHealth()` with `AbortSignal.timeout(3000)`, `cache: 'no-store'`; `export const dynamic = 'force-dynamic'`; Runtime Status section shows API state
- [x] `.env.example` updated with `API_BASE_URL`, `CORS_ALLOWED_ORIGINS`, `WORKER_HEARTBEAT_INTERVAL_MS`, `WORKER_STALE_AFTER_MS`
- [x] No production debug endpoint
- [x] No stack traces exposed
- [x] No wildcard CORS in production

### Verification Results (2026-06-30)

| Command | Result |
|---|---|
| `pnpm install` | ✓ +1 package (zod) |
| `pnpm lint` | ✓ No errors |
| `pnpm typecheck` | ✓ 11/11 tasks |
| `pnpm test` | ✓ 56 tests across config (10), observability (4), api (26), worker (12), web (4) |
| `pnpm build` | ✓ 8/8 tasks; `/` route is `ƒ` (Dynamic) |

### Manual Verification (2026-06-30)

| Check | Result |
|---|---|
| `GET /health` | ✓ `{ data: { status: "ok", service: "recafco-fmp-api" }, meta: { requestId }, error: null }` |
| `GET /ready` | ✓ `{ data: { status: "ready", uptimeMs: N }, meta: { requestId }, error: null }` |
| Custom `x-request-id` header | ✓ Echoed back in response and logged |
| Invalid `x-request-id` (spaces) | ✓ Replaced with UUID |
| 404 response | ✓ Gets UUID request-id, correct error shape |
| Structured request-completion log | ✓ Contains `method`, `path`, `statusCode`, `durationMs`, `requestId`, `service`, `environment` |
| Worker startup | ✓ Structured JSON log: `{ event: "worker_started" }` |
| Worker graceful shutdown | ✓ SIGTERM handled; `process.exitCode` pattern |

### New Dependencies

| Package | Location | Purpose |
|---|---|---|
| `zod@^3` | `packages/config` | Environment schema validation |

## Unit 03 — PostgreSQL and Prisma Foundation (Completed 2026-06-30)

### Acceptance Criteria — All Met

- [x] `packages/config` — `DatabaseEnvSchema` (standalone), `ApiEnvSchema` extended with `DATABASE_URL` (required, postgresql:// validated), `DATABASE_CONNECTION_TIMEOUT_MS`, `DATABASE_STATEMENT_TIMEOUT_MS`, `DATABASE_POOL_MAX`; error messages never contain URL value or password
- [x] `packages/database` — Prisma 7.8.0 with `prisma-client` generator, explicit output to `src/generated/prisma/`; model-free `schema.prisma` (no `url` in datasource — Prisma 7 breaking change); `prisma.config.ts` with `defineConfig` and `dotenv/config`
- [x] `packages/database/src/prisma-client.ts` — `createPrismaClient(config)` factory using `PrismaPg` adapter + `pg.Pool`; pg-level `connectionTimeoutMillis` and `statement_timeout` session parameter; no `process.env` reads
- [x] `packages/database/src/database-health.ts` — `checkDatabaseHealth(client, timeoutMs)` with `categorizeError()` (timeout, connection_refused, authentication, unknown); `Promise.race` as secondary guard; no secrets in result
- [x] `apps/api/src/database/database.module.ts` — NestJS module providing and exporting `DatabaseService`
- [x] `apps/api/src/database/database.service.ts` — `OnModuleInit` connects (failure → logs category, does not throw); `OnModuleDestroy` disconnects safely; `checkHealth()` delegates to `checkDatabaseHealth()`; logs category on unavailable; no `process.env` reads
- [x] `apps/api/src/health/readiness.controller.ts` — updated: async, injects `DatabaseService`, two 503 paths (not-initialized, db-unavailable), 200 includes `checks: { environment, logging, requestContext, database }`; 503 database-down exposes only `details: { database: 'unavailable' }`
- [x] `apps/api/src/health/health.module.ts` — imports `DatabaseModule`; `GET /health` remains 200 (unaffected)
- [x] `prisma validate` — PASSED (model-free schema, no `url` in datasource)
- [x] `prisma generate` — PASSED (generated TypeScript client to `src/generated/prisma/`)
- [x] `**/generated/**` added to ESLint ignores
- [x] `packages/database/src/generated/` added to `.gitignore`
- [x] `turbo.json` — `db:generate` task added (cache: false)
- [x] Root scripts — `db:validate`, `db:format`, `db:generate`, `db:migrate:dev`, `db:migrate:deploy`, `db:migrate:status`, `db:studio` (no `db:reset`, `db:drop`, `db:push`)
- [x] `.env.example` — `DATABASE_URL` template added with role/database instructions
- [x] `docs/runbooks/local-postgresql.md` — prerequisites, role/database creation, test database, env setup, security reminders
- [x] `docs/runbooks/database-migrations.md` — local workflow, production deploy, prohibited commands, owner/role separation
- [x] No domain models, migrations, seed data, or business module work

### Verification Results (2026-06-30)

| Command | Result |
|---|---|
| `pnpm install` | ✓ +110 packages (@prisma/adapter-pg, @prisma/client, pg, dotenv, etc.) |
| `pnpm db:validate` | ✓ Schema valid (model-free, no datasource url property) |
| `pnpm db:generate` | ✓ Generated Prisma Client 7.8.0 to src/generated/prisma in ~23ms |
| `pnpm lint` | ✓ No errors |
| `pnpm typecheck` | ✓ 12/12 tasks |
| `pnpm test` | ✓ 75 tests (api: 41, database: 13, config: 19, observability: 4, worker: 12, web: 4); 0 failures; live db tests skipped (no authorized credentials yet) |
| `pnpm build` | ✓ 8/8 tasks |

### Skipped — Requires Authorized Credentials

- `pnpm db:migrate:status` — requires live database connection with authorized account
- Live readiness verification — requires `.env` with valid `DATABASE_URL`
- `recafco_fmp_dev` database status — not verified (postgres superuser password unknown)
- `recafco_fmp_app` role status — not verified (same reason)

### New Dependencies

| Package | Location | Purpose |
|---|---|---|
| `prisma@^7.8.0` | `packages/database` (devDep) | Prisma CLI for schema/migration commands |
| `@prisma/client@^7.8.0` | `packages/database` | Prisma runtime client base |
| `@prisma/adapter-pg@^7.8.0` | `packages/database` | PostgreSQL driver adapter for Prisma 7 |
| `pg@^8.13.0` | `packages/database` | node-postgres (connection pool) |
| `@types/pg@^8.11.0` | `packages/database` (devDep) | TypeScript types for pg |
| `dotenv@^16.4.0` | `packages/database` | Load .env for CLI (prisma.config.ts) |

### Key Discoveries

- Prisma 7 breaking change: `url` property NOT allowed in schema.prisma datasource (Error P1012); URL must live in `prisma.config.ts` only
- Prisma 7 generator name changed from `prisma-client-js` to `prisma-client`
- Generated entry point is `client.ts` not `index.ts`; imports must reference `./generated/prisma/client`
- `pnpm-workspace.yaml` `allowBuilds` required for `@prisma/engines` and `prisma` (pnpm v11 security policy)

## Unit 04 — Organization Reference Data (Completed 2026-06-30)

### Acceptance Criteria — All Met

- [x] Prisma schema — `Department`, `Plant`, `Location` models with `@map` snake_case columns, `@db.Timestamptz(3)`, varchar limits, nullable `plantId` on Location, `onDelete: Restrict` FK, `@@index([plantId])`
- [x] `packages/database/src/index.ts` — re-exports `Department`, `Plant`, `Location`, `Prisma` from generated client
- [x] `pnpm db:validate` — PASSED; `pnpm db:format` — PASSED; `pnpm db:generate` — PASSED
- [x] Migration SQL applied to `recafco_fmp_dev`; migration status verified up to date
- [x] `GlobalExceptionFilter` updated — prefers `code` field over `error` field; passes through `details`
- [x] `DatabaseService.getClient()` method added
- [x] `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform`, custom `exceptionFactory` returning `VALIDATION_ERROR` with `details.fields`
- [x] `PendingAuthGuard` — 503 `AUTH_NOT_IMPLEMENTED` in production; passes in dev/test
- [x] `isPrismaError(err, code)` utility for duck-type P2002/P2003 detection
- [x] `OrgListQueryDto` — shared pagination (page 1, pageSize 20, max 100), search, isActive
- [x] Departments — DTOs (create/update with `@Transform` normalization), service, 18 service tests, controller (6 routes, `ParseUUIDPipe`, `getRequestId()` meta)
- [x] Plants — identical structure to Departments; 10 service tests
- [x] Locations — extended DTOs with optional `plantId`; service with `requirePlantExists()`; 14 service tests; controller with `plantId` list filter
- [x] `OrganizationsModule` — imports `DatabaseModule`, declares all 3 controllers, provides all 3 services
- [x] `AppModule` — imports `OrganizationsModule`
- [x] Tailwind CSS v4 — `postcss.config.mjs`, `globals.css` with `@import "tailwindcss"` + `@theme {}` from `ui-tokens.md`; `layout.tsx` imports CSS
- [x] `apps/web/src/lib/organizations-api.ts` — typed API client with `apiFetch<T>`, three namespaces
- [x] Administration landing page — 3 entity cards
- [x] Departments: list page (server component, table, StatusBadge), new page, edit page
- [x] Plants: same structure as Departments
- [x] Locations: same structure with Plant column and plant selector
- [x] Shared components registered: `StatusBadge`, `PageHeader`, `EmptyState`, `ErrorState`, `OrgEntityForm`, `LocationForm`
- [x] `docs/data-dictionary/organization-reference-data.md` — table definitions, column types, expected migration SQL
- [x] `docs/api/organization-reference-data.md` — all routes, request/response shapes, error codes
- [x] `context/library-docs.md` — class-validator, class-transformer, Tailwind CSS v4 sections added
- [x] `context/ui-registry.md` — 6 new components registered

### Correction Notes

27 corrections were applied from the approval phase. Key ones:
- `Location.plantId` nullable; no `Location.departmentId`; no `locationType`
- Departments company-wide (no plant FK); flat hierarchy only
- Code regex `^[A-Z0-9_-]{2,32}$`; normalized via `@Transform` before validation
- Server Actions → NestJS API (never Prisma directly)
- Mutation endpoints guarded by `PendingAuthGuard`; controllers never touch Prisma

### Verification Results (2026-06-30)

| Command | Result |
|---|---|
| `pnpm db:validate` | ✓ Schema valid |
| `pnpm db:format` | ✓ No changes needed |
| `pnpm db:generate` | ✓ Prisma Client 7.8.0 generated |
| `pnpm lint` | ✓ No errors |
| `pnpm typecheck` | ✓ 12/12 tasks (including 3 exactOptionalPropertyTypes fixes) |
| `pnpm test` | ✓ 88 tests (44 new organization service/filter tests + 44 existing) |
| `pnpm build` | ✓ 8/8 tasks; 10 administration pages emit |
| `pnpm db:migrate:status` | ✓ Migration applied; `recafco_fmp_dev` up to date |

### Live Database Verification (2026-06-30)

All checks performed against `recafco_fmp_dev` via the running API:

| Scenario | Result |
|---|---|
| First migration applied to `recafco_fmp_dev` | ✓ |
| `departments`, `plants`, `locations` tables present | ✓ |
| Department code normalized to uppercase on create | ✓ |
| Plant code normalized to uppercase on create | ✓ |
| Duplicate code rejected with 409 `DUPLICATE_CODE` | ✓ |
| Location created without plant (`plantId` null) | ✓ |
| Location created with plant (`plantId` set) | ✓ |
| Invalid `plantId` rejected with 400 `INVALID_PLANT_ID` | ✓ |
| Activate/deactivate idempotent (repeated calls succeed) | ✓ |
| Search filter (name and code, case-insensitive) | ✓ |
| `isActive` filter | ✓ |
| `plantId` filter on locations list | ✓ |
| Pagination (`page`, `pageSize`, `totalPages` correct) | ✓ |
| `pageSize` > 100 rejected with 400 `VALIDATION_ERROR` | ✓ |
| No hard-delete endpoint exists | ✓ |
| DB `code` format CHECK constraint enforced | ✓ |
| DB non-blank `name` CHECK constraint enforced | ✓ |
| QA records removed; tables clean | ✓ |
| Unmatched route (e.g. `DELETE /:id`) returns `NOT_FOUND` | ✓ |
| Mutation endpoints return 503 in production env (dev: pass-through) | ✓ |

### New Dependencies

| Package | Location | Purpose |
|---|---|---|
| `class-validator@^0.14.1` | `apps/api` | DTO field validation decorators |
| `class-transformer@^0.5.1` | `apps/api` | DTO field normalization (trim, uppercase) |
| `tailwindcss@^4.0.0` | `apps/web` (devDep) | CSS utility framework v4 |
| `@tailwindcss/postcss@^4.0.0` | `apps/web` (devDep) | Tailwind v4 PostCSS plugin |

## Unit 05 — Users and Authentication Foundation (Completed 2026-06-30)

### Acceptance Criteria — All Met

- [x] Prisma schema — `User`, `UserSession`, `SecurityAuditEvent` models; snake_case `@map`; `@db.Timestamptz(3)`; `failedLoginAttempts`, `lockedAt`, `lastLoginAt`, `mustChangePassword`; `UserSession.tokenHash`, `expiresAt`; `SecurityAuditEvent.metadata` as Json; back-relations; `@@index` on `tokenHash`, `expiresAt`, `userId`, `event`
- [x] `packages/config` — `ApiEnvSchema` extended with `JWT_ACCESS_SECRET` (required ≥32 chars), `JWT_ACCESS_EXPIRES_SECONDS`, `REFRESH_TOKEN_EXPIRES_DAYS`, `MAX_FAILED_LOGIN_ATTEMPTS`, `LOCKOUT_WINDOW_MINUTES`
- [x] Migration `0002_add_users_auth` — `CREATE TABLE` with UUID PK, CHECK constraints (role IN, status bounds, length limits), `ON DELETE CASCADE` for sessions and audit events, `ON DELETE RESTRICT` for org FKs, all indexes
- [x] `@node-rs/argon2` — Argon2id, memoryCost 65536, timeCost 3, parallelism 4; pre-warmed dummy hash for constant-time unknown-user defense
- [x] `@nestjs/jwt` — `JwtModule.registerAsync` in `AuthModule`; `JwtService` re-exported for consuming modules
- [x] `AuthService` — `login()` (audit lockout/success, constant-time dummy verify for unknown users), `refresh()` (token rotation, old session deleted), `logout()` (idempotent), `changePassword()` (all sessions revoked, no new tokens)
- [x] `UsersService` — `create()` (temp password, mustChangePassword=true, audit), `findAll()` (isLocked computed), `findOne()`, `update()`, `resetPassword()`, `deactivate()` (blocks self+last-admin), `activate()`, `unlock()`; org consistency validation (department/plant/location must belong together)
- [x] `JwtAuthGuard` — reads live DB session (not JWT claim alone); 401 on missing/bad/revoked token; 403 if `mustChangePassword` without `@AllowMustChangePassword`
- [x] `AdminGuard` — 403 unless `role === ADMIN`
- [x] `IpThrottleGuard` — in-memory sliding window; 429 on 11+ requests in 15 min; per-IP isolation; `X-Forwarded-For`
- [x] `@AllowMustChangePassword` decorator; `@CurrentUser()` decorator
- [x] `AuthController` — `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password`
- [x] `UsersController` — `GET/POST /administration/users`, `GET/PATCH /administration/users/:id`, activate/deactivate/reset-password/unlock sub-routes; all guarded `JwtAuthGuard + AdminGuard`
- [x] `OrganizationsModule` controllers — `PendingAuthGuard` replaced with `JwtAuthGuard`; mutation routes add `AdminGuard`
- [x] `bootstrap-admin.ts` — interactive username + hidden password (readline raw mode); blocks if users exist; `mustChangePassword: true`; audit event; `node --env-file=../../.env` loads env
- [x] `cleanup-sessions.ts` — deletes expired sessions; idempotent; logs count; same env-file loading
- [x] `AuthModule` exports `AuthService`, `JwtAuthGuard`, `AdminGuard`, `JwtModule` (re-exported so `JwtService` resolves in consumer modules)
- [x] Web `proxy.ts` — cookie-to-Authorization translation for Next.js → API; `export const proxy` and `export const config`; `cookies()` awaited
- [x] Web `auth-api.ts` — typed client for login/refresh/changePassword/me; server-side only
- [x] Web `users-api.ts` — typed client for all user admin endpoints; server-side only
- [x] `organizations-api.ts` — `apiFetch()` auto-reads `recafco_access` cookie; no caller change needed
- [x] `login/actions.ts`, `login/page.tsx`, `login/_components/login-form.tsx` — `useActionState`; sets `recafco_access` and `recafco_refresh` httpOnly cookies; redirects to `/change-password` if `mustChangePassword`
- [x] `change-password/actions.ts`, `change-password/page.tsx`, `change-password/_components/change-password-form.tsx` — clears all cookies on success; redirects to `/login`
- [x] `administration/users/page.tsx`, `new/page.tsx`, `[id]/edit/page.tsx` — server components; status badges for locked/mustChangePassword
- [x] `UserForm`, `ResetPasswordForm` — client components with `useActionState`; `ResetPasswordForm` wraps 3-arg action to satisfy 1-arg form action contract
- [x] `administration/page.tsx` — Users section added as first item
- [x] `PageHeader.description` changed from `string` to `ReactNode`
- [x] 146 tests passing (14 test files); new: `auth.service.test.ts` (~25), `users.service.test.ts` (~21), `jwt-auth.guard.test.ts` (8), `admin.guard.test.ts` (3), `ip-throttle.guard.test.ts` (5); `env.test.ts` updated with `JWT_ACCESS_SECRET`

### Correction Notes

25 corrections applied from the approval phase. Key ones:
- Argon2id parameters fixed: memoryCost 65536, timeCost 3, parallelism 4
- JwtAuthGuard reads live DB session; mustChangePassword checked live (not from JWT)
- changePassword revokes ALL sessions, returns void, redirects to login
- IpThrottleGuard: in-memory only, no Redis, max 10 (11th blocked), 15-min window
- bootstrap:admin uses interactive prompt; no env var password; blocks if users exist
- Never log passwords, hashes, raw tokens, or JWT values in audit events
- Organizations read endpoints use JwtAuthGuard; mutations also need AdminGuard
- `exactOptionalPropertyTypes: true` compliance throughout (conditional spreads)
- `useActionState` 2-arg action cannot be passed directly to `<form action>`; requires wrapper component
- CORS must not use wildcard in production (already enforced from Unit 02)

### Verification Results (2026-06-30)

| Command | Result |
|---|---|
| `pnpm db:validate` | ✓ Schema valid |
| `pnpm db:generate` | ✓ Prisma Client regenerated with User, UserSession, SecurityAuditEvent |
| `pnpm db:migrate:status` | ✓ 2 migrations applied; `recafco_fmp_dev` up to date |
| `pnpm --filter @recafco/api typecheck` | ✓ No errors |
| `pnpm --filter @recafco/api test` | ✓ 146/146 tests pass (14 test files) |
| `pnpm --filter @recafco/api build` | ✓ |
| `pnpm --filter @recafco/web typecheck` | ✓ No errors |
| `pnpm --filter @recafco/web test` | ✓ 4/4 tests pass |
| `pnpm --filter @recafco/web build` | ✓ All new routes visible: `/login`, `/change-password`, `/administration/users`, `/administration/users/new`, `/administration/users/[id]/edit` |

### Live API Verification (2026-06-30)

All checks against `recafco_fmp_dev` via running API on port 4000:

| Scenario | Result |
|---|---|
| `GET /health` | ✓ HTTP 200 `{ status: "ok" }` |
| `GET /ready` | ✓ HTTP 200 `{ status: "ready", checks: { database: "ok" } }` |
| `GET /auth/me` (no token) | ✓ HTTP 401 `UNAUTHORIZED` |
| `GET /administration/users` (no token) | ✓ HTTP 401 `UNAUTHORIZED` |
| `GET /organizations/departments` (no token) | ✓ HTTP 401 `UNAUTHORIZED` |
| `POST /auth/login` (unknown user) | ✓ HTTP 401 `INVALID_CREDENTIALS` |
| `POST /auth/refresh` (missing refreshToken) | ✓ HTTP 400 `VALIDATION_ERROR` |
| `POST /auth/logout` (missing refreshToken) | ✓ HTTP 400 `VALIDATION_ERROR` |
| `POST /auth/change-password` (no JWT) | ✓ HTTP 401 `UNAUTHORIZED` |
| `POST /auth/login` (valid credentials) | ✓ HTTP 200, returns `accessToken`, `refreshToken`, `mustChangePassword` |
| `GET /auth/me` (valid token) | ✓ HTTP 200, returns full user profile |
| `POST /auth/refresh` (valid token) | ✓ HTTP 200, new token pair issued (rotation) |
| Old refresh token after rotation | ✓ HTTP 401 `SESSION_EXPIRED` |
| `POST /auth/change-password` (correct creds) | ✓ HTTP 200, all sessions revoked |
| `GET /auth/me` after change-password | ✓ HTTP 401 (session revoked) |
| `POST /auth/refresh` after change-password | ✓ HTTP 401 `SESSION_EXPIRED` |
| `POST /auth/login` with new password | ✓ HTTP 200 |
| `POST /auth/login` with old password | ✓ HTTP 401 `INVALID_CREDENTIALS` |
| `POST /auth/logout` (idempotent) | ✓ HTTP 200 `{ error: null }` |

### Runtime Fix Applied

`AuthModule` was missing `JwtModule` from its `exports` array. Because `OrganizationsModule` and `UsersModule` import `AuthModule`, NestJS tried to resolve `JwtService` (a `JwtAuthGuard` dependency) in those modules' DI context but couldn't find it. Fix: added `JwtModule` to `AuthModule.exports`.

### New Dependencies

| Package | Location | Purpose |
|---|---|---|
| `@node-rs/argon2@^2.0.2` | `apps/api` | Argon2id password hashing (native binding) |
| `@nestjs/jwt@^11.0.2` | `apps/api` | JWT signing/verification |

### Dev Script Change

`apps/api/package.json` dev/bootstrap/cleanup scripts now use `node --env-file=../../.env -r ts-node/register` instead of `ts-node` binary directly. Node 22+ `--env-file` flag loads the monorepo root `.env` without requiring `dotenv`.

## Unit 06 — Roles and Permissions Foundation (Completed 2026-07-01)

### Approved Decisions

- **A-1:** Three system roles: `SUPER_ADMIN`, `ADMIN`, `VIEWER` (MANAGER deferred)
- **A-2:** Existing `UserRole.ADMIN` → `SUPER_ADMIN`; `UserRole.USER` → `VIEWER`
- **A-3:** USER renamed to VIEWER
- **A-4:** `users.assign_role` is a separate permission from `users.update`
- **A-5:** Two-migration staged approach (0003 additive + 0004 finalize with NOT NULL)
- **A-6:** `AdminGuard` deleted after all controllers migrated to `PermissionGuard`
- **A-7:** Live DB permission resolution on every request (no caching in Unit 06)
- **A-8:** ADMIN has `roles.read` but not `roles.create/update/assign_permissions`
- **A-9:** Privilege escalation guard — only SUPER_ADMIN may assign SUPER_ADMIN
- **A-10:** Bootstrap script looks up SUPER_ADMIN by stable role code, never hardcodes UUID
- **A-11:** No future-module permissions seeded in Unit 06
- **A-12:** `pending-auth.guard.ts` deleted (confirmed dead code)

### Mandatory Protections Applied

- No hidden SUPER_ADMIN bypass — SUPER_ADMIN gets explicit permission rows in `role_permissions`
- System roles cannot be hard-deleted, deactivated, or renamed (service-layer enforcement)
- Self-demotion, self-removal from SUPER_ADMIN, deactivation of last active SUPER_ADMIN all blocked
- All role/permission/user-role mutations create `SecurityAuditEvent` rows in same transaction
- No hard-delete endpoints for roles, permissions, or assignments

### Acceptance Criteria — All Met

- [x] `schema.prisma` — `Role`, `Permission`, `RolePermission` models; `User.roleId` (NOT NULL after 0004); `UserRole` enum removed
- [x] Migration `20260630123605_add_rbac_foundation` — additive: creates tables, nullable `role_id` FK, seeds 3 roles + 18 permissions + role_permission assignments, backfills `role_id` from legacy `role` enum column; generated with `--create-only`
- [x] Migration `20260630123606_finalize_rbac_role_column` — safety guard (`RAISE EXCEPTION` if any NULL `role_id`), `ALTER COLUMN role_id SET NOT NULL`, `DROP COLUMN role`, `DROP TYPE user_role`; created manually
- [x] `packages/database/src/index.ts` — exports `Role`, `Permission`, `RolePermission` types; `UserRole` removed
- [x] `apps/api/src/common/types/auth-user.ts` — `AuthUser` redesigned: `roleId`, `roleCode`, `roleName`, `permissions: string[]`
- [x] `apps/api/src/common/decorators/permissions.decorator.ts` — `@Permissions(...codes)` via `SetMetadata`
- [x] `apps/api/src/common/guards/permission.guard.ts` — `PermissionGuard` checks `user.permissions` array via `Reflector.getAllAndOverride`
- [x] `apps/api/src/auth/guards/jwt-auth.guard.ts` — loads role + nested permissions in single `findFirst` query; builds new `AuthUser` structure
- [x] `apps/api/src/auth/guards/admin.guard.ts` — DELETED (A-6)
- [x] `apps/api/src/common/guards/pending-auth.guard.ts` — DELETED (A-12)
- [x] `apps/api/src/auth/auth.module.ts` — `AdminGuard` removed; `PermissionGuard` added to providers and exports
- [x] `apps/api/src/auth/auth.service.ts` — `me()` select updated to use `role: { select: { code, name } }`; `UserProfile` redesigned with `roleId/roleCode/roleName`
- [x] `apps/api/src/users/dto/create-user.dto.ts` — `role?: UserRole` replaced with `roleId?: string` (UUID)
- [x] `apps/api/src/users/dto/update-user.dto.ts` — `role` field removed entirely
- [x] `apps/api/src/users/dto/assign-role.dto.ts` — new DTO with `roleId: string` (UUID)
- [x] `apps/api/src/users/users.service.ts` — full rewrite: `USER_SELECT` includes `role: { select: { code, name } }`; `UserRecord` uses `roleId/role.code/role.name`; `create()` defaults to VIEWER; `deactivate()` checks `role.code === 'SUPER_ADMIN'`; `updateRole(id, roleId, actor)` with privilege escalation + last-SUPER_ADMIN guards; `assertNotLastActiveSuperAdmin()` replaces `assertNotLastActiveAdmin()`
- [x] `apps/api/src/users/users.controller.ts` — `AdminGuard` removed; `PermissionGuard + @Permissions()` applied per-endpoint; `PATCH :id/role` endpoint added; `UserListQueryDto.role?: UserRole` replaced with `roleCode?: string`
- [x] `apps/api/src/organizations/departments/departments.controller.ts` — `AdminGuard` → `PermissionGuard + @Permissions('org.departments.*')`
- [x] `apps/api/src/organizations/plants/plants.controller.ts` — same pattern
- [x] `apps/api/src/organizations/locations/locations.controller.ts` — same pattern
- [x] `apps/api/src/roles/roles.service.ts` — `findAll()`, `findOne()`, `create()`, `update()`, `getPermissions()`, `assignPermissions()`, `listAllPermissions()`, `deactivate()` (blocks system roles + roles with active users)
- [x] `apps/api/src/roles/roles.controller.ts` — `GET /administration/roles`, `GET /administration/roles/:id`, `POST`, `PATCH :id`, `GET :id/permissions`, `PUT :id/permissions`, `POST :id/deactivate`; all permission-gated
- [x] `apps/api/src/roles/roles.module.ts` — imports `DatabaseModule` + `AuthModule`
- [x] `apps/api/src/roles/dto/create-role.dto.ts`, `update-role.dto.ts`, `assign-permissions.dto.ts`
- [x] `apps/api/src/app.module.ts` — imports `RolesModule`
- [x] `apps/api/src/scripts/bootstrap-admin.ts` — looks up SUPER_ADMIN role by `code`, uses `roleId` scalar in create; logs `roleCode` in audit event
- [x] `apps/api/src/users/users.service.test.ts` — `ADMIN_ACTOR` and `BASE_USER` updated to new `AuthUser`/`UserRecord` shapes; `updateRole` tests rewritten for UUID-based signature; new privilege escalation test
- [x] `apps/api/src/auth/guards/jwt-auth.guard.test.ts` — `SESSION` mock updated to nested role + permissions shape; test verifies `roleCode` and `permissions` on `req.user`
- [x] `apps/api/src/auth/auth.service.test.ts` — `AUTH_USER` in changePassword tests updated to new `AuthUser` shape
- [x] `apps/web/src/lib/users-api.ts` — `UserSummary.role` replaced with `roleId/role: { code, name }`; `CreateUserPayload.role` replaced with `roleId?`; `UpdateUserPayload.role` removed; `assignRole()` added; `list()` query `role` → `roleCode`
- [x] `apps/web/src/lib/auth-api.ts` — `UserProfile.role: string` replaced with `roleId/roleCode/roleName`
- [x] `apps/web/src/lib/roles-api.ts` — new: `rolesApi.list()`, `rolesApi.get()`, `rolesApi.listPermissions()`
- [x] `apps/web/src/app/administration/users/actions.ts` — `role → roleId` in create action; `role` removed from update action
- [x] `apps/web/src/app/administration/users/_components/user-form.tsx` — `roles: RoleSummary[]` prop added; role select uses `roleId` field, populated from `roles` prop
- [x] `apps/web/src/app/administration/users/new/page.tsx` — fetches roles via `rolesApi.list()`, passes to `UserForm`
- [x] `apps/web/src/app/administration/users/[id]/edit/page.tsx` — fetches roles; passes `roleId` as defaultValue; passes `roles` prop
- [x] `apps/web/src/app/administration/users/page.tsx` — role badge uses `user.role.code` and `user.role.name`

### 18 Permissions Seeded

| Module | Permissions |
|---|---|
| `users` | `users.read`, `users.create`, `users.update`, `users.assign_role`, `users.activate`, `users.reset_password`, `users.unlock` |
| `roles` | `roles.read`, `roles.create`, `roles.update`, `roles.assign_permissions` |
| `org` | `org.departments.read`, `org.departments.write`, `org.plants.read`, `org.plants.write`, `org.locations.read`, `org.locations.write` |
| `audit` | `audit.read` |

### Role-Permission Matrix

| Permission | SUPER_ADMIN | ADMIN | VIEWER |
|---|---|---|---|
| All 18 | ✓ | — | — |
| All except roles.create/update/assign_permissions | — | ✓ (15) | — |
| users.read, roles.read, org.*.read | — | — | ✓ (5) |

### Verification Results (2026-07-01)

| Command | Result |
|---|---|
| `pnpm db:validate` | ✓ Schema valid |
| `pnpm db:migrate:status` | ✓ 2 migrations pending (expected — not yet applied to dev DB) |
| `pnpm lint` | ✓ No errors |
| `pnpm typecheck` | ✓ 12/12 tasks |
| `pnpm test` | ✓ 145/145 tests pass (13 test files) |
| `pnpm build` | ✓ 8/8 tasks; all routes visible including `/administration/users` variants |

### Pending Database Step (Operator Action Required)

The following steps must be performed by the operator before deploying:

1. **Take a full backup** of `recafco_fmp_dev`
2. **Review** migration SQL files:
   - `packages/database/prisma/migrations/20260630123605_add_rbac_foundation/migration.sql`
   - `packages/database/prisma/migrations/20260630123606_finalize_rbac_role_column/migration.sql`
3. **Apply migration 0003** to `recafco_fmp_dev`:
   - `pnpm db:migrate:deploy` (or `prisma migrate deploy`)
4. **Verify** all users have a non-null `role_id` before proceeding
5. **Apply migration 0004** to `recafco_fmp_dev`
6. **Verify** `pnpm db:migrate:status` shows 0 pending migrations

### New Dependencies

None in Unit 06 — all used packages were already installed.

## Unit 07 — Protected Application Shell, Navigation, and Manager Demo Dashboard (Completed 2026-07-01)

### Approved Decisions

- Route group `(protected)` wraps all authenticated pages; URL paths unchanged
- 2-step auth in layout: `authApi.me()` → `rolesApi.get(roleId)` → live `permissions: string[]`; no NestJS changes
- Permission-aware sidebar: ADMIN_ITEMS filtered by permission; Administration hidden if no admin permissions
- Expandable Administration section via `useState`; auto-expands when `pathname.startsWith('/administration')`
- `ShellUser` type carries `displayName`, `username`, `roleCode`, `roleName`, `permissions[]`
- `logoutAction` clears cookies even if API session invalidation fails (best-effort)
- Dashboard uses `Promise.allSettled` — no new backend endpoints
- Honest implementation progress section — no fake operational data
- `lucide-react` added as web dep (MIT, tree-shaken, RSC-compatible)
- Old `app/page.tsx` and `app/administration/` deleted (moved into `(protected)/`)

### Acceptance Criteria — All Met

- [x] `lucide-react` installed in `@recafco/web`
- [x] `(protected)/_components/app-shell.tsx` — client component; manages `mobileOpen`, Escape key, body scroll, focus restoration, close-on-route-change
- [x] `(protected)/_components/sidebar.tsx` — dual desktop/mobile render; grouped nav (Dashboard, Operations, Governance, Administration); expandable Administration section with `aria-expanded` + `aria-controls`
- [x] `(protected)/_components/top-header.tsx` — hamburger (mobile only), user info, logout form
- [x] `(protected)/_components/breadcrumbs.tsx` — `BreadcrumbItem[]`; last item gets `aria-current="page"`
- [x] `(protected)/_components/metric-card.tsx` — `MetricStatus` type; Restricted/Unavailable states; wraps in `<Link>` when href + ok
- [x] `(protected)/_components/module-card.tsx` — title, description, href, icon, status, phase
- [x] `(protected)/_components/permission-gate.tsx` — render-prop gate; fallback prop
- [x] `(protected)/actions.ts` — `logoutAction` server action; best-effort logout; clears both cookies; redirects to /login
- [x] `(protected)/layout.tsx` — 2-step auth; `mustChangePassword` redirect; live permissions; passes `ShellUser` to AppShell
- [x] `(protected)/loading.tsx` — spinner with `aria-live="polite"`
- [x] `(protected)/page.tsx` — dashboard: API status, DB status, 6 org/permission-aware metric cards; 8 MODULE_CARDS; PROGRESS_STEPS with honest status
- [x] 6 module landing pages created: `/production`, `/factory-tasks`, `/incidents`, `/maintenance`, `/safety-compliance`, `/contracts`
- [x] `(protected)/administration/page.tsx` — overview with 5 sections including Roles
- [x] `(protected)/administration/loading.tsx` — skeleton loading state
- [x] `(protected)/administration/roles/page.tsx` — real read-only roles table using `rolesApi.list()`
- [x] All administration sub-pages updated with Breadcrumbs component and `min-h-full`
- [x] Old `app/page.tsx` deleted (replaced by `(protected)/page.tsx`)
- [x] Old `app/administration/` deleted (replaced by `(protected)/administration/`)
- [x] `MetricCardProps.value` type updated to `string | number | undefined` for `exactOptionalPropertyTypes` compliance
- [x] `lint` script fixed from `--dir src` to no-flag invocation

### Verification Results (2026-07-01)

| Command | Result |
|---|---|
| `pnpm --filter @recafco/web typecheck` | ✓ No errors |
| `pnpm --filter @recafco/web test` | ✓ 4/4 tests pass |
| `pnpm --filter @recafco/web build` | ✓ 24 routes; 0 errors |

### Build Output Routes

```
/ (ƒ)                                   ← Dashboard (protected)
/administration (ƒ)                     ← Admin overview
/administration/departments (ƒ)
/administration/departments/[id]/edit (ƒ)
/administration/departments/new (ƒ)
/administration/locations (ƒ)
/administration/locations/[id]/edit (ƒ)
/administration/locations/new (ƒ)
/administration/plants (ƒ)
/administration/plants/[id]/edit (ƒ)
/administration/plants/new (ƒ)
/administration/roles (ƒ)
/administration/users (ƒ)
/administration/users/[id]/edit (ƒ)
/administration/users/new (ƒ)
/change-password (○)
/contracts (ƒ)
/factory-tasks (ƒ)
/incidents (ƒ)
/login (○)
/maintenance (ƒ)
/production (ƒ)
/safety-compliance (ƒ)
```

### New Dependencies

| Package | Location | Purpose |
|---|---|---|
| `lucide-react@^1.22.0` | `apps/web` | SVG icon set (MIT, tree-shaken, RSC-compatible) |

## Unit 08 — Incident Reporting Foundation (Completed 2026-07-01)

### Approved Decisions

- **A:** `incidents.review` may change severity during SUBMITTED/UNDER_REVIEW; `incidents.manage` required after INVESTIGATION
- **B:** Reporter may cancel own DRAFT or SUBMITTED (non-empty reason required); `incidents.manage` required for others at any non-terminal state
- **C:** Corrective actions require `incidents.investigate` (not `incidents.review`)
- **D:** DRAFT incidents excluded from dashboard Open Incidents count
- **E:** `occurredAt` up to 1 minute in future for clock skew; application code only
- **F:** `linkedTaskId` deferred until Factory Tasks unit

### Acceptance Criteria — All Met

- [x] Prisma schema — `IncidentSeverity`, `IncidentStatus`, `IncidentActionStatus` enums; `Incident`, `IncidentAction`, `IncidentComment`, `IncidentActivity`, `IncidentSequence` models; `affectedDepartmentId` (not `departmentId`); 6 named user FKs on Incident; `onDelete: Restrict` on action/comment/activity; no FK on `IncidentActivity.actorUserId`; `actorName VARCHAR(200)` denormalized; `immediateAction`, `rootCause`, `investigationSummary`, `resolutionSummary` fields
- [x] Migration `20260701000001_add_incident_foundation` — DDL with CHECK constraints (no `now()`); reference number format regex `^INC-[0-9]{4}-[0-9]{6}$`; permission seeds with `ON CONFLICT("code") DO NOTHING`; role assignments with code-based subqueries + `ON CONFLICT("role_id","permission_id") DO NOTHING`
- [x] `packages/database/src/index.ts` — exports `IncidentSequence`, `Incident`, `IncidentAction`, `IncidentComment`, `IncidentActivity`, `IncidentSeverity`, `IncidentStatus`, `IncidentActionStatus`
- [x] `apps/api/src/incidents/incidents-ref.service.ts` — `nextRef()` uses `$queryRaw` atomic upsert; sequence exhaustion protection at 999,999; UTC year from `createdAt`
- [x] `apps/api/src/incidents/incidents.service.ts` — `VALID_TRANSITIONS` static map; `VALID_ACTION_TRANSITIONS` explicit; concurrency-safe `updateMany(where: {id, status})` pattern; UTC month boundaries for summary; `openActionCount` check on resolve; reopen clears lifecycle timestamps; people picker endpoint
- [x] `apps/api/src/incidents/incidents.controller.ts` — 23 endpoints; `summary` and `people` declared before `/:id`
- [x] `apps/api/src/incidents/incidents.module.ts` — imports DatabaseModule + AuthModule; providers: IncidentsService + IncidentsRefService
- [x] `apps/api/src/app.module.ts` — imports IncidentsModule
- [x] `apps/web/src/lib/incidents-api.ts` — full TypeScript interfaces; `apiFetch()` + `apiFetchResult()` + `incidentsApi` namespace
- [x] `apps/web/src/app/(protected)/incidents/actions.ts` — all server actions; `exactOptionalPropertyTypes` compliant with conditional spreads; `INCIDENT_OPEN_ACTIONS` handling
- [x] `apps/web/src/app/(protected)/incidents/_components/incident-status-badge.tsx` — 8 statuses mapped to color classes
- [x] `apps/web/src/app/(protected)/incidents/_components/incident-severity-badge.tsx` — 4 severities; CRITICAL=danger, HIGH=orange-700, MEDIUM=warning, LOW=success
- [x] `apps/web/src/app/(protected)/incidents/_components/incident-form.tsx` — `'use client'`, `useActionState`; title, severity, occurredAt, description, immediateAction, affectedPlant, affectedDept
- [x] `apps/web/src/app/(protected)/incidents/_components/activity-timeline.tsx` — merges IncidentActivity + IncidentComment by createdAt; actor initial avatar for comments
- [x] `apps/web/src/app/(protected)/incidents/_components/incident-action-row.tsx` — `'use client'`, `useTransition`; advance button per action state machine
- [x] `apps/web/src/app/(protected)/incidents/_components/incident-transitions.tsx` — `'use client'`; all status transitions; inline panels for cancel/reopen/resolve/assign/severity
- [x] `apps/web/src/app/(protected)/incidents/_components/investigation-panel.tsx` — `'use client'`, `useActionState`; rootCause + investigationSummary
- [x] `apps/web/src/app/(protected)/incidents/_components/add-comment-form.tsx` — `'use client'`, `useActionState`
- [x] `apps/web/src/app/(protected)/incidents/_components/add-action-form.tsx` — `'use client'`, `useActionState`; toggled show/hide
- [x] `apps/web/src/app/(protected)/incidents/loading.tsx` — skeleton for list page
- [x] `apps/web/src/app/(protected)/incidents/page.tsx` — list with status/severity/date/search filters; pagination; gated "Report Incident" button
- [x] `apps/web/src/app/(protected)/incidents/new/page.tsx` — form page; loads plants + departments
- [x] `apps/web/src/app/(protected)/incidents/[id]/page.tsx` — full detail; two-column layout; transitions sidebar; investigation/actions/comments sections
- [x] `apps/web/src/app/(protected)/incidents/[id]/edit/page.tsx` — guards DRAFT + own reporter; `updateDraftAction.bind(null, id)`
- [x] `apps/web/src/app/(protected)/page.tsx` — 4 incident MetricCards added (Open Incidents, Critical Open, Under Investigation, Resolved This Month); gated on `incidents.read`

### 10 Permissions Seeded

| Code | Assigned to |
|---|---|
| `incidents.read` | SUPER_ADMIN, ADMIN, VIEWER |
| `incidents.create` | SUPER_ADMIN, ADMIN, VIEWER |
| `incidents.update_own_draft` | SUPER_ADMIN, ADMIN, VIEWER |
| `incidents.review` | SUPER_ADMIN, ADMIN |
| `incidents.assign` | SUPER_ADMIN, ADMIN |
| `incidents.investigate` | SUPER_ADMIN, ADMIN |
| `incidents.resolve` | SUPER_ADMIN, ADMIN |
| `incidents.close` | SUPER_ADMIN, ADMIN |
| `incidents.comment` | SUPER_ADMIN, ADMIN, VIEWER |
| `incidents.manage` | SUPER_ADMIN, ADMIN |

### Verification Results (2026-07-01)

| Command | Result |
|---|---|
| `pnpm db:validate` | ✓ Schema valid |
| `pnpm db:format` | ✓ No changes needed |
| `pnpm db:migrate:status` | ✓ 5 migrations applied; `recafco_fmp_dev` up to date |
| `pnpm lint` | ✓ No errors |
| `pnpm typecheck` | ✓ 12/12 tasks |
| `pnpm test` | ✓ 145/145 tests pass (13 test files) |
| `pnpm build` | ✓ 8/8 tasks; 4 new incident routes: `/incidents`, `/incidents/[id]`, `/incidents/[id]/edit`, `/incidents/new` |
| Post-implementation verification | ✓ All 12 items passed; 23 endpoints mapped; no security defects found |

### Key Implementation Notes

- Shadow DB migration order conflict: solved by using `prisma migrate diff --from-config-datasource --to-schema` against the live database instead of `migrate dev --create-only`
- Named relations required for 6 user FKs on Incident (`IncidentReportedBy`, `IncidentReportedFor`, `IncidentAssignedTo`, `IncidentReviewedBy`, `IncidentResolvedBy`, `IncidentClosedBy`)
- Prisma 7 nullable `Json?` fields: use conditional spreads or omit the property instead of passing `null` (which is rejected with `exactOptionalPropertyTypes: true`)
- `pg_dump` located at `C:\Program Files\PostgreSQL\18\bin\pg_dump.exe`; DB owner is `recafco_fmp_owner`

### New Dependencies

None — all used packages were already installed.

## Current Unit

### Unit 09 — TBD

See `context/build-plan.md` for next phase item.

## Open Questions

### Organization
Departments, plants, locations, roles, cross-department access, and language requirements.

### Infrastructure
Server OS/hardware, direct install versus containers, internal DNS/TLS, backup location/retention, concurrency, SAP network route.

### SAP
Service Layer availability, internal URL, test company, restricted account, Integration Framework, DI API, custom add-on, custom HANA views/procedures/tables/fields, report sources.

### Modules
Detailed production, task, incident, maintenance, safety, and contract workflows remain under management preparation and must not be invented.

## Decisions

1. Modular monolith first.
2. One PostgreSQL database with explicit module ownership.
3. Open-source/self-hosted-first.
4. SAP remains authoritative for SAP-owned data.
5. SAP integration begins read-only.
6. MinIO stores binaries; PostgreSQL stores metadata.
7. Worker handles long-running operations.
8. Granular permissions.
9. Existing systems remain isolated.
10. UI tokens, rules, and registry govern consistency.
11. Library usage must be documented.
12. Build uses visible, verifiable production slices.
13. Turbo v2 used for local monorepo task orchestration. No remote cache. No Vercel account required.
14. Packages compile to `dist/`; apps import compiled output. Build order enforced by Turbo dependency graph.
15. ESLint v9 flat config with non-type-aware rules in Unit 01. Type-aware rules deferred to later unit.

## Unit 09 — Factory Tasks Foundation (Completed 2026-07-01)

### Acceptance Criteria — All Met

- [x] `TaskPriority` enum (LOW, MEDIUM, HIGH, URGENT) and `TaskStatus` enum (DRAFT, OPEN, ASSIGNED, IN_PROGRESS, BLOCKED, COMPLETED, CLOSED, CANCELLED)
- [x] `TaskSequence` model — atomic upsert sequence with CHECK (last_seq BETWEEN 0 AND 999999)
- [x] `FactoryTask` model — 24 columns, reference number `TASK-YYYY-NNNNNN`, incidentId FK `onDelete: Restrict`
- [x] `FactoryTaskProgress`, `FactoryTaskComment`, `FactoryTaskActivity` models — all append-only
- [x] Back-relations added to Department (2), Plant, Location, User (7), Incident
- [x] Migration `20260701000002_add_factory_tasks_foundation` — applied via `prisma db execute --stdin` (shadow DB workaround)
- [x] 11 permission seeds (`ON CONFLICT ("code") DO NOTHING`): tasks.read, tasks.create, tasks.update_own_draft, tasks.assign, tasks.start, tasks.block, tasks.complete, tasks.close, tasks.manage, tasks.update_progress, tasks.comment
- [x] `TasksRefService` — atomic `$queryRaw INSERT ... ON CONFLICT ... RETURNING last_seq`; throws `TASK_SEQUENCE_EXHAUSTED` at 999999
- [x] 7 DTO files — all with class-validator decorators and proper length constraints
- [x] `FactoryTasksService` — 24 methods including full lifecycle, concurrency-safe transitions, assignee ownership, requestedByUserId impersonation guard, plant/location derivation, incident validation, UTC metrics
- [x] Activity metadata policy — no full text duplicated (only hasBlockedReason, hasCompletionSummary, hasPercent flags)
- [x] Reopen — clears lifecycle timestamps, preserves completionSummary and blockedReason text
- [x] Cancellation — reason required for ALL statuses (1–1000 chars)
- [x] `FactoryTasksController` — 24 endpoints; summary/my/people declared before /:id; proper HTTP codes
- [x] `factory-tasks-api.ts` — typed web client (TaskPriority, TaskStatus, FactoryTask, TaskSummary, ListResponse)
- [x] `actions.ts` — 13 server actions: create, updateDraft, open, assign, unassign, start, block, unblock, complete, close, reopen, cancel, updatePriority, updateDueDate, addProgress, addComment
- [x] Components: TaskStatusBadge, TaskPriorityBadge, TaskForm, TaskTransitionsPanel, TaskActivityTimeline, AddProgressForm, AddTaskCommentForm
- [x] Pages: loading.tsx, page.tsx (live list + filters), my/page.tsx, new/page.tsx, [id]/page.tsx, [id]/edit/page.tsx
- [x] Dashboard — Factory Tasks section with 5 MetricCards; MODULE_CARDS updated to `status: 'available'`; PROGRESS_STEPS updated
- [x] `factory-tasks.service.test.ts` — 40 tests: assignee ownership, reassignment, cancellation reasons, requestedBy impersonation, incident linking, priority changes, reopen clearing, concurrency, UTC metrics
- [x] Lint: 0 errors | Typecheck: 0 errors | Tests: 185/185 | Build: 8/8

### Verification Results (2026-07-01)

| Command | Result |
|---|---|
| `pnpm db:migrate:status` | ✓ 6 migrations applied, up to date |
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors |
| `pnpm test` | ✓ 185/185 tests (14 files, 40 new factory-tasks tests) |
| `pnpm build` | ✓ 8/8 tasks |

## Unit 10 — Maintenance Requests Foundation (Completed 2026-07-01)

### Acceptance Criteria — All Met

- [x] `MaintenancePriority` enum (LOW, MEDIUM, HIGH, URGENT) and `MaintenanceStatus` enum (DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, ASSIGNED, IN_PROGRESS, WAITING_FOR_PARTS, COMPLETED, CLOSED, REJECTED, CANCELLED)
- [x] `MaintenanceSequence` model — atomic upsert sequence with CHECK (last_seq BETWEEN 0 AND 999999)
- [x] `MaintenanceRequest` model — 35+ columns, reference number `MR-YYYY-NNNNNN`, CHECK constraint `^MR-[0-9]{4}-[0-9]{6}$`
- [x] `MaintenanceRequestComment`, `MaintenanceRequestActivity` models — append-only; no FK on actorUserId for activity
- [x] Back-relations added to Department, Plant, Location, User (6 named FKs)
- [x] Migration `20260701000003_add_maintenance_foundation` — applied via `prisma db execute --stdin` (shadow DB workaround); 11 permission seeds + role assignments for SUPER_ADMIN/ADMIN/VIEWER
- [x] `packages/database/src/index.ts` — exports `MaintenanceSequence`, `MaintenanceRequest`, `MaintenanceRequestComment`, `MaintenanceRequestActivity`, `MaintenancePriority`, `MaintenanceStatus`
- [x] `MaintenanceRefService` — atomic `$queryRaw INSERT ... ON CONFLICT ... RETURNING last_seq`; throws `MR_SEQUENCE_EXHAUSTED` at 999,999
- [x] 6 DTO files — `CreateMrDto`, `UpdateMrDto`, `MrListQueryDto` (with `PaginatedResult<T>`), `transition.dto.ts` (6 transition DTOs), `AddMrCommentDto`
- [x] `MaintenanceService` — ~550 lines; 17 lifecycle methods; `WAITING_FOR_PARTS` status with reason required; `waitingForParts`/`resume` both use `maintenance.start` permission; concurrency-safe `updateMany` + count check; `reopen()`: REJECTED→SUBMITTED, COMPLETED/CLOSED→IN_PROGRESS; UTC metrics for `getSummary()`
- [x] `MaintenanceController` — 23 endpoints; summary/my/people declared before `/:id`
- [x] `MaintenanceModule` — imports `DatabaseModule` + `AuthModule`; provides `MaintenanceService` + `MaintenanceRefService`
- [x] `app.module.ts` — imports `MaintenanceModule`
- [x] `maintenance-api.ts` — typed web client with `maintenanceApi` namespace: list, get, summary, my, listComments, listActivities, people
- [x] `actions.ts` — 16 server actions: create, updateDraft, submit, review, approve, reject, assign, unassign, start, waitingForParts, resume, complete, close, cancel, reopen, addComment
- [x] Components: `MrStatusBadge` (11 statuses), `MrPriorityBadge` (4 priorities)
- [x] Pages: `loading.tsx`, `page.tsx` (list + filters + pagination), `my/page.tsx`, `new/page.tsx`, `[id]/page.tsx` (full detail + transitions + comments + activity), `[id]/edit/page.tsx`
- [x] Dashboard — "Maintenance Requests" section with 5 MetricCards (Open, Assigned to Me, Overdue, Waiting for Parts, Completed This Month); MODULE_CARDS updated to `status: 'available'`; PROGRESS_STEPS updated
- [x] `maintenance.service.test.ts` — 59 tests covering all lifecycle transitions, assignee ownership, concurrency, impersonation guard, reopen logic, getSummary metrics
- [x] Lint: 0 errors | Typecheck: 0 errors | Tests: 251/251 | Build: 8/8

### 11 Permissions Seeded

| Code | Assigned to |
|---|---|
| `maintenance.read` | SUPER_ADMIN, ADMIN, VIEWER |
| `maintenance.create` | SUPER_ADMIN, ADMIN, VIEWER |
| `maintenance.review` | SUPER_ADMIN, ADMIN |
| `maintenance.approve` | SUPER_ADMIN, ADMIN |
| `maintenance.reject` | SUPER_ADMIN, ADMIN |
| `maintenance.assign` | SUPER_ADMIN, ADMIN |
| `maintenance.start` | SUPER_ADMIN, ADMIN, VIEWER |
| `maintenance.complete` | SUPER_ADMIN, ADMIN, VIEWER |
| `maintenance.close` | SUPER_ADMIN, ADMIN |
| `maintenance.comment` | SUPER_ADMIN, ADMIN, VIEWER |
| `maintenance.manage` | SUPER_ADMIN, ADMIN |

Note: VIEWER receives `maintenance.read`, `maintenance.create`, `maintenance.start`, `maintenance.complete`, `maintenance.comment` (5 of 11); no reject, close, or manage.

### Verification Results (2026-07-01)

| Command | Result |
|---|---|
| `pnpm db:migrate:status` | ✓ 7 migrations applied, up to date |
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm test` | ✓ 251/251 tests (15 files, 59 new maintenance tests) |
| `pnpm build` | ✓ 8/8 tasks; 5 new maintenance routes: `/maintenance`, `/maintenance/[id]`, `/maintenance/[id]/edit`, `/maintenance/my`, `/maintenance/new` |

### Key Implementation Notes

- `WAITING_FOR_PARTS` is a unique status not found in factory-tasks; transitions: IN_PROGRESS↔WAITING_FOR_PARTS via `waitingForParts()`/`resume()`; both use `maintenance.start` permission (assignee-controlled)
- `reopen()` behavior differs by source status: REJECTED→SUBMITTED (re-enters review workflow); COMPLETED/CLOSED→IN_PROGRESS (continues execution)
- `cancel` endpoint uses `maintenance.create` permission at controller level; service enforces ownership/manage internally (creator may cancel own DRAFT/SUBMITTED; `maintenance.manage` required for others or advanced states)
- Shadow DB workaround still active for all migrations
- Database package must be rebuilt (`pnpm --filter @recafco/database build`) before running tests in fresh environment

### New Dependencies

None — all used packages were already installed.

## Risks

- Incomplete module requirements
- Undocumented SAP customizations
- Unknown server capacity
- Existing maintenance migration risk
- Dependence on external SAP consultant
- Pressure to make unfinished workflows appear complete
