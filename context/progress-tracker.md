# Progress Tracker

## Current Status

- **Project:** RECAFCO Factory Management Platform
- **Short name:** RECAFCO FMP
- **Phase:** Phase 1 — Repository and Runtime
- **Last completed:** Unit 03 — PostgreSQL and Prisma Foundation (2026-06-30)
- **Next:** Unit 04 (TBD per build plan)
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

## Current Unit

### Unit 04 — TBD

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

## Risks

- Incomplete module requirements
- Undocumented SAP customizations
- Unknown server capacity
- Existing maintenance migration risk
- Dependence on external SAP consultant
- Pressure to make unfinished workflows appear complete
