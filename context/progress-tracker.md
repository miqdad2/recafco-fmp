# Progress Tracker

## Current Status

- **Project:** RECAFCO Factory Management Platform
- **Short name:** RECAFCO FMP
- **Phase:** Phase 1 — Repository and Runtime
- **Last completed:** Unit 01 — Monorepo Foundation (2026-06-30)
- **Next:** Unit 02 — Environment, Logging, Request IDs, Health
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

## Current Unit

### Unit 02 — Environment, Logging, Request IDs, Health

See `context/build-plan.md` Phase 1, item 2.

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
