# Progress Tracker

## Current Status

- **Project:** RECAFCO Factory Management Platform
- **Short name:** RECAFCO FMP
- **Phase:** Discovery and repository preparation
- **Last completed:** Expanded context package created
- **Next:** Unit 01 — Monorepo Foundation
- **Deployment:** RECAFCO internal company server
- **SAP:** SAP Business One 9.3 for SAP HANA, build 9.30.150, PL 06, 64-bit
- **Licensing:** open-source/self-hosted-first

## Completed

- Platform name approved
- Six permanent main modules confirmed
- Open-source/self-hosted direction confirmed
- SAP product/version/database confirmed
- Architecture, standards, UI tokens, UI rules, UI registry, library rules, build plan, and progress structure prepared

## Current Unit

### Unit 01 — Monorepo Foundation

Acceptance criteria:

- pnpm workspace
- `apps/web`, `apps/api`, `apps/worker`
- `packages/database`, `packages/shared`, `packages/ui`, `packages/config`, `packages/observability`
- strict TypeScript
- lint/test/typecheck/build scripts
- minimal web page
- API `/health`
- worker liveness
- no database schema
- no auth
- no SAP access
- no business workflows
- no fake production metrics
- progress tracker updated
- agent stops after final report

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

## Risks

- Incomplete module requirements
- Undocumented SAP customizations
- Unknown server capacity
- Existing maintenance migration risk
- Dependence on external SAP consultant
- Pressure to make unfinished workflows appear complete
