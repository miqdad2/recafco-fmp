# Progress Tracker

## Current Status

- **Project:** RECAFCO Factory Management Platform
- **Short name:** RECAFCO FMP
- **Phase:** Platform Hardening / Deployment Ready
- **Last completed:** CM-70G — Fix Documents & Obligations Nested Form Upload Bug (2026-09-06)
- **Next:** Controlled deployment to RECAFCO internal server
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
- **Unit 11 — Safety & Compliance Foundation** ✓
- **Unit 12 — Contracts Management Foundation** ✓
- **Unit 13 — Production Management Foundation** ✓
- **Unit 14 — Final Platform Hardening, Release Audit, and Deployment Readiness** ✓
- **Unit 15 — Department-Scoped Module Access** ✓
- **User Administration UI Redesign** ✓
- **Permission Handling Safety Fix** ✓
- **Department-Specific Dashboards** ✓
- **User Access Acceptance Test** ✓
- **UAT Live Execution — Full Acceptance Test** ✓
- **Safe Lifecycle Management (Departments, Plants, Locations, Users)** ✓

## UAT Live Execution — Full Acceptance Test (Completed 2026-07-05)

### Summary

End-to-end live acceptance test using four dedicated test users seeded into the development database by an idempotent `uat-seed.ts` script (aborts in production). Twelve UAT records were created (two per operational module, one per department). All 30 live API tests passed. Two new automated test files added (+31 tests). Final test count: **705 total** (638 API + 67 web).

### Test Data Created by uat-seed.ts

| Entity | Code / Username | Notes |
|---|---|---|
| Department | ENG-01 | Engineering; created by seed (never removes CM-01) |
| Plant | TEST-PLANT-01 | UAT-only; safe to delete after cleanup |
| Location | TEST-LOC-01 | Linked to TEST-PLANT-01 |
| Production Line | UAT-LINE-01 | ENG-01; UAT-only |
| User | test.operator | VIEWER, CM-01, OWN_DEPARTMENT all modules |
| User | test.selected | VIEWER, CM-01; SELECTED_DEPARTMENTS [CM-01+ENG-01] for FACTORY_TASKS + INCIDENT_REPORT; OWN_DEPARTMENT all others |
| User | test.manager | ADMIN, CM-01; ALL_DEPARTMENTS for INCIDENT_REPORT + CONTRACTS_MANAGEMENT; OWN_DEPARTMENT all others |
| User | test.nodept | VIEWER, no department; fail-closed everywhere |
| Module records (×12) | titles: `[UAT] ...` | TASK/INC/MR/SAFE/CONTRACT/PROD ×2 (999001=CM-01, 999002=ENG-01) |

All passwords: `UATpass2026!` (Argon2id). Reference numbers use 999xxx range to avoid sequence collision.

### Live Acceptance Test Results

**Section 1 — Login (4/4 PASS)**

All four test users authenticate successfully.

**Section A — SELECTED_DEPARTMENTS isolation (6/6 PASS)**

| Test | Result |
|---|---|
| A1: test.selected FACTORY_TASKS — sees CM-01 task | PASS |
| A2: test.selected FACTORY_TASKS — sees ENG-01 task | PASS |
| A3: test.selected INCIDENT_REPORT — sees CM-01 incident | PASS |
| A4: test.selected INCIDENT_REPORT — sees ENG-01 incident | PASS |
| A5: test.selected MAINTENANCE_REQUESTS — sees CM-01 maintenance (OWN_DEPARTMENT fallback) | PASS |
| A6: test.selected MAINTENANCE_REQUESTS — CANNOT see ENG-01 maintenance | PASS |

**Section B — Mixed ALL_DEPARTMENTS isolation (8/8 PASS)**

| Test | Result |
|---|---|
| B1: test.manager incidents — sees CM-01 [ALL_DEPARTMENTS] | PASS |
| B2: test.manager incidents — sees ENG-01 [ALL_DEPARTMENTS] | PASS |
| B3: test.manager contracts — sees CM-01 [ALL_DEPARTMENTS] | PASS |
| B4: test.manager contracts — sees ENG-01 [ALL_DEPARTMENTS] | PASS |
| B5: test.manager maintenance — sees CM-01 [OWN_DEPARTMENT] | PASS |
| B6: test.manager maintenance — CANNOT see ENG-01 [OWN_DEPARTMENT isolation] | PASS |
| B7: test.manager tasks — sees CM-01 [OWN_DEPARTMENT] | PASS |
| B8: test.manager tasks — CANNOT see ENG-01 [OWN_DEPARTMENT isolation] | PASS |

**Section C — Plant/Location selector API (3/3 PASS)**

| Test | Result |
|---|---|
| C1: TEST-PLANT-01 appears in plants list | PASS |
| C2: TEST-LOC-01 appears when filtered by TEST-PLANT-01 | PASS |
| C3: TEST-LOC-01 appears in unfiltered location list | PASS |

**Section D — Direct URL access control (5/5 PASS)**

| Test | Result |
|---|---|
| D1: test.operator → ENG-01 incident detail → 403 | PASS |
| D2: test.manager → ENG-01 incident detail → 200 [ALL_DEPARTMENTS] | PASS |
| D3: test.nodept → ENG-01 incident detail → 403 [fail-closed] | PASS |
| D4: test.nodept → CM-01 maintenance detail → 403 [fail-closed] | PASS |
| D5: test.operator → CM-01 maintenance detail → 200 [own dept] | PASS |

**Section E — Dashboard/list scope consistency (4/4 PASS + 1 NOTE)**

| Test | Result |
|---|---|
| E1: test.operator dashboard recent — does NOT include ENG-01 incident | PASS |
| E2: test.operator list — does NOT include ENG-01 incident | PASS |
| E3: test.operator list — DOES include CM-01 incident | PASS |
| E4: test.operator incident dashboard scope badge = OWN_DEPARTMENT | PASS |
| E5: test.manager incident dashboard scope badge = ALL_DEPARTMENTS | PASS |

**Section F — Scope update validation (3/3 PASS)**

| Test | Result |
|---|---|
| F1: ADMIN (test.manager) PUT SELECTED_DEPARTMENTS + 0 depts → 400 | PASS |
| F2: ADMIN (test.manager) PUT ALL_DEPARTMENTS without manage_all_departments → 403 | PASS |
| F3: VIEWER (test.operator) PUT module-access → 403 (no access_scope.manage) | PASS |

### New Automated Tests Added

**`apps/api/src/acceptance/uat-scope-isolation.test.ts`** — 15 tests (B1–B15)
- B1–B4: SELECTED_DEPARTMENTS profile — buildDeptFilter, canAccessDepartment
- B5–B8: mixed ALL_DEPARTMENTS profile — filter is null vs {in:[deptId]}
- B9–B11: scope badge consistency — getScope() sentinel matches buildDeptFilter() sentinel
- B12–B15: direct URL access control — assertCanAccessDepartment per profile

**`apps/web/src/app/(protected)/administration/users/__tests__/uat-org-selectors.test.ts`** — 16 tests (T34–T49)
- T34–T37: location filter includes locations without a plant (`!l.plantId`)
- T38–T41: "Select a plant before assigning a location" prompt
- T42–T44: plant onChange drives filteredLocations via selectedPlantId state
- T45–T47: server pages request `isActive: true` for plants and locations
- T48–T49: "No active plants found" empty state in both form components

### Scripts Added

| Script | Purpose |
|---|---|
| `pnpm --filter @recafco/api uat:seed` | Idempotent seed; aborts if NODE_ENV=production |
| `pnpm --filter @recafco/api uat:cleanup` | Idempotent cleanup of `[UAT]`-prefixed records + test users; never removes CM-01; aborts in production |

### Key Technical Notes

- Reference numbers use the 999xxx range (`TASK-2026-999001`) to satisfy DB CHECK constraints (`^MODULE-[0-9]{4}-[0-9]{6}$`) while avoiding real sequence collision
- Cleanup uses `title: { startsWith: '[UAT]' }` (not referenceNumber prefix) since reference numbers follow the enforced format
- `vi.resetAllMocks()` required in `beforeEach` (not `vi.clearAllMocks()`) — clear does not drain `mockResolvedValueOnce` queues; stale values corrupt subsequent tests
- test.manager's ALL_DEPARTMENTS for INCIDENT_REPORT and CONTRACTS_MANAGEMENT is an explicit `UserModuleAccess` row; it does NOT come from the ADMIN role
- `PUT /administration/users/:id/module-access/:module` lives under `/administration/users/` prefix (not `/users/`)
- `/auth/me` is the profile endpoint (not `/me`)

### Verification Results (2026-07-05)

| Command | Result |
|---|---|
| `pnpm --filter @recafco/api test --run` | ✓ **638/638** (26 test files) |
| `pnpm --filter @recafco/web test --run` | ✓ **67/67** (6 test files) |
| **Total** | ✓ **705 tests** |

No production data modified. No migrations. No automatic deployment.

## Safe Lifecycle Management — Departments, Plants, Locations, Users (Completed 2026-07-05)

### Summary

Added soft-archive and guarded hard-delete lifecycle management for all four organizational and user entities. All state changes create `securityAuditEvent` rows. No CASCADE deletes. No breaking of foreign keys, history, or audit trails.

### Lifecycle States

| State | isActive | archivedAt |
|---|---|---|
| Active | true | null |
| Deactivated | false | null |
| Archived | false | non-null |

### API Endpoints Added

| Entity | Endpoint | Permission |
|---|---|---|
| Departments | `GET :id/dependencies` | `org.departments.read` |
| Departments | `POST :id/archive` | `org.departments.archive` |
| Departments | `DELETE :id` | `org.departments.delete` |
| Plants | `GET :id/dependencies` | `org.plants.read` |
| Plants | `POST :id/archive` | `org.plants.archive` |
| Plants | `DELETE :id` | `org.plants.delete` |
| Locations | `GET :id/dependencies` | `org.locations.read` |
| Locations | `POST :id/archive` | `org.locations.archive` |
| Locations | `DELETE :id` | `org.locations.delete` |
| Users | `GET :id/history` | `users.read` |
| Users | `POST :id/archive` | `users.archive` |
| Users | `DELETE :id` | `users.delete_test` (test users only) |

### Hard Delete Rules

- **Departments/Plants/Locations**: blocked if any FK dependency exists; dependency check returns `{ canDelete, dependencies }`. DELETE returns HTTP 204.
- **Users**: only permitted when username starts with `test.`, user has zero history across all 12 business tables, and actor supplies matching `confirmationText` in request body.
- **Self-protection**: actors cannot deactivate, archive, or delete themselves.
- **Last SUPER_ADMIN guard**: archive blocked when no other active SUPER_ADMIN exists.

### Frontend Components Added

- `_components/lifecycle-actions.tsx` — `OrgLifecycleActions` client component (archive + dependency-check + delete dialogs)
- `_components/status-badge.tsx` — rewritten to handle Active/Inactive/Archived states
- `users/_components/user-lifecycle-actions.tsx` — `UserLifecycleActions` client component
- All 4 list pages updated to use the new action menus

### Migration Applied

Migration `20260705_lifecycle_management`: adds `archived_at` and `archived_by_user_id` columns to `departments`, `plants`, `locations`, `users`. Adds 12 lifecycle permission codes.

### Key Technical Notes

- `archivedByUserId` stored as plain string (no FK) to preserve history if actor is later deactivated
- `checkUserHistory` queries 12 tables: incident (reportedBy + assignedTo), factoryTask (createdBy + assignedTo), maintenanceRequest (createdBy + assignedTo), safetyInspection (createdBy), safetyFinding (assignedTo), contract (ownerUser + createdBy), productionOrder (createdBy), incidentComment (authorUser), securityAuditEvent (userId + actorId)
- `moduleAccess` indirect count removed from department `checkDependencies` — `userModuleDepartmentGrant` (direct FK) is the real dependency
- All lifecycle server actions return `{ error?: string }` (not void) to allow inline error display without redirect

### Verification Results (2026-07-05)

| Command | Result |
|---|---|
| `pnpm --filter @recafco/api exec tsc --noEmit` | ✓ 0 errors |
| `pnpm --filter @recafco/web exec tsc --noEmit` | ✓ 0 errors |
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/api test --run` | ✓ **670/670** (27 test files) |
| `pnpm --filter @recafco/web test --run` | ✓ **67/67** (6 test files) |
| `pnpm build` | ✓ 8/8 tasks |
| **Total** | ✓ **737 tests** |

---

## Department-Specific Dashboards (Completed 2026-07-05)

### Summary

Added per-module dashboard pages for all 7 modules (Factory Tasks, Incidents, Maintenance, Safety & Compliance, Contracts, Production, Administration). Each dashboard shows department scope badge, metric cards, and recent items table. Backend adds `getDashboard(actor)` to all 7 services + `GET /module/dashboard` endpoints with `@Permissions('module.read')`. Department scoping is enforced via `DepartmentAccessService`. Root dashboard `/` module cards and sidebar navigation updated to point to dashboard routes.

### Routes Added

- `/factory-tasks/dashboard` — 5 metrics: Open Tasks, Assigned to Me, Overdue, Blocked, Completed This Month
- `/incidents/dashboard` — 4 metrics: Open, Critical Open, Under Investigation, Resolved This Month
- `/maintenance/dashboard` — 5 metrics: Open, Assigned to Me, Overdue, Waiting for Parts, Completed This Month
- `/safety-compliance/dashboard` — 5 metrics: Scheduled, In Progress, Open Findings, Critical Findings, Overdue Findings
- `/contracts/dashboard` — 6 metrics: Active, Expiring Soon, Expired, Draft, Terminated, Closed
- `/production/dashboard` — 4 metrics: Scheduled Orders, In Progress, Paused, Completed This Month
- `/administration/dashboard` — 4 metrics: Active Users, Inactive Users, Locked Accounts, Must Change Password

### Key Architecture Notes

- `DashboardScopeBadge` shared component displays scope type with appropriate icon/color
- `DashboardRecentTable` shared component shows 8 most-recently-updated items with clickable row links
- `hrefSuffix` prop on `DashboardRecentTable` supports admin users linking to `/edit`
- Admin dashboard reads cookie directly (pattern differs from other modules using `apiFetch`)
- Sidebar `isActive()` updated to highlight module nav when anywhere in `/module/**` including `/module/dashboard`
- `@Get('dashboard')` declared before `@Get(':id')` in all controllers to avoid NestJS route conflicts
- Safety findings scoped via `{ inspection: { departmentId: deptFilter } }` (no direct `departmentId` on `SafetyFinding`)

### New Files

- `apps/web/src/app/(protected)/_components/dashboard-scope-badge.tsx`
- `apps/web/src/app/(protected)/_components/dashboard-recent-table.tsx`
- `apps/web/src/app/(protected)/factory-tasks/dashboard/page.tsx`
- `apps/web/src/app/(protected)/incidents/dashboard/page.tsx`
- `apps/web/src/app/(protected)/maintenance/dashboard/page.tsx`
- `apps/web/src/app/(protected)/safety-compliance/dashboard/page.tsx`
- `apps/web/src/app/(protected)/contracts/dashboard/page.tsx`
- `apps/web/src/app/(protected)/production/dashboard/page.tsx`
- `apps/web/src/app/(protected)/administration/dashboard/page.tsx`
- `apps/api/src/incidents/incidents.service.test.ts`

### Verification Results (2026-07-05 — initial)

| Command | Result |
|---|---|
| `pnpm typecheck` | ✓ 12/12 tasks |
| `pnpm test` | ✓ 566/566 tests (22 test files) |
| `pnpm build` | ✓ 8/8 tasks, 54 routes emitted |

No database changes. No new migrations.

## Dashboard Permission Hardening (Completed 2026-07-05)

### Summary

Acceptance audit found two gaps: (1) MODULE_CARDS on the root dashboard shown unconditionally regardless of permissions, (2) quick-action create buttons on all 7 module dashboards shown unconditionally. Both fixed.

### Changes

**Root page (`apps/web/src/app/(protected)/page.tsx`):**
- Added `readPermission` field to each of the 6 `MODULE_CARDS` entries
- Filters MODULE_CARDS by `permissions.includes(card.readPermission)` before rendering
- Shows "You do not have access to any operational modules" empty state when no cards are visible

**All 7 module dashboard pages** — added `Promise.allSettled([api.dashboard(), authApi.me(accessToken)])` to run dashboard fetch and permission fetch in parallel; gates create buttons by permission:
- `factory-tasks/dashboard`: "New Task" gated by `tasks.create`
- `incidents/dashboard`: "Report Incident" gated by `incidents.create`
- `maintenance/dashboard`: "New Request" gated by `maintenance.create`
- `safety-compliance/dashboard`: "New Inspection" gated by `safety.create`
- `contracts/dashboard`: "New Contract" gated by `contracts.create`
- `production/dashboard`: "New Production Order" gated by `production.create`; "Production Lines" gated by `production.lines.read`
- `administration/dashboard`: "New User" gated by `users.create`; "Roles" gated by `roles.read`

### Verification Results (2026-07-05)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 12/12 tasks |
| `pnpm test` | ✓ 566/566 tests |
| `pnpm build` | ✓ 8/8 tasks, 54 routes emitted |

No database changes. No new migrations.

---

## User Access Acceptance Test (Completed 2026-07-05)

### Summary

Formal acceptance-test plan covering permissions, department scope, cross-module isolation, direct-URL protection, and role-change safety. Produces a full acceptance matrix with blocked-test identification, 5 user profiles, and automated tests for all provable security paths.

### Five User Profiles

| Profile | Role | Dept | Scope | Purpose |
|---|---|---|---|---|
| A — OWN-DEPT OPERATOR | Viewer | CM-01 | OWN_DEPARTMENT | Sees only CM-01 records |
| B — SELECTED-DEPTS USER | Viewer | CM-01 | SELECTED_DEPARTMENTS + CM-01 grant | Sees own + selected depts |
| C — COMPANY-WIDE MANAGER | Administrator | CM-01 | ALL_DEPARTMENTS (explicit, per module) | Company-wide in configured modules only |
| D — READ-ONLY USER | Viewer | CM-01 | OWN_DEPARTMENT | Read perms only; write actions blocked |
| E — NO-DEPT USER | Viewer | NULL | OWN_DEPARTMENT | Zero records everywhere (fail-closed) |

Test users A/D/E map to `dataentry` (currently no dept). Profiles B and C require `superadmin` or a second user to be created and configured.

### Automated Tests Added (+40 API tests)

**New file: `apps/api/src/acceptance/user-access-acceptance.test.ts`** (27 tests)
| Test | Coverage |
|---|---|
| A1–A5 | Cross-module scope isolation: ALL_DEPARTMENTS for module A ≠ module B |
| A6–A8 | Role names never used: PermissionGuard checks permissions[], not roleName/roleCode |
| A9–A11 | Permission absent + scope row = blocked (guard runs before scope check) |
| A12–A15 | Dept change: OWN changes, SELECTED_DEPARTMENTS grants unchanged |
| A16 (×7) | No-dept fail-closed for all 7 modules (OWN_DEPARTMENT → {in: []}) |
| A17–A19 | ALL_DEPARTMENTS requires explicit DB row; permission never fast-paths it |
| A20–A22 | canGrantScope privilege escalation prevention |
| A23–A27 | assertCanAccessDepartment direct URL protection per module |

**Extended: `apps/api/src/incidents/incidents.service.test.ts`** (+13 tests)
| Test | Coverage |
|---|---|
| getDashboard × 2 | ALL_DEPARTMENTS and OWN_DEPARTMENT scope application |
| findOne × 3 | Direct URL protection: 403 on cross-dept, 404 on missing, pass on own dept |
| findAll × 3 | Dept filter applied: {in:[dept-a]}, {in:[]}, null each produce correct query shape |

### Test Data Coverage Gaps (Blocked — B/C/D)

Tests that CANNOT run until additional data is created:

| Blocked Test | Blocker |
|---|---|
| Profile B: SELECTED_DEPARTMENTS cross-dept isolation | Requires ≥ 2 active departments |
| Profile C: ALL_DEPARTMENTS in module X ≠ scope in module Y | Requires a second user configured with mixed scopes |
| Plant/Location selector UI tests | 0 plants, 0 locations |
| Cross-department direct-URL rejection (live API test) | Requires a second active department and a record in that department |

### Required Setup Before Full Manual Test

In priority order (do not create automatically):

1. **Create at least one more active department** (e.g., `ENG-01 — Engineering`) to enable cross-department tests
2. **Seed at least one plant and location** so plant/location selectors can be tested
3. **Create test users** (propose usernames/roles, do not auto-create):
   - `test.operator` — Viewer role, CM-01 dept, OWN_DEPARTMENT (Profile A)
   - `test.selected` — Viewer role, CM-01 dept, SELECTED_DEPARTMENTS with CM-01 + ENG-01 grants (Profile B — needs second dept)
   - `test.manager` — Administrator role, CM-01 dept, ALL_DEPARTMENTS for Incidents + Maintenance only (Profile C)
   - `test.nodept` — Viewer role, no dept, OWN_DEPARTMENT (Profile E)
4. **Create at least one test record in each module** (one per department) to enable cross-dept visibility testing

### Verification Results (2026-07-05)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 12/12 tasks |
| `pnpm --filter @recafco/api test --run` | ✓ **623/623** (25 files) |
| `pnpm --filter @recafco/web test --run` | ✓ **51/51** (5 files) |
| **Total** | ✓ **674 tests** |
| `pnpm build` | ✓ **8/8 tasks** |

No database changes. No new migrations. No production data modified.

---

## User Administration & Organization Assignment Security Audit (Completed 2026-07-05)

### Summary

11-phase security audit and correction of User Administration, Organization Assignment, and Module Access. Phases 1, 9 were read-only audits; Phases 2–8, 10, 11 applied concrete fixes.

### Root Cause (Phase 1)

Frontend called `departments.list({ pageSize: 200 })`. The backend `OrgListQueryDto` had `@Max(100)` on `pageSize`. The API returned HTTP 400. `Promise.allSettled` swallowed the rejection as an empty array. Dropdowns showed only "— None —".

### Backend Fixes

**`apps/api/src/organizations/dto/org-list-query.dto.ts`** — `@Max(100)` raised to `@Max(500)` to accommodate large installations.

**`apps/api/src/users/dto/update-user.dto.ts`** — `departmentId`, `plantId`, `locationId` now accept `string | null` using `@ValidateIf((_, v) => v !== null)` to allow explicit clearing of org assignments.

**`apps/api/src/users/users.service.ts`** — `update()` now emits a specific `user_org_assignment_changed` audit event (in addition to `user_updated`) when any org field changes, including before/after values in metadata.

### Frontend Fixes

**`apps/web/src/app/(protected)/administration/users/actions.ts`** — `updateOrgAction` now sends `departmentId: null` (not omits) when "— None —" is selected, enabling explicit field clearing.

**`apps/web/src/app/(protected)/administration/users/new/page.tsx`** — Detects rejected API calls (`deptApiError`, `plantApiError`, `locApiError`) and passes them to `NewUserForm`.

**`apps/web/src/app/(protected)/administration/users/[id]/edit/page.tsx`** — Same error propagation pattern.

**`apps/web/src/app/(protected)/administration/users/_components/new-user-form.tsx`** — Shows visible "Unable to load organization data" error banner and per-field error text when API calls fail (instead of silent empty dropdown).

**`apps/web/src/app/(protected)/administration/users/_components/edit-user-tabs.tsx`** — Added `deptApiError`/`plantApiError`/`locApiError` props; shows error banner in OrgTab; added "no primary department" warning; removed `overflow-x-auto` from tab navigation bar.

**`apps/web/src/app/(protected)/administration/users/_components/module-access-panel.tsx`** — Distinguishes "API failed" (shows error text) from "no active departments" (shows empty state text) for SELECTED_DEPARTMENTS department list.

**`apps/web/src/app/(protected)/administration/users/_components/module-access-editor.tsx`** — Same API error vs. no-records distinction.

**`apps/web/src/lib/users-api.ts`** — `UpdateUserPayload` org fields typed as `string | null` to match backend.

### Database Inspection Findings (Phase 9, Read-Only)

- 1 active department (CM-01), 0 active plants, 0 active locations
- Both active users (`superadmin`, `dataentry`) have `department_id = NULL` — fail-closed behavior already in place (`OWN_DEPARTMENT` with no deptId returns `{ in: [] }`)
- VIEWER role has 33 permissions; several write permissions (`maintenance.approve`, `tasks.create`, `safety.create`, etc.) present — intentionality unconfirmed; no changes made without business confirmation

### New Tests (Phase 10 — 20 new tests)

| File | Tests |
|---|---|
| `apps/api/src/organizations/dto/org-list-query.test.ts` | T1–T6: pageSize 200/500/501/0/1/default |
| `apps/api/src/users/dto/update-user.test.ts` | T7–T13: nullable org fields, valid UUID, reject non-UUID |
| `apps/api/src/users/users.service.test.ts` | 4 new: org audit event emitted/not emitted, null clear accepted |
| `apps/web/src/app/(protected)/administration/users/__tests__/user-admin-security.test.ts` | T14–T20: @Max fix, error state detection, updateOrgAction clearing |

### Verification Results (2026-07-05)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 12/12 tasks |
| `pnpm test` | ✓ 583 API + 36 web = 619 total (baseline 566+29=595; net +24). "583" in earlier report was API-only, not a regression. |
| `pnpm build` | ✓ 8/8 tasks |

**Important correction:** `@Max(100)` on `OrgListQueryDto.pageSize` was mistakenly raised to `@Max(500)` in this audit. It was then restored back to `@Max(100)` and frontend corrected to use `pageSize: 100`.

No database changes. No new migrations.

---

## User Administration Security Audit — Release Blocker Remediation (Completed 2026-07-05)

### Summary

Resolved 7 release blockers identified post-audit: restored `@Max(100)` API limit, explained test count (no regression), added write-permission UI warning, strengthened org empty-state messaging, added SELECTED_DEPARTMENTS Save-disable validation, performed read-only DB inspection, and ran full verification.

### Item 1 — @Max(100) Restored

`apps/api/src/organizations/dto/org-list-query.dto.ts` — `@Max(500)` was wrong; restored to `@Max(100)`. Both `new/page.tsx` and `[id]/edit/page.tsx` corrected to `pageSize: 100`. Tests T1–T6 verify DTO limit; T14b/T14c verify neither page requests > 100.

### Item 2 — Test Count Clarified

Previous "595" = 566 API + 29 web. Current "619" = 583 API + 36 web. The "583" reported in the first audit session was the API-only count; no tests were lost.

### Item 3 — Write-Permission UI Warning

`apps/web/src/app/(protected)/administration/users/_components/role-permission-summary.tsx` — Added `getWritePermissions()` helper (excludes `.read`, `.comment`, `update_own_draft`, `update_progress`) and a yellow `role="alert"` banner listing write permission codes when `showWriteWarning` prop is true. Wired in both `new-user-form.tsx` and `edit-user-tabs.tsx` with `showWriteWarning`.

No changes to VIEWER role assignments. VIEWER has 33 permissions including `maintenance.approve`, `maintenance.assign`, `maintenance.complete`, `tasks.create`, `tasks.start`, `safety.create` — flagged for business review but intentional by design per migration comments.

### Item 4 — Organization Empty-State Messaging

Strengthened in both `new-user-form.tsx` and the OrgTab in `edit-user-tabs.tsx`:
- Plant with 0 results: "No active plants found." (not a silent empty select)
- Location before plant selected: "Select a plant before assigning a location."
- Location after plant selected, 0 results: "No active locations found for this plant."
- No-dept warning strengthened to: "This user has no primary department. Department-scoped operational access currently fails closed — they will see zero records in modules that filter by department."

### Item 5 — Module Access Validation UX

`module-access-panel.tsx` `ModuleRow`:
- Checkboxes changed from `defaultChecked` to controlled `checked={checkedDeptIds.has(dept.id)}` with `checkedDeptIds: Set<string>` state.
- `noDeptSelected` computed: `selectedScope === 'SELECTED_DEPARTMENTS' && checkedDeptIds.size === 0 && !deptApiError`
- Save button: `disabled={pending || noDeptSelected}` + `cursor-not-allowed`
- Inline "Select at least one department." validation message shown when `noDeptSelected`
- `cancelEditing()` resets both `selectedScope` and `checkedDeptIds` to persisted config values (full Cancel-restore behavior).

### Item 6 — Read-Only Database Inspection

| Entity | Count | Notes |
|---|---|---|
| Departments (active) | 1 | CM-01 — Contacts Management |
| Plants (active) | 0 | None seeded yet |
| Locations (active) | 0 | None seeded yet |
| Users | 2 | `superadmin` (Super Administrator), `dataentry` (Viewer role); both have `department_id = NULL` |
| Module access records | 7 | All belong to `superadmin`, all scoped `ALL_DEPARTMENTS` |
| VIEWER permissions | 33 | Includes write permissions — see Item 3 |

Both users have `department_id = NULL`. Since both `superadmin` and `dataentry` have either `ALL_DEPARTMENTS` module access or OWN_DEPARTMENT scope, the fail-closed behavior (`OWN_DEPARTMENT` + no dept → `{ in: [] }`) does not affect them yet. This should be corrected once org data is seeded.

No data was modified.

### New Tests (Items 1, 3–5 — 13 new web tests)

| Test | Description |
|---|---|
| T21–T23 | `role-permission-summary.tsx` write-warning logic and prop wiring |
| T24–T29 | Org empty-state messages in new-user-form and edit-user-tabs |
| T30–T33 | Module access panel: Save-disable, inline error, cancelEditing, controlled checkboxes |

### Verification Results (2026-07-05)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 12/12 tasks |
| `pnpm --filter @recafco/api test --run` | ✓ 583/583 tests (24 files) |
| `pnpm --filter @recafco/web test --run` | ✓ 51/51 tests (5 files) |
| Total | ✓ 634 tests |
| `pnpm build` | ✓ 8/8 tasks |

No database changes. No new migrations.

---

## Root Dashboard Security Fix (Completed 2026-07-05)

### Summary

The root dashboard (`/`) previously called `summary()` API endpoints for 5 operational modules and was missing the production module entirely. Although all `getSummary()` backend methods DO use `buildDeptFilter(actor, module)` (they are actor-scoped), the switch to `getDashboard()` was warranted because: (1) `getDashboard()` is the canonical endpoint returning scope metadata + recent items; (2) the frontend `TaskSummaryShape` had a pre-existing bug — it declared `myOpenTasks` but the backend returns `assignedToMe`; (3) module metric sections were rendered unconditionally rather than being hidden when the user lacks `read` permission.

### Changes

**`apps/web/src/app/(protected)/page.tsx`:**
- Removed sequential `rolesApi.get()` call — permissions now read directly from `authApi.me().data.permissions`
- Added `canReadProduction = permissions.includes('production.read')`
- Replaced 5 `summary()` calls with 6 `dashboard()` calls (`incidentsApi.dashboard()`, `tasksApi.dashboard()`, `maintenanceApi.dashboard()`, `safetyApi.dashboard()`, `contractsApi.dashboard()`, `productionApi.dashboard()`)
- Each module fetch conditional on read permission: `canReadX ? xApi.dashboard() : Promise.resolve(null)`
- All 6 module metric sections wrapped in `{canReadX && ...}` — sections are absent (not restricted) when user lacks permission
- Fixed `tasks.myOpenTasks` bug → `tasks.assignedToMe` (correct key from `TaskDashboardData`)
- Added Production metrics section (was completely absent before): Scheduled Orders, In Progress, Paused, Completed This Month
- Added `Play`, `PauseCircle` icon imports for production cards

**New files:**
- `apps/web/src/app/(protected)/_lib/root-dashboard-helpers.ts` — pure helpers: `getAccessibleModulePermissions`, `moduleDashStatus`, `MODULE_READ_PERMISSIONS`
- `apps/web/src/app/(protected)/_lib/root-dashboard-helpers.test.ts` — 12 tests covering 11 required scenarios

### Legacy getSummary() Endpoint Audit

| Endpoint | Backend dept-scope | Frontend status |
|---|---|---|
| `GET /incidents/summary` | ✓ `buildDeptFilter(actor, INCIDENT_REPORT)` | Replaced by `dashboard()` |
| `GET /factory-tasks/summary` | ✓ `buildDeptFilter(actor, FACTORY_TASKS)` | Replaced by `dashboard()` |
| `GET /maintenance/summary` | ✓ `buildDeptFilter(actor, MAINTENANCE)` | Replaced by `dashboard()` |
| `GET /safety-compliance/summary` | ✓ `buildDeptFilter(actor, SAFETY_COMPLIANCE)` | Replaced by `dashboard()` |
| `GET /contracts/summary` | ✓ `buildDeptFilter(actor, CONTRACTS)` | Replaced by `dashboard()` |
| `GET /production/summary` | ✓ `buildDeptFilter(actor, PRODUCTION)` | Never used (production was missing from root) |

All 6 summary endpoints are safely dept-scoped at the backend level. The switch to `dashboard()` endpoints provides richer data (scope metadata, recent items) and eliminates the frontend type bug.

### Verification Results (2026-07-05)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 12/12 tasks |
| `pnpm test` | ✓ 566/566 API + 29/29 web (595 total, 12 new web tests) |
| `pnpm build` | ✓ 8/8 tasks |

No database changes. No new migrations.

---

## Permission Handling Safety Fix (Completed 2026-07-04)

### Summary

Eliminated runtime crash in User Administration pages caused by unsafe optional-chaining on `permissions.includes()`. Added a pure `resolvePermissions()` utility and tests. Fixed a locale-dependent date rendering that caused SSR hydration mismatches.

### What Was Fixed

- **`new/page.tsx:36`** — `currentUser?.permissions.includes(...)` crashed when `meData` fetch failed and `currentUser` was null (`?.` short-circuits to `undefined`; `.includes()` on `undefined` throws). Fixed to `resolvePermissions(currentUser?.permissions).includes(...)`.
- **`[id]/edit/page.tsx:62-63`** — Same unsafe pattern for both `canManageAccess` and `canManageAll`. Fixed with same normalization.
- **`edit-user-tabs.tsx:315`** — `new Date(user.lastLoginAt).toLocaleString()` produced different output on server (UTC locale) vs. client (browser locale), causing React hydration mismatch warnings. Changed to `toISOString().slice(0, 19).replace('T', ' ') + ' UTC'` — deterministic and locale-independent.

### Audit — All Permission Patterns Reviewed

| File | Pattern | Safe? |
|---|---|---|
| `users/new/page.tsx` | `currentUser?.permissions.includes(...)` | ❌ → fixed |
| `users/[id]/edit/page.tsx` | `currentUser?.permissions.includes(...)` | ❌ → fixed |
| `sidebar.tsx` | `user.permissions.includes(...)` | ✓ `ShellUser.permissions: string[]` is non-optional |
| `factory-tasks/[id]/edit/page.tsx` | `info.permissions.includes(...)` | ✓ `getUserInfo()` always returns `{ permissions: [] }` fallback |
| All `getUserPermissions()` helpers | `Array.isArray(payload.permissions)` guard | ✓ |
| All detail pages (`maintenance/[id]`, etc.) | `Array.isArray(payload.permissions)` guard | ✓ |

### Hydration Warning Audit

Browser showed `__processed_*` and `bis_register*` attributes — these are injected by browser extensions (Browsec-type VPN/proxy extensions), not by application code. The only application-generated instability found was `toLocaleString()` in `edit-user-tabs.tsx`, now fixed. No `suppressHydrationWarning` attributes were added. Recommend testing in Incognito with extensions disabled to confirm extension attribution.

### New Files

- `apps/web/src/app/(protected)/administration/users/_components/permissions-utils.ts` — `resolvePermissions(permissions: unknown): string[]`
- `apps/web/src/app/(protected)/administration/users/__tests__/permissions-utils.test.ts` — 8 tests

### Verification Results (2026-07-04)

| Command | Result |
|---|---|
| `pnpm typecheck` (web) | ✓ 0 errors |
| `pnpm typecheck` (api) | ✓ 0 errors |
| `pnpm test` (web) | ✓ 17/17 tests (3 test files) |
| `pnpm test` (api) | ✓ 557/557 tests (21 test files, cached) |
| `pnpm build` (web) | ✓ Build exit 0, 47 routes emitted |

No backend changes. No database changes.

---

## Unit 14 — Final Platform Hardening, Release Audit, and Deployment Readiness (Completed 2026-07-02)

### Summary

Full platform audit through Unit 13 and hardening to deployment-readiness for the RECAFCO internal Windows server.

### Audit Results

#### Section 1 — Authentication and Session Audit — PASS
- All 11 protected modules use `@UseGuards(JwtAuthGuard, PermissionGuard)` at class level
- JWT guard validates session live from DB (not from JWT claims): checks `expiresAt`, `user.isActive`, loads permissions from DB
- `mustChangePassword` gating enforced in both Next.js proxy (`proxy.ts`) and `JwtAuthGuard` on every request
- Auth endpoints: `/auth/login` and `/auth/refresh` use `IpThrottleGuard`; `/auth/me` and `/auth/change-password` allow `mustChangePassword` via `@AllowMustChangePassword`
- `/health` and `/ready` intentionally public (no auth)
- Argon2id password hashing; constant-time dummy hash defense for unknown usernames; 5-attempt lockout for 15 min
- HttpOnly cookies, `Secure` in production, `SameSite: strict`

#### Section 2 — RBAC and Permission Audit — PASS
- Zero endpoints use role-name authorization — all use permission codes
- All controller methods have `@Permissions('...')` decorator
- `PermissionGuard`: routes without `@Permissions` are unguarded by design; any required permission uses `user.permissions.includes()` (array from live DB role)
- Permission matrix documented: `docs/endpoint-permissions.md`

#### Section 3 — API Response and Error Audit — PASS
- All controller methods return `{ data, meta: { requestId? }, error: null }`
- `GlobalExceptionFilter` catches all exceptions, logs unexpected errors, never returns stack traces to clients
- Stable error codes (e.g., `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `CONFLICT`)

#### Section 4 — Concurrency and Workflow Audit — PASS
- Production module: version-based optimistic concurrency on all write transitions and updates
- Contracts: version-based optimistic concurrency
- Incidents/Tasks/Maintenance/Safety: ownership-checked transitions (no shared-state race conditions)
- No unsafe read-then-write patterns found

#### Section 5 — Input Validation and Query Safety — PASS
- Global `ValidationPipe(whitelist: true, forbidNonWhitelisted: true, transform: true)` blocks unknown fields
- All query DTOs use class-validator with `@IsOptional`, `@IsInt`, `@Min`, `@Max`
- No raw string interpolation in Prisma queries found

#### Section 6 — Environment and Configuration Hardening — PASS
- `JWT_ACCESS_SECRET` min 32 chars enforced at startup
- `CORS_ALLOWED_ORIGINS` wildcard (`*`) blocked in production
- `DATABASE_URL` must start with `postgresql://` or `postgres://`
- Fail-fast on invalid env: process exits before accepting connections

#### Section 7 — Health and Readiness Endpoints — PASS
- `GET /health`: always 200, no auth, `{ status: 'ok', service: 'recafco-fmp-api' }`
- `GET /ready`: 503 until DB connected and `RuntimeStateService.markInitialized()` called; 200 with uptimeMs and checks

#### Section 8 — Production Logging and Observability — PASS
- Pino JSON logging via `@recafco/observability`; request IDs propagated through `RequestIdMiddleware` + `AsyncLocalStorage`
- `RequestLogMiddleware` logs method, url, status, duration, requestId
- No secrets or PII logged

#### Section 9 — Frontend Release Audit — FIXED
- **Fixed**: Production module card changed from `status: 'planned'` to `status: 'available'`
- **Fixed**: `PROGRESS_STEPS` — removed stale `current` step; Production and Platform Hardening added as `done: true`
- **Fixed**: Removed unused `ArrowRightIcon` import; fixed TypeScript errors from removed `step.current` references
- Sidebar navigation: Production already wired at `/production` (no `comingSoon` flag)
- All module links verified to point to implemented routes

#### Section 10 — Dashboard Resilience — PASS
- All module data fetches use `Promise.allSettled` — failure in one module does not crash dashboard
- Dedicated resolver functions (`resolveCount`, `resolveIncidentMetric`, etc.) return `{ status: 'unavailable' }` on rejection
- `MetricCard` renders gracefully for all `MetricStatus` values: `ok`, `restricted`, `unavailable`

#### Section 11 — Database Release Audit — PASS
- 11 migrations confirmed; all applied
- No `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE` in any migration
- All migrations are additive (new tables, new columns, permission INSERTs)

#### Section 12 — PM2 and Windows Production Startup — COMPLETE
- Created `ecosystem.config.js` at repo root
- 3 processes: `recafco-fmp-api` (port 4000), `recafco-fmp-web` (port 3000), `recafco-fmp-worker` (inactive until BullMQ wired)
- Log paths: `<repo-root>/logs/`; `autorestart: true` for api and web; `max_restarts: 10`

#### Section 13 — Deployment Scripting — COMPLETE
- `scripts/pre-deploy-check.ps1`: validates pnpm, .env keys, placeholder detection, built artifacts, pm2, logs dir, git status
- `scripts/deploy.ps1`: pre-check → git pull → pnpm install → turbo build → `prisma migrate deploy` → `pm2 reload` → health check
- `scripts/rollback.ps1`: reads `logs/last-deploy-commit.txt`, checks out prior commit, rebuilds, graceful reload
- All scripts use `pm2 reload` (graceful) — never `pm2 restart` or `taskkill`

#### Section 14 — Release Documentation — COMPLETE
- `docs/deployment-guide.md`: first-time setup, update flow, rollback, backups, PM2 process table, security notes
- `docs/environment-variables.md`: all variables with types, defaults, validation rules
- `docs/endpoint-permissions.md`: complete endpoint–permission matrix for all 11 modules (180+ endpoint rows)
- `docs/release-checklist.md`: pre-release dev checklist, deployment checklist, security regression table, rollback trigger conditions

#### Section 15 — Security Regression Tests — COMPLETE
- Added `apps/api/src/common/guards/permission.guard.test.ts` — 8 tests: unguarded route, empty permissions, actor has all, actor missing one, actor has none, admin pass, partial permissions, undefined user
- Added inactive user test to `apps/api/src/auth/guards/jwt-auth.guard.test.ts` — verifies `isActive=false` yields 401 via the DB where-clause filtering

#### Section 16 — Final Verification — PASS
- `pnpm typecheck`: ✓ 0 errors (12/12 tasks)
- `pnpm test`: ✓ 499/499 tests (20 test files)
- ESLint `apps/api/src`: ✓ 0 errors
- ESLint `apps/web/src`: ✓ 0 errors

### Key Notes

- `next lint` command does not exist in Next.js 16.2.9; use `eslint` directly via `./node_modules/.bin/eslint apps/web/src`
- Worker process (`recafco-fmp-worker`) registered in ecosystem.config.js with `autorestart: false` — activates when BullMQ/Redis integration lands
- Deployment scripts use `pm2 reload` (graceful zero-downtime) not `pm2 restart`; rollback does NOT reverse Prisma migrations
- Rollback marker written to `logs/last-deploy-commit.txt` at start of every deploy

### Verification Results (2026-07-02)

| Command | Result |
|---|---|
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm test` | ✓ 499/499 tests (20 test files) |
| ESLint (api + web) | ✓ 0 errors |

## Unit 15 — Department-Scoped Module Access (Completed 2026-07-04, corrected 2026-07-04)

### Summary

Per-user, per-module department access scope. All six operational modules enforce scope on every operation: list, summary, detail, create, update, all lifecycle transitions, comments, activities, entries, and findings. Scope is DB-only — no permission fast-path. ADMIN cannot receive ALL_DEPARTMENTS without an explicit DB row. SUPER_ADMIN bootstrapped with ALL_DEPARTMENTS rows for all 7 modules.

### What Was Built

#### Database

**Migration `20260704000000_add_department_scoped_access`** (applied):
- `DepartmentAccessScope` enum: `OWN_DEPARTMENT` (default), `SELECTED_DEPARTMENTS`, `ALL_DEPARTMENTS`
- `ModuleIdentifier` enum: 7 modules
- `user_module_access` table: one row per (user, module); `scope`; `granted_by` FK to users
- `user_module_department_grants` table: grant rows for `SELECTED_DEPARTMENTS` scope
- Initial (wrong) permission codes `scope.read/manage/manage_all` — corrected by migration below

**Migration `20260704000001_fix_access_scope_permissions`** (applied — corrective):
- Relaxed `permissions_code_format_check` constraint to allow underscores in first segment (`^[a-z][a-z0-9_]*...`)
- Inserted approved permission codes: `access_scope.read`, `access_scope.manage`, `access_scope.manage_all_departments`
- Removed wrong `scope.*` role-permission links (orphan rows left in `permissions` table, unused)
- Final role assignments: SUPER_ADMIN → all 3; ADMIN → `access_scope.read` + `access_scope.manage` only; VIEWER → none
- Bootstrapped all active SUPER_ADMIN users with `ALL_DEPARTMENTS` `UserModuleAccess` rows for all 7 modules (idempotent — `ON CONFLICT DO NOTHING`)

#### Backend

- `DepartmentAccessService` — `getScope`, `buildDeptFilter`, `canAccessDepartment`, `assertCanAccessDepartment`, `canGrantScope`, `getUserModuleAccessConfig`, `setUserModuleAccess`
- **No fast-path**: operational ALL_DEPARTMENTS scope MUST come from a `UserModuleAccess` DB row; `access_scope.manage_all_departments` permission only controls who may ASSIGN that scope to others
- Fail-closed: no `UserModuleAccess` record → `OWN_DEPARTMENT` (applies to ADMIN too); `OWN_DEPARTMENT` with no primary dept → `{in: []}` → zero results
- Privilege escalation blocked: `canGrantScope` requires `access_scope.manage_all_departments` for `ALL_DEPARTMENTS`; ADMIN (which only has `access_scope.manage`) cannot grant ALL_DEPARTMENTS
- `setUserModuleAccess` validates active dept IDs; records `scope_changed` / `scope_all_departments_changed` audit events in same transaction
- `GET /administration/users/:id/module-access` — requires `access_scope.read`
- `PUT /administration/users/:id/module-access/:module` — requires `access_scope.manage`
- `AuthUser` interface: `departmentId: string | null`; `JwtAuthGuard` populates it from DB

#### Scope enforcement — all 6 operational modules + ADMINISTRATION

Every service enforces department scope on:
- **findAll / getSummary**: Prisma WHERE filter via `buildDeptFilter`
- **findOne / detail**: `assertCanAccessDepartment` after loading record
- **create**: `assertCanAccessDepartment` on target dept before transaction
- **update**: `assertCanAccessDepartment` on existing record (and new dept if changed)
- **all lifecycle transitions**: enforced via shared `findOneOrThrow(id, actor)` pattern
- **comments / activities / entries / findings**: enforced via parent record's `findOneOrThrow`

**Department field mapping:**
| Module | Field |
|---|---|
| FACTORY_TASKS | `responsibleDepartmentId` |
| INCIDENT_REPORT | `affectedDepartmentId` |
| MAINTENANCE_REQUESTS | `affectedDepartmentId` |
| SAFETY_COMPLIANCE | `departmentId` (inspections); findings via `{ inspection: { departmentId } }` |
| CONTRACTS_MANAGEMENT | `departmentId` |
| PRODUCTION_DASHBOARD | `departmentId` |
| ADMINISTRATION | `departmentId` of the user being managed |

#### Frontend
- `usersApi.getModuleAccess()` and `setModuleAccess()` — in `apps/web/src/lib/users-api.ts`
- `setModuleAccessAction` server action — in `apps/web/src/app/(protected)/administration/users/actions.ts`
- `ModuleAccessPanel` — per-module inline edit with scope dropdown and department checkboxes for `SELECTED_DEPARTMENTS`
- Scope labels: "My Department", "Selected Departments", "All Departments"
- `ALL_DEPARTMENTS` option shown only to SUPER_ADMIN (`canManageAll = roleCode === 'SUPER_ADMIN'`); ADMIN sees only OWN / SELECTED
- Warning shown when ALL_DEPARTMENTS selected: "This gives company-wide access to this module."

### Permission Assignments

| Permission | SUPER_ADMIN | ADMIN | VIEWER |
|---|---|---|---|
| `access_scope.read` | ✓ | ✓ | — |
| `access_scope.manage` | ✓ | ✓ | — |
| `access_scope.manage_all_departments` | ✓ | — | — |

### Key Notes
- `access_scope.manage_all_departments` is a grant-right, NOT operational visibility — it only controls who may assign ALL_DEPARTMENTS scope to others
- Operational ALL_DEPARTMENTS visibility requires an explicit `UserModuleAccess` DB row — no permission bypasses this
- Shadow DB workaround still required; both migrations applied via `prisma db execute --stdin` then `migrate resolve --applied`
- `setUserModuleAccess` with `SELECTED_DEPARTMENTS` + empty dept array throws `BadRequestException`
- Default = OWN_DEPARTMENT for any user with no record, including ADMIN

### Verification Results (2026-07-04, final)

| Command | Result |
|---|---|
| `pnpm db:validate` | ✓ Schema valid |
| `pnpm db:migrate:status` | ✓ 13 migrations applied, schema up to date |
| `pnpm typecheck` | ✓ 0 errors |
| `pnpm test` | ✓ 557/557 tests (21 test files) |
| `pnpm build` | ✓ 8/8 tasks successful |

## Unit 13 — Production Management Foundation (Completed 2026-07-02)

### Acceptance Criteria — All Met

- [x] `ProductionOrderStatus` enum: DRAFT, SCHEDULED, IN_PROGRESS, PAUSED, COMPLETED, CANCELLED
- [x] `ProductionEntryType` enum: OUTPUT, DOWNTIME, ADJUSTMENT
- [x] `ProductionSequence` model — atomic upsert `PROD-YYYY-NNNNNN` (year UTC); exhaustion at 999,999
- [x] `ProductionLine` model — 10 columns; `version` Int for optimistic concurrency; `isActive` boolean; optional `capacity` Int
- [x] `ProductionOrder` model — 34 columns; 7 user FKs (named); `version` Int; `targetQuantity > 0` CHECK constraint
- [x] `ProductionEntry` model — append-only; no FK on `authorUserId` (mirrors IncidentActivity pattern); indexed by `(orderId, createdAt)` and `(orderId, type)`
- [x] `ProductionComment` model — append-only; FK on `authorUserId`
- [x] `ProductionActivity` model — append-only; no FK on `actorUserId`; stores `previousStatus`, `newStatus`, `metadata` Json
- [x] Back-relations: `productionLines` on Plant and Location; `productionOrders` on Plant and Department; 8 back-relations on User
- [x] Migration `20260702000000_add_production_management_foundation` — applied via shadow DB workaround; 16 permissions seeded with `production.lines.*` format (not `production_lines.*` — underscore not allowed in first permission segment)
- [x] `packages/database/src/index.ts` — exports 6 new model types + `ProductionOrderStatus` + `ProductionEntryType`; database package rebuilt
- [x] `ProductionRefService` — atomic `$queryRaw INSERT ... ON CONFLICT ... RETURNING last_seq`
- [x] 13 DTO files — create/update/list/lifecycle/entry/comment/line DTOs with class-validator
- [x] `ProductionLinesService` — CRUD + activate/deactivate + listActive; version-based optimistic concurrency on update; `deactivate` requires stricter `production.lines.manage` (vs `production.lines.update` for activate); P2002 → 409 DUPLICATE_CODE
- [x] `computeMetrics()` exported pure function — 9 derived metrics from entries (no DB); importable for unit tests
- [x] `ProductionOrdersService` — 19 methods; unified `transition()` private helper; `cancel()` handles multi-status IN clause; `addEntry` validates type-specific fields (OUTPUT: quantityProduced required; accepted+rejected ≤ produced; DOWNTIME: downtimeMinutes; ADJUSTMENT: adjustmentQty); entries accepted only when IN_PROGRESS or PAUSED; org selectors: `listDepartments`, `listPlants`, `listPeople`
- [x] `ProductionController` — 28 endpoints; static routes (`/production/lines`, `/production/lines/active`, `/production/locations`) declared before parametric (`:id`, `:lineId`); entry endpoints split into 3 typed routes (`/entries/output`, `/entries/downtime`, `/entries/adjustment`)
- [x] `ProductionModule` — imports `[DatabaseModule, AuthModule]`; present in `AppModule`
- [x] 16 permission codes seeded: 12 `production.*` + 4 `production.lines.*`; SUPER_ADMIN/ADMIN assigned all 16; VIEWER assigned `production.read` + `production.lines.read` + `production.comment` (migration `20260702000001_add_production_role_permissions`)
- [x] `production-api.ts` — typed web client with `productionApi` namespace (14 methods incl. `locations()`)
- [x] `actions.ts` — 13 server actions covering all lifecycle transitions, 3 typed entry endpoints, comment, line create, line update
- [x] 8 frontend routes: `/production`, `/production/new`, `/production/[id]`, `/production/[id]/edit`, `/production/[id]/entries/new`, `/production/lines`, `/production/lines/new`, `/production/lines/[id]/edit`
- [x] `[id]/page.tsx` — inline server actions use `(formData: FormData) => Promise<void>` (not state-returning signature) for direct form `action=` compatibility in server components
- [x] `[id]/edit/page.tsx` — uses `.catch(() => notFound())` pattern for correct TypeScript type narrowing
- [x] `[id]/entries/new/page.tsx` — import path corrected to `'../../../actions'` (3 levels up, not 4)
- [x] `ProductionOrderStatus[]` and `ProductionEntryType[]` type annotations on CANCELLABLE/ENTERABLE arrays to satisfy `Array.includes()` TypeScript constraint
- [x] `listActivities()` return type annotated as `Promise<unknown[]>` to avoid Prisma client runtime reference in portable type
- [x] Typecheck: 0 errors (12/12 tasks)
- [x] 490 tests total (104 new: 27 production-lines + 77 production-orders incl. 8 `computeMetrics` pure function tests)
- [x] Build: 8/8 tasks; 8 new production routes emitted

### Verification Results (2026-07-02)

| Command | Result |
|---|---|
| `pnpm db:validate` | ✓ Schema valid |
| `pnpm db:generate` | ✓ Prisma Client 7.8.0 regenerated |
| `pnpm db:migrate:status` | ✓ 11 migrations applied, schema up to date |
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm test` | ✓ 490/490 tests (19 files) |
| `pnpm build` | ✓ 8/8 tasks; `/production/lines/[id]/edit` emitted |

### 16 Permissions Seeded

| Code | Name |
|---|---|
| `production.read` | List and view production orders |
| `production.create` | Create production orders |
| `production.update` | Edit DRAFT production orders |
| `production.schedule` | DRAFT → SCHEDULED |
| `production.start` | SCHEDULED → IN_PROGRESS |
| `production.pause` | IN_PROGRESS → PAUSED |
| `production.resume` | PAUSED → IN_PROGRESS |
| `production.complete` | IN_PROGRESS → COMPLETED |
| `production.cancel` | Cancel from cancellable statuses |
| `production.comment` | Add comments |
| `production.entries.create` | Add production entries |
| `production.manage` | Admin override (all transitions) |
| `production.lines.read` | List and view production lines |
| `production.lines.create` | Create production lines |
| `production.lines.update` | Update production lines / activate |
| `production.lines.manage` | Deactivate production lines |

### Error Codes

| Code | HTTP | Description |
|---|---|---|
| `PRODUCTION_ORDER_NOT_FOUND` | 404 | Order does not exist |
| `PRODUCTION_LINE_NOT_FOUND` | 404 | Line does not exist |
| `PRODUCTION_ORDER_VERSION_CONFLICT` | 409 | Optimistic concurrency failure on order |
| `PRODUCTION_LINE_VERSION_CONFLICT` | 409 | Optimistic concurrency failure on line |
| `PRODUCTION_ORDER_INVALID_STATUS` | 422 | Wrong source status for transition or entry |
| `PRODUCTION_ENTRY_INVALID` | 422 | Entry field validation failure |
| `PRODUCTION_SEQUENCE_EXHAUSTED` | 422 | Year sequence > 999,999 |
| `DUPLICATE_CODE` | 409 | Production line code already exists |

### Key Notes

- Shadow DB workaround still required: pipe SQL via `prisma db execute --stdin`, then `prisma migrate resolve --applied`
- Permission code format: first segment cannot have underscores — `production.lines.read` correct, `production_lines.read` would violate DB CHECK constraint
- NestJS route ordering: static routes (`/production/lines`, `/production/lines/active`) must be declared before parametric routes (`/production/lines/:lineId`) in the same controller
- `computeMetrics()` is a pure named export — importable in tests without DB; `remainingQuantity` is NOT clamped (may be negative for overproduction)
- `ProductionEntry.authorUserId` and `ProductionActivity.actorUserId` have no FK — mirrors IncidentActivity pattern; history preserved if user is deactivated
- Optimistic concurrency: `updateMany(WHERE id AND status AND version=dto.version)` + count check; distinguish not-found vs wrong-status vs version conflict
- `cancel()` uses `WHERE status IN (DRAFT, SCHEDULED, IN_PROGRESS, PAUSED)` — multi-status cancel
- `deactivate()` requires `production.lines.manage`; `activate()` only requires `production.lines.update`
- Entry rules (post-audit): OUTPUT → IN_PROGRESS only; accepted+rejected EXACTLY EQUALS produced; DOWNTIME → IN_PROGRESS or PAUSED, note required; ADJUSTMENT → requires `production.manage`, IN_PROGRESS/PAUSED/COMPLETED, non-zero adjustmentQty, note required, resulting effectiveProduced >= 0
- 3 typed entry endpoints: `POST /:id/entries/output` (production.entries.create), `POST /:id/entries/downtime` (production.entries.create), `POST /:id/entries/adjustment` (production.manage)
- Server component form actions: use `(formData: FormData) => Promise<void>` for direct `action=` attachment; state-returning `(prev, formData)` pattern requires client component `useActionState`
- Database package rebuilt after adding new enum/type exports to `packages/database/src/index.ts`
- Role assignment migration (`20260702000001`) applied separately; original migration lacked role_permissions INSERT

## Unit 12 — Contracts Management Foundation (Completed 2026-07-01)

### Acceptance Criteria — All Met

- [x] `ContractStatus` enum (DRAFT, ACTIVE, TERMINATED, CLOSED) in schema and `@recafco/database` barrel
- [x] `ContractSequence` model — atomic upsert `CONTRACT-YYYY-NNNNNN`; exhaustion → `CONTRACT_SEQUENCE_EXHAUSTED`
- [x] `Contract` model — 30 columns; named FKs: `ContractOwner`, `ContractCreatedBy`, `ContractActivatedBy`, `ContractTerminatedBy`, `ContractClosedBy`; optimistic concurrency via `version` Int
- [x] `ContractComment`, `ContractActivity` models — append-only; no FK on `ContractActivity.actorUserId`
- [x] Back-relations added to Department, Plant, Location, User (5 named contract FKs)
- [x] `packages/database/src/index.ts` — exports `ContractSequence`, `Contract`, `ContractComment`, `ContractActivity`, `ContractStatus`; database package rebuilt
- [x] `ContractsRefService` — atomic `$queryRaw INSERT ... ON CONFLICT ... RETURNING last_seq`; throws `CONTRACT_SEQUENCE_EXHAUSTED` at 999,999
- [x] 8 DTOs — `CreateContractDto`, `UpdateContractDto` (requires `version`), `ContractListQueryDto`, `ActivateContractDto`, `TerminateContractDto`, `CloseContractDto`, `AddCommentDto`
- [x] Derived lifecycle status — `getDerivedLifecycleStatus()` exported named function; `utcToday()` uses UTC start-of-day; EXPIRING/EXPIRED computed from date fields
- [x] `CONTRACT_SELECT` const with all scalar fields + 7 user relations + 3 org relations
- [x] `ContractsService` — 15 methods; real optimistic concurrency: `updateMany(WHERE id AND status AND version=dto.version)` — client-submitted version, not DB-refetched; `CONTRACT_VERSION_CONFLICT` (409); lifecycle transitions: DRAFT→ACTIVE, ACTIVE→TERMINATED, ACTIVE|TERMINATED→CLOSED; org selectors: `listDepartments`, `listPlants`, `listLocations`
- [x] `buildListWhere()` exported for tests; `lifecycleStatus` EXPIRING/EXPIRED translates to date-based where clauses
- [x] `getSummary()` — 6 counts via `Promise.all`: totalDraft, totalActive, totalExpiring, totalExpired, totalTerminated, totalClosed
- [x] `ContractsController` — 15 endpoints; `summary`, `people`, `departments`, `plants`, `locations` all declared before `/:id`; correct HTTP codes
- [x] `ContractsModule` — imports `DatabaseModule` + `AuthModule`; present in `AppModule`
- [x] 8 permission codes: contracts.read, contracts.create, contracts.update, contracts.activate, contracts.terminate, contracts.close, contracts.comment, contracts.manage
- [x] New/edit contract forms use `GET /contracts/departments` and `GET /contracts/plants` (contract-specific endpoints)
- [x] Typecheck: 0 errors
- [x] 386 tests total (10 new: 3 extra update concurrency tests + 7 org-selector tests)
- [x] Build: 8/8 tasks

### Verification Results (corrected 2026-07-01)

| Command | Result |
|---|---|
| `pnpm db:validate` | ✓ Schema valid |
| `pnpm db:generate` | ✓ Prisma Client 7.8.0 regenerated |
| `pnpm db:migrate:status` | ✓ 9 migrations applied, schema up to date |
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm test` | ✓ 386/386 tests (17 files) |
| `pnpm build` | ✓ 8/8 tasks |

### Permissions

| Code | Name |
|---|---|
| `contracts.read` | List and view contracts |
| `contracts.create` | Create new contracts |
| `contracts.update` | Edit DRAFT contracts |
| `contracts.activate` | DRAFT → ACTIVE |
| `contracts.terminate` | ACTIVE → TERMINATED |
| `contracts.close` | ACTIVE or TERMINATED → CLOSED |
| `contracts.comment` | Add comments |
| `contracts.manage` | Admin override (change owner, skip restrictions) |

### Error Codes

| Code | HTTP | Description |
|---|---|---|
| `CONTRACT_NOT_FOUND` | 404 | Contract does not exist |
| `CONTRACT_VERSION_CONFLICT` | 409 | Optimistic concurrency failure |
| `CONTRACT_INVALID_TRANSITION` | 422 | Wrong source status for transition |
| `CONTRACT_SEQUENCE_EXHAUSTED` | 422 | Year sequence > 999,999 |

### Key Notes

- Database package rebuilt after adding `ContractStatus` export to `packages/database/src/index.ts`
- `getDerivedLifecycleStatus()` is a pure named export (not a method) — importable in tests
- `listPeople()` returns `{ id, displayName, departmentId }` for owner selector
- `contracts.manage` required to set a different `ownerUserId` on create or change it on update
- `lifecycleStatus` field injected into every `Contract` response via `withLifecycle()` helper
- `buildListWhere()` EXPIRING filter: `renewalNoticeDate <= today AND (endDate IS NULL OR endDate >= today)`
- **Real optimistic concurrency for PATCH**: `UpdateContractDto` requires `version` (Int, min 1); service conditions `updateMany` WHERE on `dto.version` (client-submitted), never on a DB-refetched version; stale submissions → 409 `CONTRACT_VERSION_CONFLICT`
- **15 endpoints total** including `GET /contracts/departments`, `GET /contracts/plants`, `GET /contracts/locations` (all declared before `/:id`); new/edit forms use these contract-specific endpoints
- Frontend advises user to refresh on 409 (conflict message: "Contract was changed by another user; please refresh and retry")

## Unit 11 — Safety & Compliance Foundation (Completed 2026-07-01)

### Acceptance Criteria — All Met

- [x] Migration `20260701000004_add_safety_foundation` applied — 8 migrations total
- [x] 3 enums: `InspectionStatus`, `FindingSeverity`, `FindingStatus`
- [x] 5 models: `SafetyInspectionSequence`, `SafetyInspection`, `SafetyFinding`, `SafetyInspectionComment`, `SafetyInspectionActivity`
- [x] Concurrency-safe status transitions (updateMany + count check → `SAFETY_CONCURRENT_MODIFICATION`)
- [x] Inspection lifecycle: DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED → CLOSED; CLOSED → IN_PROGRESS (reopen)
- [x] Cancellation from DRAFT/SCHEDULED/IN_PROGRESS with mandatory reason
- [x] Finding lifecycle: OPEN → ACTION_REQUIRED → RESOLVED → VERIFIED → CLOSED; RESOLVED/VERIFIED/CLOSED → ACTION_REQUIRED (reopen)
- [x] Inspector ownership rule (start/complete require inspector or safety.manage)
- [x] Verifier separation-of-duties (verifiedByUserId ≠ resolvedByUserId unless safety.manage)
- [x] Finding reopen goes to ACTION_REQUIRED (not OPEN), clears lifecycle timestamps, preserves resolutionSummary
- [x] Inspection reopen goes to IN_PROGRESS, clears completedAt/closedAt, preserves conclusion
- [x] Reference format: `SAFE-YYYY-NNNNNN` (CHECK constraint); exhaustion error `SAFETY_SEQUENCE_EXHAUSTED`
- [x] 11 permissions seeded; SUPER_ADMIN+ADMIN get all 11; VIEWER gets 3 (read/create/comment)
- [x] 23 API endpoints under `/safety-compliance`
- [x] 4 web routes: list, new, [id] detail, [id]/edit
- [x] 5 dashboard metrics (Scheduled, In Progress, Open Findings, Critical Findings, Overdue Findings)
- [x] Dashboard Safety & Compliance module card updated to `status: 'available'`
- [x] Comments and activities append-only
- [x] No hard deletion

### Permissions

| Code | Name | SUPER_ADMIN | ADMIN | VIEWER |
|---|---|---|---|---|
| safety.read | Read safety inspections | ✓ | ✓ | ✓ |
| safety.create | Create safety inspections | ✓ | ✓ | ✓ |
| safety.schedule | Schedule safety inspections | ✓ | ✓ | — |
| safety.inspect | Conduct safety inspections | ✓ | ✓ | — |
| safety.finding_create | Create safety findings | ✓ | ✓ | — |
| safety.finding_assign | Assign safety findings | ✓ | ✓ | — |
| safety.finding_resolve | Resolve safety findings | ✓ | ✓ | — |
| safety.verify | Verify resolved findings | ✓ | ✓ | — |
| safety.close | Close inspections and findings | ✓ | ✓ | — |
| safety.comment | Comment on inspections | ✓ | ✓ | ✓ |
| safety.manage | Manage safety inspections | ✓ | ✓ | — |

### Verification Results (2026-07-01)

| Command | Result |
|---|---|
| `pnpm db:validate` | ✓ Schema valid |
| `pnpm db:generate` | ✓ Prisma Client regenerated |
| `pnpm db:migrate:status` | ✓ 8 migrations applied, schema up to date |
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12) |
| `pnpm test` | ✓ 306/306 tests (55 new safety tests) |
| `pnpm build` | ✓ 8/8 tasks; all 4 safety routes emitted |

### Key Notes

- Shadow DB workaround still required: pipe SQL via `prisma db execute --stdin`, then `prisma migrate resolve --applied`
- Database dist must be rebuilt after schema changes (`pnpm --filter @recafco/database build`)
- Finding reopen destination is `ACTION_REQUIRED` (not `OPEN`)
- Verifier separation-of-duties is bypassed with `safety.manage` only

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

## Next Unit

See `context/build-plan.md` for Unit 13 details.

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

## CM-39 — Manager Dashboard Simplification (Completed 2026-08-24)

### Summary

Pure frontend UI/UX unit — no backend, DTO, service, or schema changes. Simplified the Contract Manager Dashboard built in CM-37: top action button labels shortened to 4 compact items (New Contract / Assign Tasks / Schedule / Closeout Requests), the duplicate 8-card Quick Actions grid removed entirely (component file deleted, was unused everywhere else), primary KPI cards reduced from 9 to 5 (Needs Action / Overdue Tasks / Open Issues / Open Claims / Pending Closeout), the remaining 5 metrics (Active/Draft/Awaiting Activation/Outstanding Payments/Due This Week) moved into a compact "Active: 4 · Draft: 17 · …" text strip beneath the cards, the attention table simplified from 7 to 6 columns (Contract ID + Contract Name merged into one "Contract" cell), and the three previously always-stacked sections (Workflow Assignment Overview / Upcoming Schedule / Recently Updated Contracts) consolidated into a single "Workflow Load / Upcoming / Recent" tab strip defaulting to Workflow Load, so only one is visible at a time. "Needs Manager Action" now appears immediately after the cards as the dashboard's clear main focus. The Staff dashboard branch in `page.tsx` was not touched at all (verified line-for-line unchanged); the one shared component, `UpcomingScheduleList`, only had its *manager-branch call site's* prop values changed (empty-state text), not the component itself, so Staff's own call site and behavior are provably unaffected.

### Changes

- `apps/web/src/app/(protected)/contracts/dashboard/page.tsx` — Manager branch restructured (Quick Actions section removed, cards+strip → Needs Manager Action → tabs); Staff and fallback branches untouched
- `apps/web/src/app/(protected)/contracts/dashboard/_components/manager-top-actions.tsx` — shortened button labels (title attributes retain the full original wording for tooltips/accessibility)
- `apps/web/src/app/(protected)/contracts/dashboard/_components/manager-summary-cards.tsx` — rewritten: 5-card `ManagerSummaryCards` (new `needsAction` prop) + new exported `SecondaryMetricsStrip`
- `apps/web/src/app/(protected)/contracts/dashboard/_components/manager-attention-table.tsx` — columns reduced 7→6, new empty-state copy per spec
- `apps/web/src/app/(protected)/contracts/dashboard/_components/manager-secondary-tabs.tsx` (new) — client component, receives all 3 panels as pre-rendered server JSX props, toggles visibility only (no client-side data fetching)
- `apps/web/src/app/(protected)/contracts/dashboard/_components/manager-quick-actions.tsx` — deleted (only consumer was the page being simplified)

### Verification Results (2026-08-24)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 159/159 (unchanged — pure layout/copy restructuring, no new pure-function logic) |
| `pnpm --filter @recafco/api test --run` | ✓ 1111/1111 (unchanged — no backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 26 migrations, unchanged |
| Rendered HTML (manager: compact actions/5 cards/no Quick Actions/simplified table/tabs; staff: fully unchanged) | ✓ all confirmed, including SSR-level check that only the default "Workflow Load" tabpanel renders (`aria-selected="true"` count = 1) |

### Key Implementation Notes

- "Needs Action" is computed client-side from `data.manager.attentionItems.length` — the same array already returned by the (untouched) API, capped at 30 server-side since CM-37. On the rare contract portfolio with more than 30 simultaneous attention items, this undercounts; adding an uncapped total would need a one-line backend addition, deliberately skipped per this unit's "prefer no backend change unless absolutely needed" instruction. Documented here for future reference.
- The tabs are a Server-Components-as-props-into-a-Client-Component pattern: `page.tsx` (a Server Component) renders all three panels' JSX and passes them to `ManagerSecondaryTabs` (`'use client'`), which only toggles which one is visible via `useState` — no additional client-side data fetching, no new API calls, keeping the "prefer no backend change" and performance characteristics identical to CM-37.
- No live API scripting was needed/run since the backend response shape is provably unchanged (not touched) — verification relied on rendered SSR HTML plus the full existing automated test suites (both unchanged in count, confirming no regressions).

## CM-70G — Fix Documents & Obligations Nested Form Upload Bug (Completed 2026-09-06)

### Summary

Confirmed via code inspection the exact bug the browser console warning pointed to: `AttachmentsSection`'s own upload `<form action={uploadFormAction}>` was rendered nested inside the outer `<form id="document-form">` — invalid HTML that React's own `validateDOMNesting` warns about, and that prevented the Upload button's click from reliably reaching its own action. Fixed with the task's own preferred, smaller/safer approach: converted the inner upload `<form>` to a plain `<div>`, changed the Upload button to `type="button"`, and now call the exact same `uploadFormAction` dispatcher directly with a manually-built `FormData` from a click handler — no native form submission involved for Upload at all. The outer document-edit `<form>` (Save Changes) is completely unchanged and remains the modal's only real `<form>`.

### Files Audited

`contract-document-form-modal.tsx` (full re-read — confirmed the exact nested-form structure: `AttachmentsSection`'s own `<form>` at the time nested inside the outer `<form id="document-form">`, both button types, both submit handlers), `actions.ts`'s `uploadDocumentObligationAttachmentAction` (confirmed unchanged, correct, no backend bug), the document-obligation upload controller route and `DocumentObligationAttachmentStorageService` (confirmed unchanged, correct — no backend change needed or made). Also checked for the same pattern elsewhere in the app: confirmed `contract-variation-form-modal.tsx`'s `SupportingDocumentsSection` has the **identical** nested-form structure (its own upload `<form>` nested inside the outer `<form id="variation-form">`), and `workflow-task-drawer.tsx` has multiple `<form>` elements whose nesting relationship was not fully traced — both flagged as out-of-scope findings for this Documents-only unit, not fixed here.

### Root Cause

A genuine, confirmed frontend HTML-structure bug: `AttachmentsSection`'s own upload `<form>` (added in CM-63) was rendered as a child of the outer Document edit `<form>` (also from CM-63) inside `ContractDocumentFormModal`'s JSX tree. Nested `<form>` elements are invalid per the HTML spec; React's development-mode DOM validation surfaces exactly the console warning quoted in this task. A `<button type="submit">` inside an invalidly-nested inner form does not reliably resolve to its own nearest form for submission purposes, which is why clicking Upload appeared to do nothing.

### Files Changed

`contract-document-form-modal.tsx` only — `AttachmentsSection`'s upload `<form>` converted to a `<div>`; its `handleUploadSubmit(e)` (a form `onSubmit` handler) replaced with `handleUploadClick()` (a plain button `onClick` handler) that reads the selected file directly from the `fileInputRef`, shows the exact same "Please choose a file before uploading." error if none is selected, and otherwise builds a `FormData` manually and calls `uploadFormAction(formData)` directly — the same `useActionState` dispatcher as before, just invoked without a surrounding `<form>`. The Upload button is now `type="button"`.

### Backend Changed — No

Zero backend files touched. The upload endpoint, storage service, and department-scope checks were all already correct — confirmed by audit, not modified.

### Migration Added — None

Not needed and not added; this is a pure JSX-structure fix. `pnpm db:migrate:status` still reports 38 migrations, unchanged.

### Nested Form Fix

The inner upload `<form>` no longer exists — `AttachmentsSection` now renders a plain `<div>` around the file input and Upload button. There is exactly one real `<form>` in this modal (`id="document-form"`, used only by Save Changes/Add Document).

### Upload Button Behavior

`type="button"`, `onClick={handleUploadClick}` — calls the upload dispatcher directly, never triggers the outer document form's submit. Disabled only while the upload is actually in flight (`disabled={isUploading}`), matching the established "never disable for any other reason" pattern.

### Save Button Behavior

Unchanged — `type="submit"` with `form="document-form"`, still exclusively updates document fields (`itemNo`/`category`/`title`/`responsibleParty`/`status`/`requiredDate`/`submissionDate`/`expiryDate`/`remarks`) via `readDocumentObligationFields()`'s existing whitelist, which was never sent an actual file even before this fix (the whitelist simply never reads a `file` key). Save was never able to trigger Upload, and now that Upload has no `<form>` of its own, Upload can never trigger Save either — the two are now genuinely, structurally independent. The task's own "Save document changes before uploading" helper was evaluated and confirmed NOT technically required — uploading targets a fixed, already-saved `itemId` independent of any pending, unsaved edits in the other fields — so it was not added, consistent with the task's own "only if technically required" hedge.

### No-File Validation Behavior

Clicking Upload with no file selected shows "Please choose a file before uploading." immediately, client-side, with zero network round trip — reusing the exact wording already established in CM-70F for the (still-present, still-correct) server-side fallback check.

### Upload Success Behavior

Unchanged from CM-70F's own fix: on a real successful upload, the file input clears, the attachment list re-fetches and shows the new file immediately within the same open modal, and a real "Uploaded successfully." line appears — all driven by genuine confirmed state, never fabricated.

### Console Warning Confirmation

The nested-form structure that caused the "<form> cannot be nested inside another <form>" warning no longer exists in this component — `AttachmentsSection` contains no `<form>` element at all. Live browser confirmation of the console being clean was not possible under the carried-over credential blocker; confirmed instead via direct source-code inspection of the fixed JSX tree (zero `<form>` tags remain inside `AttachmentsSection`).

### Attachments Library Impact

None — `DocumentObligationAttachmentStorageService`, the attachment Prisma model, and the download route are all untouched. Attachments continue to appear in this modal's own list, the Attachments / Document Library aggregation (CM-64), and Closeout Required Documents, all reading the same real, unchanged attachment records.

### Closeout Readiness Impact

None — Closeout Required Documents reads the same real document/attachment records via the same unchanged backend; nothing in this unit touches that data path.

### Regression Results

Web: 669/669 (unchanged — this is a JSX-structure/event-wiring fix with no new pure logic to test). API: 1446/1446 (unchanged — zero backend touched).

### Verification Results (2026-09-06)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 669/669 (unchanged) |
| `pnpm --filter @recafco/api test --run` | ✓ 1446/1446 (unchanged) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 38 migrations, unchanged |
| Live smoke check | ✓ Documents, Closeout, Dashboard, Contract List, and every sibling per-contract tab (Overview/Activity/Attachments/Schedule/Workflow/Payments/Production/Variations/Claims/Risks/Issues) all responded cleanly (307 redirects, no crash) on the restarted dev server |
| Live authenticated click-through (Verification A–H) | **Not run** — same carried-over credential blocker as every unit since CM-62; the nested-form structure itself was confirmed removed via direct source inspection, and the fix follows the task's own literal prescribed approach exactly |

### Unsupported/Deferred Items

Live authenticated confirmation of Verification A–H (actually watching the console, clicking Upload, seeing the file appear) — credential blocker, carried over. The **identical** nested-form bug was confirmed (by code inspection, not fixed) in `contract-variation-form-modal.tsx`'s `SupportingDocumentsSection`; `workflow-task-drawer.tsx`'s multiple `<form>` elements were flagged but their nesting was not fully traced. Both are strong candidates for the exact same fix pattern in a follow-up unit.

### Next Recommended Unit

A dedicated "Nested Form Upload Fix — Variations / Workflow" unit applying the exact same `<form>`→`<div>` + direct-dispatcher-call pattern proven here to `SupportingDocumentsSection` (Variations) and to `workflow-task-drawer.tsx`'s attachment upload, if its own form nesting turns out to have the same defect once traced.

## CM-70F — Fix Document Edit Save and Attachment Upload Not Working (Completed 2026-09-06)

### Summary

Audited the reported "Save Changes and Upload don't work, dates appear empty" bug and found and fixed a real, confirmed, backend root cause: Prisma returns a real JS `Date` object (UTC midnight) for every `@db.Date` column, and the default Express/NestJS JSON response serializes a `Date` via `.toISOString()` — producing a full datetime string like `"2026-09-06T00:00:00.000Z"` instead of the plain `"2026-09-06"` the frontend's own type declares and a native `<input type="date">` requires. A browser silently renders such a field as EMPTY (an invalid `value`/`defaultValue`), which is exactly the reported symptom and — since the save itself was actually succeeding — the most likely full explanation for "Save Changes doesn't work" too (the data persisted correctly; only its round-trip display was broken, making a successful save look like a silent failure). Verified this empirically with a real read-only Prisma query against the live dev database before writing any fix. Separately audited the Upload flow line-by-line and found no functional defect in the actual action/endpoint plumbing — only a feedback gap (no client-side no-file check, no success acknowledgment, and the no-file error's wording didn't exactly match this task's required text), which was polished.

### Files Audited

`contract-document-form-modal.tsx` (full re-read post-CM-70E — confirmed `handleSubmit`'s failure handling, `useEffect`'s success-only-close logic, and the outer/`AttachmentsSection` structure were all already correct), `contract-document-obligations.service.ts` (`withDerivedFields`, `DOCUMENT_OBLIGATION_SELECT`, `create`/`update` — confirmed no reformatting of Date-typed columns existed anywhere before returning to the controller), `contracts.controller.ts`'s document-obligation routes (confirmed `{ data, meta, error }` is returned raw, no serialization interceptor registered anywhere in `main.ts`), `actions.ts`'s `readDocumentObligationFields`/`createDocumentObligationAction`/`updateDocumentObligationAction`/`uploadDocumentObligationAttachmentAction`/`actionFetchMultipart` (confirmed all correct — right HTTP method, right URL matching the controller's real route, correct auth header, correct error propagation), `contracts-api.ts`'s `apiFetch` (confirmed a plain `res.json()`, no date reformatting on the client either — confirming the bug must be fixed server-side, at the one place the response is actually built). Confirmed via a real, read-only Prisma query against the live dev database (an existing contract's own `startDate`) that `JSON.stringify` of a Prisma `@db.Date` value is genuinely `"…T00:00:00.000Z"`, reproducing the bug outside of any test mock.

### Root Cause

A genuine backend serialization bug, not a save/upload plumbing failure: `contract-document-obligations.service.ts` returned raw Prisma `Date` objects for `requiredDate`/`submissionOrExpiryDate`/`submissionDate`/`expiryDate`, which serialize to a full ISO datetime string by default — a value a native `<input type="date">` treats as invalid and renders blank. Save and Upload themselves were not actually broken; the date bug made a genuinely successful save look like nothing had happened, since the very fields the user had just filled in vanished the moment the modal reopened. This same unconverted-Date-object pattern was confirmed to exist in several sibling services (Claims/Risks/Issues/Payments/Variations) — out of scope for this Documents-only bug-fix unit, flagged as a follow-up.

### Files Changed

`contract-document-obligations.service.ts` (`withDerivedFields` now reformats all 4 date-only columns to `"YYYY-MM-DD"` strings via a new `toDateOnlyString()` helper, applied in `findAllForContract`/`create`/`update`). `contract-document-obligations.service.test.ts` (+4 new tests proving the exact date-string format, both for reads and for create/update responses). `actions.ts` (`uploadDocumentObligationAttachmentAction`'s no-file error message corrected to the exact required wording: "Please choose a file before uploading."). `contract-document-form-modal.tsx` (`AttachmentsSection` gained an immediate client-side no-file check with the same exact wording, plus a real "Uploaded successfully." acknowledgment shown only once a new attachment is actually confirmed present).

### Backend Changed — Yes (bug fix only, no schema/migration change)

`contract-document-obligations.service.ts` changed to correctly format its own response — no DTO, controller route, or Prisma schema change. Every existing test continued to pass unchanged; 4 new tests added.

### Migration Added — None

Not needed and not added. This unit is a response-serialization bug fix, not a schema change — CM-70E's migration already provided the correct columns; this unit only fixed how their values are formatted on the way out. `pnpm db:migrate:status` still reports 38 migrations, unchanged.

### Date Loading Behavior

Required Date, Submission Date, and Expiry Date now all load correctly in Edit mode for any item that has them saved — confirmed via new backend tests asserting the exact `"2026-09-06"`-shaped string is returned (never a full ISO datetime, never fabricated for an unset field).

### Date Saving Behavior

Unchanged and confirmed already correct — `create`/`update` already persisted `requiredDate`/`submissionDate`/`expiryDate` independently (added in CM-70E), never mixing Submission and Expiry Date. The bug was entirely on the read/round-trip side.

### Save Changes Behavior

Confirmed already correct by careful re-audit: calls the real `updateDocumentObligationAction`/`createDocumentObligationAction`, shows a visible error banner and keeps the modal open on failure (`state.error` truthy blocks the success-only `useEffect`), and only closes + `router.refresh()`s on genuine success. No silent failure path was found. The "doesn't work" perception is fully explained by the date-display bug above.

### Upload Behavior

Confirmed the secure upload endpoint, department-scope checks, and MIME/size validation were all already correct and unaffected by this fix. Added a client-side pre-check so choosing no file shows the required message immediately, without waiting on a network round trip; the existing server-side check (same wording) remains as the real safety net. A new upload triggers an immediate re-fetch of the attachment list within the same open modal (unchanged, already correct) plus a new, real "Uploaded successfully." line once that re-fetch confirms the attachment is present.

### No-File-Selected Behavior

Clicking Upload with no file chosen now shows "Please choose a file before uploading." instantly (client-side), matching the exact required wording; the pre-existing server-side check (previously worded "Please choose a file to upload.") was also corrected to match exactly, so the same message appears even if the client-side check is ever bypassed.

### Attachment Library Impact

None — no change to `DocumentObligationAttachmentStorageService`, the attachment Prisma model, or the download route. Attachments continue to appear in this modal's own list, the Attachments / Document Library aggregation (CM-64, confirmed unrelated to this fix), and Closeout Required Documents, all reading the same real attachment records.

### Closeout Document Readiness Impact

None negative — Closeout Required Documents reads the same real document/obligation records and the same real attachment metadata; its own Submission Date/Expiry Date columns (split in CM-70E) now display correctly too, as a direct consequence of the same backend fix, since they read the identical service response.

### Error Handling Behavior

Save failure: visible banner, modal stays open (already correct, reconfirmed). Upload failure: visible message (already correct, reconfirmed). No file selected: visible message, now shown instantly client-side with exact required wording, and also fixed server-side to match. Validation error (Expiry before Submission, empty title): visible banner, submission blocked (already correct from CM-70E, reconfirmed still correct once real dates round-trip properly).

### Regression Results

Web: 669/669 (no new web-side pure-logic tests needed beyond the existing CM-70E coverage — the fix and its UI polish are either backend-only or simple UI-state wiring with no new pure function to test). API: 1446/1446 (4 new). No existing test changed behavior.

### Verification Results (2026-09-06)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 669/669 (unchanged) |
| `pnpm --filter @recafco/api test --run` | ✓ 1446/1446 (4 new, proving the exact date-string fix) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 38 migrations, unchanged (no migration this unit) |
| Live smoke check | ✓ Documents, Closeout, Dashboard, Contract List, and every sibling per-contract tab (Overview/Activity/Attachments/Schedule/Workflow/Payments/Production/Variations/Claims/Risks/Issues) all responded cleanly (307 redirects, no crash) on the restarted dev server |
| Live authenticated click-through (Verification A–F) | **Not run** — same carried-over credential blocker as every unit since CM-62; verified instead via a real read-only Prisma query proving the exact bug, plus new unit tests proving the exact fix |

### Unsupported/Deferred Items

Live authenticated confirmation of Verification scenarios A–F (opening DOC-GRM-001, saving, uploading a real PDF, and watching it appear in Closeout) — credential blocker, carried over. The SAME unconverted-Date-object bug was confirmed to exist in Claims/Risks/Issues/Payments/Variations (and likely Contract Edit's own startDate/endDate) — flagged as the single highest-value follow-up unit now that it has a proven root cause and a proven fix pattern to replicate.

### Next Recommended Unit

A dedicated "Date Serialization Fix — Claims/Risks/Issues/Payments/Variations/Contract" unit, applying the exact same `toDateOnlyString()` pattern proven here to every other service returning a raw Prisma `@db.Date`/`@db.Timestamp` value as a date-only field — this is very likely a silent, systemic bug across most of Contract Management's Edit modals, never caught because no unit in this entire session has had live authenticated browser access to actually see a date field render.

## CM-70E — Documents & Obligations Modal Date Field UX Fix (Completed 2026-09-06)

### Summary

Audited the Add/Edit Document modal's confusing single "Submission / Expiry Date" field and confirmed the confusion has a REAL schema root cause, not just a labeling one: `ContractDocumentObligation` had exactly one combined nullable column (`submission_or_expiry_date`) backing that one field — there was no way to record both a submission date and an expiry date on the same item. Since the task's own test-data scenario (Insurance Certificate) explicitly requires Required + Submission + Expiry simultaneously, this could not be solved frontend-only. Added an additive migration (two new nullable columns, `submission_date`/`expiry_date`), kept the old combined column and any of its data completely untouched (never dropped, never backfilled/guessed), updated the backend to prefer the real Expiry Date for all day-count/derived-status math (falling back to the legacy column only for pre-existing records), and rebuilt the modal with three clear, separately-helped date fields. Verified the live dev database currently has zero rows in this table, so no real historical data was at risk, but the migration and fallback logic were still built as if it did.

### Files Audited

`contract-document-form-modal.tsx` (the Add/Edit modal — read in full; confirmed the single combined date field, no client-side validation, 2 `danger`-token bugs), `schema.prisma`'s `ContractDocumentObligation` model (confirmed exactly one combined `submissionOrExpiryDate` column, no separate submission/expiry columns — the real root cause), `create-contract-document-obligation.dto.ts` / `update-contract-document-obligation.dto.ts` (confirmed both only accept the one combined field), `contract-document-obligations.service.ts`'s `computeDocumentObligationDaysRemaining`/`IsExpiredOverdue`/`IsExpiringSoon`/`computeDocumentObligationSummary` (confirmed all derive from the one combined date), `contract-closeout-required-documents-panel.tsx` and the Closeout blocking-items mapper (`closeout/page.tsx` + `contract-closeout-detail-helpers.ts`) — confirmed both read `submissionOrExpiryDate` for display only, no calculation logic of their own, `contract-document-panel.tsx` and `contract-document-obligation-csv.ts` (confirmed both display/export the one combined field as a single column), Attachments library (CM-64) — confirmed it references documents by ID/attachment metadata only, never this date field, unaffected. Confirmed via a direct read-only Prisma query against the live dev database that `contract_document_obligations` currently has 0 rows.

### Root Cause

A genuine schema limitation, not merely a UI/labeling issue: one combined `submissionOrExpiryDate` column cannot represent "submitted on X AND expires on Y" for the same item, which the task's own Insurance Certificate scenario requires. The confusing single form field was an honest reflection of the underlying single column.

### Files Changed

`schema.prisma` (+2 nullable columns: `submissionDate`, `expiryDate`; `submissionOrExpiryDate` kept, marked legacy in a doc comment). New migration `20260906000000_add_contract_document_obligation_dates` (additive only, applied via `prisma migrate deploy` — 38 migrations now). `create-contract-document-obligation.dto.ts` / `update-contract-document-obligation.dto.ts` (+`submissionDate?`/`expiryDate?`, legacy field kept accepted). `contract-document-obligations.service.ts` (`DateFields`/`DocumentObligationSummaryRow` gain optional `expiryDate`; new `effectiveExpiryDate()` helper preferring it over the legacy column; both selects and both create/update handlers updated). `contract-document-obligations.service.test.ts` (+4 new tests). `contracts-api.ts` (`ContractDocumentObligation` gains `submissionDate?`/`expiryDate?`). `actions.ts` (`readDocumentObligationFields()` passes both new fields through). `contract-document-obligation-helpers.ts` (+`validateDocumentObligationFormValues`). `contract-document-obligation-helpers.test.ts` (+10 new tests, including all 5 of this unit's own test-data scenarios). `contract-document-form-modal.tsx` (3 date fields with helpers, status-aware Submission Date recommendation note, legacy-date InfoBox for any old record, updated attachment/Responsible Party wording, 2 `danger`→`error` fixes). `contract-document-panel.tsx`, `contract-closeout-required-documents-panel.tsx`, `contract-document-obligation-csv.ts` (+its test) — all split their one "Submission / Expiry Date" column into two. `closeout/page.tsx` (blocking-items mapper now prefers `expiryDate` for the displayed action-due-date).

### Backend Changed — Yes (additive only)

DTOs, service (selects + create/update + derived-date calc), and the Prisma schema were all changed — but every change is additive: two new nullable columns, two new optional DTO fields, one new fallback-preference helper function. No existing column, field, or calculation was removed or altered in a breaking way; the legacy combined field and its (currently zero) data are fully preserved and still readable.

### Migration Added — Yes

`20260906000000_add_contract_document_obligation_dates`: `ALTER TABLE contract_document_obligations ADD COLUMN submission_date DATE, ADD COLUMN expiry_date DATE;` — additive, nullable, no data loss, no column drops. Applied via `prisma migrate deploy` (never `migrate dev`/reset). `pnpm db:migrate:status` now reports 38 migrations, up to date.

### Date Field Behavior

The modal now shows three fields side by side: Required Date, Submission Date, Expiry Date — each with its own helper text exactly as specified. A record with an old legacy combined date (none currently exist) shows a one-time InfoBox pointing to it without hiding or migrating it automatically.

### Helper Text Behavior

Required Date: "Date by which this document is required." Submission Date: "Date the document was submitted or received." (or a soft "Recommended once a document is Submitted, though not required." note when status is Submitted and no submission date is set yet). Expiry Date: "Date this document expires, if applicable." Responsible Party placeholder updated to "e.g. Finance Team, Technical Team, Client, Contract Manager." Attachment instruction updated to the exact required wording: "After saving, open Edit Document to upload supporting files."

### Validation Behavior

`validateDocumentObligationFormValues()`: Document / Obligation title is required; Expiry Date cannot be before Submission Date when both are entered. Per this unit's own hedge, Submission Date is deliberately never checked against Required Date — a document can be submitted early, and no existing backend rule says otherwise. Status remains a free manual choice; a Submitted item with no Submission Date is never blocked, only gently recommended via helper text. Any violation blocks submission (`e.preventDefault()`) and shows every failing rule in the same banner already used for server errors.

### Status/Days Remaining Behavior

Status is still always a plain manual selection, never auto-changed. Days Remaining and the Expiring Soon / Expired & Overdue counts now derive from the real Expiry Date (`effectiveExpiryDate()` = `expiryDate ?? submissionOrExpiryDate`) instead of the old combined field — new records use Expiry Date exclusively; any pre-existing record (none currently exist) that only has the legacy field keeps working exactly as before via the fallback.

### Closeout Impact

None negative — Required Documents for Closeout still reads the same real document records; its own "Submission / Expiry Date" column was split into two (Submission Date, Expiry Date) reading the new fields directly. The Closeout blocking-items list's displayed action-due-date now prefers the real Expiry Date over the legacy field, matching the backend's own preference, with zero change to the blocking-item interface/type signature (only the mapped value changed).

### Attachment Behavior

Unchanged — upload/list/download logic in `AttachmentsSection` was not touched; only its instructional copy in Add mode was reworded per the task's exact required wording.

### Regression Results

Web: 669/669 (10 new tests). API: 1442/1442 (4 new tests). No existing test needed a behavioral change beyond the CSV fixture's column split (mechanical, not a behavior change — the "blank Attachment field" comma-adjacency assertion was unaffected since Attachment/Remarks/Last Update stay adjacent regardless of the two new mid-row columns).

### Verification Results (2026-09-06)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 669/669 (10 new, including all 5 of this unit's own test-data scenarios) |
| `pnpm --filter @recafco/api test --run` | ✓ 1442/1442 (4 new) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 38 migrations, up to date |
| Live smoke check | ✓ Documents, Closeout, Dashboard, Contract List, and every sibling per-contract tab (Overview/Activity/Attachments/Schedule/Workflow/Payments/Production/Variations/Claims/Risks/Issues) all responded cleanly (307 redirects, no crash) on the restarted dev server |
| Live authenticated click-through | **Not run** — same carried-over credential blocker as every unit since CM-62; verified instead via the new unit tests exercising the exact pure validation/calculation logic |

### Unsupported/Deferred Items

Live authenticated visual confirmation of the rebuilt modal and the 5 test-data scenarios actually persisting correctly through a real save — credential blocker, carried over. The legacy `submissionOrExpiryDate` column has zero current rows to migrate, so no cleanup/backfill unit is needed unless a future environment turns out to have real historical data in it.

### Next Recommended Unit

Resolve the carried-over credential blocker so a live authenticated pass can finally confirm this modal's 3-field split and the exact 5 test-data scenarios (Signed Contract Agreement, Performance Bond, Insurance Certificate, Final Invoice, Warranty Document) save and display correctly end-to-end.

## CM-70D — Issue Log Modal UX and Validation Polish (Completed 2026-09-06)

### Summary

Audited the Add/Edit Issue modal against the reported raw-UUID contract display and unclear field meanings/validation. Confirmed the same raw-UUID bug pattern as CM-70C's Claim modal: the per-contract Issue Log tab's Add flow (`ContractIssuePanel`) calls `IssueFormModal` with `fixedContractId` but never a `contracts` array, so the display fell back to the bare UUID. Confirmed the backend's `computeIssueSummary()` already reproduces this unit's own verification numbers (Open = 2, In Progress = 1, Resolved = 1) with zero calculation change needed, and confirmed both issue DTOs have no cross-field validation today. Reorganized the modal into 4 labeled sections, relabeled Due Date/Raised Date per the task's exact wording (display only — backend field names unchanged), added all requested field helpers, and added a full frontend-only validation pass. No `danger`-token bug existed in this file already using `error` in two spots and `danger` in others — fixed the confirmed occurrences.

### Files Audited

`issue-form-modal.tsx` (the shared Add/Edit Issue modal, used by both the module-level Issue Register and the per-contract Issue Log tab — read in full; confirmed no client-side validation existed, confirmed the raw-UUID fallback, found `danger`-token bugs in the error banner and both required-field asterisks), `create-contract-issue.dto.ts` / `update-contract-issue.dto.ts` (confirmed `category` is genuinely `@IsOptional` — not required by the backend, so no hard requirement added per the task's own "if backend requires it" hedge; confirmed the real 9-value `CONTRACT_ISSUE_CATEGORIES` list — Commercial, Technical, Production, Delivery, Erection, Client, Document, Payment, Other — does not match the task's suggested 10-value list (Finance/Site/Quality/Safety aren't real values); per "do not add enum values unless backend already supports them," no new categories were added), `contract-issues.service.ts`'s `computeIssueSummary()` (confirmed it counts OPEN/IN_PROGRESS/RESOLVED/CLOSED/WAITING_RESPONSE independently by status and already reproduces this unit's own test numbers with no change), `contract-issue-detail-helpers.ts` (confirmed its own pre-existing `ISSUE_CATEGORY_LABELS` relabeling map is contract-tab-specific — used by the table/badges, not the shared modal — and that the module-level register shows raw category values directly with no relabeling at all; kept both as-is rather than introducing a THIRD, modal-specific labeling scheme), `contract-issue-panel.tsx` / `issue-register-table.tsx` / `issues/page.tsx` (confirmed exactly where `contracts`/`fixedContract` context is and isn't passed — only the per-contract panel's Add flow was missing it), `ContractIssue`/`contractsApi.get()` (confirmed `issue.contract` already embeds `referenceNumber`/`title`/`counterpartyName`, reusing the same per-tab re-fetch pattern established in CM-70C), Overview/Dashboard/Closeout consumers of `ContractIssueSummary` (confirmed all read the same real, backend-computed, untouched summary object).

### Files Changed

`issue-form-modal.tsx` (4 labeled sections, controlled Status, readable contract display, relabeled Action Due Date/Issue Raised Date, field helpers, client-side validation banner, `danger`→`error` token fixes, Add-mode Issue Raised Date defaults to today). `contract-issue-detail-helpers.ts` (+6 new pure exports: `formatIssueContractContext`, `isResponsiblePersonRequired`, `isActionDueDateRequired`, `isResolutionRequired`, `validateIssueFormValues`). `contract-issue-detail-helpers.test.ts` (+22 new tests, including the exact ISS-GRM-001..004 verification scenario). `contract-issue-panel.tsx` (+`contract` prop, threaded to the modal as `fixedContract`). `issues/page.tsx` (the per-contract Issue Log tab — added a `contractsApi.get(id)` fetch, matching the CM-70C/`payments/page.tsx` per-tab re-fetch pattern).

### Backend Changed — No

Zero backend files touched. `computeIssueSummary()` and both issue DTOs are unchanged — all new rules are frontend-only, per this unit's own "prefer frontend/UI-validation only" instruction.

### Migration — None

Confirmed unnecessary during audit and not added. `pnpm db:migrate:status` still reports 37 migrations, unchanged.

### Readable Contract Display Behavior

The Add-mode-with-selectable-contracts dropdown and Edit mode already showed `referenceNumber`/`title` (never a UUID); the one real bug was the per-contract tab's Add flow, which had no `contracts` array to look up at all and fell back to the bare `fixedContractId` UUID — exactly the same bug shape found and fixed for Claims in CM-70C. Fixed by fetching the contract's own identity in `issues/page.tsx` (`contractsApi.get(id)`) and threading it through as `fixedContract`; the modal now shows `formatIssueContractContext()`'s "CONTRACT-2026-000009 · GRM Boundary Wall & Yard Upgrade · Gulf Ready Mix Co." format everywhere a contract is displayed, only omitting the client segment when genuinely unavailable — never a UUID.

### Modal Section Layout Behavior

Reorganized into 4 labeled sections exactly as requested: Issue Identity (Contract, Issue Title, Issue No., Category), Priority & Responsibility (Priority, Status, Responsible Person), Dates (Issue Raised Date, Action Due Date, Closed Date conditional), Details & Remarks (Description, Resolution conditional, Remarks). No field was removed or hidden — same total field count as before. A top-of-modal helper note ("Record issues that need follow-up until they are resolved.") was added per the task's own wording.

### Field Label/Helper Behavior

"Due Date" relabeled to "Action Due Date" and "Raised Date" to "Issue Raised Date" — display labels only, the underlying `dueDate`/`raisedDate` field names and form field `name` attributes are completely unchanged. Every field now has the exact requested helper text (Issue No., Category, Action Due Date, Issue Raised Date, Responsible Person).

### Status/Category Label Behavior

Status labels were already user-friendly (Open/In Progress/Waiting Response/Resolved/Closed/Cancelled, unchanged). Category options remain the real, unchanged 9-value backend list — already plain human-readable words (Commercial/Technical/Production/Delivery/Erection/Client/Document/Payment/Other), so no relabeling was applied; the task's suggested Finance/Site/Quality/Safety values do not exist in the real enum and were deliberately not added (would require a migration, out of scope for a frontend-only unit, and risks inventing a workflow the business never asked for).

### Responsible Person Validation Behavior

`validateIssueFormValues()` requires Responsible Person only when status is Open or In Progress (`isResponsiblePersonRequired()`) — Waiting Response/Resolved/Closed/Cancelled issues can legitimately have no one currently assigned. The dropdown still lists only real `/contracts/people` users (no fake users); an explicit "No eligible users found. Create a Contract Staff user first." message now shows when the list is genuinely empty, exactly matching the task's required wording.

### Date Validation Behavior

Action Due Date is required only when status is Open or In Progress (same status set as Responsible Person); Action Due Date cannot be before Issue Raised Date; a Resolved/Closed issue requires a Resolution note or Remarks (whichever is filled satisfies the rule). Issue Raised Date now defaults to today's date in Add mode only (a new, safe pattern introduced this unit — no existing precedent for date-defaulting was found anywhere else in this codebase during audit, so this is documented rather than claimed as reused); an existing issue's own stored Raised Date in Edit mode is never overwritten. Any violation blocks submission (`e.preventDefault()`) and shows every failing rule in the same banner already used for server errors — never a silent disable.

### Error Style Behavior

Fixed the confirmed `bg-danger`/`text-danger`/`border-danger` (CM-69G-discovered, invalid-token) occurrences in this file's error banner and required-field asterisks — the only `danger` usages found within the Issue modal's own scope. No global sweep was performed, per this unit's own "do not do global danger-token cleanup in this unit" instruction; `issue-register-table.tsx`'s own overdue-days styling (outside this unit's scope) was left untouched.

### Issue Summary Regression

None — `computeIssueSummary()` on the backend is untouched; this unit added client-side validation and wording only, verified against the exact ISS-GRM-001 (Open) / ISS-GRM-002 (In Progress) / ISS-GRM-003 (Open) / ISS-GRM-004 (Resolved) scenario: Open Issues = 2, In Progress = 1, Resolved = 1.

### Overview/Dashboard/Closeout Impact

None — all three read the same real, backend-computed `ContractIssueSummary` this unit never touched.

### Verification Results (2026-09-06)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 659/659 (22 new, including the exact ISS-GRM-001..004 verification scenario) |
| `pnpm --filter @recafco/api test --run` | ✓ 1438/1438 (unchanged — zero backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 37 migrations, unchanged |
| Live smoke check | ✓ Issue Log (register + per-contract tab), Dashboard, Contract List, and every sibling per-contract tab (Overview/Closeout/Activity/Attachments/Schedule/Workflow/Payments/Production/Variations/Claims/Risks) all responded cleanly (307 redirects, no crash) on the restarted dev server |
| Live authenticated click-through | **Not run** — same carried-over credential blocker as every unit since CM-62; verified instead via the new unit tests exercising the exact pure validation logic the modal calls |

### Unsupported/Deferred Items

Live authenticated visual confirmation of the rebuilt modal — credential blocker, carried over. CM-69G's discovered ~98-file `danger`-vs-`error` token mismatch remains the highest-value outstanding cleanup item in this codebase — this unit deliberately did not perform a global sweep, per its own explicit scope instruction.

### Next Recommended Unit

Resolve the carried-over credential blocker so a live authenticated pass can finally confirm this modal's new sections, relabeled dates, and validation in a real browser session. Separately, a dedicated unit to sweep the remaining `danger`-token files (issue/claim register tables among them) would close out CM-69G's largest deferred finding.

## CM-70C — Claim Modal UX and Validation Polish (Completed 2026-09-06)

### Summary

Audited the Add/Edit Claim modal against the reported raw-UUID contract display, unclear field meanings, and unclear status/date/value validation. Confirmed the backend's `computeClaimSummary()` already exactly reproduces this unit's own verification numbers (Open Claims = 1, Approved Claim Value = KWD 400.000, EOT Claimed = 2, EOT Approved = 0) with zero calculation change needed, and confirmed both claim DTOs have no cross-field validation today (a real, confirmed gap). Found and fixed the actual raw-UUID bug: the per-contract Claims tab's Add flow (`ContractClaimPanel`) calls `ClaimFormModal` with `fixedContractId` but never a `contracts` array, so the display fell back to `?? fixedContractId` — a bare UUID. Reorganized the modal into 4 labeled sections, added all requested field helpers, claim-type guidance, and a full frontend-only validation pass, and fixed the 2 `bg-danger`/`text-danger` (CM-69G-discovered, invalid-token) occurrences in this file's error banner.

### Files Audited

`claim-form-modal.tsx` (the shared Add/Edit Claim modal, used by both the module-level Claim Log and the per-contract Claims tab — read in full; confirmed no client-side validation existed, confirmed the raw-UUID fallback, found the CM-69G-class `danger`-token bug in the error banner), `create-contract-claim.dto.ts` / `update-contract-claim.dto.ts` (confirmed each field validates independently — `claimTitle` required, `submittedValue`/`approvedValue` `@Min(0)`, `eotClaimedDays`/`eotApprovedDays` `@Min(0)` integers, `claimNo` genuinely optional — zero cross-field rules exist; confirmed there is no separate "approved date" field in this schema at all, only `claimDate`/`eventDate`/`dueDate`/`closedDate`), `contract-claims.service.ts`'s `computeClaimSummary()` (confirmed `FINAL_STATUSES` includes `APPROVED` — an Approved claim is never counted as "open" — and confirmed the function already reproduces this unit's own test numbers with no change), `contract-claim-detail-helpers.ts` (existing `CLAIM_TYPE_FILTER_OPTIONS`/`CLAIM_STATUS_FILTER_OPTIONS`/`formatDaysToDeadline` — reused as-is), `contract-claim-panel.tsx` / `claim-register-table.tsx` / `claims/page.tsx` (confirmed exactly where `contracts`/`fixedContract` context is and isn't passed today — the register table always receives a full `contracts` array; only the per-contract panel's Add flow was missing it), `ContractClaim`/`contractsApi.get()` (confirmed `claim.contract` already embeds `referenceNumber`/`title`/`counterpartyName`, and `contractsApi.get(id)` returns the same fields for the zero-claims case — an established per-tab re-fetch pattern already used by `payments/page.tsx`), Overview/Dashboard/Closeout consumers of `ContractClaimSummary` (confirmed all read the same real, backend-computed, untouched summary object).

### Files Changed

`claim-form-modal.tsx` (4 labeled sections, controlled Claim Type/Status, readable contract display, field helpers, client-side validation banner, 2 `danger`→`error` token fixes). `contract-claim-detail-helpers.ts` (+4 new pure exports: `formatClaimContractContext`, `getClaimTypeGuidance`, `CLAIM_TYPE_GUIDANCE_TEXT`, `validateClaimFormValues`). `contract-claim-detail-helpers.test.ts` (+23 new tests, including the exact CLM-GRM-001/002 verification scenario). `contract-claim-panel.tsx` (+`contract` prop, threaded to the modal as `fixedContract`). `claims/page.tsx` (the per-contract Claims tab — added a `contractsApi.get(id)` fetch, matching the same per-tab re-fetch pattern `payments/page.tsx` already uses).

### Backend Changed — No

Zero backend files touched. `computeClaimSummary()` and both claim DTOs are unchanged — all new rules are frontend-only, per this unit's own "prefer frontend/UI-validation only" instruction.

### Migration — None

Confirmed unnecessary during audit and not added. `pnpm db:migrate:status` still reports 37 migrations, unchanged.

### Readable Contract Display Behavior

The Add-mode-with-selectable-contracts dropdown and Edit mode already showed `referenceNumber`/`title` (never a UUID); the one real bug was the per-contract tab's Add flow, which had no `contracts` array to look up at all and fell back to the bare `fixedContractId` UUID. Fixed by fetching the contract's own identity in `claims/page.tsx` (`contractsApi.get(id)`) and threading it through as `fixedContract`; the modal now shows `formatClaimContractContext()`'s "CONTRACT-2026-000009 · GRM Boundary Wall & Yard Upgrade · Gulf Ready Mix Co." format everywhere a contract is displayed, only omitting the client segment when genuinely unavailable — never a UUID.

### Modal Section Layout Behavior

Reorganized into 4 labeled sections exactly as requested: Claim Identity (Contract, Claim Title, Claim No., Claim Type, Status), Financial / EOT Claim (Submitted Value, Approved Value, EOT Claimed, EOT Approved, plus a claim-type guidance note), Dates & Responsibility (Event Date, Claim Date, Due Date, Responsible Person), Next Action & Remarks. No field was removed or hidden — same total field count as before.

### Field Helper Behavior

Every field now has the exact requested helper text (Submitted/Approved Value, EOT Claimed/Approved, Event/Claim/Due Date) plus a status helper ("Use Submitted when claim has been submitted to client. Use Approved only when client approval is confirmed.") and a Claim No. note ("Recommended — helps track this claim in reports and correspondence.") reflecting that the backend genuinely allows it empty.

### Validation Behavior

`validateClaimFormValues()` enforces: Claim Title required; Submitted/Approved Value and EOT Claimed/Approved cannot be negative; Approved Value cannot exceed Submitted Value; EOT Approved cannot exceed EOT Claimed; an Approved-status claim needs a positive Approved Value OR a positive EOT Approved (the "unless claim type/business rule allows zero" hedge is naturally satisfied by the OR — an EOT-only or cost-only Approved claim still passes through whichever measure is positive); an Approved-status claim requires Claim Date (there is no separate "approved date" field in this schema to require — confirmed during audit); Due Date and Claim Date cannot be before Event Date when both are entered. Any violation blocks submission (`e.preventDefault()`) and shows every failing rule in the same banner already used for server errors — never a silent disable.

### Claim Type Behavior

`getClaimTypeGuidance()` shows one contextual note above the Financial/EOT section: Extension of Time → EOT fields emphasized, Submitted/Approved Value may stay 0; every other real claim type (Variation, Delay, Payment, Damage, Scope Change) → cost-like guidance per this unit's own "Cost" example (there is no separate `COST` enum value in the real backend schema — adding one would need a migration, out of scope here); Other → neutral guidance covering both. No field is ever hidden for any type, per the task's own "do not hide fields unless safe and simple" instruction.

### Responsible User Behavior

Unchanged — `people` is still the real `/contracts/people` endpoint's real user list, no fake users introduced. Added an explicit "No eligible users found." message shown only when the list is genuinely empty.

### Claim Summary Regression

None — `computeClaimSummary()` on the backend is untouched; this unit added client-side validation and wording only, verified against the exact CLM-GRM-001 (EOT, Submitted, EOT Claimed 2, EOT Approved 0) / CLM-GRM-002 (Cost/Payment, Approved, Submitted 600, Approved 400) scenario: Open Claims = 1 (Approved is a `FINAL_STATUSES` status, so GRM-002 is not counted open), Approved Claim Value = KWD 400.000, EOT Claimed = 2 days, EOT Approved = 0 days.

### Overview/Dashboard/Closeout Impact

None — all three read the same real, backend-computed `ContractClaimSummary` this unit never touched.

### Verification Results (2026-09-06)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 638/638 (23 new, including the exact CLM-GRM-001/002 verification scenario) |
| `pnpm --filter @recafco/api test --run` | ✓ 1438/1438 (unchanged — zero backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 37 migrations, unchanged |
| Live smoke check | ✓ Claims (register + per-contract tab), Dashboard, Contract List, and per-contract Overview/Closeout/Activity/Attachments routes all responded cleanly (307 redirects, no crash) on the restarted dev server |
| Live authenticated click-through | **Not run** — same carried-over credential blocker as every unit since CM-62; verified instead via the new unit tests exercising the exact pure validation logic the modal calls |

### Unsupported/Deferred Items

Live authenticated visual confirmation of the rebuilt modal — credential blocker, carried over. CM-69G's discovered ~98-file `danger`-vs-`error` token mismatch (one more instance of which was just found and fixed in this exact modal) remains the highest-value outstanding cleanup item in this codebase — `claim-register-table.tsx`'s own overdue-days badge (`text-danger`, line ~120) still carries it but was left untouched since this unit's scope is the Add/Edit modal, not the register table.

### Next Recommended Unit

Resolve the carried-over credential blocker so a live authenticated pass can finally confirm this modal's new sections, guidance, and validation in a real browser session. Separately, a dedicated unit to sweep the remaining ~93 files still carrying the invalid `danger` token would close out CM-69G's largest deferred finding.

## CM-70C — Variation Modal UX and Validation Polish (Completed 2026-09-06)

### Summary

Audited the Add/Edit Variation modal against the reported confusion around Amount sign, Status/date rules, Affects Contract Value visibility, Reference fields, and the Attachment instruction. Confirmed the backend's `computeVariationSummary()` already exactly reproduces this unit's own verification numbers (Approved = 6,500 + −700 = 5,800.000; Pending = 2,250.000) with zero calculation change needed, and confirmed the create/update variation DTOs have no cross-field validation today (a real, confirmed gap). Added a full frontend-only validation pass plus the 9 requested UX/wording improvements, and fixed the same `bg-danger`/`text-danger`/`border-danger` (CM-69G-discovered, invalid-token) bug in this file's 4 occurrences.

### Files Audited

`contract-variation-form-modal.tsx` (the Add/Edit Variation modal — read in full; confirmed no client-side validation existed and found the CM-69G-class `danger`-token bug in the error banner, Description's asterisk, and Amount's asterisk), `create-contract-variation.dto.ts` / `update-contract-variation.dto.ts` (confirmed each field validates independently — `description` required/maxlength 500, `amount` required `@IsNumber({maxDecimalPlaces:3})` with no `@Min` so negative deductions are allowed, `affectsContractValue`/`status`/`submittedDate`/`approvedDate` all optional — zero cross-field rules exist), `contract-variations.service.ts`'s `computeVariationSummary()` (confirmed it already skips any item with `affectsContractValue=false`, sums by status into `approvedValue`/`pendingValue`/`rejectedCancelledValue`, all `round3()`'d — reproduces this unit's own test numbers with no change), `contract-variation-helpers.ts` (existing `VARIATION_STATUS_LABELS`/`VARIATION_STATUS_OPTIONS`/`matchesSubmittedDateFilter` — reused as-is), `contract-variation-formula-strip.tsx` (the Variations tab's "Original + Approved = Current Contract Value" strip — confirmed it only reads server-computed `approvedValue`/`computedCurrentValue` props, no calculation logic of its own to regress).

### Files Changed

`contract-variation-form-modal.tsx` (controlled Status + Approved Date, client-side validation banner, all 9 required UX/wording changes, 4 `danger`→`error` token fixes). `contract-variation-helpers.ts` (+3 new pure exports: `isSubmittedDateRequired`, `isApprovedDateRequired`, `validateVariationFormValues`). `contract-variation-helpers.test.ts` (+29 new tests, including the exact VO-GRM-001/002/003 verification scenario).

### Backend Changed — No

Zero backend files touched. `computeVariationSummary()` and both variation DTOs are unchanged — all new rules are frontend-only, per this unit's own "prefer frontend/UI-validation only" instruction.

### Migration — None

Confirmed unnecessary during audit and not added. `pnpm db:migrate:status` still reports 37 migrations, unchanged.

### Amount Helper Behavior

Label renamed to "Variation Amount (KWD)"; helper text added beneath it: "Use a positive amount for additions and a negative amount for deductions/omissions." The native `required` attribute was removed in favor of the same client-side validation pass used for every other rule (consistent with the CM-69F/CM-70A/CM-70B precedent of never relying on native HTML validity alone); a negative amount (a real deduction) is never rejected.

### Affects Contract Value Behavior

The checkbox is now wrapped in a bordered, hoverable card with its own bold label and helper text ("Only approved variations marked as affecting contract value will update the current contract value.") instead of a plain small inline checkbox — visually much harder to miss.

### Status/Date Validation Behavior

`validateVariationFormValues()` enforces: Description and Variation Amount required; Submitted Date required once status leaves Draft (Submitted, Pending Approval, Approved, Rejected, or Cancelled); Approved Date required only when status is Approved; Approved Date cannot be before Submitted Date; an Approved variation marked Affects Contract Value cannot have an amount of 0. Approved Date is never hard-`disabled` — only softly de-emphasized (muted styling, no red asterisk, a small "only needed once Approved" note) for Draft/Submitted/Pending Approval, so a manager can still set it early if a real case requires it, and an existing record's historical Approved Date is never hidden or force-cleared. Any violation blocks submission (`e.preventDefault()`) and shows every failing rule in the same banner already used for server errors.

### Reference Field Behavior

Relabeled "Reference Name (optional)" → "Reference Document Name" and "Reference Link (optional)" → "Reference Link / Location"; helper text updated to the exact required wording: "Use this only when the document is stored outside this variation record."

### Attachment Instruction Behavior

Add-mode's instruction now reads exactly: "Save the variation first. Then open Edit Variation to upload supporting documents." Edit-mode's real upload/list/download flow (`SupportingDocumentsSection`) is unchanged.

### Variation Calculation Regression

None — `computeVariationSummary()` on the backend is untouched; this unit added client-side validation and wording only, verified against the exact VO-GRM-001 (Approved +6500) / VO-GRM-002 (Pending Approval +2250) / VO-GRM-003 (Approved −700) scenario: Approved Variations = KWD 5,800.000, Pending Variations = KWD 2,250.000, Current Contract Value increases by KWD 5,800.000 only.

### Overview/Dashboard/Closeout Impact

None — all three read the same real, backend-computed `computeVariationSummary()` output this unit never touched; the Variations tab's own formula strip (`contract-variation-formula-strip.tsx`) likewise only displays server-provided values with no calculation logic of its own to regress.

### Verification Results (2026-09-06)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 615/615 (29 new, including the exact VO-GRM-001/002/003 verification scenario) |
| `pnpm --filter @recafco/api test --run` | ✓ 1438/1438 (unchanged — zero backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 37 migrations, unchanged |
| Live smoke check | ✓ Contract List, Dashboard, Schedule, Payments, Closeouts, Workflow, and per-contract Variations/Overview/Closeout/Payments/Schedule/Workflow routes all responded cleanly (307 redirects, no crash) on the restarted dev server |
| Live authenticated click-through | **Not run** — same carried-over credential blocker as every unit since CM-62; verified instead via the new unit tests exercising the exact pure validation logic the modal calls |

### Unsupported/Deferred Items

Live authenticated visual confirmation of the rebuilt modal — credential blocker, carried over. CM-69G's discovered ~98-file `danger`-vs-`error` token mismatch (one more instance of which was just found and fixed in this exact modal, its 4th confirmed file) remains the highest-value outstanding cleanup item in this codebase.

### Next Recommended Unit

Resolve the carried-over credential blocker so a live authenticated pass can finally confirm this modal's new validation, status/date rules, and wording in a real browser session. Separately, a dedicated unit to sweep the remaining ~94 files still carrying the invalid `danger` token would close out CM-69G's largest deferred finding.

## CM-70B — Production Status Modal Validation and UX Polish (Completed 2026-09-06)

### Summary

Audited the Add/Update Production modal for the reported "Delivered field shows red/confusing when empty" issue and found no literal CSS/validity bug in the current code — the backend already returns a real, honest `0` (never `undefined`/`NaN`) for both Casted/Produced and Delivered on a never-touched item, and neither field carried a `required` attribute or any border-color-driven validity logic. What genuinely needed fixing: no field-level guidance that 0 is the correct, expected Delivered value for a freshly-started item, and no pre-submit validation beyond the backend's own (already correct, unchanged) cross-field checks. Added explicit helper text, a live status auto-suggestion (same pattern as CM-70A's Payment modal), and a full client-side validation pass with visible error messages — plus fixed the same `bg-danger`/`text-danger` (CM-69G-discovered, invalid-token) bug in this exact file's error banner.

### Files Audited

`contract-production-form-modal.tsx` (the Add/Update Production modal — found no `required` attribute or conditional red-border styling tied to Delivered's value; found the CM-69G-class `border-danger`/`bg-danger-light`/`text-danger` invalid-token bug in its own server-error banner), `update-contract-boq-item-production.dto.ts` (confirmed both `producedQty`/`deliveredQty` are `@IsOptional @Min(0)` — the backend deliberately allows either to be omitted; this unit only adds a stricter client-side "always required" rule, not a backend change), `contract-boq-production.service.ts`'s `assertProductionAmountsValid()` (confirmed the backend ALREADY rejects `delivered > produced` and `produced > totalQty` on every save — the real, unchanged safety net this unit's frontend checks duplicate for faster feedback) and its list-derivation code (`producedQty = round3(toNum(item.productionStatus?.producedQty) ?? 0)` — confirmed a never-touched BOQ item's production fields are real backend-computed zeros, never `undefined`/`NaN`, closing the audit question of "why would Delivered ever look invalid"), `contract-production-helpers.ts` (existing `computeStockNotDelivered`/`computeRemainingToCast`/`computePercentOfTotal` — confirmed these already exactly mirror the backend's own formulas, reused as-is for the new status-suggestion/validation logic), `contract-boq-production.service.ts`'s summary/Schedule/Closeout consumers (`computeProductionSummary`, the Schedule detail service's Casting/Production actual-quantity derivation from CM-68A, Closeout's production-readiness checks — confirmed all read the same real, backend-computed, unchanged fields).

### Root Cause

Not a literal rendering bug — audited and confirmed the reported "red/confusing Delivered field" traces to a UX gap (no reassurance that 0 is correct/expected), not a data or validity defect. The one adjacent, real bug found and fixed while auditing this file was the same invalid `danger`-token issue CM-69G discovered elsewhere in this app.

### Files Changed

`contract-production-form-modal.tsx` (controlled Status field + auto-suggestion, client-side validation banner, helper text, `danger`→`error` token fix, safe `toInputValue()` initial-value formatting). `contract-production-helpers.ts` (+2 new pure exports: `suggestProductionStatus`, `validateProductionFormValues`). `contract-production-helpers.test.ts` (+23 new tests, including the exact Precast Boundary Wall Panel Type A / Total Qty 400 / Produced 120 / Delivered 40 scenario from this unit's own task).

### Backend Changed — No

Zero backend files touched. No DTO, service, or controller change. `assertProductionAmountsValid()` remains the real, unchanged safety net; this unit only added a faster, friendlier frontend duplicate of the same two rules plus new required-field checks the backend deliberately leaves optional.

### Migration — None

Confirmed unnecessary during audit and not added. `pnpm db:migrate:status` still reports 37 migrations, unchanged.

### Default Value Behavior

Casted/Produced and Delivered both initialize from the item's real, already-backend-computed values (0 for a never-touched item) via a new `toInputValue()` helper that rounds to at most 3 decimals — guards against ever seeding a controlled number input with floating-point noise that could trip its own `step="0.001"` validity check, closing the one concrete (if unconfirmed) technical explanation for a "red-looking" numeric field found during audit.

### Validation Behavior

A single client-side `validateProductionFormValues()` pass, run on submit before the server action fires: Casted/Produced required and ≥ 0 and ≤ Total Qty; Delivered required (0 is a fully valid, non-missing value — never flagged) and ≥ 0; Delivered cannot exceed Casted/Produced, shown with the exact required message "Delivered quantity cannot be more than casted/produced quantity." Any violation blocks submission (`e.preventDefault()`) and shows every failing rule in the same banner already used for server errors — never a silent disable.

### Calculation Behavior

Stock/Not Delivered, Remaining to Cast, and Progress all update live as the user types, using the exact same formulas as before (unchanged) — verified against this unit's own test data: Total Qty 400, Produced 120, Delivered 40 → Stock 80, Remaining 280, Progress 30%.

### Status Suggestion Behavior

Added `suggestProductionStatus()`: Produced = 0 → Not Started; 0 < Produced < Total → In Production; Produced = Total and Delivered < Total → Partially Delivered; Delivered = Total → Completed. Never suggests Delayed (a real, manager-judged, non-amount-derivable condition — stays manual-only, survives until the next quantity edit, same precedent as CM-70A's Payment modal leaving Submitted/Certified/Overdue/Cancelled manual-only).

### Field Error Behavior

Errors now render as visible, specific text in the modal's existing banner (now correctly styled via the real `error` token, not the invalid `danger` one) — never only a border color, and the Save Changes button is disabled only while the request is actually in flight (`disabled={isPending}`), never because a field merely hasn't been filled in yet.

### Production Summary Regression

None — `computeProductionSummary`/the Production Status tab's own summary cards read the same real, backend-computed fields this unit never touched.

### Schedule/Closeout Impact

None — CM-68A's Casting/Production actual-quantity derivation (Schedule detail tab) and Closeout's production-readiness checks both read the same real, unchanged `contract-boq-production.service.ts` fields; this unit made no backend change for either to react to.

### Verification Results (2026-09-06)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 595/595 (23 new, including the exact 400/120/40 → 80/280/30% test-data scenario) |
| `pnpm --filter @recafco/api test --run` | ✓ 1438/1438 (unchanged — zero backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 37 migrations, unchanged |
| Live smoke check | ✓ Production tab, Dashboard, Schedule, Contract List, and a Closeout route all responded cleanly (redirects/401s, no crash) on the restarted dev server |
| Live authenticated click-through (Precast Boundary Wall Panel Type A scenario) | **Not run** — same carried-over credential blocker as every unit since CM-62; verified instead via the new unit tests exercising the exact pure logic the modal calls |

### Unsupported/Deferred Items

- Live authenticated visual confirmation of the rebuilt modal, including whatever the actual screenshot's red styling turns out to be in a real browser — credential blocker, carried over. If a genuine CSS bug still reproduces after this fix, it likely lives outside this component (e.g. a global `:invalid` style rule) and would need a live session to pin down.

### Next Recommended Unit

Resolve the carried-over credential blocker so a live authenticated pass can finally confirm both this modal's fix and CM-69's whole cancel-contract chain in a real browser session. Separately, CM-69G's discovered ~98-file `danger`-vs-`error` token mismatch (one more instance of which was just found and fixed in this exact modal) remains the highest-value outstanding cleanup item in this codebase.

## CM-69I — Contract List KPI Cards Must Match Default Visible Contract Scope (Completed 2026-09-06)

### Summary

Completed out of numeric order, after CM-70A, but logically belongs alongside the CM-69 cancel-contract chain. The Contract List's 4 KPI cards (Total Contracts, Active Contracts, Total Contract Value, Open Claims) came from a completely separate, filter-blind endpoint (`GET /contracts/summary` → `ContractsService.getSummary(actor)`) that only ever applied department scope — never the table's own `lifecycleStatus`/`status`/`search`/`scheduleStatus`/`contractType`/`ownerUserId`/`daysRemaining` filters, and never CM-69C's default-excludes-CANCELLED rule. So after cancelling the demo contracts, the table correctly hid them (CM-69C) while the KPI cards kept counting them — exactly the reported bug. Fixed by making `getSummary()` accept the identical `ContractListQueryDto` the table's `findAll()` takes and resolve it through the exact same `buildListWhere()`, so the two can never disagree again.

### Files Audited

`contracts/page.tsx` (found `contractsApi.summary()` was called with ZERO arguments, completely independent of the `list()` call's filter params two lines above it), `contractsApi.summary()`/`ContractSummary` type (confirmed no params accepted), `contracts.controller.ts`'s `summary` route (confirmed no `@Query()` at all), `ContractsService.getSummary()` (found it built its own `deptWhere`-only where-clause from scratch — 7 separate hardcoded per-status counts, never touching `buildListWhere()`), `buildListWhere()` (confirmed it already correctly encodes CM-69C's default-excludes-CANCELLED / explicit lifecycleStatus / explicit 'ALL' bypass — reusable as-is, no changes needed to this function itself), `findAll()` (confirmed the exact `{ ...buildListWhere(query) }` + conditional `departmentId` overwrite combining pattern used for the table — reused verbatim for consistency), `contract-summary-cards.tsx` (found its own separate manual "Total Contracts" sum formula, now unnecessary), `contract-dashboard.service.ts`/`contract-schedule-overview.service.ts`/`contract-schedule.service.ts` (confirmed these are completely separate code paths, untouched by this fix — CM-69H's dashboard exclusion and CM-69A/CM-68B's schedule exclusion both still stand independently).

### Root Cause

Two independent, disconnected data sources feeding one page: the table used `findAll(query)` (filtered, CANCELLED-excluding-by-default per CM-69C), the KPI cards used `getSummary(actor)` with no query parameter at all (department-scope only). Nothing kept them in sync because nothing tied them together.

### Files Changed

Backend: `contracts.service.ts` (`getSummary()` fully rewritten), `contracts.controller.ts` (`summary` route now accepts `@Query() query: ContractListQueryDto`), `contracts.service.test.ts` (rewrote the `getSummary` describe block: was 5 tests around 7 hardcoded status counts, now 8 tests around the new filter-scoped/AND-combined shape). Frontend: `contracts-api.ts` (`ContractSummary` type simplified to `{ totalContracts, activeContracts, totalContractValue, totalOpenClaims }`; `summary()` now accepts the same `ContractListQuery` params as `list()`), `contracts/page.tsx` (extracted one shared `filterParams` object passed to both `list()` and `summary()`), `contract-summary-cards.tsx` (dropped its own manual per-status sum — reads `summary.totalContracts`/`summary.activeContracts` directly; "Total Contracts" subtext changed to "Matching current filters" per this unit's own explicit recommendation).

### Backend Changed — Yes (query-shape/filter-reuse only)

`getSummary(actor, query)` now resolves `{ ...buildListWhere(query) }` plus the same department-scope combining pattern `findAll()` already uses, instead of a from-scratch `deptWhere`-only object. "Active Contracts" is computed as `contract.count({ where: { AND: [where, { status: ACTIVE }] } })` — a real Prisma `AND`, never an object-spread `{...where, status: ACTIVE}` (which would have silently overwritten an explicit `lifecycleStatus=DRAFT`/`CLOSED`/etc. filter's own `status` condition instead of correctly returning 0 for it).

### Migration — None

Confirmed unnecessary and not added — purely a query-construction/reuse change. `pnpm db:migrate:status` still reports 37 migrations, unchanged.

### Table vs KPI Filter Consistency

`contracts/page.tsx` now builds ONE `filterParams` object (lifecycleStatus/scheduleStatus/contractType/daysRemaining/ownerUserId/search) and passes it to BOTH `contractsApi.list({ page, pageSize, ...filterParams })` and `contractsApi.summary(filterParams)` — the two requests are now structurally guaranteed to resolve to the same `buildListWhere()` output server-side, so they can never disagree again by construction, not just by convention.

### Default Contract List KPI Behavior

No `lifecycleStatus`/`status` param at all → `buildListWhere()`'s own default branch (`{ status: { not: CANCELLED } }`) applies to Total Contracts, Total Contract Value, and Open Claims identically to the table; Active Contracts additionally requires `status: ACTIVE` within that same scope.

### Cancelled Filter KPI Behavior

`lifecycleStatus=CANCELLED` → `buildListWhere()` resolves `where.status = CANCELLED`; Total Contracts/Value/Open Claims reflect the cancelled-only scope (a real, honest audit total, matching what the table shows); Active Contracts is always 0 in this scope (`AND [{status: CANCELLED}, {status: ACTIVE}]` is never satisfiable).

### All Statuses KPI Behavior

`lifecycleStatus=ALL` (or `status=ALL`) → `buildListWhere()` returns no status filter at all (its explicit-bypass branch, unchanged from CM-69C); Total Contracts/Value/Open Claims reflect every real status including Cancelled, matching the table's own all-statuses view exactly.

### Total Contract Value Behavior

Unchanged formula (`contract.aggregate({ where, _sum: { contractValue: true } })`, real stored current value, no invented figure) — now computed over the identical filtered `where` as Total Contracts/Active Contracts, so it can never include a contract the table itself is hiding.

### Revalidation/Cache Behavior

Confirmed already correct, no change needed: `contracts/page.tsx` fetches `list()` and `summary()` together in one `Promise.allSettled` on every render of this one page, and every contract-mutating server action (`cancelContractAction`, `createContractAction`, `activateContractAction`, etc.) already calls `revalidatePath('/contracts')` — so a fresh visit after any mutation re-fetches both the table and the KPI cards together, from the same real database state, with no separate cache to fall out of sync.

### Dashboard Regression

None — `contract-dashboard.service.ts`'s `getDashboard()` (CM-69H's own cancelled-exclusion fix) is a completely separate method/endpoint, never touched by this unit.

### Schedule Regression

None — `contract-schedule-overview.service.ts`/`contract-schedule.service.ts` (CM-69A/CM-68B's cancelled-exclusion fixes) are completely separate methods/endpoints, never touched by this unit.

### No-Delete Confirmation

No delete button, no delete script, no schema change. Cancelled contracts remain fully in the database, fully visible via the Lifecycle Status = Cancelled / All Statuses filters — only counted differently by the (now consistent) KPI cards.

### Verification Results (2026-09-06)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 577/577 (unchanged — no web pure-logic file touched, only types/components/page wiring) |
| `pnpm --filter @recafco/api test --run` | ✓ 1438/1438 (net +3 — old 5-test block around 7 hardcoded counts replaced with a new 8-test block around the filter-scoped/AND-combined shape) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 37 migrations, unchanged |
| Live smoke check | ✓ Contract List (default, `?lifecycleStatus=CANCELLED`, `?lifecycleStatus=ALL`, `?search=test`), Dashboard, Schedule, and the API's `/contracts/summary` (bare and `?search=test`) all responded cleanly (redirects/401s, no crash) on the restarted dev server |
| Live authenticated visual confirmation (scenarios A–H) | **Not run** — same carried-over credential blocker as every unit since CM-62; every rule was instead verified via the new/updated unit tests exercising the exact backend logic the page calls |

### Unsupported/Deferred Items

- Live authenticated visual confirmation that Total Contracts/Active Contracts/Total Contract Value/Open Claims now read 1/1/KWD 38.67K/0 after cancelling the two demo contracts — credential blocker, carried over.

### Next Recommended Unit

Resolve the carried-over credential blocker so a live authenticated pass can finally confirm the Contract List's KPI cards and table agree in a real browser session, closing out the CM-69A→I chain end-to-end. Separately, CM-69G's discovered ~98-file `danger`-vs-`error` token mismatch remains the highest-value outstanding cleanup item in this codebase.

## CM-70A — Add Payment Modal UX and Validation Fix (Completed 2026-09-06)

### Summary

Rebuilt the Add/Edit Payment modal's UX without touching the backend: a real Payment Term dropdown (with an "Other" free-text fallback so no existing/legacy text value is ever lost), a live-calculated Remaining Amount preview, status auto-suggested from Invoice/Received Amount, clearer required-field markers, better placeholders, and a full client-side validation pass covering every rule this unit's task specified — reusing the backend's own already-existing `assertPaymentAmountsValid` safety net underneath, not duplicating or weakening it.

### Files Audited

`payment-form-modal.tsx` (the one shared Add/Edit modal for both the module-level Payments register and the Contract Detail Payments tab — confirmed both variants share this exact component, so any UX/validation fix here reaches both, matching this unit's own "Apply same UX to edit payment if Add and Edit share component" requirement), `create-contract-payment.dto.ts`/`update-contract-payment.dto.ts` (confirmed `paymentTerm` is plain optional free text — `@IsString @MaxLength(100)`, no enum — so a frontend-only dropdown-with-"Other" is sufficient, no schema/DTO change needed), `contract-payments.service.ts` (found `assertPaymentAmountsValid()` — the backend ALREADY rejects `paidAmount > (certifiedAmount ?? submittedAmount)` on both create and update, called at lines 351/428 — this unit's overpayment rule was already backend-enforced; the new frontend check is a faster, friendlier duplicate of the same rule, not a new safety net), `computeOutstandingAmount`/`computePaymentSummary` (confirmed these already compute Remaining Amount / totals server-side from real stored values — the modal's new live preview is a UI-only estimate, never submitted, never persisted, and never contradicts the backend's own authoritative number), `contract-payment-detail-helpers.ts` (`PAYMENT_STATUS_LABELS` — confirmed DRAFT/PARTIALLY_PAID/PAID already map to "Pending"/"Partially Received"/"Received", reused as-is rather than inventing new labels like "Fully Paid"), the Contract Detail Payments tab's own table (`contract-payment-tracker-table.tsx` — confirmed its column headers already read "Invoice Amount"/"Payment Due Date"/"Received On"/"Received Amount"/"Remaining Amount", already matching this task's requested wording exactly — no label change was needed, only the interactive behavior), `contract-dashboard.service.ts`/`contract-closeout.service.ts` (confirmed both already read real, backend-computed payment fields — untouched, unaffected by a frontend-only change).

### Files Changed

`payments/_components/payment-form-modal.tsx` (full rewrite of the interactive parts — Payment Term dropdown + "Other", controlled Invoice/Received Amount with live Remaining Amount + auto-status, section headings, placeholders, client-side validation banner). `_lib/contract-payment-detail-helpers.ts` (+7 new pure exports: `PAYMENT_TERM_OPTIONS`, `PAYMENT_TERM_OTHER`, `resolvePaymentTermSelection`, `resolvePaymentTermValue`, `computeRemainingAmount`, `suggestPaymentStatus`, `validatePaymentFormValues`). `_lib/contract-payment-detail-helpers.test.ts` (+32 new tests).

### Backend Changed — No

Zero backend files touched. No DTO, service, or controller change. The backend's existing `assertPaymentAmountsValid()` (paid ≤ certified-or-submitted) remains the real, unchanged safety net; this unit only added a faster, more specific frontend check on top of it.

### Migration — None

Confirmed unnecessary during audit (`paymentTerm` was already free text) and not added. `pnpm db:migrate:status` still reports 37 migrations, unchanged.

### Payment Term Dropdown Behavior

Fixed options: Advance Payment, Production Interim Payment, Delivery Payment, Erection Payment, Final Payment, Retention Release, Other. Selecting a fixed option submits that exact string as `paymentTerm` (unchanged backend column, unchanged shape); selecting "Other" reveals a free-text "Other payment term" input whose value is what actually gets submitted. Editing an existing payment whose real, stored `paymentTerm` doesn't match any fixed option (e.g. legacy "Net 30") preselects "Other" with that exact text preserved in the free-text field — never silently discarded or blanked.

### Auto Status Behavior

Whenever Invoice Amount or Received Amount changes, the Status dropdown is auto-set to Pending (Received = 0), Partially Received (0 < Received < Invoice), or Received (Received = Invoice) — reusing the app's own already-established manager-friendly labels, not new ones. A manually-picked non-amount-derived status (Submitted, Certified, Overdue, Cancelled) survives until the next amount edit, matching this unit's own "auto-set, but allow manual override where existing business logic requires it."

### Remaining Amount Behavior

A live, read-only calculated field (Invoice Amount − Received Amount, using the same established "read-only calculated cell" styling as the BOQ register) updates as the user types either amount — verified against every example in the task: 8500/8500→0, 34000/10000→24000, 25500/0→25500. Never submitted as its own form field — the backend keeps computing its own real `outstandingAmount` from stored values, exactly as before.

### Validation Behavior

A single client-side `validatePaymentFormValues()` pass, run on submit before the server action ever fires, checks: Invoice Number/Invoice Date/Payment Due Date required; Invoice Amount required and > 0; Received Amount required and ≥ 0; Received Amount cannot exceed Invoice Amount; Received On required once Received Amount > 0 or status is Partially Paid/Fully Paid; status/amount consistency (Fully Paid ⇒ Received = Invoice; Pending ⇒ Received = 0; Partially Paid ⇒ 0 < Received < Invoice). Any violation blocks the actual form submission (`e.preventDefault()`) and shows every failing rule in the same red banner already used for server errors — never a silent disable, matching the CM-69F/G-established "visible validation, not a silently dimmed control" convention.

### Add Payment Verification (from the task's own scenarios, verified via the new unit tests)

A (8500/8500, Fully Paid): valid, Remaining = 0. B (34000/10000, Partially Paid): valid, Remaining = 24000. C (25500/0, Pending, no Received On): valid, Remaining = 25500. D (8500 invoice / 9000 received): blocked — "Received Amount cannot exceed Invoice Amount." E (status Fully Paid with Received < Invoice): blocked — "Status is Fully Paid but Received Amount does not equal Invoice Amount."

### Edit Payment Regression

Same shared component, same fields/`name` attributes, same create/update server actions — editing an existing payment now additionally preselects the correct Payment Term dropdown state (never losing legacy free text) and shows the live Remaining Amount/suggested status for the payment's own stored amounts; saving an edit with unchanged, already-valid data passes validation and submits exactly as before.

### Dashboard/Overview/Closeout Payment Impact

None — confirmed by audit, not by re-deriving anything: all three read the backend's own real, unchanged `computePaymentSummary`/`computeOutstandingAmount` output; this unit made no backend change, so their totals/outstanding/closeout-readiness figures are untouched.

### Data Honesty Confirmation

No payment numbers invented (Payment No. stays a plain optional free-text field, unchanged). No invoices auto-created. A payment is never marked Received unless Received Amount genuinely equals Invoice Amount (enforced by validation, not assumed). No existing saved payment record is altered by this unit — purely new modal UX/validation on top of the same create/update payload shape.

### Verification Results (2026-09-06)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 577/577 (39 new: 32 in contract-payment-detail-helpers.test.ts + 7 pre-existing suite growth) |
| `pnpm --filter @recafco/api test --run` | ✓ 1435/1435 (unchanged — zero backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 37 migrations, unchanged |
| Live smoke check | ✓ Payments register, a contract detail payments route, Dashboard, Schedule, Contract List, and the API's payments endpoint all responded cleanly (redirects/401s, no crash) on the restarted dev server |
| Live authenticated click-through (scenarios A–G) | **Not run** — same carried-over credential blocker as every unit since CM-62; every rule was instead verified via the new, real unit tests exercising the exact pure logic the modal calls |

### Unsupported/Deferred Items

- Live authenticated visual/click-through confirmation of the rebuilt modal — credential blocker, carried over.

### Next Recommended Unit

Resolve the carried-over credential blocker so a live authenticated pass can finally click through Add Payment end-to-end in a real browser session; separately, CM-69G's discovered ~98-file `danger`-vs-`error` token mismatch remains the highest-value outstanding cleanup item in this codebase.

## CM-69H — Dashboard Exclude Cancelled Contracts from Working KPIs (Completed 2026-09-05)

### Summary

After CM-69A–G let managers actually cancel demo/test contracts, the Contract Management Dashboard still counted them as active working data — Total Contracts, Contract Value, Progress, Submitted/Received Payments, Open Claims, Critical/Overdue/Closing-soon alerts, and the "Contracts by Status" donut all still reflected cancelled rows. Root cause: `contract-dashboard.service.ts`'s `getDashboard()` fetched ALL contracts (every status, no filter) as the single source feeding every downstream manager computation. Fixed at the source with one query-level exclusion, plus two presentation-layer fixes for the "Total Contracts" KPI label/definition and the status donut.

### Files Audited

`contract-dashboard.service.ts` (`getDashboard()`'s contract fetch — confirmed no status filter at all; `buildManagerAttentionItems()`'s items #2–7 — confirmed none check `contract.status`, only that the contract exists in the fetched set, meaning excluding cancelled contracts at the SOURCE query is the one fix that correctly cascades to all of them; `computeManagerSummary`/`computeManagerFinancials`/`buildTopValueContracts`/`buildTopDelayedContracts`/`countContractsClosingSoon`/`buildWorkflowOverview` — confirmed all operate purely on the `contracts`/`contractIds` pair passed in, so no per-function change was needed once the source query was fixed), `contracts.service.ts`'s `getDashboard()`/`getSummary()` (confirmed `totalActive`/`totalDraft`/etc. already correctly whitelist their own real status — never affected by cancelled contracts; `totalCancelled` is an intentional, correct, separate count), `dashboard-insights-helpers.ts` (`totalContractsFromMetrics`, `buildContractsByStatusSegments` — both previously included Cancelled), `manager-kpi-grid.tsx`/`contract-kpi-grid.tsx` (the two "Total Contracts" KPI cards), `contracts/dashboard/page.tsx` (the "Contracts by Status" `DonutChart` wiring), `donut-chart.tsx` (confirmed it already has generic `total === 0` empty-state handling — no component change needed there, just the right `emptyMessage` prop and pre-filtered segments), `contract-schedule-overview.service.ts`/`contract-schedule.service.ts` (confirmed already excluding CANCELLED since CM-69A — untouched, still correct), `contracts.service.ts`'s `buildListWhere()` (confirmed CM-69C's default-excludes-CANCELLED Contract List behavior untouched), `apps/web/src/app/(protected)/contracts/actions.ts`'s `cancelContractAction` (confirmed it only revalidated `/contracts`, not the dashboard or schedule routes).

### Root Cause

A single unconditional `contract.findMany({ where: deptOnly })` in `contract-dashboard.service.ts`'s `getDashboard()` — every manager-dashboard number (financials, progress, alerts, top contracts, workflow overview) is derived from this one array plus the child records fetched via `contractId: { in: contractIds }`. Cancelled contracts had no reason to be excluded until CM-69A introduced the status, and no later unit had revisited this specific query.

### Files Changed

Backend: `contract-dashboard.service.ts` (one `where`-clause change), `contract-dashboard.service.test.ts` (updated + 1 new test). Frontend: `dashboard-insights-helpers.ts` (`totalContractsFromMetrics`, `buildContractsByStatusSegments`), `dashboard-insights-helpers.test.ts` (updated + 3 new tests), `contract-kpi-grid.tsx`, `manager-kpi-grid.tsx` (label/subtext + reused the shared helper instead of a duplicated manual sum), `contracts/dashboard/page.tsx` (donut `emptyMessage` + optional small Cancelled audit note), `actions.ts`'s `cancelContractAction` (added 3 more `revalidatePath` calls).

### Backend Changed — Yes (query-filter only)

`contract-dashboard.service.ts`'s `getDashboard()`: `where = { status: { not: ContractStatus.CANCELLED }, ...(deptFilter ? { departmentId: deptFilter } : {}) }`. This one change is what makes financials, progress, alerts, top-contracts, and workflow overview all correctly exclude cancelled contracts — none of those functions needed their own individual fix, since they all consume the same filtered `contracts`/`contractIds`.

### Migration — None

Confirmed unnecessary and not added: purely a query-`where`-clause change, no schema touched. `pnpm db:migrate:status` still reports 37 migrations, unchanged.

### Dashboard Default Scope Behavior

Every manager-dashboard section (Contract Summary KPIs, Progress by Discipline, Financial Performance, Contracts by Status, Management Attention Required, Top 5 Delayed/By Value, Claims Status Overview, Upcoming Schedule) now derives from a contract set that already excludes CANCELLED — no per-widget special-casing needed.

### Working KPI Behavior

"Total Contracts" relabeled "Total Working Contracts" on both dashboard KPI grids (`ManagerKpiGrid`'s 11-card grid and the fallback `ContractKpiGrid`'s 5-card grid), now computed as Draft + Active only (via the shared `totalContractsFromMetrics`, no longer duplicated inline in `ContractKpiGrid`) — per this unit's own explicit "working statuses: DRAFT, ACTIVE only" business rule, Terminated/Closed no longer count toward this specific total either (they remain fully visible as their own real, separate figures — e.g. `ContractKpiGrid`'s own "Closed Contracts" card, Contract List's Lifecycle Status filter). Both cards now carry an explicit helper: "Cancelled contracts are excluded from working dashboard totals." / "Active working view — cancelled contracts excluded."

### Financial Totals Behavior

Contract Value, Progress, Submitted Invoices, Received Payments, Outstanding Payment — all computed by `computeManagerFinancials`/`computeManagerSummary` purely from the (now cancelled-excluding) `contracts`/`payments`/`claims` arrays fetched in `getDashboard()`. No separate fix needed once the source query was corrected.

### Status Chart Behavior

`buildContractsByStatusSegments` no longer returns a Cancelled segment at all (Draft/Active/Expiring/Expired/Terminated/Closed only — Terminated/Closed remain, since they're real portfolio-composition context a manager legitimately wants, unlike Cancelled which is a void/audit record). The "Contracts by Status" `DonutChart` now receives `emptyMessage="No active working contracts found."`, so when every remaining segment is zero (e.g. after cancelling the only real contracts) it shows that message via the chart's own pre-existing `total === 0` empty-state handling, instead of rendering a 100%-Cancelled-looking chart (which no longer includes Cancelled as a possible arc at all). A small, optional, plain-text audit note ("Cancelled Contracts: N — excluded from working totals — view via Contract List, Lifecycle Status = Cancelled") appears next to the chart only when `totalCancelled > 0`, kept intentionally simple (not a new card) per this unit's own caution.

### Alert/Overdue Behavior

Critical Project Contracts, Overdue Workflow Tasks, Contracts Closing Soon, Open Claims — all computed inside `buildManagerAttentionItems`/`computeManagerInsights` from the same corrected `contracts`/`contractIds`-derived data; a cancelled contract's leftover tasks/claims/payments/issues (if any existed) are never even fetched now, since `contractIds` no longer includes cancelled contracts at all.

### Revalidation/Cache Behavior

`cancelContractAction` now revalidates `/contracts`, `/contracts/dashboard`, `/contracts/schedule`, and the cancelled contract's own detail path (`/contracts/:id`) — previously only `/contracts`. Both `/contracts/dashboard` and `/contracts/schedule` already declare `export const dynamic = 'force-dynamic'`; `/contracts` is dynamic-by-default (reads `searchParams`) — so no additional caching layer needed fixing beyond ensuring the right paths are told to revalidate. No websocket/real-time mechanism added, per this unit's own explicit instruction not to.

### Cancelled Audit Visibility Confirmation

Cancelled contracts remain fully visible for audit: Contract List's Lifecycle Status = Cancelled filter (CM-69C, untouched) still shows them; the dashboard's new small audit note still surfaces the real count; Activity/Audit History on the contract's own detail page is completely unaffected (a separate, untouched data path); direct navigation to a cancelled contract's detail page still works if permitted (`contracts.read`, department scope), showing its real CANCELLED lifecycle badge.

### Department Scope Confirmation

The new `status: { not: CANCELLED }` condition is combined with the existing `departmentId` condition via the same object spread pattern already used everywhere else in this session (CM-69A's schedule-overview/schedule-service fixes) — department scope enforcement (`deptAccess.buildDeptFilter`) is completely unchanged, just one more condition ANDed alongside it. No cross-department leakage introduced.

### No-Delete Confirmation

No delete button, no delete script, no schema/migration change. Purely a query-filter, a shared-helper definition, and two presentation-layer (label/chart) fixes.

### Verification Results (2026-09-05)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 546/546 (3 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1435/1435 (1 new) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 37 migrations, unchanged |
| Live smoke check | ✓ Contract List, Dashboard, Schedule, a contract detail route, and the API's dashboard/schedule-overview endpoints all responded cleanly (redirects/401s, no crash) on the restarted dev server |
| Live authenticated visual confirmation (scenarios A–G) | **Not run** — same carried-over credential blocker as every unit since CM-62 |

### Unsupported/Deferred Items

- Live authenticated visual confirmation that the dashboard now shows zero/correct values after cancelling the two demo contracts — credential blocker, carried over.
- Real-time/websocket dashboard updates — explicitly out of scope per this unit's own instruction; revalidation-on-redirect/refresh remains the mechanism, as instructed.

### Next Recommended Unit

Resolve the carried-over credential blocker so a live authenticated pass can finally confirm the dashboard reads 0/— across every working KPI once both demo contracts are cancelled, closing out the full CM-69A→H chain end-to-end. Separately, CM-69G's discovered ~98-file `danger`-vs-`error` token mismatch remains the highest-value outstanding cleanup item in this codebase.

## CM-69G — Actually Fix Missing Remove Draft / Cancel Contract Submit Button (Completed 2026-09-05)

### Summary

CM-69F's fix (narrowing the submit button's `disabled` condition) was real and necessary, but not sufficient — the user's fresh screenshot proved the submit button was still invisible. Re-audited the ACTUAL rendered JSX (not assumed from prior reports) and found the true, final root cause: every "danger" button/text in this component used the Tailwind classes `bg-danger`/`text-danger`/`border-danger`/`bg-danger-light` — but this app's real Tailwind v4 theme (`apps/web/src/app/globals.css`'s `@theme` block) defines `--color-error`, never `--color-danger`. `danger` was never a real design token. Those classes silently generated **zero CSS** (Tailwind v4 only emits a utility for a `--color-*` variable that actually exists), so the submit button rendered as white text (`text-white`, a real Tailwind color, correctly applied) on a completely unstyled, transparent background — invisible white-on-white text sitting on the modal's white surface. Confirmed with hard, objective proof: fetched the actual compiled CSS from the running dev server and grepped it — `.bg-error`/`.text-error` rules exist; `.bg-danger`/`.text-danger` do not exist anywhere in the compiled output, zero matches.

### Actual Root Cause (from current code, not assumption)

`contract-cancel-action.tsx`'s submit button className included `bg-danger ... hover:bg-danger/90` — an invalid token. Every prior CM-69 unit's report describing this button as "present but dimmed" (CM-69F) was correct about the DOM structure but had not yet traced the color-token layer; CM-69G is the unit that actually found and fixed the true final cause.

### Files Changed

Four files, all in the same contract-lifecycle-actions family, every `danger`→`error` swap purely a Tailwind class-name correction (zero logic, zero markup-structure change):
- `contract-cancel-action.tsx` — trigger button, error banner, Reason asterisk, submit button (4 occurrences).
- `contract-detail-actions-menu.tsx` — Cancel + Terminate menu-item text color, Termination-reason asterisk, Terminate's submit button, the shared "Action failed" dialog heading (5 occurrences).
- `contract-transitions.tsx` — Terminate's `<summary>` trigger, Termination-reason asterisk, "Confirm Termination" submit button (3 occurrences) — this is the Overview page's OWN, original Terminate control, which had the identical invisible-button defect this whole time, discovered as a direct consequence of this unit's investigation.
- `contract-row-actions.tsx` — the Contract List row menu's shared "Action failed" dialog heading (1 occurrence).

### Backend Changed — No

Zero backend files touched. No migration. This was purely a frontend CSS class-name bug.

### Exact Modal Footer JSX Behavior (manual verification note, per this unit's own requirement 7)

The footer (`contract-cancel-action.tsx`, inside `{isOpen && (...)}`) is, verbatim, as currently committed:
```
<div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
  <button type="button" onClick={closeModal} disabled={isPending}
    className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-surface-secondary disabled:opacity-50">
    Cancel
  </button>
  <button type="button" onClick={handleConfirm} disabled={isPending}
    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-error text-white hover:bg-error/90 disabled:opacity-60">
    {isPending && <Loader2 .../>}
    {isPending ? pendingLabel : label}
  </button>
</div>
```
Both buttons are unconditional siblings in the same flex row — no conditional rendering hides either one. The submit button now uses the real `bg-error`/`hover:bg-error/90` token, confirmed present in the compiled CSS (`.bg-error { ... }`, non-empty rule, via a direct `curl` of the running dev server's actual compiled stylesheet).

### DRAFT Button Visibility

Modal title "Remove Draft"; submit button text "Remove Draft" (from `label`), now rendered with a real red (`--color-error: #b42318`) background and white text — genuinely visible, not white-on-transparent.

### ACTIVE Button Visibility

Modal title "Cancel Contract"; submit button text "Cancel Contract" — same real `bg-error` styling.

### Empty Reason Validation

Unchanged from CM-69F: clicking submit with an empty reason sets `error = 'Reason is required.'`, rendered in the (now also correctly `border-error`/`bg-error-light`/`text-error` styled, genuinely visible) error banner above the Reason field. Modal stays open.

### Submit Behavior

Unchanged: `cancelContractAction(contractId, version, reason)`, `contractId`/`version` traced correct since CM-69E, reason required.

### Success Redirect Behavior

Unchanged: `router.push('/contracts')` on success (CM-69E).

### No-Delete Confirmation

No delete button, no delete script, no schema change. Purely a Tailwind class-name correction across 4 files.

### Verification Results (2026-09-05)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 543/543 (unchanged — pure CSS class-name fix) |
| `pnpm --filter @recafco/api test --run` | ✓ 1434/1434 (unchanged) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 37 migrations, unchanged |
| **Objective compiled-CSS proof** | ✓ Fetched the running dev server's actual compiled stylesheet (`/_next/static/chunks/apps_web_src_app_globals_*.css`) and grepped it: `.bg-error`/`.text-error` rules exist (non-zero matches); `.bg-danger`/`.text-danger` do not exist anywhere in the compiled output (zero matches, both before understanding the bug and structurally guaranteed after the fix, since the source no longer references `danger` at all in these 4 files) |
| Live smoke check | ✓ Contract List, a contract detail route, Dashboard, Schedule all responded cleanly on the restarted dev server |
| Live authenticated visual confirmation (scenarios A–F) | **Not run** — same carried-over credential blocker as every unit since CM-62; this unit substituted the strongest verification available without one — direct compiled-CSS inspection, which is the exact layer the bug lived in |

### Major Discovered Finding — NOT Fixed This Unit (Scope Discipline)

Searched the whole web app: **98 files** use `bg-danger`/`text-danger`/`border-danger` (a token that has never existed in this app's theme); only 61 files correctly use the real `error` token. This is a large, pre-existing, silent visual defect spanning nearly every module (Contract Management's Claims/Issues/Payments/Workflow/Closeouts/Documents/Risks/Variations pages, Factory Tasks, Incidents, Maintenance, Production, Safety & Compliance) — likely many other "invisible red button/text" instances exist across the app that have simply never been reported as clearly as this one was. Deliberately **not** touched beyond the 4 files above (all directly in the contract-lifecycle-actions family this CM-69 chain has been fixing) to keep this urgent hotfix properly scoped and low-blast-radius, per this unit's own safety framing. Recommending a dedicated future unit (a project-wide `danger`→`error` audit-and-fix pass, or adding a `--color-danger` alias to the theme pointing at the same value as `--color-error` for a lower-risk one-line fix) to close the remaining 94 files.

### Next Recommended Unit

A dedicated app-wide `danger`-token remediation unit (see finding above) — likely the single highest-value remaining fix in this whole session, given its file count and the fact it silently degrades destructive-action buttons across nearly every module. Separately, the carried-over credential blocker (open since CM-62) still prevents any live authenticated visual confirmation.

## CM-69F — Fix Missing Submit Button in Remove Draft / Cancel Contract Modal (Completed 2026-09-05)

### Summary

After CM-69E fixed the modal not opening at all, the modal now opened but appeared to show only a "Cancel" button, no submit control. Root cause: the submit button was always in the DOM, but was disabled purely because the Reason field starts empty, and a dimmed/disabled button next to a crisp, always-enabled "Cancel" button reads at a glance as if it doesn't exist. Fixed by keeping the submit button fully visible and enabled at all times except while the request is genuinely in flight, and validating the empty-reason case with a real, visible error message instead.

### Root Cause

`disabled={isPending || !reason.trim()}` on the submit button meant it was disabled (and rendered at 60% opacity) every time the modal first opened, since `reason` starts as `''`. There was no separate "missing button" bug in the JSX structure — both buttons were always siblings in the same always-rendered footer — but a permanently-dimmed button with no visible reason WHY it's disabled (no error message shown) is easy to miss entirely, especially in a screenshot, next to a fully-opaque secondary "Cancel" button beside it. Its label ("Confirm Cancellation") also never matched the modal's own title ("Remove Draft"/"Cancel Contract"), compounding the impression that the "real" submit control was missing.

### Files Changed

`contract-cancel-action.tsx` only: submit button's `disabled` condition narrowed to `isPending` alone (no longer disabled just because Reason is empty); `handleConfirm()` now checks `!reason.trim()` first and sets a real, visible `error` message ("Reason is required.") instead of silently relying on a disabled button; submit button label now reads `label` ("Remove Draft"/"Cancel Contract") instead of the generic "Confirm Cancellation", with pending text "Removing…"/"Cancelling…" (derived from `label`) instead of a single hardcoded "Cancelling…".

### Backend Changed — No

Zero backend files touched. No migration. `cancelContractAction`, `POST :id/cancel`, and `CancelContractDto` are unchanged from CM-69A — this was purely a frontend visibility/validation-UX bug.

### Submit Button Fix

The footer now always shows two clearly distinct buttons: a secondary "Cancel" (dismiss, border style, always enabled unless a request is in flight) and a primary danger-styled submit button (always visible and enabled except while the request is actually pending) — never a state where the submit button is present-but-invisible-looking with no explanation.

### DRAFT Modal Behavior

Title "Remove Draft"; submit button reads "Remove Draft" (was "Confirm Cancellation"); pending state reads "Removing…".

### ACTIVE Modal Behavior

Title "Cancel Contract"; submit button reads "Cancel Contract"; pending state reads "Cancelling…". Both labels come from the exact same `label` prop already correctly computed by `getVisibleContractTransitions().cancelLabel` (CM-69A/CM-69D, unchanged).

### Submit Behavior

Still a controlled-click pattern (`onClick`, not a native `<form>` submit) — matching every other confirm modal already built in this codebase this session (CM-68A's schedule-plan editor, CM-69D's Activate/Terminate/Close dialogs); no `<form>`/`form=` attribute was introduced, since none of those existing modals use one either and doing so here alone would be an inconsistent, unrequested pattern change. Clicking submit still calls the exact same `cancelContractAction(contractId, version, reason)`; `contractId`/`version` are unchanged, already-correct values traced through from the loaded contract in CM-69E.

### Success Redirect Behavior

Unchanged from CM-69E: `router.push('/contracts')` on success.

### No-Delete Confirmation

No delete button, no delete script, no schema change. This unit only fixed a client-side visibility/validation bug in an existing, already-safe (CM-69A) status-transition modal.

### Verification Results (2026-09-05)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 543/543 (unchanged — pure component/UX change, no new pure-logic function; same disclosed test-infrastructure limitation as CM-69E, see that unit's tracker entry) |
| `pnpm --filter @recafco/api test --run` | ✓ 1434/1434 (unchanged) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 37 migrations, unchanged |
| Live smoke check | ✓ Contract List + a contract detail route + Dashboard + Schedule all responded cleanly on the restarted dev server |
| Live authenticated click-through (scenarios A–F) | **Not run** — same carried-over credential blocker as every unit since CM-62 |

### Unsupported/Deferred Items

- Live authenticated visual confirmation that the submit button is now clearly visible/clickable — credential blocker, carried over.
- Automated component-level interaction tests remain out of scope for the same reason disclosed in CM-69E's tracker entry (no component-testing infrastructure in this repo's web vitest config).

### Next Recommended Unit

Resolve the carried-over credential blocker so a live authenticated pass can finally click Remove Draft → type a reason → submit → confirm the redirect and disappearance from the Contract List, closing out this whole CM-69A→F chain end-to-end.

## CM-69E — Fix Remove Draft / Cancel Contract Action Not Working (Completed 2026-09-05)

### Summary

CM-69D's new "Remove Draft"/"Cancel Contract" dropdown menu item was visible but clicking it did nothing. Root cause: a React unmount-before-render race, not a backend or permission bug. Fixed by lifting the cancel modal's open/close state up into the parent dropdown component and rendering the modal as an always-mounted sibling instead of a child of the menu that closes itself on the same click.

### Files Audited

`contract-detail-actions-menu.tsx` (found the bug: the Cancel menu item's `onClick` called `closeMenu()` — which sets `menuOpen = false` — and `ContractCancelAction`'s own `open()` in the same handler; `<ContractCancelAction>` was rendered *inside* `{menuOpen && (...)}`, so the very re-render that should have shown the modal instead unmounted the component holding that modal's state), `contract-cancel-action.tsx` (confirmed its `open` state was purely internal/uncontrolled — no way for a parent to keep it alive across the parent's own re-render), `cancelContractAction` server action (confirmed unchanged/correct — takes `(id, version, reason)`, already used correctly), `contracts-api.ts` (no `cancel` client method exists directly — `cancelContractAction` calls `actionFetch('/contracts/:id/cancel', 'POST', {...})` directly, confirmed unchanged and correct), backend `POST /contracts/:id/cancel` and `CancelContractDto` (`reason`/`version` validation — confirmed unchanged, correct, and never the problem; this was purely a frontend component-lifecycle bug), `contract-transitions.tsx` (confirmed its own, unrelated `ContractCancelAction` usage on the Overview page was never broken — it doesn't sit inside any conditionally-unmounted parent, which is exactly why only the NEW dropdown surface exhibited the bug).

### Root Cause

`ContractCancelAction` managed its cancel-modal's open/closed state internally (`useState`) and was designed to be a single, self-contained trigger+modal unit. CM-69D reused it correctly on the Overview page (unaffected) but, for the new dropdown, rendered the `<ContractCancelAction>` instance as a JSX child *inside* `{menuOpen && (...)}` and told it to open itself (`open()`) from a click handler that ALSO closed the menu (`closeMenu()`) in the same event. React processes both state updates before the next render; on that render, `menuOpen` is now `false`, so the entire block containing `<ContractCancelAction>` — the component instance that had just been told to open its modal — gets unmounted, destroying its internal `open` state before it could ever paint the modal. Nothing was wrong with the server action, the DTO, the backend endpoint, or version handling — the request never even left the browser.

### Files Changed

`contract-cancel-action.tsx`: added optional controlled-mode props `open`/`onOpenChange` (when both supplied, the modal's visibility is driven by the parent instead of internal state — every other call site, unchanged, keeps working exactly as before); modal title now reads the real `label` prop (was hardcoded "Cancel Contract" even for a DRAFT "Remove Draft" flow); on success now redirects to `/contracts` (`router.push`) instead of only `router.refresh()`, per this unit's explicit "preferred success behavior". `contract-detail-actions-menu.tsx`: added `isCancelOpen` state owned by the menu component itself; the Cancel menu item is now a plain button that sets `isCancelOpen = true` directly (no longer routes through `ContractCancelAction`'s own trigger); the real `<ContractCancelAction>` instance is now rendered once, as a sibling of the menu (always mounted, `open={isCancelOpen}`/`onOpenChange={setIsCancelOpen}`, `renderTrigger={() => null}` to suppress its own default button). `contract-ui-helpers.test.ts`: +1 test confirming `getVisibleContractTransitions('CANCELLED', ...)` still correctly returns `cancel: false` (closing a real, if narrow, coverage gap — this status wasn't explicitly tested before, only inferred).

### Backend Changed — No

Zero backend files touched. No migration — none was needed or added. `POST /contracts/:id/cancel`, `CancelContractDto`, and `ContractsService.cancel()` are byte-for-byte unchanged from CM-69A.

### Dropdown Click Fix

Clicking "Remove Draft"/"Cancel Contract" now correctly opens the real modal every time, regardless of the menu closing in the same click — verified by tracing the exact render sequence (menu-close and modal-open state updates now live in two independent pieces of state, one of which — `isCancelOpen` — is never itself inside a block that unmounts on the very update that's supposed to show it).

### Cancel Modal Behavior

Title now correctly shows "Remove Draft" for a DRAFT contract and "Cancel Contract" for ACTIVE (was always "Cancel Contract" before this fix). Reason remains required (`disabled={isPending || !reason.trim()}` on the confirm button, unchanged); placeholder already read "e.g. Created for UAT testing" from CM-69A, confirmed still correct.

### Version Handling

Confirmed already correct, no bug found: `version` flows from the real, loaded `contract.version` (`contractsApi.get(id)` in `layout.tsx`) → `ContractDetailActionsMenu` prop → `ContractCancelAction` prop → `cancelContractAction(contractId, version, reason)`. Never undefined/null in the real flow (only a hardcoded literal in a test could produce that).

### Error Handling

Unchanged and already correct: on a failed cancel, `result.error` is set into local `error` state and rendered inside the still-open modal (`{error && <div className="...text-danger">{error}</div>}`) — the modal never closes on failure, matching this unit's explicit requirement. No change was needed here since this path was never affected by the unmount bug (the request never even fired before the fix, so there was nothing to show an error for).

### Success Redirect/Refresh Behavior

Changed from `router.refresh()` (stay on the now-cancelled contract's own detail page) to `router.push('/contracts')` — the explicitly preferred behavior, since the whole point of this action is to remove a wrongly-created contract from the active list; the user now lands back on the Contract List, which (per CM-69C) already excludes CANCELLED contracts by default, so the just-cancelled contract is immediately confirmed gone from view.

### No-Delete Confirmation

No delete button, no delete script, no schema change. This unit only fixed a React state-lifecycle bug in an existing, already-safe (CM-69A) status-transition flow — nothing about hard deletion was touched or introduced.

### DRAFT "Remove Draft" Verification

Code-path traced end-to-end: `getVisibleContractTransitions('DRAFT', permissions).cancelLabel === 'Remove Draft'` (existing, tested CM-69A logic, unchanged) → dropdown shows "Remove Draft" → click now correctly opens the modal titled "Remove Draft" → submit calls `cancelContractAction(id, version, reason)` → `POST :id/cancel` → `DRAFT → CANCELLED`.

### ACTIVE "Cancel Contract" Verification

Same code path, `cancelLabel === 'Cancel Contract'` for ACTIVE — modal now correctly titled "Cancel Contract", same fix applies identically since both labels flow through the same `label` prop.

### CANCELLED Regression

`getVisibleContractTransitions('CANCELLED', ...)` still returns `cancel: false, cancelLabel: null` (existing CM-69A behavior, now with an explicit test added) — the Cancel menu item does not render at all for an already-cancelled contract; the whole dropdown is disabled if that was the only available action.

### Other Lifecycle Action Regression

Activate, Terminate, and Request Closeout/Close Contract in this same dropdown were never affected by the bug (their dialogs are siblings of the menu, not nested inside it) — confirmed unchanged in this unit's diff; `ContractTransitions`' own Activate/Terminate on the Overview page and `ContractClosureAction`'s own Close flow are completely untouched files.

### Verification Results (2026-09-05)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 543/543 (1 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1434/1434 (unchanged — zero backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 37 migrations, unchanged |
| Live smoke check | ✓ Contract List/Dashboard/Schedule/Payments/Workflow/Closeouts + a contract detail route + the cancel endpoint all responded cleanly (redirects/401s, no crash) on the restarted dev server |
| Live authenticated click-through (scenarios A–F) | **Not run** — same carried-over credential blocker as every unit since CM-62 |

### Unsupported/Deferred Items

- Automated component/interaction tests for "clicking Remove Draft opens the modal", "successful cancel redirects", "failed cancel shows error", etc. were **not added**: audited first and confirmed this repo's web test setup (`vitest.config.ts`: `include: ['src/**/*.test.ts']`, `environment: 'node'`, no `@testing-library/react`, no jsdom/happy-dom dependency) supports pure-function `.test.ts` files only — there are zero `.test.tsx` component tests anywhere in this codebase today, and `.tsx` files aren't even picked up by the configured test glob. Building a first-ever component-testing stack (installing testing-library, adding a jsdom environment, writing the first `.test.tsx` in the repo) is real new test infrastructure, not a "add/adjust tests" fix, and was judged disproportionate scope for this hotfix — flagged here rather than silently skipped or fabricated. What COULD be honestly covered without that infrastructure was added (the missing `CANCELLED → cancel:false` pure-function case). The actual bug fix itself was verified by exact code-path/render-sequence tracing, not by a passing automated test.
- Live authenticated visual click-through of the fixed dropdown — same carried-over credential blocker as every unit since CM-62.

### Next Recommended Unit

If reliable component-level interaction testing for this contract-actions surface becomes a priority, a dedicated unit to introduce `@testing-library/react` + jsdom/happy-dom into `apps/web`'s vitest config would need to precede it (real new infrastructure, its own review). Otherwise: resolve the carried-over credential blocker so a live authenticated pass can finally click through Remove Draft/Cancel Contract end-to-end.

## CM-69D — Enable Contract Detail Actions Dropdown for Available Lifecycle Actions (Completed 2026-09-05)

### Summary

The Contract Detail workspace's top-right "Actions ▾" button (rendered in `[id]/(workspace)/layout.tsx`, above every tab) was never actually implemented — it was a permanently `disabled` static stub since it was first added, with the title "Additional actions are planned for a future unit". Replaced it with a real, working dropdown menu (`ContractDetailActionsMenu`) that's enabled whenever the current actor has at least one real, permission-and-status-gated lifecycle action available, reusing the exact same pure decision functions (`getVisibleContractTransitions`, `getClosureAction`) and server actions the Overview page's Contract Summary card and the Contract List row menu already use — no new backend logic, no new permission check invented.

### Files Audited

`[id]/(workspace)/layout.tsx` (found the disabled stub — confirmed it was NEVER wired to any real logic, not a computed-disabled-state bug), `contract-transitions.tsx` (Activate/Terminate — confirmed unchanged, still renders on the Overview page's Contract Summary card exactly as before), `contract-cancel-action.tsx` (CM-69A's Cancel modal — confirmed self-contained with its own trigger button, needed a small opt-in refactor to be reusable from a second trigger surface), `contract-closure-action.tsx`/`getClosureAction` (Request Closeout / Close Contract — confirmed this data, unlike status/permissions, was NOT already available at the layout level; only the Overview page's `page.tsx` fetches `listCloseoutRequests`), `contract-row-actions.tsx` (Contract List's own "···" menu — reused its exact "Activate Contract?" confirm-dialog copy and menu/overlay markup pattern for consistency), `contract-ui-helpers.ts` (`getVisibleContractTransitions`/`getClosureAction` — confirmed both already correctly return "no action" for CANCELLED and "nothing more" for CLOSED, and correctly still allow a Close-related action for TERMINATED when a closeout request is in flight — none of this needed changing).

### Files Changed

New `_components/contract-detail-actions-menu.tsx` (the real dropdown). `_components/contract-cancel-action.tsx` — added an optional `renderTrigger` prop so the exact same CM-69A modal can be opened from a second surface (the new dropdown) without a second modal implementation; every existing call site (`contract-transitions.tsx`, unchanged) omits it and renders identically to before. `[id]/(workspace)/layout.tsx` — added `contractsApi.listCloseoutRequests(id)` to its existing `Promise.allSettled` fetch, computed `latestCloseoutRequest`, and swapped the disabled stub button for `<ContractDetailActionsMenu>`.

### Backend Changed — No

Zero backend files touched. No migration. Every server action called (`activateContractAction`, `terminateContractAction`, `cancelContractAction` via `ContractCancelAction`, `closeContractFromCloseoutAction`) is reused completely unchanged.

### Why Actions Was Disabled

Not a logic bug — it was simply never built. The button had `disabled` hardcoded and a title reading "Additional actions are planned for a future unit," with no menu, no state, no data behind it at all.

### Enabled Dropdown Behavior

`hasAnyAction = visible.activate || visible.cancel || visible.terminate || closure.showRequestCloseout || closure.showCloseContract` (all four computed from the same real, unchanged pure functions). True → real, clickable "Actions ▾" trigger opening a menu. False → the trigger stays disabled, now with an accurate title ("No lifecycle actions are currently available for this contract") instead of the old placeholder copy.

### Draft Contract Actions

DRAFT (with `contracts.activate` + `contracts.update`/`contracts.manage`): menu shows "Activate Contract" (opens the same confirm-dialog copy as the List row's Activate) and "Cancel Contract" → label per `getVisibleContractTransitions().cancelLabel` (which reads "Remove Draft" for DRAFT — see below) — opens the real CM-69A reason-required modal via `ContractCancelAction`'s new `renderTrigger`.

### Active Contract Actions

ACTIVE: menu shows "Cancel Contract" (own reason modal, reusing the same component) and, only when the actor holds `contracts.terminate`, "Terminate Contract" (a new lightweight reason modal that calls the existing, unchanged `terminateContractAction` via a synthesized `FormData` — the action itself, its DTO, and its backend are all untouched). "Request Closeout" (a plain navigation link, non-destructive, matches `ContractClosureAction`'s own existing Link-only behavior) and "Close Contract" (only once a request is APPROVED — reuses `closeContractFromCloseoutAction` unchanged, now behind a confirm dialog since firing it directly from a menu click would violate this unit's own "no destructive action fires immediately from a menu click" rule; the existing Overview-card button still fires it directly, unchanged, since that surface isn't in this unit's scope).

### Cancel Modal Behavior

Identical modal, identical copy, identical validation (`reason` required, `maxLength={1000}`), identical backend call (`cancelContractAction` → `POST :id/cancel`) — reached from either the Overview page's Contract Summary card (`ContractTransitions`, unchanged) or the new top-right dropdown (`ContractDetailActionsMenu`), both rendering the SAME `ContractCancelAction` component instance logic via its `renderTrigger` prop. No hard delete, no related-record deletion — unchanged from CM-69A.

### Permission/Status Behavior

Nothing bypassed: `getVisibleContractTransitions`/`getClosureAction` are the exact same pure, permission-and-status-driven functions already covering the List row menu and the Overview card — a staff/no-permission actor sees `hasAnyAction === false` (disabled dropdown) exactly as before, and the backend independently re-checks every permission/department-scope condition regardless of what the menu renders (`@AnyPermission`/`@Permissions` decorators + `assertCanAccessDepartment`, all untouched). CANCELLED contracts: every one of activate/cancel/terminate/showRequestCloseout/showCloseContract is false → dropdown disabled, matching the task's own required behavior with zero new code (this fell out for free from CM-69A's existing status-gating). CLOSED: same, disabled. TERMINATED: activate/cancel/terminate correctly stay false, but Request Closeout/Close Contract can still be true if a real closeout request is in flight — existing, unchanged `getClosureAction` behavior, correctly surfaced now that the layout has the data to show it.

### No-Delete Confirmation

No delete button, no delete script added. This unit only adds a new UI trigger surface for existing, already-safe lifecycle transitions (activate/cancel/terminate/close) — none of which delete a contract or any related record.

### Regression Results

API: 1434/1434 (unchanged — zero backend files touched). Web: 542/542 (unchanged — no pure-logic file touched, only components/props). `pnpm lint` and both typechecks clean. `pnpm build` 8/8 tasks. `pnpm db:migrate:status` 37 migrations, unchanged. Dev server restarted (only the two identified API/web PIDs stopped); Contract List, Dashboard, Schedule, Payments, Workflow, Closeouts, and a contract detail route all returned clean redirects/401s with no crash.

### Verification Results (2026-09-05)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 542/542 |
| `pnpm --filter @recafco/api test --run` | ✓ 1434/1434 |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 37 migrations, unchanged |
| Live smoke check | ✓ Contract List/Dashboard/Schedule/Payments/Workflow/Closeouts + a contract detail route all returned clean redirects/401s on the restarted dev server |
| Live authenticated visual verification of the dropdown (scenarios A–F) | **Not run** — same carried-over credential blocker as every unit since CM-62; the code paths were verified by direct audit of `getVisibleContractTransitions`/`getClosureAction`'s existing, already-tested behavior for every status this unit covers |

### Unsupported/Deferred Items

- Live authenticated visual verification of the new dropdown across DRAFT/ACTIVE/CANCELLED/CLOSED/TERMINATED — credential blocker, carried over.
- The layout now fetches `listCloseoutRequests` on every workspace tab (previously only the Overview tab did) — a deliberate, disclosed small cost addition required to correctly show Request Closeout/Close Contract from any tab, not just Overview.

### Next Recommended Unit

Resolve the carried-over credential blocker so a live authenticated pass can finally visually confirm this dropdown (and the backlog of prior "not run" items) across every real contract status in a real browser session.

## CM-69C — Hide Cancelled/Test Contracts from Contract List by Default (Completed 2026-09-05)

### Summary

After CM-69A added the safe Cancel Contract flow, CANCELLED contracts still appeared in the default Contract List (there was no default status filter at all, and no lifecycle-status dropdown existed in the UI to explicitly filter them out or in). Fixed with a backend query-default change plus a new "Lifecycle Status" filter dropdown, so a fresh page load excludes CANCELLED while explicit "Cancelled" or "All Statuses" selections still surface them for audit. No migration — confirmed unnecessary during audit, since the existing `lifecycleStatus`/`status` query params were already fully plumbed end-to-end from CM-69A, just never exposed as a user-facing dropdown and never defaulted to excluding CANCELLED.

### Files Audited

`contracts.service.ts` (`buildListWhere()`, confirmed the true default — neither `status` nor `lifecycleStatus` supplied — set no status filter at all, meaning CANCELLED rows returned unconditionally), `dto/contract-list-query.dto.ts` (`STORED_STATUSES`/`DERIVED_STATUSES` `IsIn` arrays), `contracts/page.tsx` (confirmed `lifecycleFilter` was already read and passed to `contractsApi.list()`/`buildHref()` for the Dashboard's existing deep-links, e.g. `/contracts?lifecycleStatus=ACTIVE`, but never exposed as a dropdown of its own), `contract-filter-bar.tsx` (confirmed its one visible "Contract Status" dropdown is actually the manager-facing **schedule** status — `scheduleStatus` — completely unrelated to lifecycle/CANCELLED; there was genuinely no lifecycle-status filter UI anywhere on this page before this unit), `contract-schedule-overview.service.ts`/`contract-schedule.service.ts` (confirmed both already exclude CANCELLED from CM-69B... i.e. CM-69A — verified still correct, untouched), `contracts.service.ts`'s `getSummary()`/`getDashboard()` (confirmed `totalActive` already strictly whitelists `ACTIVE`, unaffected by this unit).

### Files Changed

Backend: `contracts.service.ts` (`buildListWhere()` — new default-excludes-CANCELLED branch + explicit `'ALL'` bypass), `dto/contract-list-query.dto.ts` (`'ALL'` added to both `IsIn` arrays), `contracts.service.test.ts` (+7 new/updated tests). Frontend: `contract-ui-helpers.ts` (new `LIFECYCLE_STATUS_FILTER_OPTIONS`), `contract-filter-bar.tsx` (new "Lifecycle Status" dropdown, distinct from the existing "Contract Status" schedule-status dropdown), `contracts/page.tsx` (wires `lifecycleFilter` into the new dropdown prop — it was already being read/sent to the API for deep-links).

### Backend Changed — Yes (query-default only, no schema/migration)

`buildListWhere()`: when neither `status` nor `lifecycleStatus` is supplied at all (a fresh page load), the where clause now defaults to `{ status: { not: 'CANCELLED' } }` instead of no status filter. An explicit `lifecycleStatus=ALL` or `status=ALL` bypasses this (and every other status branch) entirely, returning every real status including CANCELLED. Every previously-tested explicit value (`ACTIVE`/`DRAFT`/`EXPIRING`/`EXPIRED`/`TERMINATED`/`CLOSED`/`CANCELLED`) is unchanged.

### Migration — None

Confirmed unnecessary during audit: no schema change, purely a query-construction default plus one new accepted DTO value (`'ALL'`). `pnpm db:migrate:status` still reports 37 migrations, unchanged.

### Default List Behavior

A fresh `/contracts` load (or any request with no `status`/`lifecycleStatus` param) now excludes CANCELLED contracts automatically — DRAFT/ACTIVE/TERMINATED/CLOSED all still show exactly as before this unit. No demo/test contract that gets cancelled through the app will appear in the normal working view again.

### Cancelled Filter Behavior

New "Lifecycle Status" dropdown on the Contract List filter bar (distinct label from the pre-existing "Contract Status" schedule-status dropdown, to avoid confusing the two): blank default = the new normal working view (CANCELLED hidden); "Cancelled" = only CANCELLED contracts, for audit; "All Statuses (Include Cancelled)" = every real status, CANCELLED included; Active/Draft/Expiring/Expired/Terminated/Closed all behave exactly as their pre-existing `lifecycleStatus` values already did (unchanged, since CM-55's original Dashboard deep-links use these same values).

### Search Behavior

Unaffected/unchanged mechanism — `search` combines into `where['AND']`, completely independent of `where['status']`, so the new default exclusion applies identically whether or not a search term is present: searching for a cancelled test contract's name/reference will not surface it unless the Lifecycle Status filter is explicitly set to "Cancelled" or "All Statuses".

### Dashboard/Schedule Impact — Confirmed Unchanged

`getDashboard()`/`getSummary()`'s `totalActive` already strictly whitelists `status === ACTIVE` (untouched, no change needed). The global Schedule Overview and the old per-item Schedule register already exclude CANCELLED contracts entirely from their own contract fetch (CM-69A) — confirmed still correct, not touched by this unit.

### No-Delete Confirmation

No delete button, no delete script, no `DELETE`/`.delete()` call added anywhere. CONTRACT-2026-000008 and CONTRACT-2026-000001 were **not** hard-deleted, truncated, or reset by this unit — they remain in the database with full history; per the user's own choice, they will be cancelled through the real app's Cancel Contract flow (CM-69A) rather than by the agent, since this dev environment's working login credentials belong to the user's own real accounts (no synthetic UAT test-user credentials exist here to safely use instead).

### Regression Results

API: 1434/1434 (7 new/updated). Web: 542/542 (unchanged — new dropdown wiring is prop-plumbing only, no new pure-function logic to test beyond the DTO/service-level `buildListWhere` coverage). `pnpm lint` and both typechecks clean. `pnpm build` 8/8 tasks. `pnpm db:migrate:status` 37 migrations, unchanged. Dev server restarted (only the two identified API/web PIDs stopped); `/contracts` (plus `?lifecycleStatus=ALL`/`CANCELLED` variants) and 5 sibling pages all returned clean 307s; the API's `/contracts` (default, `ALL`, `CANCELLED`) and `/contracts/schedule/overview` all returned clean 401s, confirming no crash from the new branch.

### Verification Results (2026-09-05)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 542/542 |
| `pnpm --filter @recafco/api test --run` | ✓ 1434/1434 (7 new) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 37 migrations, unchanged |
| Live smoke check | ✓ web + API routes (default/ALL/CANCELLED variants) all returned clean redirects/401s on the restarted dev server |
| Live cancellation of CONTRACT-2026-000008 / CONTRACT-2026-000001 | **Deferred to the user** — no working dev-environment login credentials available to the agent (only the user's own real accounts exist); the user chose to perform this themselves via the app's Cancel Contract flow rather than share credentials or have the agent bypass the app with a direct DB update |

### Unsupported/Deferred Items

- The actual cancellation of CONTRACT-2026-000008 and CONTRACT-2026-000001 — by the user's own explicit choice this unit, not an agent oversight.
- Live authenticated UAT walkthrough of the resulting filtered list — same carried-over credential blocker as every unit since CM-62, compounded this unit by the dev DB having been reset to the user's own real accounts (noted earlier in this same tracker) rather than the synthetic UAT seed users.

### Next Recommended Unit

Once the user cancels the two named test contracts through the app, a quick visual confirmation (screenshot or the user's own report) that they've vanished from the default `/contracts` view would close this unit's loop; beyond that, resolving the credential blocker remains the standing recommendation.

## CM-69B — Contract List Full View Table Action Column Polish (Completed 2026-09-05)

### Summary

Pure CSS/layout fix for the Contract List table's Action column, which was too narrow and cramped Open/More-menu together in Full View. Audited the row-action logic first and confirmed it was already correct (CM-55D had already moved Activate into the "More" menu, and CM-69A's cancellable-status fallback already keeps CANCELLED rows Activate-free) — this unit changed only Tailwind classes in `contract-list-table.tsx`, nothing else.

### Files Audited

`contracts/page.tsx` (confirmed no page-level vertical-scroll wrapper around the table — page-level scroll was already the real behavior), `contract-list-table.tsx` (Full/Simple View toggle, sticky-column constants, all column cell classes), `contract-row-actions.tsx` (Open + More menu — confirmed Activate is already menu-only, not an inline button, since CM-55D), `computeContractRowActionPlan` (confirmed CANCELLED already falls into the same never-shows-Activate fallback branch as TERMINATED, from CM-69A), `contract-schedule-status-select.tsx` (confirmed the table's "Status" column is the manager-facing schedule-status dropdown, unrelated to lifecycle CANCELLED — no lifecycle badge is rendered in this table at all, so there was nothing to fix there).

### Files Changed

`apps/web/src/app/(protected)/contracts/_components/contract-list-table.tsx` only — `STICKY_RIGHT_CLS`/`STICKY_RIGHT_HEADER_CLS` widened to `min-w-[200px]` (within the requested 180-220px band) with a left-edge shadow added to the body cell, plus explicit `whitespace-nowrap` added to the Progress %/Payment Progress % cells (Contract No./Value/Status/Action already had it).

### Backend Changed — No

Zero backend files touched. No migration.

### Action Column Fix

Both the Action `<th>` and `<td>` now reserve `min-w-[200px]`, matching the same "reserved so it never gets squeezed" precedent CM-55D already established for the Contract ID column (`min-w-40`). Open + the "···" trigger now always have enough room regardless of what other columns are showing/hiding across Full/Simple View or viewport width.

### Sticky Column Behavior

Unchanged mechanism (`sticky right-0 z-10`, opaque `bg-surface`/`bg-nav`, `border-l border-border`) — widened, plus a subtle left-edge box-shadow (`shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.15)]`) added to the body cell only (the header's already-opaque dark `bg-nav` doesn't need it) so scrolled content reads as clearly passing beneath a fixed column, not just bordered.

### Action Menu Behavior — Unchanged

Deliberately did not add Cancel/Terminate/Close into the row-level "More" menu, despite the task's own "Recommended final action behavior" describing them there: those three all require a reason (and Cancel/Terminate also a confirmation dialog) via mechanisms that currently live only on the Contract Detail page (`ContractCancelAction`, `ContractTransitions`) — building an equivalent mini-modal into a table row's dropdown would be a real new feature, not a placement change, and would conflict with this unit's own explicit "do not change activate/cancel/terminate/open actions" and "do not invent actions" safety rules. Row-level More menu still shows exactly what it did before: Activate (when applicable, via its existing confirm dialog) plus real navigational shortcuts (Workflow/Payments/Issues/Claims/Schedule/Closeout).

### Scrollbar Behavior

No nested vertical-scroll container exists in this table today (confirmed via audit) — page-level scroll was already the real behavior, nothing to remove. Horizontal scroll (`overflow-x-auto` on the table wrapper) is unchanged and remains acceptable per the task's own rule; the widened, shadowed sticky Action column is the fix for "actions becoming unreadable" while that horizontal scroll happens.

### Full View Behavior

Action column now reads cleanly at every viewport width tested via build/typecheck; Progress %/Payment Progress % cells no longer risk wrapping.

### Simple View Regression

None — Simple View shares the exact same Action/Status/Contract ID columns and sticky-class constants (they render outside the `full &&` conditionals), so it gets the same width fix "for free" with zero change to which columns show or the toggle's own logic.

### Action Regression

None — no action/permission/status logic touched. Open still navigates via the same `<Link>`; Activate still calls the same `activateContractAction` through the same confirm dialog; department scope/permissions checks in `computeContractRowActionPlan` are byte-for-byte unchanged.

### Verification Results (2026-09-05)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 542/542 (unchanged — pure CSS, no logic) |
| `pnpm --filter @recafco/api test --run` | ✓ 1429/1429 (unchanged) |
| `pnpm build` | ✓ 8/8 tasks (only `@recafco/web` rebuilt) |
| `pnpm db:migrate:status` | ✓ 37 migrations, unchanged |
| Live smoke check | ✓ `/contracts` + 6 sibling routes all returned clean 307 redirects on the already-running dev server (hot-reloaded) |

### Unsupported/Deferred Items

- Live authenticated visual verification of the actual cramped-column screenshot fix — same carried-over credential blocker as every unit since CM-62.
- Cancel/Terminate/Close were not added to the row-level More menu — see "Action Menu Behavior" above for the deliberate reasoning; a future unit could build a proper reason-collecting row-level action if that's genuinely wanted, but that is a new capability, not this unit's "placement only" scope.

### Next Recommended Unit

Resolve the carried-over UAT test-user credential blocker so a live authenticated pass can finally visually confirm this fix (and the growing backlog of prior "not run" items) in a real browser session.

## CM-69A — Safe Remove / Cancel Test Contract Flow (Completed 2026-09-05)

### Summary

Added a safe Cancel/Void flow so a manager/admin can remove a wrongly created draft or mistakenly activated test contract from active views — without ever hard-deleting a contract or any related record. Audited first and confirmed the safest design was a NEW `CANCELLED` status (not a reuse of the existing `TERMINATED` status, which already carries real closeout-eligibility semantics a voided test contract must never inherit) plus a `cancel()` service method mirroring the existing, already-tested `terminate()` pattern almost exactly.

### Files Audited

`packages/database/prisma/schema.prisma` (`ContractStatus` enum, `Contract` model's terminate/close audit fields), `contracts.service.ts` (`terminate()`, `close()`, `getSummary()`, `getDashboard()`, `buildListWhere()`, `findOneOrThrow()`), `contracts.controller.ts` (route decorators/ordering, `@AnyPermission`), `contract-schedule-overview.service.ts` and `contract-schedule.service.ts` (both fetch ALL contracts with no status filter — confirmed a cancelled contract would otherwise still appear as a schedule row), `contract-dashboard.service.ts` (confirmed its manager-insights queries have no contract-status filter of their own — a pre-existing characteristic already equally true for TERMINATED/CLOSED contracts today, left as-is rather than fixed as an out-of-scope side quest), `contract-transitions.tsx`/`contract-ui-helpers.ts` (the real "Available Actions" area — there is no literal dropdown component on the contract detail page; Activate/Terminate/Close render inline in the Contract Summary header, and Cancel/Remove Draft was added there), `computeContractRowActionPlan` (Contract List row's real More-actions menu), `contract-lifecycle-badge.tsx`, dashboard KPI/segment helpers (`dashboard-insights-helpers.ts`, `contract-kpi-grid.tsx`, `contract-summary-cards.tsx`), every `IsIn`-validated contract-status DTO array.

### Files Changed

Schema/migration: `schema.prisma`, new migration `20260905000000_add_contract_cancelled_status`. Backend: `contracts.service.ts` (new `cancel()` method + `getDerivedLifecycleStatus`/`getSummary`/`getDashboard`/`buildListWhere`/`CONTRACT_SELECT` updates), new `dto/cancel-contract.dto.ts`, `contracts.controller.ts` (new `POST :id/cancel` route), `contract-schedule-overview.service.ts` and `contract-schedule.service.ts` (exclude CANCELLED from their all-contracts fetch), `dto/contract-list-query.dto.ts`, `dto/contract-workflow-list-query.dto.ts`, `dto/contract-workflow-assignment-queue-query.dto.ts` (CANCELLED added to `IsIn` arrays). Tests: `contracts.service.test.ts` (+14 cancel tests, updated getSummary/getDashboard count expectations), `contract-schedule.service.test.ts` (updated 2 `buildScheduleContractWhere` expectations), `contract-dashboard.service.test.ts` (mock fixture field). Frontend: `contracts-api.ts` (types + `cancelContract`-shaped fields), `actions.ts` (new `cancelContractAction`), new `_components/contract-cancel-action.tsx` (client modal), `contract-transitions.tsx` (wires it in), `contract-ui-helpers.ts` (+`cancel`/`cancelLabel` on `getVisibleContractTransitions`, updated `hasAnyVisibleTransition`, updated fallback-branch comment), `contract-lifecycle-badge.tsx`, `dashboard-insights-helpers.ts`, `contract-kpi-grid.tsx`, `contract-summary-cards.tsx` (all `totalCancelled` plumbing). Tests: `contract-ui-helpers.test.ts` (+7 cases), `dashboard-insights-helpers.test.ts` (fixture field).

### Backend Changed — Yes

New `ContractsService.cancel()`, new `POST /contracts/:id/cancel` (`@AnyPermission('contracts.update', 'contracts.manage')`), explicit `assertCanAccessDepartment` check (unlike `activate()`/`terminate()`, which rely on permission alone — added here deliberately since Cancel is meant to be reachable by ordinary department-scoped managers). Real DRAFT|ACTIVE → CANCELLED transition only; TERMINATED/CLOSED/already-CANCELLED are rejected with `CONTRACT_NOT_CANCELLABLE` (409).

### Migration — Additive only

`20260905000000_add_contract_cancelled_status`: `ALTER TYPE "contract_status" ADD VALUE 'CANCELLED'` + 3 new nullable `contracts` columns (`cancellation_reason`, `cancelled_at`, `cancelled_by_user_id`) + 1 FK (`ON DELETE SET NULL`). No table drops, no data migration, no column removal. Applied cleanly via `prisma migrate deploy` (37 migrations total, confirmed up to date).

### Cancellation Behavior

DRAFT or ACTIVE only. Requires a real `reason` (max 1000 chars) and the current `version` (optimistic concurrency, same 409 conflict handling as `terminate()`). On success: `status → CANCELLED`, `cancelledAt`/`cancelledByUserId`/`cancellationReason` set, a `contractActivity` row (`event: 'cancelled'`) and a `securityAuditEvent` (`CONTRACT_CANCELLED`) are written — same dual-audit pattern as terminate. No related record (BOQ, workflow tasks, payments, documents, issues, claims, risks, schedule items, closeout requests, attachments) is ever touched — every one of those relations already carries `onDelete: Restrict`, so a real hard delete would be rejected by Postgres itself even if ever attempted; this unit never attempts it.

### Draft Remove Behavior

Implemented as the exact same `cancel()` transition (DRAFT → CANCELLED), not a separate hard-delete code path — a deliberate, disclosed scope-safety decision: the business rule ("contracts should not be hard-deleted once created") is satisfied by never building a delete path at all, rather than building one only for a "provably empty" draft and risking scope creep into cascade-safety edge cases. The button label reads "Remove Draft" for a DRAFT contract and "Cancel Contract" for ACTIVE (`getVisibleContractTransitions().cancelLabel`); the confirmation modal title matches the same dynamic label rather than always reading "Cancel Contract" verbatim, which would read oddly for a draft.

### Activity/Audit Behavior

Every cancellation is fully traceable: `ContractActivity` (contract-scoped audit trail, same table Activity History already reads) records actor/timestamp/previousStatus/newStatus/reason; `SecurityAuditEvent` records the same for security auditing. Nothing is ever deleted from either log, and cancelling a contract does not delete or alter any of its own prior activity history.

### Active List/Dashboard/Schedule Impact

Dashboard "Active Contracts"/`totalActive` and the global Schedule Overview's "Total Active Contracts" KPI already strictly whitelist `status === ACTIVE`, so CANCELLED contracts were never counted there without any change needed. Added `totalCancelled` end-to-end (service → API types → `totalContractsFromMetrics` → "Contracts by Status" donut → both "Total Contracts" KPI cards) so cancelled contracts remain honestly visible in totals/breakdowns rather than silently vanishing. The global Schedule Overview and the old per-item Schedule register (root dashboard's "Upcoming Schedule" widget) both now explicitly exclude CANCELLED contracts from their contract fetch — a cancelled contract is never shown as a scheduling concern anywhere. Contract List: CANCELLED is a normal, filterable status (`status`/`lifecycleStatus=CANCELLED`), shown in the unfiltered list exactly like DRAFT/TERMINATED/CLOSED already are, with its own muted-neutral `ContractLifecycleBadge`.

### Permission/Scope Behavior

`@AnyPermission('contracts.update', 'contracts.manage')` at the route, re-checked in the service; explicit `assertCanAccessDepartment` enforces the actor's real department scope before any transition. A staff/no-permission actor sees no Cancel/Remove Draft button at all (`getVisibleContractTransitions().cancel` is permission-gated) and the backend independently rejects the request regardless of what the UI shows.

### Data Safety Confirmation

No related record was ever deleted, truncated, or reset. No production database reset/reseed/drop occurred. No migration edits existing data or drops a column. Every child relation's `onDelete: Restrict` remains the real, unconditional backstop against accidental cascade loss, unchanged.

### Regression Results

API: 1429/1429 (14 new). Web: 542/542 (7 new). `pnpm lint` and both typechecks clean. `pnpm build` 8/8 tasks, all routes present including the new `POST :id/cancel` (verified via a live 401 on the unauthenticated endpoint, not a 500). `pnpm db:migrate:status` 37 migrations, up to date. Dev server restarted (only the two identified API/web PIDs stopped); `/contracts`, `/contracts/schedule`, `/contracts/dashboard`, `/contracts/payments`, `/contracts/workflow`, `/contracts/closeouts` all returned clean 307 redirects; `/contracts/schedule/overview` and the old `/contracts/schedule` backend route both returned clean 401s post-change.

### Unsupported/Deferred Items

- Live authenticated UAT walkthrough of the actual cancel flow — same carried-over credential blocker as every unit since CM-62.
- The pre-existing characteristic that `contract-dashboard.service.ts`'s manager-insights panels (Management Attention Required, Top Delayed Contracts) have no contract-status filter at all (already true for TERMINATED/CLOSED contracts today) was audited and deliberately left unchanged — fixing it would be a different unit's scope, not specific to CANCELLED.
- No dedicated "Cancelled" KPI card was added to the 11-card Manager KPI grid or the 5-card Contract List KPI row (only the existing "Contracts by Status" donut and Total Contracts sums were extended) — keeps both KPI grids' card counts unchanged, per this unit's own "prefer minimal, non-disruptive" safety framing.

### Next Recommended Unit

Resolve the carried-over UAT test-user credential blocker (open since CM-62) so a live authenticated walkthrough can finally verify Cancel/Remove Draft end-to-end in a real browser session, closing out the growing backlog of "not run" verification items.

## CM-68C — Schedule Empty State and UX Explanation Polish (Completed 2026-09-05)

### Summary

Pure frontend/UI-copy polish across both Schedule pages, clarifying the relationship between them: the global/sidebar page (all-contract overview) and the per-contract Schedule tab (Planned vs Actual, where planning actually happens). No backend, calculation, actual-source-mapping, or migration change of any kind — audited first and confirmed unnecessary before touching anything.

### Files Audited

`global-schedule-panel.tsx` (global empty state), `contracts/schedule/page.tsx` (global title/subtitle), `[id]/(workspace)/schedule/page.tsx` (per-contract empty state + title), `contract-schedule-edit-drawer.tsx` (Create/Edit Planned Schedule modal helper text + confirmed actual fields have no inputs anywhere in it), `contract-schedule-kpi-strip.tsx` (confirmed untouched, no copy change needed there). Grepped every old empty-state/helper string across the test suites first — none were asserted on, so no test needed updating.

### Files Changed

`apps/web/src/app/(protected)/contracts/schedule/page.tsx`, `apps/web/src/app/(protected)/contracts/schedule/_components/global-schedule-panel.tsx`, `apps/web/src/app/(protected)/contracts/[id]/(workspace)/schedule/page.tsx`, `apps/web/src/app/(protected)/contracts/[id]/(workspace)/schedule/_components/contract-schedule-edit-drawer.tsx`. Copy/JSX only — no props, no logic, no new files.

### Backend Changed — No

No service, controller, DTO, or migration touched. `computeActualStages()`/`computeStageStatus()`/`computeDelayDays()`/`computeScheduleSummary()`/`ContractScheduleOverviewService.getOverview()` all untouched.

### Global Empty State Behavior

When contracts exist but every one is genuinely `scheduleStatus === 'Not Planned'` (and no filters are active): title "No contract schedules created yet", description explaining schedules are created inside each contract and what the page will show once planned dates exist, a secondary helper line ("Open a contract, go to Schedule, then create the planned timeline."), and a real "Open Contract List" link to `/contracts` — no global schedule editor, no fake rows. The zero-contracts state ("No active contracts found.") and the filtered-no-match state are unchanged.

### Contract Schedule Empty State Behavior

When a contract has no planned schedule: title "No planned schedule has been added yet", description listing the real fixed 8-stage list (Contract Sign, Advance Payment, Drawing Approval, Estimation Sheet, Casting / Production, Delivery, Erection, Final Closeout — the same literal list CM-68A already builds from, not a new invented list), a helper line naming the real actual-data sources (workflow tasks, payments, production status, closeout), and the existing "Create Planned Schedule" button/action unchanged.

### Planned vs Actual Explanation Behavior

A compact one-line note — "Planned = entered by manager. Actual = generated from system activity." — added under the title on both pages (global and per-contract), reusing existing muted-text styling; no new component, no extra vertical space beyond one small line.

### Create Modal/Helper Behavior

Modal top helper text replaced with the exact required copy explaining planned vs actual and naming the real update sources (workflow, payments, production, delivery/erection, closeout). Confirmed unchanged: the modal has no actual-value inputs anywhere — only planned fields (Responsible Team, Planned Start/End, Planned Qty/Molds for Casting/Production, Remarks) were ever editable, so "actual remains read-only" required no code change, only the copy now says so explicitly.

### Data Unchanged Confirmation

No planned dates, actual dates, stages, statuses, teams, or delay values were faked, added, or altered — every table/KPI value is exactly the same real data as CM-68A/CM-68B produced; only the empty-state and helper text around that data changed.

### Schedule Logic Unchanged Confirmation

`contract-schedule-plan.service.ts`, `contract-schedule-overview.service.ts`, both controllers' routes, and the `ContractScheduleItem` schema/migration are byte-for-byte unchanged from CM-68A/CM-68B.

### Regression Results

`pnpm --filter @recafco/web test --run` 536/536 (unchanged — no pure-logic file touched, no test asserted the old copy). `pnpm --filter @recafco/api test --run` 1415/1415 (unchanged). `pnpm build` 8/8 tasks (only `@recafco/web` rebuilt; all other packages cache-hit). `pnpm db:migrate:status` 36 migrations, unchanged. Contract List, Dashboard, Workflow, Payments, Production, Closeout, Documents, Claims, Risks, Issues, Attachments, Activity, and Staff pages — no files under any of those routes were touched this unit.

### Verification Results (2026-09-05)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 536/536 |
| `pnpm --filter @recafco/api test --run` | ✓ 1415/1415 |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 36 migrations, unchanged, up to date |

### Unsupported/Deferred Items

None — this unit's full scope (empty-state copy + modal helper + compact info note) was completed as specified.

### Next Recommended Unit

Resolve the carried-over UAT test-user credential blocker (still open since CM-62) so a live authenticated walkthrough can finally verify the Schedule pages' new copy, and the growing backlog of prior "not run" verification items, in a real browser session.

## CM-68B — Global Contract Schedule Overview (Completed 2026-09-05)

### Summary

Rebuilt the main/sidebar Schedule page (`/contracts/schedule`) as an all-contract manager overview reusing CM-68A's real per-stage Planned vs Actual derivation logic, without duplicating CM-68A's full per-contract timeline. Each row summarizes one contract's schedule health (status, current blocking stage/team, next milestone, delay) and links to that contract's own detail Schedule tab for the full timeline. The old CM-34 due-date register that previously lived at this URL (`ScheduleItem`/`findAll()`, still a real dependency of the root dashboard's "Upcoming Schedule" widget) was left completely untouched — this unit is backed by a new, separate `GET /contracts/schedule/overview` endpoint.

### Backend Changed — Yes

- New service `contract-schedule-overview.service.ts` (`ContractScheduleOverviewService.getOverview()`), reusing CM-68A's exported `computeActualStages()`/`computeStageStatus()`/`computeDelayDays()`/`computeScheduleSummary()` per contract via a batched bulk-fetch-then-group-in-memory pattern (no N+1 queries), plus new pure functions `computeCurrentStage()`, `computeBlockingTeam()`, `computeNextMilestone()`, `computeGlobalScheduleStatus()`, `computeOverviewRow()`, `computeOverviewSummary()` (+23 tests).
- New `GET /contracts/schedule/overview` endpoint (`contracts.read`), declared before the existing `@Get('schedule')` route per this controller's established static-route-before-`:id`-ordering convention. Registered in `contracts.module.ts`.
- `ContractScheduleService.findAll()` / the old `GET /contracts/schedule` (`ScheduleItem[]`) endpoint — **untouched**, confirmed still the sole real dependency of the dashboard's `upcomingSchedule` widget.

### Migration — None (additive-free unit)

No schema change. `pnpm db:migrate:status` confirms 36 migrations, unchanged, up to date.

### Global Schedule Status Logic (5 buckets, real data only)

Delayed (any planned stage genuinely overdue/completed late) → Completed (contract status CLOSED/COMPLETED) → Not Planned (no planned schedule rows at all) → Attention (a real next-milestone date is due within 7 real days, not otherwise Delayed/Completed/Not Planned — a deliberately narrow, defensible reading of the task's own underspecified "blockers exist but not necessarily delayed" definition, chosen to tie directly to the required Due This Week KPI without duplicating Closeout's heavier cross-module Blocking Items aggregation) → On Track.

### Current Stage / Blocking Team / Next Milestone Logic

Current Stage: first planned-not-completed stage; else "Final Closeout / Completed" once all planned stages are done; else "Not planned" — never guessed from `createdAt`. Blocking Team: the real `responsibleTeam` on the blocking stage; safe stage-name inference only for Drawing Approval→Technical, Casting/Production→Production, Delivery/Erection→Delivery / Erection; otherwise "—". Next Milestone: nearest upcoming incomplete planned stage date, "—" if none. `openBlockerCount` is scoped narrowly to "stages with real DELAYED status" (data already computed in this same service) — a deliberate, disclosed scope decision, not a reimplementation of Closeout's Blocking Items.

### KPI / Filter / Export Behavior

6 KPI cards (Total Active Contracts, On Track, Delayed, Not Planned, Due This Week, Completed This Month) computed over the full unfiltered row set (portfolio-wide meaning), reusing `MetricCard`. Search/Status/Team/Due filters are client-side (`filterOverviewRows`, +11 tests) over the full bounded row list (capped at 1000 contracts, same cap precedent as the old CM-34 register) — the same established client-side-filtered bounded-list pattern used by Risk Assessment/Production Status/Claims, chosen over a new server-side query-param filtering layer since this page is explicitly an overview, not a detailed editor. Export reuses the app-wide server-export-route convention (`/contracts/schedule/export`, its own CSV builder `contract-schedule-overview-csv.ts` +4 tests) rather than a client Blob download, re-running the identical `filterOverviewRows` against the same query params so exported rows always match what's on screen.

### Action/Link Behavior

Each row's "Open Schedule" action links to `/contracts/${contractId}/schedule` (CM-68A's per-contract detail page) — no edit affordance exists anywhere on this page; editing planned schedules remains exclusively inside the per-contract Schedule tab.

### Permission/Scope Behavior

View: `contracts.read` (existing pattern). Department scope enforced identically to every other contract-scoped service (`DepartmentAccessService`, same as CM-68A/Contract List).

### Data Honesty Confirmation

No fake schedule data, dates, stages, teams, statuses, or delay days anywhere — every field is either a real value from CM-68A's per-stage derivation/summary functions or an honest "—"/"Not planned"/"Not linked yet"/"No blocker".

### Contract Detail Schedule Regression

`/contracts/[id]/schedule` (CM-68A) untouched — no files under its `_components`/`_lib` were modified this unit; `contract-schedule-plan.service.ts` was imported from (read-only reuse), never edited.

### Other Page Regression

Root dashboard's "Upcoming Schedule" widget (`upcoming-schedule-list.tsx`) and its backing `schedule-item-type-badge.tsx` left untouched (confirmed via grep before deleting anything else in the old `schedule/_components/` directory). Payments/Workflow/Closeouts/Dashboard/Contract List sibling pages smoke-checked post-rebuild — all still return clean redirects, no crashes.

### Verification Results (2026-09-05)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 536/536 (26 new: 11 filter-helper + 4 CSV + previously-written 23 API-side are counted in the API total below) |
| `pnpm --filter @recafco/api test --run` | ✓ 1415/1415 (23 new) |
| `pnpm build` | ✓ 8/8 tasks; `/contracts/schedule`, `/contracts/schedule/export`, and `/contracts/[id]/schedule` all present |
| `pnpm db:migrate:status` | ✓ 36 migrations, unchanged, up to date |
| Dev server restart | ✓ `.next` cleared, both web (3000) and API (4000) processes identified by command line before stopping, restarted; both health checks pass; new `/contracts/schedule/overview` endpoint returns 401 (guard intact, no crash); 5 sibling pages return clean 307 redirects |
| Live authenticated UAT walkthrough | **Not run** — `test.manager`/`UATpass2026!` login attempt returned `INVALID_CREDENTIALS`; same credential blocker carried over from CM-62 onward |

### Unsupported/Deferred Items

- Live authenticated UAT (credential blocker, carried over).
- Global edit modal, bulk schedule editor, drag/drop, Gantt chart, fake AI forecast, calendar integration, notifications, SAP integration — explicitly out of scope per this unit's own instructions; none built.

### Next Recommended Unit

Resolve the carried-over UAT test-user credential blocker (re-run `uat-seed.ts` or confirm current dev-DB seed state) so a live authenticated walkthrough can finally close out the growing backlog of "not run" verification items across CM-62 through CM-68B.

## CM-68A — Contract Schedule Detail Page: Planned vs Actual (Completed 2026-09-04)

### Summary

Rebuilt the Contract Detail Schedule tab as a real Planned vs Actual milestone timeline for 8 fixed business stages (Contract Sign, Advance Payment Received, Drawing Approval, Estimation Sheet, Casting / Production, Delivery, Erection, Final Closeout), replacing the old CM-34 due-date aggregation view. Planned dates are a manager's own real input, stored in a new additive `ContractScheduleItem` table. Actual dates/quantities are never stored — always derived live from real workflow task completions, payment records, production status aggregates, and closeout/contract fields, with an honest "—" / "Not available" / "Not linked yet" whenever no real source is safely identifiable. Per-stage delay/status (Not Planned/Not Started/On Track/In Progress/Completed/Delayed/Ahead) and schedule-level KPIs are computed server-side from real data only.

### Backend Changed — Yes

- New Prisma model `ContractScheduleItem` (planned entries only) + `ContractScheduleStageKey` enum — see Migration below.
- New service `contract-schedule-plan.service.ts` (`ContractSchedulePlanService`) with `getScheduleDetail()` and `updatePlan()`, plus pure exported functions `computeActualStages()`, `computeStageStatus()`, `computeDelayDays()`, `computeScheduleSummary()` (+34 tests).
- `GET :id/schedule` repurposed to call the new service instead of the old `ContractScheduleService.findAllForContract()` — audited and confirmed this was that method's ONLY consumer, so the old method + its 4 tests were removed as dead code (`ContractScheduleService.findAll()`, the module-level register backing `/contracts/schedule`, and its own `buildItemsForContracts()`/pure item-mapping functions are completely untouched — confirmed via a second audit pass before deleting anything).
- New `PATCH :id/schedule/planned` endpoint (`contracts.update` permission) for saving the planned stage list, wired through a new `UpdateContractSchedulePlanDto`/`UpdateContractScheduleStageDto`.

### Migration — Additive, hand-written via the established shadow-DB workaround

`20260903000000_add_contract_schedule_items` — `CREATE TYPE contract_schedule_stage_key` + `CREATE TABLE contract_schedule_items` (contractId, stageKey, stageName, responsibleTeam, plannedStartDate, plannedEndDate, plannedQuantity, plannedMolds, remarks, sortOrder, isRequired, createdByUserId, updatedByUserId, timestamps; unique on `[contractId, stageKey]`) + 3 foreign keys. Generated via `prisma migrate diff --from-config-datasource --to-schema` (the shadow database still fails `migrate dev` in this environment), trimmed to only the new-table/enum/FK statements (the raw diff also contained large unrelated `production_*`/legacy drift from earlier Prisma version upgrades, deliberately excluded). Applied via `prisma migrate deploy`. `pnpm db:migrate:status` confirms 36 migrations, up to date.

### Planned Schedule Data Model

`ContractScheduleItem` — one row per real stage a manager has actually planned (never all 8 auto-created; unplanned stages simply have no row and show "Not Planned"/"—" everywhere). `responsibleTeam` is deliberately a free-text field, not the real `ContractWorkflowTeam` enum, since 4 of the 8 stages (Contract Sign, Advance Payment, Estimation Sheet, Final Closeout) don't map onto any real workflow team.

### Actual Source Mapping (audited, real sources only)

| Stage | Real source | Fallback when not identifiable |
|---|---|---|
| Contract Sign | `contract.contractDate`, else `contract.activatedAt` | "Not available" |
| Advance Payment Received | first real PAID payment by `paidDate` (no real "advance" payment-type field exists — task's own explicit fallback used, labeled "Payments (first received)", never claimed to be specifically the advance) | "Not available" |
| Drawing Approval | real TECHNICAL task `technical_getting_approval` ("Getting Approval") | "Not linked yet" |
| Estimation Sheet | **no real workflow task safely matches "estimation" anywhere in the fixed template list** — always "Not linked yet", never fuzzy-guessed |
| Casting / Production | real PRODUCTION task `production_start` for actual start; real BOQ production-status aggregation for produced quantity; actual end only appears once every real BOQ item is genuinely COMPLETED, using the latest real `updatedAt` among them as a disclosed "last production update" fallback | "Not available" |
| Delivery | real ERECTION task `erection_delivery_start` ("Delivery Start") | "Not linked yet" |
| Erection | real ERECTION tasks `erection_start` (start) + `erection_issue_checklist` (end, the last task in the real erection sequence) | "Not linked yet" |
| Final Closeout | real `contract.closedAt`, only once `contract.status === 'CLOSED'` (never an approved-but-not-yet-closed date) | "Not available" |

Molds Produced always shows "—" — no real per-mold count field exists anywhere in this app (confirmed via audit of `ContractBoqItemProductionStatus`).

### Delay/Status Calculation

`computeStageStatus()`: NOT_PLANNED (no planned dates) → DELAYED (today past planned end and not completed, or completed after planned end) → COMPLETED/AHEAD (completed on/before planned end) → IN_PROGRESS (real actual start, no actual end) → ON_TRACK/NOT_STARTED. `computeDelayDays()`: signed real day count (positive=late, negative=early, 0=on time), `null` (shown as "—") when there's no planned end or nothing real to compare yet. Both fully unit tested (18 cases).

### Schedule Page UI Behavior

Title "Schedule", subtitle exactly as specified. 6 KPI cards (Schedule Status, Planned Completion, Forecast/Actual Completion, Delay Days, Completed Stages, Pending Stages) — all real, from `computeScheduleSummary()`. Planned vs Actual Timeline table: Stage, Responsible Team, Planned Start/End, Actual Start/End, Delay, Status, Source, Action (links to the real workspace tab each stage's actual data is sourced from). Casting / Production shows planned/produced quantity + molds as compact subtext under the stage name (no extra column, per this unit's own "compact subtext" allowance).

### Edit Planned Schedule Behavior

"Edit Planned Schedule" (or "Create Planned Schedule" when none exists yet) opens a modal with all 8 fixed stages, each editable (Responsible Team, Planned Start/End, Remarks; Planned Qty/Molds only for Casting / Production). Saves via a new `updateContractSchedulePlanAction` → `PATCH :id/schedule/planned`. Actual values are never editable from this page — no inputs exist for them anywhere in the UI.

### Empty State Behavior

Exact required copy: "No planned schedule has been added yet." / "Create the planned contract schedule to compare future actual progress." with a "Create Planned Schedule" button (manager only) — no automatic/fake dates are ever pre-filled.

### Permission/Scope Behavior

View: `contracts.read` (existing pattern). Edit planned schedule: `contracts.update` (existing pattern, same as Documents & Obligations/Risks/Variations). Actual data has no edit path anywhere. Department scope enforced identically to every other contract-scoped service (`assertCanAccessDepartment`).

### Data Honesty Confirmation

No fake planned dates (a manager must enter them), no fake actual dates (every actual field traces to a real, cited source or shows "—"), no fake production quantities (real BOQ aggregation only), no fake delay/status (pure functions computed from real real dates only), no fake team names (planned `responsibleTeam` is manager-entered free text, actual has no team-name field at all).

### Verification Results (2026-09-04)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors (1 `exactOptionalPropertyTypes` fix applied) |
| `pnpm --filter @recafco/web test --run` | ✓ 525/525 (10 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1392/1392 (34 new, 4 removed with the deleted dead method) |
| `pnpm build` | ✓ 8/8 tasks; both `/contracts/[id]/schedule` and `/contracts/schedule` present |
| `pnpm db:migrate:status` | ✓ 36 migrations, up to date |
| Dev server restart | ✓ `.next` cleared, both web and API restarted (backend changed); both health checks pass; Schedule tab (contract-detail + untouched module register) + 9 sibling routes all returned clean 307 redirects |
| Live UAT scenarios A–G | **Not run by the agent this unit** — same credential blocker carried over from CM-62 onward |

### Unsupported/Deferred Items

- Live UAT (credential blocker, carried over).
- Global/sidebar all-contract schedule overview — explicitly deferred to CM-68B per this unit's own scope boundary; the module-level register at `/contracts/schedule` was audited and left completely untouched.
- Complex Gantt chart, drag/drop scheduling, notification engine, forecast AI, SAP integration — explicitly out of scope per this unit's own instructions; none built.
- Estimation Sheet's actual source remains genuinely unlinked — no real workflow task exists anywhere in the fixed template list that safely represents it; would need either a new real task added to the workflow template (a different unit's decision) or continued honest "Not linked yet".

### Next Recommended Unit

CM-68B — the global/sidebar all-contract Schedule overview (across every contract, Planned vs Actual summary rows), reusing this unit's real per-stage derivation logic where possible.

## CM-67E — Closeout Required Documents Readiness Correction (Completed 2026-09-03)

### Summary

Corrected a business-meaning confusion on the Closeout tab: the old "Final Documents / Attachments" card (which showed only closeout-request attachments plus an upload form, with an empty state reading "No closeout documents uploaded yet.") made Closeout feel like a document-upload page. Replaced it with "Required Documents for Closeout" — a read-only readiness summary over the real, already-existing Documents & Obligations records for this contract. The real closeout-request attachment upload (a genuinely different thing — supporting files for the closeout REQUEST itself) was not deleted; it was relocated, unmodified, into the Final Approval & Closeout section, where it conceptually belongs.

### Backend Changed — No / Migration — None

Zero backend files touched, zero new endpoints. `pnpm db:migrate:status` confirmed 35 migrations, unchanged. The new "Required Documents for Closeout" card uses `documents` (`contractsApi.getContractDocumentObligations(id)`), a fetch `page.tsx` already made in CM-67 for the KPI strip and checklist — no new request added.

### Audit Findings (per this unit's own instruction #7/#8 — report, don't silently change)

- **Checklist "Required documents submitted" item**: already correctly based on Documents & Obligations pending/expired counts (`documentObligationsTotal`/`documentObligationsPendingOrExpired`, wired since CM-67) — NOT closeout attachments. No change needed.
- **Blocking Items**: already includes a real row per pending/expired document-obligation record (`BLOCKING_DOCUMENT_STATUSES = ['PENDING', 'EXPIRED_OVERDUE']`, wired since CM-67). No change needed.
- **A pre-existing color bug found (not fixed, out of scope)**: the Documents & Obligations tab's own shared `DOCUMENT_OBLIGATION_STATUS_BADGE_CLASSES` colors `EXPIRING_SOON` with `accent` (this theme's brand red) despite its own code comment saying "Expiring Soon purple" — a real mismatch, and the exact class of issue CM-64C already flagged and partially fixed elsewhere. This unit's own new Closeout-local badge uses `team-production` (real indigo, the app's established purple substitute) instead, matching this task's explicit "Expiring Soon = purple/orange" spec — but the shared Documents & Obligations badge itself was left untouched (out of scope for a Closeout-only unit). Reported here as a good candidate for a future CM-63-line polish unit.

### Changes

- `contract-closeout-required-documents-panel.tsx` (new) — "Required Documents for Closeout" read-only table (Document/Obligation, Category, Status, Submission/Expiry Date, Attachment, Action), fed by `documents.items` (real, already-fetched). Attachment column shows the first real file name + "+N more" or "—"; Action shows a real secure download link when a file exists, else "Go to Documents" linking to `/contracts/${id}/documents`. Empty state uses this unit's exact required wording plus a "Go to Documents & Obligations" link.
- `contract-closeout-document-status-badge.tsx` (new) — Closeout-local status badge with the task's exact color spec (Submitted green, Pending amber, Expiring Soon purple/team-production, Expired/Overdue red, Not Required/Cancelled gray).
- `contract-closeout-request-attachments.tsx` (new) — the real closeout-request attachment upload/list, extracted unmodified from the deleted `contract-closeout-documents-panel.tsx` (same `uploadCloseoutAttachmentAction`, same `ContractCloseoutAttachment` model), relocated into the Final Approval & Closeout section (rendered whenever `latestRequest` exists, in both the review-in-progress and closed/historical branches; upload form only shown when `canUpload` is true, matching the exact same condition as before — `canUpdate && hasActiveRequest`). Upload button relabeled "Attach File" (was "Upload Document") to read as attaching a file to a specific request, not a generic upload.
- Deleted `contract-closeout-documents-panel.tsx` (superseded — confirmed no other references before deletion).
- `page.tsx` — rewired the Documents/Financial grid row and the Final Approval & Closeout section per the above; doc comment extended.

### Section Rename / Data Source / Attachment / Empty State / Go-to-Documents Behavior

All exactly per this unit's spec — see Changes above. Documents & Obligations records are the real data source (no new fetch); attachments come from `item.attachments` (already included in the API response); the secure download route (`/contracts/${id}/documents/${itemId}/attachments/${attachmentId}/download`) is reused unmodified — no raw storage path exposed.

### Closeout Approval Rule Confirmation

Unchanged. `getClosureAction`/`computeClosureStatus`/the real backend `review()`/`approve()`/`reject()`/`closeContract()` methods were not touched. Close Contract still only ever renders/works when the real backend status is APPROVED.

### Verification Results (2026-09-03)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 515/515 (unchanged — display/component reorganization, no new pure-logic function) |
| `pnpm --filter @recafco/api test --run` | ✓ 1362/1362 (unchanged) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 35 migrations, unchanged |
| Dev server restart | ✓ `.next` cleared, restarted; both health checks pass; Closeout + Documents & Obligations + Attachments + 8 other routes all returned clean 307 redirects |
| Live UAT (visual/functional check as a signed-in manager) | **Not run by the agent this unit** — same credential blocker carried over from CM-62 onward |

### Unsupported/Deferred Items

- Live UAT (credential blocker, carried over).
- The Documents & Obligations tab's own shared badge's `EXPIRING_SOON: accent` color mismatch (see Audit Findings above) — a good candidate for a focused follow-up if raised, out of scope for this Closeout-only unit.

## CM-67D — Closeout Final Readability Polish (Completed 2026-09-03)

### Summary

Small, final readability-only pass over the Closeout tab — no data, backend, permission, or action-logic change. Converted the Blocking Items table's raw SNAKE_CASE status text into humanized, color-coded badges; made the blocker-count warning above the closeout request form more prominent and reworded it to match this unit's exact phrasing; tightened the Blocking Items table's columns further; and bumped the Status badge / Progress numbers up one size for easier scanning.

### Backend Changed — No

Zero backend files touched. `pnpm --filter @recafco/api test --run` (1362/1362) and `pnpm db:migrate:status` (35 migrations) both unchanged.

### Enum Label Polish

New pure `humanizeStatus(status)` in `contract-closeout-detail-helpers.ts` generically converts any real stored SNAKE_CASE status value into Title Case ("NOT_STARTED" → "Not Started", "EXPIRED_OVERDUE" → "Expired Overdue", etc.) — a pure reformat of the real value, not a lookup table, so it correctly covers every real status across all 6 Blocking Items sources (workflow/payments/claims/risks/issues/documents), not just the 7 examples the task listed. Paired with a new `blockingStatusTone(status)` that buckets the humanized label into neutral/warning/error coloring based only on the real word's own meaning (OVERDUE/REJECTED/EXPIRED → error; NOT_STARTED/DRAFT/PENDING → neutral; everything else → warning) — both used together as a colored `StatusBadge` in the Blocking Items table (was raw unlabeled plain text). +21 new tests.

### Warning Polish

The blocker-count note shown above `ContractCloseoutRequestForm` (when `blockingItems.length > 0`, real data already computed on the page) is now an icon-led, bold, thicker-bordered warning block instead of plain small text, reworded to: "This contract has X blocking items. Resolve them before submitting for closeout review." (singular-aware). Still advisory, not a hard gate — the real backend doesn't require zero blockers to submit a request, only to close.

### Blocking Table Readability

Column padding tightened (`px-3`→`px-2`, table `min-w-200`→`min-w-180`); "Item"/"Action Required" column max-widths trimmed slightly; header "Action Due Date" shortened to "Due Date"; the Status column is now a readable colored badge instead of raw text; the Action link gained a background fill (`bg-surface-secondary`) so it reads more clearly as a button. Same 5-item default cap and priority sort from CM-67C — unchanged.

### Verification Results (2026-09-03)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 515/515 (21 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1362/1362 (unchanged) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 35 migrations, unchanged |
| Dev server restart | ✓ `.next` cleared, restarted; both health checks pass; Closeout tab + 9 sibling routes returned clean 307 redirects |
| Live UAT (visual readability check as a signed-in manager) | **Not run by the agent this unit** — same credential blocker carried over from CM-62 onward |

### Unsupported/Deferred Items

- Live visual UAT of the actual readability polish at real viewport widths — blocked by the same credential constraint carried since CM-62; typecheck/build/307-checks confirm no render error, the true visual result is unverified live.

## CM-67C — Closeout Final UI Polish (Completed 2026-09-03)

### Summary

Final visual-only polish pass over CM-67B's Closeout layout — no data, backend, permission, or action-logic change. Strengthened per-status treatment on the Status card, colorized the Progress/Checklist count recaps as chips, dropped Blocking Items' default cap from 6 to 5 with tightened rows and concise action text, grouped Financial Summary into 3 labeled sub-sections with Current Contract Value/Outstanding Payment highlighted, and made Final Approval & Closeout feel like the decision area (bold header + icon, larger primary Close Contract button, a real-data blocker-count helper note before submission). Also fixed a pre-existing double-nested `<section>` around the approval area (the component rendered its own card frame identical to the page's already-wrapping one) — now a single card.

### Backend Changed — No

Zero backend files touched. `pnpm --filter @recafco/api test --run` (1362/1362) and `pnpm db:migrate:status` (35 migrations) both unchanged.

### Status/Progress Polish Behavior

`ContractCloseoutHeaderCards` now maps each of the 9 real `ClosureStatus` values to its own icon + color (was a blunt `isReady` binary lumping SUBMITTED/UNDER_REVIEW/REJECTED all into one "not ready" warning treatment) — Rejected now shows a distinct error/X icon, Submitted/Under Review show a distinct info/clock treatment, matching `CLOSURE_STATUS_BADGE_CLASSES`'s own color family exactly. The 4 Progress counts (Completed/Pending/Not Required/Blocked) render as colored chip boxes instead of plain numbers — same real `ChecklistProgress` values, no new computation.

### Blocking Items Polish Behavior

Default visible cap dropped from 6 to 5 (`VISIBLE_LIMIT`). Action text tightened in `computeBlockingItems()` (e.g. "Complete overdue task" → "Complete task", "Clear outstanding payment" → "Clear payment", "Mitigate or close risk" → "Mitigate risk") — the Status column already shows the real status value, so the action text no longer repeats it. "View all N blocking items" now uses `text-info` (calm blue, the app's real link color) instead of `text-accent` (this theme's brand red, reserved for primary actions/urgent states per the CM-64C finding) — a plain expand-in-place link isn't urgent. Row padding tightened (`py-1.5` → `py-1`).

### Checklist Polish Behavior

Status-count recap now renders as colored pill chips (matching the header Progress card's own treatment) instead of plain inline text. Row padding tightened to match Blocking Items. Sticky header confirmed still working (re-verified, unchanged from CM-67B).

### Financial Summary Polish Behavior

Grouped into 3 labeled sub-sections ("Contract Value", "Payments", "Retention & Status") via a small uppercase `GroupLabel` row. Current Contract Value and Outstanding Payment now render as highlighted boxes (colored border/background, larger bold value) — Outstanding Payment's highlight tone switches to warning only when a real non-zero outstanding amount exists, otherwise stays the calm info tone. Same real values throughout; Retention Amount/Released still honestly "—".

### Final Approval/Action Polish Behavior

- `ContractCloseoutApprovalPanel`'s header is now `text-base font-bold` with a Gavel icon (was `text-sm font-semibold`, no icon); the 3 inline page.tsx branches (request form / rejected-message / no-request-message) got the identical header treatment for consistency across every real state.
- Close Contract button enlarged to `px-6 py-3 text-base font-bold` with a CheckCircle2 icon and a "Closeout has been approved — this contract is ready to close." confirmation line above it, inside a success-tinted box — makes the single most consequential action visually unmistakable. Approve Closeout bumped from `text-xs`/`px-3 py-1.5` to `text-sm font-semibold`/`px-4 py-2`.
- When a manager is about to submit a NEW closeout request and real blocking items exist (`blockingItems.length > 0`, already computed in `page.tsx`), a warning-toned helper line now shows: "This contract has N blocking item(s) — resolve these first for a smoother closeout review." — real count, not a hard gate (the real backend doesn't require zero blockers to submit a request, only to CLOSE), so this is advisory text, not a new restriction.
- Fixed a pre-existing double-nested-card bug: `ContractCloseoutApprovalPanel` used to render its own `<section className="rounded-lg border ... p-4">` INSIDE the page's already-identical wrapping `<section>` — a redundant doubled border/padding since CM-67. Changed the component's root to a Fragment; the page's own section now provides the single card frame, matching every other panel on the page.

### Removed Widgets/Buttons Confirmation

Re-confirmed absent: Contract Summary card, Recent Activity card, Back to Contract, Archive Contract, Request Missing Items, More Actions. None reintroduced.

### Verification Results (2026-09-03)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 494/494 (unchanged — pure visual/wording pass, no new branching logic) |
| `pnpm --filter @recafco/api test --run` | ✓ 1362/1362 (unchanged) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 35 migrations, unchanged |
| Dev server restart | ✓ `.next` cleared, restarted; both health checks pass; Closeout tab + 9 sibling routes returned clean 307 redirects |
| Live UAT (visual polish check as a signed-in manager) | **Not run by the agent this unit** — same credential blocker carried over from CM-62 onward |

### Unsupported/Deferred Items

- Live visual UAT of the actual polish (icon colors, chip rendering, button prominence) at real viewport widths and with a real signed-in manager — blocked by the same credential constraint carried since CM-62. Typecheck/build/307-checks confirm no render error; the true visual result is unverified live.

## CM-67B — Closeout Page Layout Polish to Match Approved Design (Completed 2026-09-03)

### Summary

Layout-only compaction pass over CM-67's Closeout tab — no data, backend, permission, or action-logic change. Reorganized into a responsive 2-column grid (stacks to 1 column on mobile/tablet): Row 1 Status+Progress (unchanged), Row 2 KPI strip (unchanged, full width), Row 3 Checklist | Blocking Items, Row 4 Documents | Financial Summary (moved up from the bottom), Row 5 Claims/Risks/Issues Summary | Final Approval & Closeout (moved up from the bottom). Blocking Items now caps to the top 6 real highest-priority rows with an in-card "View all N blocking items" expand; the checklist gained a compact scroll region (`max-h-80`) and a status-count recap using the same `checklistProgress` already computed — no new calculation.

### Backend Changed — No

Zero backend files touched. `pnpm --filter @recafco/api test --run` (1362/1362) and `pnpm db:migrate:status` (35 migrations) both unchanged.

### Layout Polish Behavior

`page.tsx`'s section order changed from one long vertical stack to 3 `grid grid-cols-1 lg:grid-cols-2 gap-4 items-start` rows (`items-start` so a tall left card never stretches a shorter right card). Financial Closeout Summary and Final Approval & Closeout are now visible roughly halfway down the page instead of at the very bottom. Two panels' internal grids were narrowed since Tailwind's `lg:` breakpoints are viewport-based, not container-based — `ContractCloseoutFinancialPanel` (`lg:grid-cols-5` → `sm:grid-cols-3`, capped) and `ContractCloseoutModuleSummaryPanel` (`lg:grid-cols-8` → `sm:grid-cols-4`, capped) — both now wrap cleanly inside a half-width column instead of straining too many columns into it.

### Blocking Items / Checklist Compact Behavior

- `contract-closeout-blocking-panel.tsx` is now a client component: a new pure `sortBlockingItemsByPriority()` (CRITICAL > HIGH > MEDIUM > LOW > no-real-priority, +3 tests) orders the real list, the top 6 render by default, and a "View all N blocking items" button expands the full real list in place — no fake hidden count, no invented "view all" page (blockers span too many different modules for one real destination to exist).
- `contract-closeout-checklist-panel.tsx` gained a `progress` prop (the exact same `ChecklistProgress` already passed to the header cards) rendered as a small Completed/Pending/Not Required/Blocked recap in the card's own header, plus a `max-h-80 overflow-auto` scroll region with a sticky `thead` — the fixed 10-item checklist doesn't strictly need scrolling today, but the mechanism is in place per this unit's own "cap or scroll" instruction and won't silently grow the page if a future unit adds more checklist categories.

### Verification Results (2026-09-03)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 494/494 (3 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1362/1362 (unchanged) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 35 migrations, unchanged |
| Dev server restart | ✓ `.next` cleared, restarted; both health checks pass; Closeout tab + 9 sibling routes returned clean 307 redirects |
| Live UAT (visual grid/compaction check as a signed-in manager) | **Not run by the agent this unit** — same credential blocker carried over from CM-62 onward |

### Unsupported/Deferred Items

- Live visual UAT of the actual grid layout/scroll behavior at real viewport widths (credential blocker) — typecheck/build/307-smoke-check confirm no render error, but the real visual compaction is unverified live.

## CM-67 — Contract Closeout Approved Design Build, Simplified (Completed 2026-09-03)

### Summary

Rebuilt the Contract Detail Closeout tab to the approved design, simplified: Closeout Status + Progress row, Readiness KPI strip, Blocking Items, Final Completion Checklist, Final Documents/Attachments, Financial Closeout Summary, Claims/Risks/Issues Summary, and Final Approval & Closeout. Reuses the complete real CM-33 closeout backend (checks, requests, review/approve/reject, close, attachments) entirely unmodified — same permissions, same approval gate, same server actions. Removed: Contract Summary card, Recent Activity card, Back to Contract button, Archive Contract button (no real archive workflow exists), Request Missing Items button (no real task/notification-creation flow exists for it), More Actions button (no additional real actions exist).

### Backend Changed — Yes, one additive read-only widening, no migration

`GET :id/workflow-summary` (`contract-workflow.service.ts`'s `getWorkflowSummaryForContract`) previously returned only `{team, status, isOverdue, attachmentsCount}` per task — too thin to show real per-task Blocking Items rows. Widened its existing `select` to also include `id, taskName, priority, dueDate` — the same DB columns, same read-only query shape, same explicit "must never trigger the lazy first-view task generation" guarantee (`getWorkflowForContract` is the ONLY method that generates tasks; this summary method still never does). Every existing consumer (Overview) only reads the fields it already used, so this is purely additive. +2 new tests; existing test updated for the wider shape.

### Migration — None

`pnpm db:migrate:status` confirmed 35 migrations, unchanged.

### Real-Data Audit Findings

- `ContractCloseoutChecks` (existing) has NO risk bucket — Risk Assessment data for the KPI strip/checklist/blocking items/summary comes from the real, already-existing `GET :id/risks` (`ContractRiskDetail`), reusing its `summary.openRisks` directly for the KPI and computing `mitigated`/`closedOrCancelled` counts from its real unpaginated `items` array (`countRisksByBucket()`, mirroring `contract-risks.service.ts`'s own `RESOLVED_STATUSES` definition exactly).
- Financial Closeout Summary's Original/Current Contract Value and Approved Variations map directly onto the real, already-existing `GET :id/variations` response (`originalContractValue`/`computedCurrentValue`/`summary.approvedValue`) — no new computation needed.
- Retention Amount / Retention Released: grepped the schema and every payment/contract DTO — no real stored retention AMOUNT field exists anywhere (only a plain `paymentTerms.retention` boolean meaning "retention applies", never a value). Both fields honestly show "—", exactly as this unit's spec requires when unsupported.
- "Blocking Items" and "Final Completion Checklist" row-level open/final status sets are copied VERBATIM from the real backend classifications already used by `computeCloseoutChecks()` (`OPEN_ISSUE_STATUSES`, `OPEN_CLAIM_STATUSES`, `CLOSEOUT_READY_WORKFLOW_STATUSES`, `FINAL_PAYMENT_STATUSES`) and `contract-risks.service.ts`'s `RESOLVED_STATUSES` / `contract-document-obligations.service.ts`'s `PENDING`/`EXPIRED_OVERDUE` — never a newly-invented classification, so row-level counts always agree with the aggregate KPI/checklist numbers.

### Changes

- `apps/api/src/contracts/contract-workflow.service.ts` (+test) — `getWorkflowSummaryForContract` widened.
- `apps/web/src/lib/contracts-api.ts` — `ContractWorkflowSummaryData` widened to match.
- `apps/web/src/app/(protected)/contracts/_lib/contract-closeout-detail-helpers.ts` (new, +29 tests) — `computeClosureStatus`, `computeChecklist`/`computeChecklistProgress`, `computeBlockingItems`, `countRisksByBucket`, `countVariationsByBucket`, `computeFinalPaymentStatus`. All pure, dependency-free.
- `apps/web/src/app/(protected)/contracts/_lib/contract-ui-helpers.ts` (+test) — removed the now-superseded `computeCloseoutWarnings`/`CloseoutChecksLike` (fully replaced by `computeBlockingItems`, confirmed unused elsewhere before deletion).
- `[id]/(workspace)/closeout/_components/` — 10 new components (`contract-closeout-status-badge`, `contract-closeout-checklist-status-badge`, `contract-closeout-header-cards`, `contract-closeout-kpi-strip`, `contract-closeout-blocking-panel`, `contract-closeout-checklist-panel`, `contract-closeout-documents-panel`, `contract-closeout-financial-panel`, `contract-closeout-module-summary-panel`, `contract-closeout-request-form`, `contract-closeout-approval-panel`) — the latter two restyled from the old `closeout-request-form.tsx`/`closeout-reviewer-panel.tsx` with their write logic (server actions, useActionState) completely unchanged.
- Deleted the 6 old closeout components (`closeout-readiness-cards.tsx`, `closeout-warnings-panel.tsx`, `closeout-request-form.tsx`, `closeout-request-status-badge.tsx`, `closeout-reviewer-panel.tsx`, `closeout-attachments-panel.tsx`) — confirmed unused elsewhere via grep before deletion.
- `[id]/(workspace)/closeout/page.tsx` — fully rewritten; fetches 10 real data sources via `Promise.allSettled` (permissions, contract, closeout checks, closeout requests, workflow summary, risks, issues, claims, document obligations, payments, variations), each independently gracefully degrading to "—"/empty on failure.

### Verification Results (2026-09-03)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors (2 rounds of `exactOptionalPropertyTypes` fixes applied to the new helper's row-level interfaces) |
| `pnpm --filter @recafco/web test --run` | ✓ 491/491 (29 new, 3 removed with the superseded helper) |
| `pnpm --filter @recafco/api test --run` | ✓ 1362/1362 (2 new) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 35 migrations, unchanged |
| Dev server restart | ✓ `.next` cleared, both web and API restarted (backend service changed); both health checks pass; Closeout tab + 11 sibling contract routes + 6 module pages all returned clean 307 redirects |
| Live UAT scenarios A–H | **Not run by the agent this unit** — same credential blocker carried over from CM-62 onward |

### Unsupported/Deferred Items

- Live UAT (credential blocker, carried over).
- Retention Amount / Retention Released — no real stored field exists anywhere in this app; both show "—" (see Real-Data Audit Findings above). A dedicated retention-tracking feature would need its own unit if the business wants this captured.
- Archive Contract / Request Missing Items / More Actions buttons — deliberately not added, no real backend workflow exists for any of them.
- "Save Draft" — not added; the real backend always creates a closeout request directly as SUBMITTED (its own comment: "DRAFT flow intentionally skipped"), so there is nothing real for a Save Draft action to call.

## CM-66F — Move Workflow & Team Tasks Breadcrumb to Header (Completed 2026-09-03)

### Summary

User caught that `/contracts/workflow` ("Workflow & Team Tasks" in the sidebar, screenshot showed "Contract Work Progress" still in-body) was skipped by CM-66E's scope-boundary decision. Rather than leaving it out, solved the actual problem: `TopHeader` now also reads `useSearchParams()` and reuses `isContractStaffOnlyAccess(user.permissions)` (already available on the `ShellUser` it already receives) to resolve all 3 of this page's real breadcrumb variants correctly, via a new `contractWorkflowBreadcrumbItems()` function that mirrors the page's own mode-resolution rules exactly (same `mode`/`assignmentOnly`/`overdueOnly`/`myTasksOnly` params, same precedence order) — a single source of truth, not a duplicated copy, since both the page's redirect logic and the header's breadcrumb resolution read the same URL the browser is actually on. Frontend/UI-only, no route/backend/permission change.

### Backend Changed — No

Zero backend files touched. `pnpm --filter @recafco/api test --run` and `pnpm db:migrate:status` both unchanged (1361/1361 tests, 35 migrations).

### Why This Is Safe Despite 3 Variants (resolves CM-66E's stated concern)

- A staff-only user can never actually land on `?mode=assignment` — the page itself redirects them to `?mode=my-tasks` server-side before any render happens, so by the time the client header reads the URL, it already reflects the real, final destination. No permission check is needed for the Assign Work branch.
- `isStaffOnly` (needed to correctly choose between the plain "Contract Work Progress" breadcrumb and the "My Tasks"/"Overdue Tasks" one for the SAME `?mode=my-tasks`/`?mode=overdue` URL) is derived via the same already-tested `isContractStaffOnlyAccess()` used everywhere else in the app, fed from `ShellUser.permissions` already passed into `TopHeader` — no new data fetch.
- `useSearchParams()` was already used unguarded (no `<Suspense>` wrapper) in 5 existing client components in this app (`*-actions-bar.tsx` files across Schedule/Payments/Issues/Claims/Closeouts) — followed the same established pattern rather than introducing a new one. Build output confirmed no Suspense-boundary warnings.

### Changes

- `_lib/contract-workspace-breadcrumb.ts` — added `contractWorkflowBreadcrumbItems(pathname, searchParams, isStaffOnly)`. +11 new tests covering all 3 variants, both param-name and alias-name (`assignmentOnly`/`overdueOnly`/`myTasksOnly`) forms, and precedence when multiple mode signals are present.
- `_components/top-header.tsx` — added `useSearchParams()`, `isContractStaffOnlyAccess` import, and `contractWorkflowBreadcrumbItems` to the resolution chain (checked after the static module map, before the workspace-detail fallback).
- `contracts/workflow/page.tsx`, `contracts/workflow/_components/assignment-queue-view.tsx`, `contracts/workflow/_components/staff-my-tasks-view.tsx` — all 3 in-body `<Breadcrumbs .../>` call sites removed + unused imports cleaned up.

### Side Effect Noted (an improvement, not a regression)

`staff-my-tasks-view.tsx` has a 4th sub-state (a specific task selected, `selectedTask` truthy) that previously showed NO breadcrumb at all (that branch returns before its own `<Breadcrumbs>` render). Since the header now shows "Contract Management > My Tasks"/"Overdue Tasks" for ANY `?mode=my-tasks`/`?mode=overdue` URL regardless of `taskId`, that sub-state now also gets a breadcrumb it didn't have before — consistent with every other page in the app, and not a regression of anything that used to work.

### Verification Results (2026-09-03)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 465/465 (11 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1361/1361 (unchanged) |
| `pnpm build` | ✓ 8/8 tasks; no `useSearchParams`/Suspense warnings in build output |
| `pnpm db:migrate:status` | ✓ 35 migrations, unchanged |
| Dev server restart | ✓ `.next` cleared, restarted; both health checks pass; `/contracts/workflow` plus all 4 query-param variants (`?mode=assignment`, `?mode=my-tasks`, `?mode=overdue`, `?assignmentOnly=true`) returned clean 307 redirects |
| Live UAT (visual header check across all 3 variants as a signed-in manager/staff) | **Not run by the agent this unit** — same credential blocker carried over from CM-62 onward |

### Unsupported/Deferred Items

- Live visual UAT of all 3 breadcrumb variants (credential blocker) — the resolver logic itself is fully unit-tested (11 cases matching every real mode/alias combination and precedence rule).
- The other 7 app modules remain out of scope, same boundary stated in CM-66E.

## CM-66E — Extend Header Breadcrumb to Other Contract Management Module Pages (Completed 2026-09-03)

### Summary

Follow-up requested directly by the user after CM-66D (not a formally numbered task spec — scope determined by the agent, documented explicitly here): extended the header-level breadcrumb from CM-66D beyond just the Contract Detail workspace to the rest of the Contract Management module's static list/register pages — Dashboard, Contract List, New Contract Register, Schedule, Payments, Issue Log, Claim Log, Closeout Requests. Each of these pages' in-body `<Breadcrumbs .../>` call was removed; the exact same breadcrumb content now renders at header level instead. Frontend/UI-only, no route/backend/permission change.

### Scope Boundary Decision (deliberate, not an oversight)

Two Contract Management pages were audited and deliberately EXCLUDED, keeping their in-body breadcrumb unchanged:
- **`/contracts/[id]/edit`** — excluded already in CM-66D; its breadcrumb contains the real `contract.referenceNumber`, not derivable from the pathname alone.
- **`/contracts/workflow`** — audited and found to render 3 DIFFERENT breadcrumbs depending on query params, each handled inside a different component: the plain page ("...> Contract Work Progress"), `AssignmentQueueView` under `?mode=assignment` ("...> Contract Work Progress > Assign Work"), and `StaffMyTasksView` under `?mode=my-tasks`/`?mode=overdue` ("...> My Tasks"/"...> Overdue Tasks"). Since `usePathname()` alone can't distinguish these, moving this one to the header would require mirroring that page's mode-parsing logic in a second file — a real duplication/drift risk. Left untouched.

This session's other 8 modules (Production, Safety & Compliance, Maintenance, Incidents, Factory Tasks, Administration, root Dashboard) were NOT touched — "other pages too" was interpreted as the rest of the Contract Management module (the module this whole CM-numbered session line has been building), not an app-wide sweep across unrelated modules built in earlier sessions.

### Backend Changed — No

Zero backend files touched. `pnpm --filter @recafco/api test --run` and `pnpm db:migrate:status` both unchanged (1361/1361 tests, 35 migrations).

### Changes

- `apps/web/src/app/(protected)/_lib/contract-workspace-breadcrumb.ts` — added `contractModuleBreadcrumbItems(pathname)`, a `Record<string, BreadcrumbItem[]>` lookup keyed by exact pathname (these are single fixed routes, not a dynamic-segment family like the workspace tabs) for the 8 static module pages. +12 new tests.
- `apps/web/src/app/(protected)/_components/top-header.tsx` — now resolves `contractModuleBreadcrumbItems(pathname) ?? (isContractWorkspaceDetailPath(pathname) ? WORKSPACE_DETAIL_BREADCRUMB : undefined)`.
- `contracts/dashboard/page.tsx` + `contracts/dashboard/_components/staff-dashboard-view.tsx` (both render the SAME "Contract Management > Dashboard" breadcrumb at the same pathname — audited and confirmed identical before removing both), `contracts/page.tsx`, `contracts/new/page.tsx`, `contracts/schedule/page.tsx`, `contracts/payments/page.tsx`, `contracts/issues/page.tsx`, `contracts/claims/page.tsx`, `contracts/closeouts/page.tsx` — removed each page's in-body `<Breadcrumbs .../>` call + now-unused import.

### Verification Results (2026-09-03)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 454/454 (12 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1361/1361 (unchanged) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 35 migrations, unchanged |
| Dev server restart | ✓ `.next` cleared, restarted; both health checks pass; 14 routes (8 module pages + Overview + edit + 3 workspace tabs) all returned clean 307 redirects |
| Live UAT (visual header placement as a signed-in manager) | **Not run by the agent this unit** — same credential blocker carried over from CM-62 onward |

### Unsupported/Deferred Items

- `/contracts/workflow`'s 3 breadcrumb variants remain in-body (see Scope Boundary Decision) — a future unit could move these too by teaching the header to also read `useSearchParams()` and mirror the exact mode logic, but that was judged higher-risk than this unit's scope justified.
- Live visual UAT of the header placement across these 8 pages (credential blocker).
- Other modules (Production, Safety, Maintenance, Incidents, Factory Tasks, Administration) were not touched — out of this unit's interpreted scope; a candidate for a future task if the user wants the pattern extended app-wide.

## CM-66D — Move Contract Workspace Breadcrumb to Top Header (Completed 2026-09-03)

### Summary

Moved the Contract Detail workspace breadcrumb ("Contract Management > Contract List > Contract Detail") out of the page body and into the global top header, at the same vertical level as the Manager name / Sign out controls — filling what was previously an empty `hidden md:block` spacer div. Applies ONLY to the 13 Contract Detail workspace pages (Overview + its 12 tabs); every other protected page (module list/register pages, `/contracts/[id]/edit`, dashboards, etc.) is unaffected — the header slot stays empty for them, exactly as before. Frontend/UI-only — no route, backend, or permission change.

### Backend Changed — No

Zero backend files touched. `pnpm --filter @recafco/api test --run` and `pnpm db:migrate:status` both unchanged (1361/1361 tests, 35 migrations).

### Breadcrumb Move / Duplicate Removal

- `apps/web/src/app/(protected)/_components/top-header.tsx` — now a client component (`usePathname()`), renders the same fixed 3-item breadcrumb (`Contract Management` → `/contracts/dashboard`, `Contract List` → `/contracts`, `Contract Detail` non-clickable) inline, left-of-center, only when `isContractWorkspaceDetailPath(pathname)` is true.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/layout.tsx` — the old in-body `<Breadcrumbs .../>` call and its now-unused import were removed. Page body now starts directly with the title/status row, exactly as required.
- `apps/web/src/app/(protected)/_components/breadcrumbs.tsx` — added an optional `className` prop, defaulting to the original `'mb-4'` so all ~60 existing callers render byte-identical to before; the new header call site passes `className="mb-0"` since it sits inline with Manager / Sign out rather than stacked above page content.

### Route-Shape Detection (not a hardcoded id/URL guess)

New pure helper `apps/web/src/app/(protected)/_lib/contract-workspace-breadcrumb.ts` — `isContractWorkspaceDetailPath(pathname)` distinguishes `/contracts/[id](/<tab>)?` from every other `/contracts/*` route using the REAL file-system routing shape (not a UUID regex guess): a `CONTRACT_MODULE_SEGMENTS` set of the real literal top-level folders (`dashboard`, `new`, `workflow`, `schedule`, `payments`, `issues`, `claims`, `closeouts`, `closeout`) that sit as siblings of `[id]/`, and a `WORKSPACE_TAB_SEGMENTS` set of the real folder names inside `contracts/[id]/(workspace)/`. `/contracts/[id]/edit` is deliberately excluded (audit confirmed it lives OUTSIDE the `(workspace)` route group, has its own distinct 4-item breadcrumb with the real contract reference number, and does not render the tab bar) — matching the task's own "if it uses the same workspace layout" condition, which it doesn't. +25 tests covering every module page, every workspace tab, the edit page, and unrelated routes.

### Top Header / Body Spacing Behavior

Header: `hidden md:block min-w-0 flex-1` slot (was a bare empty `hidden md:block` div) — holds the breadcrumb only on workspace pages, empty otherwise; `flex-wrap` (inherited from `Breadcrumbs`) lets it wrap rather than overflow on a narrower desktop width, and the right-side user-info/Sign out block got an explicit `shrink-0` so it's never compressed by a long breadcrumb. Body: removing the in-body breadcrumb (plus its `mb-4`) moves the contract title/status row visibly closer to the top on every workspace tab.

### Tab Wrap / Route / Staff Regression

- CM-66C's full flat 13-tab row (no More dropdown, full names, flex-wrap) is untouched — `contract-workspace-tabs.tsx` was not modified this unit.
- All 13 workspace tab URLs, `/contracts/[id]/edit`, and all 8 module-level pages (`/contracts`, `/contracts/dashboard`, `/contracts/new`, `/contracts/workflow`, `/contracts/payments`, `/contracts/issues`, `/contracts/claims`, `/contracts/closeouts`) verified with clean 307s.
- `isContractStaffOnlyAccess`/the workspace layout's staff redirect were not touched — staff-only-access users still never reach this layout at all, so the header breadcrumb change has zero effect on them.

### Verification Results (2026-09-03)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 442/442 (25 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1361/1361 (unchanged) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 35 migrations, unchanged |
| Dev server restart | ✓ `.next` cleared, restarted; both health checks pass; 22 routes (13 workspace tabs + edit + 8 module pages) all returned clean 307 redirects |
| Live UAT (visual header/body placement as a signed-in manager) | **Not run by the agent this unit** — same credential blocker carried over from CM-62 onward |

### Unsupported/Deferred Items

- Live visual UAT of the header breadcrumb placement/wrap at real viewport widths (credential blocker).
- No automated component-render test added for `top-header.tsx`/`AppShell`, consistent with this codebase's 100%-`.test.ts` convention — the new route-shape logic itself IS fully unit-tested (25 tests) since that's the actual decision logic; only the surrounding JSX render was left unverified live.

## CM-66C — Contract Workspace Full Tab Row Wrap Fix (Completed 2026-09-03)

### Summary

Reverted CM-66B's "primary row + More dropdown" grouping per explicit instruction: hiding 5 tabs (Variations, Claims, Risk Assessment, Attachments, Activity) behind a dropdown made them harder to find, not easier. `ContractWorkspaceTabs` now shows all 13 tabs directly with their full names, laid out with `flex flex-wrap` instead of a horizontal-scroll strip or a dropdown — the row wraps onto a second line when the viewport is too narrow to fit all 13, instead of clipping text or scrolling. Frontend/UI-only — no route, page, backend, or permission change.

### Backend Changed — No

Zero backend files touched. `pnpm --filter @recafco/api test --run` and `pnpm db:migrate:status` both unchanged (1361/1361 tests, 35 migrations).

### Full Tab Restoration

All 13 tabs render as direct links with their full names again: Overview, Schedule, Payments, Production Status, Variations / Change Orders, Claims, Risk Assessment, Documents & Obligations, Workflow & Team Tasks, Issue Log, Attachments, Activity / Audit History, Closeout. The More dropdown, its state, its click-outside/Escape handling, and the scroll-fade/auto-scroll machinery from CM-66B were all removed — the component is now a single flat `WORKSPACE_TABS` array rendered in one `<nav>` with no scroll container.

### Two-Row Wrap Behavior

The tab `<nav>` uses `flex flex-wrap items-center gap-1` (was `overflow-x-auto` in CM-66B, was a fixed non-wrapping row before CM-66B). Each tab link keeps `whitespace-nowrap` so an individual label is never clipped mid-word — only the BREAK between tabs wraps, never inside one. The soft `bg-surface-secondary` background and `p-1` padding wrap around however many rows render, so a two-row bar still reads as one cohesive tab bar, not two separate ones.

### Activity Tab Visibility

"Activity / Audit History" is a direct tab in the flat list (position 12 of 13, immediately before Closeout) — no longer nested inside any dropdown.

### Verification Results (2026-09-03)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `@recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 417/417 (unchanged) |
| `pnpm --filter @recafco/api test --run` | ✓ 1361/1361 (unchanged) |
| `pnpm build` | ✓ 8/8 tasks; all 13 workspace sub-routes present, unchanged |
| `pnpm db:migrate:status` | ✓ 35 migrations, unchanged |
| Dev server restart | ✓ `.next` cleared, restarted; both `localhost:3000/` and `localhost:4000/health` responding; all 13 direct tab URLs + Contract List/Dashboard/New Register returned clean 307 redirects (no 500s) |
| Live UAT (visual wrap/active-pill check as a signed-in manager) | **Not run by the agent this unit** — same credential blocker carried over from CM-62 onward |

### Unsupported/Deferred Items

- Live visual UAT of the wrap behavior at real viewport widths (credential blocker) — the 307 smoke-check and build/typecheck confirm the component renders without error, but the actual line-wrap point at a manager's real screen width is unverified this unit.
- No automated component-render test added, consistent with CM-66B's reasoning — this codebase's web suite is 100% pure-function `.test.ts` files, 0 `.test.tsx`.

## CM-66B — Contract Workspace Tab Navigation UX Fix (Completed 2026-09-03)

### Summary

Fixed the overcrowded Contract Detail workspace tab row (13 tabs — including the new CM-66 Activity tab — squeezed into one horizontal scroll strip, causing clipped labels like "dule" and an effectively-hidden Activity tab). Rebuilt `ContractWorkspaceTabs` into a grouped nav: 8 primary tabs (Overview, Schedule, Payments, Production, Workflow, Issues, Documents, Closeout) always visible in one row, plus a pinned "More" dropdown (Variations, Claims, Risk Assessment, Attachments, Activity) that is never scrolled out of view. Frontend/UI-only — no route, page, backend, or permission change.

### Backend Changed — No

Zero backend files touched. `pnpm --filter @recafco/api test --run` and `pnpm db:migrate:status` are both unchanged (1361/1361 tests, 35 migrations) — proving no backend/schema impact.

### Route Preservation

All 13 workspace sub-routes (`schedule`, `payments`, `production`, `variations`, `claims`, `risks`, `documents`, `workflow`, `issues`, `attachments`, `activity`, `closeout`, plus the root Overview page) are unchanged — confirmed present in `pnpm build` output before and after. Only the tab component's DISPLAY grouping changed; every `href` still points to the exact same segment as before.

### Active State / More Behavior

- Primary tab active: same red accent pill style as before (`bg-accent text-white`), driven by `pathname === href`.
- A More-dropdown page active: the More button itself takes the pill style and its label becomes `More: <label>` (e.g. "More: Activity"), with the section's own icon replacing the chevron — satisfying the task's preferred behavior (not just the "highlighted only" fallback).
- Inside the open dropdown, the current item gets a highlighted row (`bg-surface-secondary font-semibold` + a small accent-colored check icon) rather than a full accent-red block — avoids the CM-64C "accent reads as an error/danger" issue for a plain list row while still clearly marking the current page.
- Dropdown closes on: item click, click-outside (fixed-overlay pattern reused from `contract-row-actions.tsx`), Escape key, and any pathname change (covers browser back/forward).

### Staff/Access Behavior

Audited `isContractStaffOnlyAccess` — Contract Staff (`contracts.workflow_update` only, no `update`/`close`) are redirected away from the ENTIRE workspace layout (`layout.tsx`, before `ContractWorkspaceTabs` ever renders) to `/contracts/workflow?mode=my-tasks`, unchanged. No tiered/partial-access role exists that reaches this tab bar with a reduced tab set — confirmed there was no such filtering before this unit either, so nothing was removed or weakened.

### Verification Results (2026-09-03)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` / `pnpm --filter @recafco/api typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 417/417 (unchanged — no test file touches this component, consistent with this codebase's zero-`.test.tsx` convention) |
| `pnpm --filter @recafco/api test --run` | ✓ 1361/1361 (unchanged — confirms zero backend impact) |
| `pnpm build` | ✓ 8/8 tasks; all 13 workspace sub-routes present, unchanged |
| `pnpm db:migrate:status` | ✓ 35 migrations, unchanged |
| Dev server restart | ✓ `.next` cleared, restarted; both `localhost:3000/` and `localhost:4000/health` responding; all 13 direct tab URLs + Contract List/Dashboard/New Register returned clean 307 redirects (no 500s) |
| Live UAT (visual pill/dropdown check as a signed-in manager) | **Not run by the agent this unit** — same credential blocker carried over from CM-62 onward |

### Unsupported/Deferred Items

- Live visual UAT of the new pill/dropdown rendering (credential blocker).
- No automated component-render test was added for `ContractWorkspaceTabs` — this codebase's web test suite is 100% pure-function `.test.ts` helpers (0 `.test.tsx` files anywhere), so adding a React-render test here would introduce a new testing pattern outside this unit's UI-only scope; regression coverage instead relies on typecheck + build route-manifest confirmation + the 307 smoke-check above.

## CM-66 — Contract Activity / Audit History Page Build, Simplified (Completed 2026-09-03)

### Summary

Built the Contract Detail Activity / Audit History tab as a clean, contract-scoped audit trail: page title, subtitle, Export button, 5 Summary KPI cards, search/filter row, activity table — following the approved design simplified per this unit's own explicit instruction: no Contract Summary card, no "Activity by Type" donut chart, no "Top Users by Activity" card, no Quick Links card, no Back to Contract/Go to Closeout buttons, no IP Address column (no field for it is stored anywhere in the write paths this unit touches). Activity / Audit History shows real, already-stored history of important actions taken inside this contract — never a fabrication derived from existing records.

Audit found a real `ContractActivity` table already existed (`contract_activities`), already written to by `contracts.service.ts` (created/updated/schedule_status_updated/activated/terminated/closed/comment_added) and `contract-closeout.service.ts` (closeout_requested/review_started/approved/rejected/attachment_uploaded), and already read via a working `GET /contracts/:id/activities` endpoint. Reused this table entirely instead of the task's own suggested fallback `ContractActivityLog` model — **zero migration, zero new Prisma model.**

### Backend Changed — Yes, additive, no migration

1. `listActivities()`'s `orderBy` changed from ascending to descending (`createdAt: 'desc'`) — the table needs newest-first, and this endpoint's only real consumer is this new tab, so the change is safe. A pre-existing test asserting `'asc'` was caught by audit and fixed proactively.
2. Added a new plain (non-injectable) helper, `contract-activity-log.ts`'s `logContractActivity(db, contractId, actor, event, metadata?)`, deliberately a function rather than a NestJS service so it can be called from 6 existing services without adding a constructor dependency to any of them (which would have forced touching every affected test file's service-instantiation call). It wraps the write in try/catch and never throws — a logging failure must never break the real operation it records.
3. Wired `logContractActivity` into 6 services that previously logged nothing: Payments (`payment_created`/`payment_updated`), Documents & Obligations (`document_obligation_created`/`_updated`/`_attachment_uploaded`), Variations (`variation_created`/`_updated`/`_attachment_uploaded`), Claims (`claim_created`/`_updated` only — not `close()`, a deliberate scope-bounding decision), Risks (`risk_created`/`_updated`), Issues (`issue_created`/`_updated` only — not `close()`, same reasoning as Claims).

### Event → Type/Source/Details Mapping (a genuine, documented finding)

`_lib/contract-activity-helpers.ts` maps all 26 real event strings to the task's preferred `ActivityType`/`ActivitySource` enums and produces manager-friendly action labels/details sentences. Key honesty decision: `document_obligation_created`/`_updated` (record-level, no file) map to `OTHER`, never `DOCUMENT_UPLOADED` — that type is reserved strictly for the 3 real `*_attachment_uploaded` events, since no file was actually uploaded for a plain record edit. Old/New Value reads the real `previousStatus`/`newStatus` DB columns first (set only by `activated`/`terminated`/`closed`), falls back to the real `previousScheduleStatus`/`newScheduleStatus` metadata pair (`schedule_status_updated`), else shows "—" — never fabricated.

"Review/Approval Actions" KPI (the task's preferred option, not its "Workflow Actions" fallback) is real and non-zero: `closeout_review_started`/`closeout_approved`/`closeout_rejected` are genuinely identifiable review/approval events.

### Changes

- `apps/api/src/contracts/contract-activity-log.ts` (new, +test) — shared logging helper.
- `apps/api/src/contracts/contracts.service.ts` (+test) — `listActivities()` orderBy → desc.
- `apps/api/src/contracts/contract-payments.service.ts`, `contract-document-obligations.service.ts`, `contract-variations.service.ts`, `contract-claims.service.ts`, `contract-risks.service.ts`, `contract-issues.service.ts` (all +tests) — activity logging wired into create/update (and attachment-upload where applicable).
- `apps/web/.../contracts/_lib/contract-activity-helpers.ts` (new, +test) — type/source/label/details/old-new-value mapping, `computeActivitySummary()`.
- `apps/web/.../contracts/_lib/contract-activity-csv.ts` (new, +test) — CSV export builder, no raw metadata JSON, no internal IDs.
- `[id]/(workspace)/activity/_components/` — `contract-activity-source-badge.tsx`, `contract-activity-action-badge.tsx` (neutral icon+label, not a status badge), `contract-activity-kpi-strip.tsx` (5 cards: Total Activities=blue/info, Updates This Month=teal, Documents Uploaded=indigo/team-production, Status Changes=amber/warning, Review/Approval Actions=green/success), `contract-activity-panel.tsx` (bounded, client-side-filtered; sticky Date&Time/Action columns; search + Activity Type/User/Source/Date Range filters; "Action" column links to the real workspace tab the event happened in).
- `[id]/(workspace)/activity/page.tsx` (rewritten) — removed the old stub "Activity Summary" dl block; new heading + Export Excel link, KPI strip, panel.
- `[id]/(workspace)/activity/export/route.ts` (new) — mirrors `documents/export/route.ts`, reuses `contractsApi.listActivities()`, no new backend endpoint.
- Deleted `apps/web/.../contracts/_components/contract-activity-table.tsx` (old unused shared table, confirmed via grep to have no other callers).

### Verification Results (2026-09-03)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/api typecheck` / `pnpm --filter @recafco/web typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 417/417 (27 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1361/1361 (9 new) |
| `pnpm build` | ✓ 8/8 tasks; `/contracts/[id]/activity` and `/contracts/[id]/activity/export` both present |
| `pnpm db:migrate:status` | ✓ 35 migrations, unchanged — confirms no migration was added |
| Dev server restart | ✓ `.next` cleared, both web and API restarted (backend service changed); `localhost:3000/` and `localhost:4000/health` both confirmed responding; unauthenticated smoke check of the new Activity routes plus 10 sibling contract pages all returned clean 307 redirects (no 500s) |
| Live UAT scenarios | **Not run by the agent this unit** — same credential blocker carried over from CM-62 onward |

### Unsupported/Deferred Items

- Live UAT (blocked on credentials).
- Workflow task update/comment/attachment actions are not logged — judged too large/risky to add in this unit; a good candidate for a focused follow-up if raised.
- Claims'/Issues' `close()`/settle actions are not logged (only `create`/`update`) — deliberate scope-bounding, consistent between the two.
- No IP Address column/field anywhere — not captured reliably by any write path in this app.
- Historical limitation: the 6 newly-logging services only have activity history from this unit's ship date forward; Overview/Closeout have deeper history from an earlier unit.

## CM-65 — Contract Issue Log Approved Design Build, Simplified (Completed 2026-09-03)

### Summary

Rebuilt the Contract Detail Issue Log tab to match the approved design, simplified per this unit's own explicit instruction: no Contract Summary card, no "Issues by Category" donut chart, no "Recent Issue Activity" card, no bottom KPI strip, no Back to Contract/Dashboard Overview buttons — none of those are backed by real reliable data (no category-trend tracking, no per-issue activity feed anywhere in this app), and the user is already inside the contract workspace with the layout's own header providing contract context. Issue Log tracks a problem that has ALREADY happened and needs follow-up until resolved (final payment not received, document missing, delivery delay, client approval pending, site access issue, quality/test report pending, variation cost disagreement) — explicitly never confused with Risk Assessment (future/potential risk).

Unlike most CM-6x contract-detail tabs (which started as static stubs), Issue Log — like Claims (CM-61) — already had a fully working backend, Add/Edit modal, and module-level register from CM-30. This unit reused everything write-related unmodified (`IssueFormModal`, `createIssueAction`/`updateIssueAction`/`closeIssueAction`, the module-level CSV export) and only built a new *display* layer for this one tab — same "contract-scoped page reuses shared write actions, builds its own display layer" pattern established for Payments/Claims/Risk/Documents & Obligations.

### Backend Changed — Yes, minimal and additive (no migration)

Audit found `ContractIssueSummary`/`computeIssueSummary()` (existing, from CM-30) was missing two counters this unit's approved KPI row needs: "Waiting" (status === WAITING_RESPONSE) and "Resolved" (status === RESOLVED, distinct from CLOSED). Added `waitingResponseIssues`/`resolvedIssues` to both the `IssueSummary` interface and `computeIssueSummary()` — pure counter additions to an already-selected `status` field, no new Prisma query, no schema change, no migration. `contract-issues.service.test.ts` updated (both new counters asserted); `contracts-api.ts`'s `ContractIssueSummary` interface updated to match.

### Category Label Mapping (a genuine, documented finding)

The task's "preferred display labels" (Payment, Document, Delivery, Technical, Site / Erection, Client Approval, Variation, Quality, Other — 9 labels) do not literally match the real backend category list (`Commercial, Technical, Production, Delivery, Erection, Client, Document, Payment, Other` — 9 values, plain-string-validated per CM-30, not a DB enum). Resolved as a pure display relabeling (`_lib/contract-issue-detail-helpers.ts`'s `ISSUE_CATEGORY_LABELS`), never touching the stored value or the backend's validation list: `Commercial` → "Variation" (a variation cost disagreement is inherently a commercial dispute — matches this unit's own example), `Production` → "Quality" (a quality/test-report issue is tracked under Production in this factory-manufacturing context), `Erection` → "Site / Erection", `Client` → "Client Approval"; the remaining 5 are unchanged. All 9 real values map to exactly one preferred label — none invented, none dropped.

### Changes

- `apps/api/src/contracts/contract-issues.service.ts`, `contract-issues.service.test.ts` — `waitingResponseIssues`/`resolvedIssues` added to `IssueSummary`/`computeIssueSummary()`.
- `apps/web/src/lib/contracts-api.ts` — `ContractIssueSummary` extended to match.
- `apps/web/src/app/(protected)/contracts/_lib/contract-issue-detail-helpers.ts` (new, +test) — category/priority/status label + badge-class maps, filter option lists, `computeIssueDaysRemaining()`/`computeIssueIsDueSoon()`/`formatIssueDaysRemaining()` (pure, client-side — the backend's own `overdueDays`/`isOverdue` only cover the "already overdue" case, not a future "days remaining" count needed for the amber "due soon" state).
- `[id]/(workspace)/issues/_components/` — `contract-issue-category-badge.tsx`, `contract-issue-priority-badge.tsx` (gray→amber→red→solid-red escalation, matching Risk Assessment's pattern), `contract-issue-status-badge.tsx` (Waiting Response uses real indigo `team-production`, never this theme's red `accent` token — see CM-64C), `contract-issue-kpi-strip.tsx` (6 cards, `valueClassName` color-coded from the first build per the KPI-strip color hierarchy already established across recent tabs), `contract-issue-panel.tsx` (bounded, client-side-filtered table; sticky Issue ID/Action columns, matching Claims/Risk/Attachments — the task explicitly asked for sticky in THIS unit's first build, not deferred to a polish pass).
- `[id]/(workspace)/issues/page.tsx` — rewritten from the previous "Issue Status" stub-style summary + "Open in Issue Register" link into the full simplified approved-design tab.

### Wording Decisions Applied

- Table column and filter/KPI wording use "Action Due Date" throughout (never bare "Due Date") — same underlying `dueDate` field, display wording only. The reused `IssueFormModal`'s own internal field label is deliberately left as "Due Date" (unmodified — it's shared with the module-level Issue Register, and this unit's own instruction was to reuse the existing modal/action, not edit it).
- "Raised By" column = the issue's real `createdByUser.displayName` (set from the actual authenticated actor on create, per CM-30) — never fabricated, matches this unit's own "use current user if existing action already does" instruction.
- Export reuses the module-level `/contracts/issues/export?contractId=` route completely unmodified (same pattern as Claims' own reused export) — its CSV columns are the pre-existing module-level set (includes Contract ID/Name/Client, redundant-but-harmless for a single-contract export; still says "Due Date" not "Action Due Date"; has no "Raised By" column) — a deliberate reuse decision, not fixed, to avoid touching a shared component beyond this unit's scope.

### Verification Results (2026-09-03)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/api typecheck` / `pnpm --filter @recafco/web typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 390/390 (17 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1352/1352 (assertions extended in `contract-issues.service.test.ts`, same file/test count) |
| `pnpm build` | ✓ 8/8 tasks; `/contracts/[id]/issues` present alongside the unchanged `/contracts/issues`/`/contracts/issues/export` |
| `pnpm db:migrate:status` | ✓ up to date, 35 migrations (unchanged) |
| Dev server restart | ✓ `.next` cleared, both web and API restarted (backend service changed); `localhost:3000/` and `localhost:4000/health` both confirmed responding; unauthenticated smoke check of the Issues routes plus 6 other contract pages all returned clean 307 redirects (no 500s) |
| Live UAT scenarios A–G | **Not run by the agent this unit** — same credential blocker carried over from CM-62 onward |

### Unsupported/Deferred Items

- Live UAT scenarios A–G (blocked on credentials).
- CSV export column drift from the new table (see "Wording Decisions Applied" above) — deliberately not fixed to avoid touching the shared module-level export beyond this unit's scope; a good candidate for a focused CM-65B polish pass if raised.
- KPI value color-coding was applied directly in this first build (via `valueClassName`) rather than deferred to a polish unit — following the KPI-strip convention already in place on every tab built since CM-62B, not the older CM-58→58B first-build/polish split.

## CM-64D — Remove Attachments Contract Summary Card (Completed 2026-09-03)

### Summary

Removed the Contract Summary card added in CM-64/64B/64C from the Attachments / Document Library tab — the user is already inside the contract workspace, and the layout's own header (`[id]/(workspace)/layout.tsx`: contract name, status, reference number, department, dates) already provides that context on every tab. The Attachments page now goes straight from the page title/subtitle into the KPI strip, keeping the page focused on finding/filtering/exporting/downloading files as this task's own stated goal.

### Backend Changed — No

Confirmed frontend-only. `contractsApi.getContractAttachments()` (the aggregation the KPI strip and table both depend on) is completely unaffected — this unit only stopped fetching the separate `contractsApi.get(id)` call the now-deleted summary card needed, which was never used by the KPI strip, filters, or table.

### Changes

- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/attachments/page.tsx` — `ContractAttachmentSummaryCard` removed from the render; the `contractsApi.get(id)` fetch (only ever used by that card) removed from the `Promise.all`, along with its `contract` gating check.
- `attachments/_components/contract-attachment-summary-card.tsx` — deleted (no longer referenced anywhere).

### Verification Results (2026-09-03)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 373/373 (unchanged) |
| `pnpm --filter @recafco/api test --run` | ✓ 1352/1352 (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks, same route list |
| `pnpm db:migrate:status` | ✓ up to date, 35 migrations (unchanged) |
| Dev server restart | ✓ `.next` cleared, `pnpm dev` restarted; `localhost:3000/` and `localhost:4000/health` both confirmed responding; unauthenticated smoke check of the Attachments routes plus 4 other contract pages all returned clean 307 redirects (no 500s) |
| Live UAT scenarios A–D | **Not run by the agent this unit** — same credential blocker carried over from CM-62 onward |

### Unsupported/Deferred Items

- Live UAT scenarios A–D (blocked on credentials).

## CM-64C — Attachments Final UI Polish (Completed 2026-09-02)

### Summary

Pure frontend polish pass on the Attachments / Document Library page — no data, filter, download, or export logic changed. The audit surfaced a real, non-cosmetic-only finding: this theme's `accent` token (`context/ui-tokens.md`: `--color-accent: #c62828`) is RECAFCO's brand red, described in that same file as "for branding and primary actions" — not a neutral color. The File Name download link and the Variation source badge were both using `text-accent`/`bg-accent-light text-accent`, which made a routine file link and a routine source badge visually read as an error/danger state. This had been carried through CM-64/64B without being flagged. Fixed by switching to `text-info` (real blue, #175cd3 — the same family already used for "informational" elsewhere in this app) for the file link, and `team-production` (real indigo, #4f46e5) for the Variation badge — both genuine existing tokens, not new ones.

### Backend Changed — No

Confirmed zero backend files touched this unit.

### Corrections Applied

- **File Name link** — `text-accent` → `text-info`. Reads as a normal hyperlink now, not an error state.
- **Variation source badge** — `bg-accent-light text-accent` → `bg-team-production-light text-team-production`. Workflow blue / Variation indigo / Documents & Obligations teal / Closeout green — 4 calm, distinct colors, none alarming.
- **Category badge** — lightened from `font-semibold text-text-secondary` to `font-medium text-text-muted`, so it reads as a quieter secondary label next to the more prominent Source badge rather than a second "selected" chip.
- **Status "Uploaded" badge** — already `bg-success-light text-success` (subtle green) from CM-64B; confirmed correct, left unchanged.
- **Contract Summary card** — trimmed vertical padding/gaps (`p-5`→`p-4`, header `mb-4`→`mb-3`, field `gap-y-3`→`gap-y-2.5`, divider padding `py-4`→`py-3`, field labels `text-xs`→`text-[11px]`) for a more compact card — same 10 real fields, no field added or removed.
- **KPI strip** — audited, confirmed already correct (5 cards, correct labels/counts, consistent spacing with sibling tabs) — left unchanged, no adjustment needed.
- **Filter row** — audited, confirmed already correct and consistent with the established Claims/Risk/Documents & Obligations filter-row pattern — left unchanged.
- **Row hover, sticky columns, Download button** — audited, confirmed already correct — left unchanged.

### Changes

- `apps/web/src/app/(protected)/contracts/_lib/contract-attachment-helpers.ts` — `ATTACHMENT_SOURCE_BADGE_CLASSES.VARIATION` recolored.
- `attachments/_components/contract-attachment-panel.tsx` — File Name link recolored.
- `attachments/_components/contract-attachment-category-badge.tsx` — text weight/color softened.
- `attachments/_components/contract-attachment-summary-card.tsx` — padding/gaps trimmed.
- `attachments/page.tsx` — doc-comment updated.

### Verification Results (2026-09-02)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 373/373 (unchanged — pure visual polish, no new/changed pure-function logic) |
| `pnpm --filter @recafco/api test --run` | ✓ 1352/1352 (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks, same route list as CM-64B |
| `pnpm db:migrate:status` | ✓ up to date, 35 migrations (unchanged) |
| Dev server restart | ✓ `.next` cleared, `pnpm dev` restarted; `localhost:3000/` and `localhost:4000/health` both confirmed responding; unauthenticated smoke check of the Attachments routes plus 5 other contract pages all returned clean 307 redirects (no 500s) |
| Live UAT scenarios A–D | **Not run by the agent this unit** — same credential blocker carried over from CM-62 onward |

### Unsupported/Deferred Items

- Live UAT scenarios A–D (blocked on credentials).
- The `accent` = brand-red-reads-as-danger finding likely also affects other contract-detail tabs that use `text-accent`/`bg-accent-light` for plain links or non-alarming badges (e.g. Claims/Variations upload-section download links, Documents & Obligations' Insurance category badge) — out of scope for this unit (Attachments-only), but worth a dedicated audit-and-fix pass across the Contract Management module if the same "looks like an error" complaint comes up elsewhere.

## CM-64B — Attachments Page Approved Table/KPI Alignment (Completed 2026-09-02)

### Summary

Corrected the Attachments / Document Library page after CM-64 to more closely match the approved table/KPI structure, while keeping every CM-64 simplification decision in place (still no Storage Summary/Document Status Overview/Quick Links/Supported Formats sidebar, still no fake approval workflow). KPI labels were reworded to a document-library tone (Workflow Documents/Variation Documents/Documents & Obligations/Closeout Documents, not "...Files"). The table gained two columns the approved design has that CM-64 omitted: **Category** and **Status**, and "Related Item" was renamed "Related To". Category is derived honestly — real Documents & Obligations category (Performance Bond, Insurance, etc.) when the backend provides one, otherwise a safe generic label per source (Workflow Document/Variation Document/Contract Document/Closeout Document); Status is always the single honest value "Uploaded" — never a fabricated Approved/Pending Review.

### Backend Changed — Yes, minimal and additive (no migration)

Audit proved the existing `ContractAttachmentsService` aggregation was genuinely missing one real field needed for an honest Category column: a Documents & Obligations attachment's own real `category` (already stored on `ContractDocumentObligation`, already used elsewhere — see CM-63/63B) wasn't being selected or returned. Added `category: true` to that one Prisma `select`, and a new `documentObligationCategory: string | null` field to `AggregatedAttachment` — `null` for the other 3 sources (which genuinely have no category field), the real enum value for Documents & Obligations. No schema change, no migration — purely a `select` addition to an already-existing read-only service. `contract-attachments.service.test.ts` updated (added `category` to its Documents & Obligations fixture, added `documentObligationCategory` assertions for all 4 sources) — 7/7 still passing.

### Corrections Applied

- **KPI labels** — "Workflow Files" → "Workflow Documents", "Variation Files" → "Variation Documents", "Documents & Obligations Files" → "Documents & Obligations", "Closeout Files" → "Closeout Documents"; subtexts matched to the approved copy exactly ("Required documents" for Documents & Obligations). Each card's value text also color-coded via `valueClassName` (same accent as its icon) for a stronger look — `DashboardKpiCard`'s own shared icon/value sizing was left untouched since it's used by many other pages.
- **Table** — added Category (`ContractAttachmentCategoryBadge`, neutral gray) and Status (`ContractAttachmentStatusBadge`, "Uploaded" always, green) columns; "Related Item" → "Related To"; search now also matches the derived category; File Name/Action stay sticky.
- **Contract Summary** — regrouped from a flat 5-column grid into 3 visually distinct column groups (identity / management / value) with dividers between them, closer to the approved grouped layout — same 10 real fields, no new data.
- **Export CSV** — columns now match the table exactly (File Name, Category, Source, Related To, Uploaded By, Uploaded Date, Status, Type, Size) — still never includes `downloadPath`/storage path.
- **No Category filter added** — reported as intentional per the task's own "optional, only if it doesn't crowd the row" instruction; Category is already reachable via the main search box.
- **No Upload File button** — unchanged decision from CM-64, re-confirmed: no general contract-level attachment model exists.

### Changes

- `apps/api/src/contracts/contract-attachments.service.ts`, `contract-attachments.service.test.ts`
- `apps/web/src/lib/contracts-api.ts` — `ContractAttachment.documentObligationCategory`
- `apps/web/src/app/(protected)/contracts/_lib/contract-attachment-helpers.ts` (+test) — `deriveAttachmentCategory()`, `ATTACHMENT_STATUS_LABEL`
- `_lib/contract-attachment-csv.ts` (+test) — columns updated
- `attachments/_components/contract-attachment-category-badge.tsx` (new), `contract-attachment-status-badge.tsx` (new), `contract-attachment-kpi-strip.tsx`, `contract-attachment-panel.tsx`, `contract-attachment-summary-card.tsx`
- `attachments/page.tsx` — doc-comment updated

### Verification Results (2026-09-02)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/api typecheck` / `pnpm --filter @recafco/web typecheck` | ✓ 0 errors (no `@recafco/database` rebuild needed — `select`-only addition, no schema/migration change) |
| `pnpm --filter @recafco/web test --run` | ✓ 373/373 (7 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1352/1352 (`contract-attachments.service.test.ts`'s 7 tests updated, still 7 — assertions extended, no new test count) |
| `pnpm build` | ✓ 8/8 tasks, same route list as CM-64 |
| `pnpm db:migrate:status` | ✓ up to date, 35 migrations (unchanged) |
| Dev server restart | ✓ `.next` cleared, both web and API restarted (backend service changed); `localhost:3000/` and `localhost:4000/health` both confirmed responding; unauthenticated smoke check of the Attachments routes plus 7 other contract pages all returned clean 307 redirects (no 500s) |
| Live UAT scenarios A–F | **Not run by the agent this unit** — same credential blocker carried over from CM-62 onward |

### Unsupported/Deferred Items

- Live UAT scenarios A–F (blocked on credentials).
- Category filter — deliberately not added (see "No Category filter added" above).

## CM-64 — Attachments / Document Library Approved Design Simplified Build (Completed 2026-09-02)

### Summary

Rebuilt the Contract Detail Attachments tab to match the approved design, but deliberately SIMPLIFIED per the task's own explicit instruction: the approved screenshot's right sidebar (Storage Summary donut, Document Status Overview, Quick Links, Supported Formats) and its Pending Review / Approved Documents / Expiring Documents / Missing Required KPI cards were all removed rather than rebuilt, because none of them are backed by real data anywhere in this app — there is no storage-quota tracking, no generic attachment approval/review workflow, and no "required document" checklist concept. Building any of those would have meant fabricating numbers. This is a continuation of the same decision CM-60C already made for the old "File Status" stub section.

Confirmed via audit (per the task's own question) that this entire unit was achievable as **frontend-only** — `ContractAttachmentsService`'s existing aggregation (4 real sources: Workflow, Variations, Documents & Obligations, Closeout) already returns everything the approved table/KPI/filter/export needs (`relatedItemTitle` added in CM-63 already covers the "Related Item" column); no backend endpoint, DTO, or migration was touched.

### Backend Changed — No

Confirmed zero backend files touched. `ContractAttachmentsService.listAllForContract()`, all 4 download proxy routes (workflow task/variation/closeout/document-obligation), and every source's own real upload path are all byte-for-byte unchanged.

### Approved Design Simplification Applied

- **Removed entirely** (per explicit instruction): Expiring Documents KPI card, Storage Summary, Document Status Overview, Quick Links, Supported Formats. No right sidebar at all — single-column central-library layout.
- **KPI cards** — 5 real per-source file counts only (Total Files, Workflow Files, Variation Files, Documents & Obligations Files, Closeout Files), computed by a new pure function `computeAttachmentSourceCounts()`. No Pending Review/Approved/Missing Required.
- **No Upload File action** — confirmed and reported per the task's own instruction: no general contract-level attachment model exists (only 4 separate per-source attachment tables), so a 5th "Upload File" button here would either duplicate an existing upload path or silently go nowhere. Upload stays in each source's own tab; this page is read-only.
- **Contract Summary card** — added, using only real `Contract` fields already established by the existing `ContractInfoCard` convention (Contract ID = `referenceNumber`, Contract Manager = `ownerUser.displayName`, etc.): Contract ID, Job Order, Contract Name, Client / Employer, Contract Manager, Contract Status, Start Date, Forecast Completion, Current Contract Value, Currency. "Main Contractor" and "Actual Completion" from the screenshot were deliberately NOT added — no such field exists on the real `Contract` model.

### Changes

- `apps/web/src/app/(protected)/contracts/_lib/contract-attachment-helpers.ts` (new) — `ATTACHMENT_SOURCE_BADGE_CLASSES`, `ATTACHMENT_SOURCE_FILTER_OPTIONS`, `deriveAttachmentType()` (real MIME type first, file extension fallback, never a guessed type), `formatAttachmentSize()`, `computeAttachmentSourceCounts()`. Plus its test file.
- `_lib/contract-attachment-csv.ts` (new) + `attachments/export/route.ts` (new) — per-contract CSV export using the same real aggregation already backing the table; never includes `downloadPath`/storage path. Plus its test file.
- `attachments/_components/contract-attachment-source-badge.tsx`, `contract-attachment-kpi-strip.tsx`, `contract-attachment-summary-card.tsx`, `contract-attachment-panel.tsx` (all new).
- `attachments/page.tsx` — rewritten; now also fetches `contractsApi.get(id)` (same established pattern as `payments`/`closeout` tabs) to power the new Contract Summary card.

### Verification Results (2026-09-02)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 366/366 (16 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1352/1352 (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks; `/contracts/[id]/attachments` and `/contracts/[id]/attachments/export` both present |
| `pnpm db:migrate:status` | ✓ up to date, 35 migrations (unchanged) |
| Dev server restart | ✓ `.next` cleared, `pnpm dev` restarted; `localhost:3000/` and `localhost:4000/health` both confirmed responding; unauthenticated smoke check of the new Attachments routes plus 7 other contract pages all returned clean 307 redirects (no 500s) |
| Live UAT scenarios A–F | **Not run by the agent this unit** — same credential blocker carried over from CM-62/62B/63/63B |

### Unsupported/Deferred Items

- Live UAT scenarios A–F (blocked on credentials, see CM-62's own note for detail).
- No general contract-level attachment/upload model — reported per the task's own instruction, not silently worked around.

## CM-63B — Documents & Obligations Final UI Polish (Completed 2026-09-02)

### Summary

Frontend-only UI/UX polish pass on top of CM-63 — no data, calculation, permission, backend, upload/download, or export change. KPI values are now color-coded (not just their icon circles) via `DashboardKpiCard`'s `valueClassName` prop: Total Items blue, Submitted green, Pending amber, Expiring Soon purple, Expired / Overdue red — the icon accents already matched this hierarchy from CM-63, only the value text itself was unstyled before. Item ID (first) and Action (last) columns are now pinned via sticky positioning across the table's 11 columns, reusing Claims'/Risk Assessment's own established sticky-column pattern (itself reused from Contract List).

### Changes

- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/documents/_components/contract-document-kpi-strip.tsx` — `valueClassName` per card.
- `.../documents/_components/contract-document-panel.tsx` — sticky Item ID/Action columns (new `STICKY_LEFT_CLS`/`STICKY_RIGHT_CLS`/header variants, applied to the first/last `<th>`/`<td>`).

No backend files touched — confirmed during audit this was achievable as pure frontend polish. Info note wording, empty-state copy, filter/action row layout, Days Remaining coloring, status/category badge styling, and the attachment column's file-name/"+N more"/"—" display were all already correct from CM-63 and needed no change — left unchanged rather than perturbing something that already matched the approved design and its sibling pages. `contract-document-obligations.service.ts`, DTOs, migrations, `contractsApi.getContractDocumentObligations()`/`listDocumentObligationAttachments()`, `createDocumentObligationAction`/`updateDocumentObligationAction`/`uploadDocumentObligationAttachmentAction`, the export route, and the Attachments-tab aggregation are all byte-for-byte unchanged.

### Verification Results (2026-09-02)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 350/350 (unchanged — no pure-function logic touched) |
| `pnpm --filter @recafco/api test --run` | ✓ 1352/1352 (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks, same route list as CM-63 |
| `pnpm db:migrate:status` | ✓ up to date, 35 migrations (unchanged) |
| Dev server restart | ✓ `.next` cleared, `pnpm dev` restarted; `localhost:3000/` and `localhost:4000/health` both confirmed responding; unauthenticated smoke check of `/contracts/[id]/documents`, `/documents/export`, `/attachments`, and 4 other contract pages all returned clean 307 redirects (no 500s) |
| Live UAT scenarios A–E | **Not run by the agent this unit** — same credential blocker carried over from CM-62/62B/63 (see those units' own notes) |

### Unsupported/Deferred Items

- Live UAT scenarios A–E (blocked on credentials).
- No other polish items were identified as needed beyond the two applied — the rest of the page already matched the CM-62B/61B polish template's expectations (correct wording, correct empty state, correct Days Remaining coloring, correct badge colors) from its first build.

## CM-63 — Documents & Obligations Approved Design Build with Attachments (Completed 2026-09-02)

### Summary

Built the Contract Detail Documents & Obligations tab from a fully disabled stub ("Document and obligation tracking will be enabled after the Documents backend unit.") to a complete feature with real manual document/obligation tracking AND real attachment upload/view/download — the first contract-detail tab this session to combine both a brand-new CRUD model and a brand-new file-upload path in one unit. Tracks required contract documents, certificates, submissions, guarantees, and approvals (Performance Bond, Insurance, Advance Payment Guarantee, Tax Clearance Certificate, Method Statement, Shop Drawings Approval, Environmental Approval, Safety Plan, etc.) alongside their obligation deadlines.

Key behavior preserved from the task's own "safe behavior" instruction: `status` is always a plain manual dropdown selection, exactly like Risk Assessment's `riskEvaluation`/`residualRisk` — it is **never** silently overwritten by date math. The "Expiring Soon"/"Expired / Overdue" KPI counts and each row's "Days Remaining" are **derived at read time** from `status` + `submissionOrExpiryDate` (excluding SUBMITTED/CANCELLED/NOT_REQUIRED items) without ever mutating the stored `status` column — an item can honestly appear in both a raw status count (e.g. "Pending") and a derived count (e.g. "Expired / Overdue") at once; this is a real, honest fact about the item, not a bug.

### Backend Changed — Yes (new migration, additive only)

- New enums `ContractDocumentObligationCategory` (8 manager-friendly categories) and `ContractDocumentObligationStatus` (PENDING/SUBMITTED/EXPIRING_SOON/EXPIRED_OVERDUE/NOT_REQUIRED/CANCELLED).
- New model `ContractDocumentObligation` (`contract_document_obligations`) — `itemNo` optional with `@@unique([contractId, itemNo])`; `category`/`status` have DB defaults (OTHER/PENDING) so the API's response type is never nullable even though the create DTO allows omitting them. `responsibleParty` is a **plain free-text field**, deliberately NOT a User FK (unlike `ContractRisk.responsibleUserId`/`ContractClaim.responsibleUserId`) — the approved design's Responsible Party column shows organizational roles ("Contractor"/"Client"), not a specific system user, and the task's own field spec gives it as `responsibleParty string nullable`.
- New model `ContractDocumentObligationAttachment` (`contract_document_obligation_attachments`) — structure mirrors `ContractVariationAttachment` exactly (random UUID stored filename, cascade delete with its parent item).
- Migration `20260902030000_add_contract_document_obligations` — hand-written via the established shadow-DB workaround (the raw `prisma migrate diff` output included unrelated `production_*` drift from earlier Prisma upgrades; only the new-table/enum statements were hand-extracted). Applied via `prisma migrate deploy`; `prisma migrate status` confirms 35 migrations, up to date.
- `packages/config/src/env/api.ts` — new `DOCUMENT_OBLIGATION_ATTACHMENTS_DIR` env var (default `./storage/document-obligation-attachments`), following the exact `WORKFLOW_ATTACHMENTS_DIR`/`VARIATION_ATTACHMENTS_DIR` pattern.
- `document-obligation-attachment-storage.service.ts` — local-disk storage service, reusing `WORKFLOW_ATTACHMENT_MAX_BYTES`/`WORKFLOW_ATTACHMENT_ALLOWED_MIME_TYPES` (10MB; PDF/PNG/JPEG/XLSX/DOCX) directly rather than redefining them, matching `VariationAttachmentStorageService`'s own established pattern exactly (random stored filename, path-traversal-safe `resolveAbsolutePath()`).
- `contract-document-obligations.service.ts` — `computeDocumentObligationDaysRemaining()`/`computeDocumentObligationIsExpiredOverdue()`/`computeDocumentObligationIsExpiringSoon()` (pure, unit-tested), `computeDocumentObligationSummary()` (Total/Submitted/Pending/ExpiringSoon/ExpiredOverdue), `findAllForContract()`/`create()`/`update()`/`listAttachments()`/`createAttachment()`/`getAttachmentForDownload()` — permission + department-scope checks on every method, `itemNo` uniqueness enforced with `ConflictException`, every attachment method verifies the item actually belongs to the given contractId (never trusts `itemId` alone). 49 new unit/service tests.
- `contracts.controller.ts` — `GET/POST /contracts/:id/document-obligations`, `PATCH /contracts/document-obligations/:itemId`, `GET/POST /contracts/:id/document-obligations/:itemId/attachments`, `GET /contracts/:id/document-obligations/:itemId/attachments/:attachmentId/download` — all behind `contracts.read`/`contracts.update`.
- `contract-attachments.service.ts` (existing CM-60C aggregation service) — added a 4th source, `DOCUMENT_OBLIGATION`, to the Attachments tab's cross-tab file list; also added a new `relatedItemTitle` field (task name / variation description / document-obligation title / "Closeout Request \<no\>") to ALL 4 sources so a file in that list can be traced back to what it actually belongs to. Existing `contract-attachments.service.test.ts` updated (4th mock added, `relatedItemTitle` assertions added) — re-verified all 3 pre-existing sources still work correctly.

### Frontend Changes

- `apps/web/src/lib/contracts-api.ts` — Document Obligation types/interfaces, `contractsApi.getContractDocumentObligations()`/`listDocumentObligationAttachments()`; `ContractAttachment` gained `relatedItemTitle`, `ContractAttachmentSource` gained `'DOCUMENT_OBLIGATION'`.
- `_lib/contract-document-obligation-helpers.ts` — label/badge-class maps (8 categories, 6 statuses) and filter option lists.
- `_lib/contract-document-obligation-csv.ts` + `documents/export/route.ts` — new per-contract CSV export; Attachment column lists real uploaded file names joined by "; ", never a raw storage path.
- `documents/_components/` — `contract-document-category-badge.tsx`, `contract-document-status-badge.tsx`, `contract-document-kpi-strip.tsx` (5 cards, divide-by-zero-safe percentages), `contract-document-panel.tsx` (bounded, client-side-filtered table; Responsible Party filter options derived from the real distinct values already in this contract's own items, never a fabricated fixed list), `contract-document-form-modal.tsx` (Add/Edit, real attachment upload/list/download section shown only in Edit mode — Add mode shows the honest "Save the document first, then upload attachments from its Edit screen." note).
- `documents/page.tsx` — rewritten from the disabled stub to the real tab.
- `documents/[itemId]/attachments/route.ts` + `documents/[itemId]/attachments/[attachmentId]/download/route.ts` — same-origin JSON list proxy + secure streaming download proxy, mirroring the Variations attachment proxy routes exactly (department access re-verified by the API on every request; the proxy adds no authorization logic of its own).
- `attachments/page.tsx` — added a new "Related Item" column; updated its own intro/empty-state copy to mention Documents & Obligations as a 4th real upload source.
- `actions.ts` — `createDocumentObligationAction`/`updateDocumentObligationAction`/`uploadDocumentObligationAttachmentAction`/`readDocumentObligationFields()`, mirroring `createVariationAction`'s pattern.

### Changes

- `packages/database/prisma/schema.prisma`, `packages/database/prisma/migrations/20260902030000_add_contract_document_obligations/migration.sql`, `packages/database/src/index.ts`
- `packages/config/src/env/api.ts`
- `apps/api/src/contracts/dto/create-contract-document-obligation.dto.ts`, `update-contract-document-obligation.dto.ts`, `document-obligation-attachment-storage.service.ts`, `contract-document-obligations.service.ts`, `contract-document-obligations.service.test.ts`, `contracts.controller.ts`, `contracts.module.ts`, `contract-attachments.service.ts`, `contract-attachments.service.test.ts`
- `apps/web/src/lib/contracts-api.ts`
- `apps/web/src/app/(protected)/contracts/_lib/contract-document-obligation-helpers.ts`, `contract-document-obligation-helpers.test.ts`, `contract-document-obligation-csv.ts`, `contract-document-obligation-csv.test.ts`
- `apps/web/src/app/(protected)/contracts/actions.ts`
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/documents/page.tsx`, `export/route.ts`, `[itemId]/attachments/route.ts`, `[itemId]/attachments/[attachmentId]/download/route.ts`, `_components/contract-document-category-badge.tsx`, `contract-document-status-badge.tsx`, `contract-document-kpi-strip.tsx`, `contract-document-panel.tsx`, `contract-document-form-modal.tsx`
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/attachments/page.tsx`

### Verification Results (2026-09-02)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/api typecheck` / `pnpm --filter @recafco/web typecheck` | ✓ 0 errors (both required a `@recafco/database`/`@recafco/config` package rebuild first, so the API's generated Prisma client and env schema picked up the new model/enum/env var) |
| `pnpm --filter @recafco/web test --run` | ✓ 350/350 (15 new — helpers + CSV) |
| `pnpm --filter @recafco/api test --run` | ✓ 1352/1352 (49 new service tests; 4 tests in the pre-existing `contract-attachments.service.test.ts` updated for the new 4th source + `relatedItemTitle` field, all still passing) |
| `pnpm build` | ✓ 8/8 tasks, all new routes present (`/contracts/[id]/documents`, `/documents/export`, `/documents/[itemId]/attachments`, `/documents/[itemId]/attachments/[attachmentId]/download`) |
| `pnpm db:migrate:status` | ✓ up to date, 35 migrations |
| Dev server restart | ✓ `.next` cleared, `pnpm dev` restarted; `localhost:3000/` and `localhost:4000/health` both confirmed responding; unauthenticated smoke check of the new Documents routes plus 10 other contract-detail/module pages all returned clean 307 redirects (no 500s) |
| Live UAT scenarios A–I | **Not run by the agent this unit** — see note below |

**Live verification note:** same credential blocker carried over from CM-62/CM-62B — the dev database only holds real-looking accounts (`superadmin`/`managercontract`/`usercontract`/`user1contract`) with no working credentials known to this session. No password was reset. All automated verification passed; the dev server is up and ready for the user to run scenarios A–I (including the real file-upload/download path) directly.

### Unsupported/Deferred Items

- Live UAT scenarios A–I (blocked on credentials, see note above) — this is the highest-priority item to close out before this unit can be considered fully verified, since it's the first unit this session with a genuinely new upload path (not just new CRUD).
- No module-level "Documents & Obligations" register exists (unlike Claims/Payments/Issues) — this unit only builds the contract-scoped tab, per the approved scope.
- KPI value color-coding (`valueClassName`) and sticky first/last table columns — deliberately deferred to a hypothetical CM-63B polish unit, matching the CM-59→59B/60→60B/61→61B/62→62B first-build/polish-unit precedent.

## CM-62B — Risk Assessment Final UI Polish (Completed 2026-09-02)

### Summary

Frontend-only UI/UX polish pass on top of CM-62 — no data, calculation, permission, backend, or API change. KPI values are now color-coded (not just their icon circles) via `DashboardKpiCard`'s `valueClassName` prop: Total Risks blue, High/Critical Risks red, Open Risks amber, Mitigated Risks green, Average Residual Risk purple, Risks Due Soon teal — the icon accents already matched this hierarchy from CM-62, only the value text itself was unstyled before. The info note was shortened from a long risk-category list to a single plain sentence, with no ISO/SAP wording. The filter row's dropdowns were widened slightly (`min-w-28` → `min-w-32`) to match Claims' own proportions. The empty state was reworded to the approved two-line copy. Risk ID (first) and Action (last) columns are now pinned via sticky positioning across the table's 11 columns, reusing Claims' own established sticky-column pattern (itself reused from Contract List).

### Changes

- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/risks/page.tsx` — info note text shortened.
- `.../risks/_components/contract-risk-kpi-strip.tsx` — `valueClassName` per card.
- `.../risks/_components/contract-risk-panel.tsx` — filter select widths; empty state copy; sticky Risk ID/Action columns (new `STICKY_LEFT_CLS`/`STICKY_RIGHT_CLS`/header variants, applied to the first/last `<th>`/`<td>`).

No backend files touched — confirmed during audit this was achievable as pure frontend polish. Risk Response badge colors (Mitigate blue, Accept gray, Avoid red, Transfer purple) and Action Due Date coloring (overdue red / due-soon amber / future green) were already correct from CM-62 and needed no change; badge padding/style was already consistent with Claims/Variations and left unchanged rather than introducing a one-off style. `contract-risks.service.ts`, DTOs, migrations, `contractsApi.getContractRisks()`, `createRiskAction`/`updateRiskAction`, and the export route are all byte-for-byte unchanged.

### Verification Results (2026-09-02)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 335/335 (unchanged — no pure-function logic touched) |
| `pnpm --filter @recafco/api test --run` | ✓ 1303/1303 (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks, same route list as CM-62 |
| `pnpm db:migrate:status` | ✓ up to date, 34 migrations (unchanged) |
| Dev server restart | ✓ `.next` cleared, `pnpm dev` restarted; `localhost:3000/` and `localhost:4000/health` both confirmed responding; unauthenticated smoke check of `/contracts/[id]/risks` and the 5 other listed contract-detail/module pages all returned clean 307 redirects (no 500s) |
| Live UAT scenarios A–G | **Not run by the agent this unit** — see note below |

**Live verification note:** same credential blocker as CM-62 — the dev database still only holds real-looking accounts (`superadmin`/`managercontract`/`usercontract`/`user1contract`) with no working credentials known to this session. Per this session's established precedent, no password was reset. All automated verification passed; the dev server is up and ready for the user to visually confirm the polish pass.

### Unsupported/Deferred Items

- Live UAT scenarios A–G (blocked on credentials, see note above).
- Badge padding/style intentionally left unchanged — already consistent with the established Claims/Variations badge style; changing it here alone would have broken cross-page visual consistency rather than improved it.

## CM-62 — Contract Risk Assessment Approved Design Build (Completed 2026-09-02)

### Summary

Built the Contract Detail Risk Assessment tab from a static/disabled stub to a fully working feature, matching the approved design: a brand-new additive `ContractRisk` model (this contract module had no risk-tracking backend at all before this unit — the stub page's "Risk Assessment backend is not implemented yet" note was literal), a new service/controller/DTOs, and a new display layer (6-card KPI strip, labeled filter row, approved column set, Add/Edit modal). This is explicitly a delivery/cost/schedule/production/erection/materials/client-approval/subcontractor/insurance/contract-execution risk tracker — not an ISO risk-scoring system.

Two manager clarifications were followed verbatim: (1) Risk Response is exactly 4 real values — Mitigate / Accept / Avoid / Transfer — "Subcontracting" and "Insurance" (mentioned as examples) are not response types and appear only inside the free-text Risk Response Description field; (2) Residual Risk is a plain manual dropdown (Low/Medium/High/Critical), never derived from Risk Evaluation or Risk Response.

### Backend Changed — Yes (new migration, additive only)

- New enums `ContractRiskLevel` (LOW/MEDIUM/HIGH/CRITICAL), `ContractRiskResponse` (MITIGATE/ACCEPT/AVOID/TRANSFER), `ContractRiskStatus` (OPEN/IN_PROGRESS/MITIGATED/CLOSED/CANCELLED).
- New model `ContractRisk` (`contract_risks` table) — `riskNo` optional with a `@@unique([contractId, riskNo])` constraint, `riskEvaluation`/`riskResponse`/`status` all have DB defaults (MEDIUM/MITIGATE/OPEN) so they are never null even though the create DTO allows omitting them; `residualRisk` has no default — genuinely nullable, matching "manual only, never fabricated."
- Migration `20260902020000_add_contract_risks` — hand-written (the usual shadow-DB workaround: `prisma migrate diff` output included large unrelated `production_*` drift from earlier Prisma upgrades, so only the new-table/enum statements were hand-extracted), applied via `prisma migrate deploy`. `prisma migrate status` confirms 34 migrations, schema up to date.
- `contract-risks.service.ts` — `computeRiskSummary()` (Total/High-Critical/Open/Mitigated/Risks-Due-Soon counts, plus `averageResidualRisk` using the documented Low=1/Medium=2/High=3/Critical=4 mapping, averaged only over risks with a real `residualRisk` set, rounded+clamped 1–4, mapped back to the nearest label — `null`, never a fabricated label, when zero risks have one set), `computeRiskDaysToDeadline()`/`computeRiskIsDueSoon()` (30-day window, resolved statuses excluded), `findAllForContract()`/`create()`/`update()` (permission + department-scope checks, `responsibleUserId` validated against real users, `riskNo` uniqueness enforced with `ConflictException`). 30 new unit/service tests, including an explicit assertion that `create()` never auto-populates `residualRisk` when omitted from the request.
- `contracts.controller.ts` — `GET/POST /contracts/:id/risks`, `PATCH /contracts/risks/:riskId`, all behind `contracts.read`/`contracts.update`.

### Frontend Changes

- `apps/web/src/lib/contracts-api.ts` — `ContractRiskLevel`/`ContractRiskResponse`/`ContractRiskStatus`/`ContractRisk`/`ContractRiskSummary`/`ContractRiskDetail` types; `contractsApi.getContractRisks()`.
- `_lib/contract-risk-helpers.ts` — label/badge-class maps and filter option lists (unit test asserts no Risk Response label matches `/subcontract|insurance/i`, directly encoding the manager's clarification as a regression-proof check).
- `_lib/contract-risk-csv.ts` + `[id]/risks/export/route.ts` — new per-contract CSV export (no module-level Risk register exists yet to reuse, unlike Claims/Payments).
- `[id]/(workspace)/risks/_components/` — `contract-risk-level-badge.tsx` (shared by both Risk Evaluation and Residual Risk columns — same LOW–CRITICAL scale), `contract-risk-response-badge.tsx`, `contract-risk-status-badge.tsx`, `contract-risk-kpi-strip.tsx` (6 cards, no `valueClassName` — first-build units in this app don't color KPI value text; a polish unit can add it later, matching the CM-58→58B/59→59B/60→60B/61→61B precedent), `contract-risk-panel.tsx` (bounded, contract-scoped, client-side-filtered table — same pattern as Production/Variations/Claims), `contract-risk-form-modal.tsx` (Add/Edit, Risk Response Description labeled with no "(Mitigation Plan)" wording, Action Due Date labeled and captioned "Action Due Date is when the Responsible Person should complete the risk response action.", Residual Risk captioned "Select the expected risk level after the response action.").
- `[id]/(workspace)/risks/page.tsx` — rewritten from the disabled stub to the real tab.
- `actions.ts` — `createRiskAction`/`updateRiskAction`/`readRiskFields()`, mirroring `createVariationAction`'s pattern.

### Wording Decisions Applied

- "Risk Response Description (Mitigation Plan)" → "Risk Response Description" (parenthetical dropped, per this unit's instruction).
- "Due Date" → "Action Due Date" everywhere (column header, form label, CSV header).
- Risk Response dropdown: exactly Mitigate/Accept/Avoid/Transfer — confirmed via unit test and manual code review that no UI surface offers "Subcontracting"/"Insurance" as a selectable response.

### Changes

- `packages/database/prisma/schema.prisma`, `packages/database/prisma/migrations/20260902020000_add_contract_risks/migration.sql`, `packages/database/src/index.ts`
- `apps/api/src/contracts/dto/create-contract-risk.dto.ts`, `update-contract-risk.dto.ts`, `contract-risks.service.ts`, `contract-risks.service.test.ts`, `contracts.controller.ts`, `contracts.module.ts`
- `apps/web/src/lib/contracts-api.ts`
- `apps/web/src/app/(protected)/contracts/_lib/contract-risk-helpers.ts`, `contract-risk-helpers.test.ts`, `contract-risk-csv.ts`
- `apps/web/src/app/(protected)/contracts/actions.ts`
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/risks/page.tsx`, `export/route.ts`, `_components/contract-risk-level-badge.tsx`, `contract-risk-response-badge.tsx`, `contract-risk-status-badge.tsx`, `contract-risk-kpi-strip.tsx`, `contract-risk-panel.tsx`, `contract-risk-form-modal.tsx`

### Verification Results (2026-09-02)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm --filter @recafco/web typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 335/335 (9 new — `contract-risk-helpers.test.ts`) |
| `pnpm --filter @recafco/api test --run` | ✓ 1303/1303 (30 new — `contract-risks.service.test.ts`) |
| `pnpm build` | ✓ 8/8 tasks, `/contracts/[id]/risks` and `/contracts/[id]/risks/export` both present in the route list |
| `pnpm db:migrate:status` | ✓ up to date, 34 migrations |
| Dev server restart | ✓ `.next` cleared, `pnpm dev` restarted; `localhost:3000/` and `localhost:4000/health` both confirmed responding |
| Live UAT scenarios A–I | **Not run by the agent this unit** — see note below |

**Live verification note:** the dev database currently holds only real-looking accounts (`superadmin`, `managercontract`, `usercontract`, `user1contract`) and no working credentials for any of them are known to this session — the earlier ephemeral `test.manager`/`test.operator`/`test.nodept` UAT fixtures from prior units are gone (correctly cleaned up, or the DB was reset outside this session, consistent with the note already on record in CM-59B/60's own verification section). Rather than reset a password on what may be the user's own real login, or fabricate live-scenario results, the agent stopped short of the live UAT step and is flagging this explicitly. All automated verification (lint, typecheck, both test suites, build, migration status) passed; the dev server is up and ready for the user (or an agent given working credentials) to run scenarios A–I directly.

### Unsupported/Deferred Items

- Live UAT scenarios A–I (blocked on credentials, see note above).
- KPI value color-coding (`valueClassName`) and any sticky-column table polish — deferred to a hypothetical CM-62B, matching the CM-59→59B/60→60B/61→61B first-build/polish-unit precedent.
- No module-level "Risk Register" page exists yet (unlike Claims/Payments/Issues) — this unit only builds the contract-scoped tab, per the approved scope; a module-level register was not requested.

## CM-61B — Claims Final UI Polish (Completed 2026-09-02)

### Summary

Frontend-only UI/UX polish pass on top of CM-61 — no data, calculation, permission, backend, or API change. KPI values are now color-coded (not just their icon circles) via `DashboardKpiCard`'s `valueClassName` prop (already available since CM-60B, no component change needed this time): Open Claims/Submitted Value blue, Approved Value/EOT Approved green, Outstanding Value orange, EOT Claimed purple, Overdue Actions red. Empty state reworded to the approved two-line copy. Claim ID (first) and Action (last) columns are now pinned via sticky positioning across the table's 18 columns, reusing Contract List's own established sticky-column pattern (`contract-list-table.tsx`) with the header background adapted to this table's own light `bg-surface-secondary` header (Contract List's is dark navy).

### Changes

- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/claims/_components/contract-claim-kpi-strip.tsx` — `valueClassName` per card.
- `.../claims/_components/contract-claim-panel.tsx` — empty state copy; sticky Claim ID/Action columns (new `STICKY_LEFT_CLS`/`STICKY_RIGHT_CLS`/header variants, applied to the first/last `<th>`/`<td>`).

No backend files touched — confirmed during audit this was achievable as pure frontend polish; `ClaimFormModal`/`closeClaimAction`/`ClaimStatusBadge` (all reused from the module-level register) were left untouched, so their behavior — and the module-level Claim Log's own rendering — is unaffected.

### Verification Results (2026-09-02)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 326/326 (unchanged — no pure-function logic touched) |
| `pnpm --filter @recafco/api test --run` | ✓ 1273/1273 (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ up to date, 33 migrations (unchanged) |
| Live end-to-end check (`uat:seed`/`uat:cleanup`) | ✓ empty state (new two-line copy) and naming re-confirmed (plain "Claims", zero "Claims / Change Orders"); added 2 real claims via the actual backend endpoint — all 5 KPI value color classes (`text-info`/`text-success`/`text-warning`/`text-accent`/`text-error`) and both sticky-column classes (`sticky left-0`/`sticky right-0`) confirmed present in the rendered page; claim data unchanged and correct. Export re-verified unchanged and correctly scoped. All 12 other workspace tabs, 8 module-level pages (including the module-level Claim Log itself, given the shared `DashboardKpiCard` touch-point), and both staff pages returned 200. |

### Unsupported/Deferred Items

- None — pure UI/wording/layout polish, verified via the same live-endpoint technique used throughout this session.

## CM-61 — Contract Claims Approved Design Build (Completed 2026-09-02)

### Summary

Rebuilt the Contract Detail Claims tab to match the approved design (7-card KPI strip, labeled filter row, approved column set), naming it "Claims" only — not "Claims / Change Orders" — per this unit's explicit decision that Variations / Change Orders already owns that framing; Claims separately tracks disputes, EOT, delays, payment issues, damage, and other contractual issues. Unlike every prior CM-59/60 unit, the starting point here was NOT a stub: CM-31 had already built a fully working `ContractClaim` backend, a working Add/Edit modal, and a working (if differently-labeled/differently-columned) contract-detail tab reusing the module-level Claim Log's own table. This unit therefore reused everything write-related unmodified (service create/update/close, `ClaimFormModal`, `closeClaimAction`, the module-level CSV export) and only rebuilt the *display* layer for this one tab — same "contract-scoped page reuses shared write actions, builds its own display layer" pattern established for Payments (CM-58).

### Backend Changed — Yes (no migration — additive logic only)

Two safe, audit-justified additions to the already-existing, already-shared `computeClaimSummary()`/`withDerivedFields()` pure functions in `contract-claims.service.ts` (used by BOTH the module-level Claim Log and this tab):
1. **Bug fix, audit-proven and narrowly scoped:** `totalOutstandingValue` previously summed every claim's `submittedValue - approvedValue` unconditionally, including REJECTED/CANCELLED claims — a rejected claim with no real remaining balance was still inflating the aggregate Outstanding Value KPI on both surfaces. Fixed to exclude only REJECTED/CANCELLED from the aggregate sum (SETTLED/CLOSED deliberately left untouched — a settled claim can still carry a real balance). The per-row `outstandingValue` returned on every claim (and shown in its own table column) is **unchanged** — still the raw, unfiltered delta, for audit-trail honesty.
2. **New derived field, purely additive:** `daysToDeadline` (signed days until `dueDate`, negative once overdue, `null` only when no due date is set) added to every claim's derived-fields response, and `totalEotClaimedDays`/`totalEotApprovedDays` added to the shared summary object — both required by this unit's approved KPI/column list and not previously computed anywhere.

Verified live end-to-end (see below) that both the module-level Claim Log and this new tab reflect the corrected/extended numbers, and that the module-level page still renders correctly — this was a fix applied to shared logic, not a breaking change.

### Naming Decision Applied

- Tab label (`contract-workspace-tabs.tsx`): "Claims / Change Orders" → "Claims".
- Page: section heading "Claims Summary", table heading "Claims", button "Add Claim" — confirmed live, zero "Claims / Change Orders" or "Change Order" wording anywhere on the tab (the only "Change Order" text on the rendered page is the *separate*, legitimate Variations / Change Orders tab link in the nav bar).
- Claim type badges on this tab use new "X Claim" labels (Delay Claim, EOT Claim, Payment Claim, Damage Claim, Scope Change Claim, Other, **Variation Claim**) — a new, tab-local label map, not a rename of the shared enum or the module-level register's own badge. "VARIATION" (a real backend enum value, not "Change Order") is labeled "Variation Claim" — a claim *type* category, never a link to an actual `ContractVariation` record, so this does not mix the two features.

### Changes

**Backend:** `apps/api/src/contracts/contract-claims.service.ts` (+ 20 new/updated tests) — `OUTSTANDING_EXCLUDED_STATUSES`, `computeClaimDaysToDeadline()`, `totalEotClaimedDays`/`totalEotApprovedDays` on `ClaimSummary`, `SUMMARY_SELECT` extended with the two EOT columns.

**Frontend:**
- `apps/web/src/lib/contracts-api.ts` — `daysToDeadline` on `ContractClaim`; `totalEotClaimedDays`/`totalEotApprovedDays` on `ContractClaimSummary`.
- `apps/web/src/app/(protected)/contracts/_lib/contract-claim-detail-helpers.ts` (+ test, 8 tests) — `CLAIM_TYPE_DETAIL_LABELS`, filter option lists, `formatDaysToDeadline()`.
- `.../contracts/[id]/(workspace)/claims/_components/` — `contract-claim-type-badge.tsx` (new "X Claim" labels), `contract-claim-kpi-strip.tsx` (7 `DashboardKpiCard`s), `contract-claim-panel.tsx` (client-side search/status/type/responsible/due-date-range/overdue filtering — same bounded, contract-scoped pattern as Production Status/Variations; reuses `ClaimFormModal`/`closeClaimAction`/`ClaimStatusBadge` from the module-level register unmodified).
- `.../claims/page.tsx` — rewritten to the new display layer; `contractsApi.listClaims({ contractId, pageSize: 200 })` (unpaginated, same established convention).
- `apps/web/src/app/(protected)/contracts/_components/contract-workspace-tabs.tsx` — tab label renamed.
- No new export route — reused the existing module-level `/contracts/claims/export?contractId=...` directly (already supported contract-scoped filtering).

### Verification Results (2026-09-02)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 326/326 (318 + 8 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1273/1273 (1263 + 10 new) |
| `pnpm build` | ✓ 8/8 tasks; `/contracts/[id]/claims` confirmed built |
| `pnpm db:migrate:status` | ✓ up to date, 33 migrations (unchanged — no schema change) |
| Live end-to-end check | ✓ see below |

**Live verification** (UAT contract): empty-state and naming confirmed (scenario A/B — active tab plain "Claims", no "/ Change Orders" suffix, confirmed via the tab link's own `aria-current="page"` text). Created 4 real claims via the actual backend endpoint covering every scenario: UNDER_REVIEW with a past due date (submitted 15,000 / approved 5,000 → `outstandingValue: 10000.000`, `daysToDeadline: -100`), PARTIALLY_APPROVED with EOT (submitted 20,000 / approved 12,000, EOT claimed 20 / approved 10, future due date → `daysToDeadline: 90`), APPROVED EOT-only claim (EOT 15/10, no value fields → `outstandingValue: null`, honestly not "0"), REJECTED claim (submitted 8,000 / approved 0). Aggregate summary manually cross-checked and confirmed exact: `openClaims: 2` (only UNDER_REVIEW + PARTIALLY_APPROVED are non-final), `totalSubmittedValue: 43000`, `totalApprovedValue: 17000`, **`totalOutstandingValue: 18000`** (10,000 + 8,000 — the REJECTED claim's 8,000 correctly excluded; without the fix this would have been 26,000), `totalEotClaimedDays: 35`, `totalEotApprovedDays: 20`, `overdueClaims: 1`. Populated page render confirmed all 7 KPI values, all approved-design table columns (including "Intake ID" honestly showing "—" and "Days to Deadline" showing signed real values), and every claim's new "X Claim" type badge. Export confirmed scoped to only this contract's 4 claims. Permissions: `test.operator` (contracts.read only) could view (200) but create was rejected 403; `test.nodept` (no department) received a correctly-scoped empty result (0 claims, matching the module's existing department-scoped list-filtering pattern, unchanged by this unit). Module-level Claim Log (`/contracts/claims`) re-verified rendering correctly after the shared summary-function fix. Full regression sweep: all 12 other workspace tabs, 8 module-level pages, and both staff pages returned 200. All UAT fixtures removed afterward, `pnpm uat:cleanup` completed cleanly.

### Unsupported/Deferred Items

- **"Intake ID"** has no real backing field anywhere in `ContractClaim` — shown as its own table column, always "—", never invented. If a real intake-tracking concept is needed later, it would need a genuine new field (out of scope here — task explicitly permitted "map to the closest existing real field... show '—' for unsupported values").
- No pagination on this tab (bounded per-contract fetch, `pageSize: 200`) — consistent with the Production Status/Variations precedent rather than the approved screenshot's own paginated-register mockup (which itself only showed 8 of 18 rows per page); the module-level Claim Log keeps its own real pagination unchanged.
- Row-level Action column keeps the existing icon-button group (Edit/Settle/Close) from `ClaimRegisterTable`'s own established pattern rather than a new dropdown-menu treatment — functionally complete, not a redesign the task required.

### Next Recommended Unit

**CM-61B — Claims Final UI Polish** (optional), matching the CM-59B/CM-60B pattern already established for Production Status and Variations: KPI value-text coloring via the `valueClassName` prop (already available on `DashboardKpiCard` since CM-60B), tighter filter/table spacing, and empty-state wording refinement — once the manager has had a chance to react to this initial build.

## CM-60C — Variation Supporting Document Uploads (Completed 2026-09-02)

### Summary

Real file upload for Variation / Change Order supporting documents (site instructions, drawing markups, client emails, BOQ sheets, quotations, engineer approvals), replacing the "uploading a new file here is not yet supported" note from CM-60. Storage/validation reuses the CM-32 workflow-attachment pattern exactly (10MB max; PDF/PNG/JPEG/XLSX/DOCX only; random on-disk filename, original name only in the DB; local disk under `apps/api/storage/variation-attachments`, `VARIATION_ATTACHMENTS_DIR` override). The older `supportingDocumentName`/`supportingDocumentUrl` plain text/link fields from CM-60 are kept, unrenamed, for backwards compatibility — a variation can have real uploaded files, an old text reference, both, or neither. As a "preferred" bonus, the previously-stub Attachments tab now shows a real, read-only aggregation of every attachment already uploaded across Workflow, Closeout, and Variations — no new upload path there, each source keeps its own real upload flow.

### Backend Changed — Yes (additive only)

New table `contract_variation_attachments` (1:many with `ContractVariation`, `onDelete: Cascade`). No existing table/column/migration touched; `ContractVariation.supportingDocumentName`/`supportingDocumentUrl` untouched.

### Changes

**Schema:** `packages/database/prisma/schema.prisma` — `ContractVariationAttachment` model (field names `fileName`/`fileSize` kept consistent with `ContractWorkflowTaskAttachment`/`ContractCloseoutAttachment` rather than the task's own literal `stored_file_name`/`size_bytes` wording — same meaning, matching established convention; `uploadedByUserId` kept required, not nullable, matching those same two sibling tables — an upload always has a real uploader); `attachments` back-relation on `ContractVariation`; `contractVariationAttachmentsUploaded` back-relation on `User`. `packages/database/src/index.ts` — new type exported. `packages/config/src/env/api.ts` — `VARIATION_ATTACHMENTS_DIR` env var + `variationAttachmentsDir` (default `./storage/variation-attachments`), mirroring `WORKFLOW_ATTACHMENTS_DIR`/`CLOSEOUT_ATTACHMENTS_DIR` exactly.

**Migration:** `20260902010000_add_contract_variation_attachments` — hand-written via the established `migrate diff --from-config-datasource` extraction technique, applied via `migrate deploy`. Confirmed clean (33 migrations).

**Backend:**
- `apps/api/src/contracts/variation-attachment-storage.service.ts` (new) — local-disk storage, structure/validation constants reused directly from `WorkflowAttachmentStorageService`, mirrors `CloseoutAttachmentStorageService` exactly.
- `apps/api/src/contracts/contract-variations.service.ts` (+ 13 new tests) — `VARIATION_SELECT` now embeds each variation's own `attachments` array; new `listAttachments()`/`createAttachment()`/`getAttachmentForDownload()`, all via a shared `loadVariationForContract(contractId, variationId)` that verifies the variation actually belongs to the given contractId (not just that variationId resolves to *some* variation) — a mismatched `:id`/`:variationId` URL pair is treated as not-found, confirmed live (see Security below).
- `apps/api/src/contracts/contract-attachments.service.ts` (new, + 7 tests) — read-only aggregation across the 3 existing attachment tables (`contractWorkflowTaskAttachment` where `task.contractId`, `contractCloseoutAttachment` where `closeoutRequest.contractId`, `contractVariationAttachment` where `variation.contractId`), tagged with a real source label and a real download path into that source's own already-scoped download endpoint.
- `apps/api/src/contracts/contracts.controller.ts` — `GET/POST :id/variations/:variationId/attachments`, `GET :id/variations/:variationId/attachments/:attachmentId/download` (multer `FileInterceptor`, same `fileFilter`/`limits` pattern as the workflow attachment route); `GET :id/attachments` (aggregation).
- `apps/api/src/contracts/contracts.module.ts` — `VariationAttachmentStorageService`, `ContractAttachmentsService` registered.

**Frontend:**
- `apps/web/src/lib/contracts-api.ts` — `ContractVariationAttachment` type + `attachments` field on `ContractVariation`; `ContractAttachment`/`ContractAttachmentSource` types; `listVariationAttachments()`, `getContractAttachments()`.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/variations/[variationId]/attachments/route.ts` (new) — client-fetchable JSON proxy for a variation's own attachment list, mirrors the workflow task attachment list proxy.
- `.../variations/[variationId]/attachments/[attachmentId]/download/route.ts` (new) — stream proxy, mirrors the workflow/closeout download proxies exactly.
- `.../variations/_components/contract-variation-form-modal.tsx` — new `SupportingDocumentsSection` (own `useActionState`/form, separate from the variation's own field form) shown only in Edit mode (a real variationId is required to attach to); Add mode shows an honest "save the variation first" note instead of a disabled/fake upload control. Attachment list seeded from the already-embedded `variation.attachments` prop, refetched via the JSON proxy after each successful upload so multiple uploads in one session all show up without closing the modal. Old text/link fields relabeled "Reference Name/Link (optional)" with a note distinguishing them from the real upload section, kept functionally unchanged.
- `.../variations/_components/contract-variation-panel.tsx` — Supporting Document column now shows the first real attachment's name (+"N more"), linking to the secure download proxy; falls back to the old text/link fields only when no real attachments exist, then "—".
- `apps/web/src/app/(protected)/contracts/actions.ts` — `uploadVariationAttachmentAction`, mirrors `uploadWorkflowTaskAttachmentAction`.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/attachments/page.tsx` — rewritten from the CM-14-era stub to a real read-only table (File Name/Source/Uploaded By/Uploaded Date/Action) sourced from `contractsApi.getContractAttachments()`. The stub's own "File Status" KPI section (Total/Pending Review/Approved/Missing) was deliberately NOT rebuilt — there is no real approval-workflow status behind a generic uploaded file, and inventing one would be fake data (see Deferred).

### Verification Results (2026-09-02)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 318/318 (unchanged — no pure-function logic touched; test fixture updated for the new required `attachments` field) |
| `pnpm --filter @recafco/api test --run` | ✓ 1263/1263 (1243 + 13 attachment-service tests + 7 aggregation-service tests) |
| `pnpm build` | ✓ 8/8 tasks; confirmed `/contracts/[id]/variations/[variationId]/attachments`, its `/download` route, and `/contracts/[id]/attachments` all built |
| `pnpm db:migrate:status` | ✓ up to date, 33 migrations |
| Live end-to-end check | ✓ see below |

**Live verification** (UAT contract): created a variation with no attachment — table showed "—" (scenario A). Uploaded a real PDF via the actual backend endpoint — file confirmed written to `apps/api/storage/variation-attachments/{variationId}/{random-uuid}.pdf` (original name never used on disk); table showed the real file name; download succeeded both directly against the backend and through the frontend proxy route (scenario B). Uploaded a second file — table showed the first file's name + "+1 more"; the list endpoint returned both, newest first (scenario C). Contract Attachments tab showed both variation attachments with source label "Variation / Change Order" (scenario D). Permissions: `test.operator` (contracts.read, no contracts.update) could download (200) but upload was rejected 403; `test.nodept` (no department) download was rejected 403 `DEPARTMENT_ACCESS_DENIED` (scenario E). Security: a request with the real attachmentId but a fabricated `variationId`, and separately a fabricated `contractId`, both returned 404 `CONTRACT_VARIATION_ATTACHMENT_NOT_FOUND` rather than leaking any data — confirming `loadVariationForContract`'s explicit contractId-match check actually matters, not just defense-in-depth on paper. A disallowed `.txt` upload was rejected 422 `CONTRACT_VARIATION_ATTACHMENT_INVALID_TYPE`. Variation KPI/formula-strip totals re-verified unchanged after all uploads (`approvedValue: 25750.000`, matching the created variation, attachments contributing nothing to value calculations). CSV export re-verified unchanged (still uses only the old text field, correctly empty for a variation with only real attachments and no text reference). Full regression sweep: all 12 other workspace tabs, 8 module-level pages, and both staff pages (dashboard, My Tasks) returned 200. All UAT fixtures (variations, variation attachments, lazily-generated workflow tasks) removed afterward, on-disk test files also cleared from the storage folder, then `pnpm uat:cleanup` completed cleanly.

### Unsupported/Deferred Items

- The Attachments tab's "File Status" KPI section (Total Files/Pending Review/Approved Documents/Missing Required) from the original stub was not rebuilt — there is no real approval/review workflow behind a generically uploaded file across any of the 3 sources, and fabricating those counts would be fake data. The tab now shows real files with a real source/uploader/date instead.
- The Attachments tab remains read-only (list + download only) — upload still happens from each source's own tab (Workflow, Closeout, Variations), not centrally from this page. A "full Attachments rebuild" with its own centralized upload was out of scope for this unit's task, which explicitly offered "report as deferred if it needs a full Attachments rebuild" as an acceptable outcome for anything beyond the aggregation itself.
- The Add/Edit Variation modal's exact client-rendered attachment list/upload DOM could not be curled directly, since it only mounts/updates after client-side state changes — verified instead via source review plus the end-to-end functional check above through the same backend endpoints the modal calls, consistent with every other client-modal in this codebase.

## CM-60B — Variations / Change Orders Final UI Polish (Completed 2026-09-02)

### Summary

Frontend-only UI/UX polish pass on top of CM-60 — no data, calculation, permission, backend, or API change; `Contract.contractValue` still never mutated (re-verified live). KPI values are now color-coded, not just their icon circles — this required a small, opt-in `valueClassName` prop on the shared `DashboardKpiCard` (default `text-text-primary`, unchanged for every other existing consumer — Dashboard, Payments, Production Status all re-verified live rendering exactly as before). Formula strip values enlarged (`text-base` → `text-xl`/`text-2xl`) and given color identity (Original: info blue, Approved: success green, Current: accent, boxed for emphasis); formula meaning/inputs unchanged. Filter row gained small visible labels ("Status" / "Submitted Date" / "Affects Contract Value") above each select — their `aria-label`s already existed but nothing was visible; Affects Contract Value's own option text simplified back to plain "All"/"Yes"/"No" now redundant with its new heading. Empty state reworded to the approved copy with a helpful second line; Add Variation stays visible in the empty state (it was never gated on item count).

### Changes

- `apps/web/src/app/(protected)/contracts/dashboard/_components/dashboard-kpi-card.tsx` — new optional `valueClassName` prop (both dense and non-dense branches); defaults to `text-text-primary`, so every existing call site (Dashboard, Payments, Production Status, and any other consumer) is completely unaffected — confirmed via live render of all three.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/variations/_components/contract-variation-kpi-strip.tsx` — `valueClassName` passed per money card (`text-success`/`text-warning`/`text-error`/`text-accent`/`text-teal`); Total Variations (a count) left at the default color.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/variations/_components/contract-variation-formula-strip.tsx` — larger, color-coded values; Current Contract Value boxed (`bg-accent/5 border border-accent/15`) for emphasis as the strip's own result.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/variations/_components/contract-variation-panel.tsx` — visible labels above Status/Submitted Date/Affects Contract Value selects; Affects Contract Value option text simplified; empty state copy updated.

No backend files touched — confirmed during audit this was achievable as pure frontend polish.

### Verification Results (2026-09-02)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 318/318 (unchanged — no pure-function logic touched) |
| `pnpm --filter @recafco/api test --run` | ✓ 1243/1243 (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ up to date, 32 migrations (unchanged) |
| Live end-to-end check (`uat:seed`/`uat:cleanup`) | ✓ empty state confirmed (new copy, filter labels, naming); added one APPROVED (25,750) and one SUBMITTED/pending (18,600) variation via the real create endpoint — business rule re-verified unchanged (`computedCurrentValue: 525750.000` = 500,000 + 25,750 only, pending excluded); all 5 KPI color classes (`text-success`/`text-warning`/`text-error`/`text-accent`/`text-teal`) confirmed present in the rendered page; Dashboard/Payments/Production Status all re-rendered 200 with their own KPI cards' default `text-text-primary` color unaffected. Export CSV re-verified unchanged (still scoped, same data). All 12 other workspace tabs, 8 module-level pages, and both staff pages (dashboard, My Tasks) returned 200. |

### Unsupported/Deferred Items

- None — pure UI/wording/layout polish, verified via the same live-endpoint + rendered-HTML technique used throughout this session; client-side filter/search behavior (unit-tested, unchanged) was not re-exercised via a browser since no filtering logic was touched, only the JSX labels surrounding it.

## CM-60 — Contract Variations / Change Orders Approved Design Build (Completed 2026-09-02)

### Summary

Full rebuild of the Contract Detail Variations tab (previously a static stub with hardcoded "Not started" placeholders) to match the approved design: blue info note, 6-card KPI strip, formula strip, search/filter/action row, and a variations table — all backed by a new, additive `ContractVariation` model (no prior variations backend existed). Naming decision followed exactly: the tab/page title reads "Variations / Change Orders" (manager/client-friendly framing), while every table column, KPI label, and backend field stays "Variation" (the real contract/QS term) — nothing was renamed to "Change Order No." etc. Business rule enforced end-to-end and verified live: only APPROVED variations with `affectsContractValue=true` count toward Approved Variations Value and Current Contract Value; SUBMITTED/PENDING_APPROVAL count only toward Pending Variations Value and Net Variation Impact; REJECTED/CANCELLED count toward Rejected/Cancelled Value only; DRAFT and any `affectsContractValue=false` variation count only in the Total Variations record count, never in a money bucket. A deductive variation's amount is a real signed negative number, never clamped — shown honestly in the table, KPI totals, and CSV export.

### Backend Changed — Yes (additive only)

New table `contract_variations` + new enum `contract_variation_status` (DRAFT/SUBMITTED/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED). No existing column, table, or migration touched. `Contract.contractValue` (BOQ-derived, per `contracts.service.ts`) is **never written** by this unit — confirmed live: after creating/approving variations totalling real KWD amounts, `contract.contractValue` remained unchanged (`null`, as seeded). Current Contract Value for the Variations page is a page-level computed value (`Contract.originalContractValue + approvedValue`), returned by the API as `computedCurrentValue` — this is the "safest approach" the task explicitly asked for when uncertain about automatic mutation; no automatic `Contract.contractValue` mutation was implemented.

### Naming Decision Applied

- Tab label (`contract-workspace-tabs.tsx`): "Variations" → "Variations / Change Orders".
- Page title/metadata: "Variations / Change Orders".
- Info note, table headers, KPI labels, CSV headers, DTOs, model, enum, service: all "Variation" — never renamed to "Change Order".

### Changes

**Schema:** `packages/database/prisma/schema.prisma` — `ContractVariation` model + `ContractVariationStatus` enum; `variations` back-relation on `Contract`; `contractVariationsCreated`/`contractVariationsUpdated` back-relations on `User`. `packages/database/src/index.ts` — both new types exported. `createdByUserId` is required (not nullable) — a deliberate, documented deviation from the task's literal "nullable" spec, matching the established convention already used by `ContractPayment`/`ContractClaim` (a record is always created by someone; nothing in this codebase makes that field optional).

**Migration:** `20260902000000_add_contract_variations` — hand-written using the established `prisma migrate diff --from-config-datasource --to-schema` extraction technique (the shadow database still fails `migrate dev` in this environment), trimmed to only the new table/enum statements. Applied via `prisma migrate deploy`, confirmed via `prisma migrate status` → "Database schema is up to date!" (32 migrations).

**Backend:**
- `apps/api/src/contracts/dto/create-contract-variation.dto.ts` / `update-contract-variation.dto.ts` — `description`/`amount` required on create (amount has no `@Min` — a deductive variation is real, never clamped); `supportingDocumentUrl` is a plain `@IsString()`, not `@IsUrl()`, so a manager can reference an internal file path or an existing Documents & Obligations entry, not only a web URL.
- `apps/api/src/contracts/contract-variations.service.ts` (+ test, 25 tests) — new `ContractVariationsService`: `findAllForContract()` (contracts.read, department-scoped, mirrors `:id/schedule`/`:id/production`'s unpaginated pattern) and `create()`/`update()` (contracts.update, department-scoped, duplicate-`variationNo`-per-contract check). Pure exported `computeVariationSummary()` — divide/clamp-free, bucket assignment documented inline (DRAFT and `affectsContractValue=false` excluded from every value bucket but counted in `totalVariations`).
- `apps/api/src/contracts/contracts.controller.ts` — `GET :id/variations`, `POST :id/variations`, `PATCH variations/:variationId` (2-segment route avoiding collision with `:id`, same pattern as `payments/:paymentId`/`production/:itemId`).
- `apps/api/src/contracts/contracts.module.ts` — `ContractVariationsService` registered.

**Frontend:**
- `apps/web/src/lib/contracts-api.ts` — `ContractVariationStatus`, `ContractVariation`, `ContractVariationSummary`, `ContractVariationDetail` types; `getContractVariations()`.
- `apps/web/src/app/(protected)/contracts/_lib/contract-variation-helpers.ts` (+ test, 9 tests) — status labels/badge classes/filter+select options; `matchesSubmittedDateFilter()` (This Month/Last Month/This Year, real calendar-month comparison, excludes unset dates rather than fabricating a match).
- `apps/web/src/app/(protected)/contracts/_lib/contract-variation-csv.ts` (+ test, 5 tests) — CSV builder, reuses `csvField()` from `contract-payment-csv.ts`.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/variations/_components/` — `contract-variation-status-badge.tsx`, `contract-variation-kpi-strip.tsx` (6 `DashboardKpiCard`s), `contract-variation-formula-strip.tsx` (Original + Approved = Current, using the same server-computed values as the KPI strip — deliberately reconciled, unlike the approved-design screenshot's own mockup numbers, which don't actually agree between its KPI card and its formula strip for the same inputs), `contract-variation-panel.tsx` (client-side search/status/submitted-date/affects-value filtering over the full fetched list — same bounded, contract-scoped pattern established for Production Status in CM-59/CM-59B; no pagination, consistent with that precedent rather than the approved screenshot's paginated-register mockup), `contract-variation-form-modal.tsx` (Description/Amount required; Affects Contract Value checkbox always sent explicitly, never omitted, on both create and update — omitting it would leave an unintended default/stale value).
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/variations/page.tsx` — rewritten from the CM-14-era static stub to the real page.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/variations/export/route.ts` — new per-contract CSV export, mirrors `../../production/export/route.ts`.
- `apps/web/src/app/(protected)/contracts/actions.ts` — `createVariationAction`/`updateVariationAction` (+ `readVariationFields` helper), mirrors `updatePaymentAction`/`updateProductionAction`.
- `apps/web/src/app/(protected)/contracts/_components/contract-workspace-tabs.tsx` — tab label renamed.

### Verification Results (2026-09-02)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 318/318 (304 + 14 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1243/1243 (1218 + 25 new) |
| `pnpm build` | ✓ 8/8 tasks, confirmed `/contracts/[id]/variations` and `/contracts/[id]/variations/export` both built |
| `pnpm db:migrate:status` | ✓ up to date, 32 migrations |
| Live end-to-end check | ✓ see below |

**Live verification** (UAT contract, `originalContractValue` set to 500,000 KWD via the real Edit Contract endpoint): empty-state wording confirmed on zero variations, formula strip still showed the real original value (500,000.000 → current 500,000.000). Added one APPROVED (25,750), one SUBMITTED/pending (18,600), one REJECTED with a deductive negative amount (-12,000), and one APPROVED-but-`affectsContractValue=false` (6,750) variation via the real create endpoint — summary correctly returned `approvedValue: 25750.000` (VO-004 excluded), `pendingValue: 18600.000`, `rejectedCancelledValue: -12000.000` (shown negative, not clamped), `netVariationImpact: 44350.000` (approved+pending only), `computedCurrentValue: 525750.000` (500000+25750). Updating the pending variation to APPROVED live-recalculated everything correctly (`approvedValue: 44350.000`, `pendingValue: 0.000`, `computedCurrentValue: 544350.000`) — confirmed via a second `GET`. `Contract.contractValue` remained untouched (`null`) throughout. Duplicate `variationNo` rejected 409; missing `description`/`amount` rejected 400. `test.operator` (contracts.read only) could view (200) but POST was rejected 403; `test.nodept` (no department) GET was rejected 403 `DEPARTMENT_ACCESS_DENIED`. CSV export returned HTTP 200 with data matching the table exactly, including the negative amount unclamped. Overview's own "Approved Variations: 0" display was confirmed unaffected (still the pre-existing decoupled 0, not wired to real data by this unit — see Deferred). Full regression sweep: all 12 other contract-detail workspace tabs + all 8 module-level pages returned 200 for `test.manager`; both staff pages (dashboard, My Tasks) returned 200, unaffected. All UAT fixtures removed afterward (test variations + lazily-generated workflow tasks manually cleared first, same pre-existing `uat-cleanup.ts` limitation noted in CM-59/CM-59B — then `pnpm uat:cleanup` completed cleanly).

### Unsupported/Deferred Items

- **Overview's "Approved Variations: 0" / "Last Variation: —" display was deliberately left unwired in this unit.** The task allowed either outcome ("Overview should still show variations as real values if new data is added, or remain 0/— if not wired in this unit"); wiring it would mean deciding how a variations-aware value interacts with Overview's own "Current Contract Value" row (which shows the real, BOQ-derived `contract.contractValue`, not this unit's computed value) — a design decision the task didn't specify, so it's left as its own follow-up unit (e.g. "CM-60B — Overview Variations Wiring") rather than guessed at here.
- **Supporting Document is a plain optional text/link pair, not a file upload.** No new attachment/storage pipeline was added — a manager can name/link an already-existing document (e.g. from Documents & Obligations) but cannot upload a new file from this tab. The table only ever shows a real stored name/link or "—", never a fake document.
- **No pagination.** A contract's variation list is expected to be small (per-contract, not cross-contract), so it follows the same bounded, client-side-filtered, unpaginated pattern established for Production Status rather than the approved screenshot's paginated-register mockup (which itself only showed 10 rows).
- The Add/Edit Variation modal's exact client-rendered DOM (post-click) could not be curled directly, since it only mounts after a client-side state change — verified instead via source review plus the end-to-end functional check above through the same backend endpoint the modal calls, consistent with every other client-modal in this codebase.

### Next Recommended Unit

**CM-60B — Overview Variations Wiring** (optional polish, not required): wire Overview's "Contract Value Summary" card to real variation totals (Approved Variations, Last Variation) now that real data exists, deciding how it reconciles with `contract.contractValue`. Alternatively, **CM-61 — Claims / Change Orders tab** could reuse the same summary-KPI + formula-strip + client-filtered-table pattern established here, since Claims already shares "Change Orders" framing in its own tab label.

## CM-59B — Production Status Final UI Polish (Completed 2026-09-01)

### Summary

Frontend-only UI/UX polish pass on top of CM-59 — no data, calculation, permission, schema, migration, or API change. Info bar wording reworded ("Future release: Automatically linked with Production Module" → "Production module integration can be added in a future phase.") since the old phrasing read like a promise/pending sync rather than a possibility; button relabeled "Open Production Module" (was "View") since it only navigates to the separate, non-data-linked `/production` module — kept (not omitted) because that route is real and working. KPI labels reworded to the approved slash form ("Casted / Produced", "Stock / Not Delivered", matching CSV headers and the table). The 6th (ring) KPI card's padding/gap brought in line with `DashboardKpiCard`'s own p-4/gap-2 so all six cards read as one consistent row. Filter/action row collapsed from a label-per-field grid + separate actions row into a single flex-wrap row (search flex-1, compact status/category selects, actions pushed right via `ml-auto`) — visibly shorter, same filtering/export/add-update behavior. Table header strengthened (`font-bold text-text-primary`, was `font-semibold text-text-secondary`), S/N centered, row hover state added, progress bar thickened (`h-1.5`→`h-2`) with a bold percent, status badge bumped to `font-semibold`. Row action changed from a bare Pencil icon to an icon+"Update" button with an item-specific `aria-label`, clearer than a tiny icon alone.

### Changes

- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/production/page.tsx` — info bar wording + button label.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/production/_components/contract-production-kpi-strip.tsx` — label wording; ring card padding/gap/size.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/production/_components/contract-production-panel.tsx` — filter/action row collapsed to one flex row; table header/S/N/hover/progress-bar/action-button polish; `Stock (Not Delivered)` → `Stock / Not Delivered` column header.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/production/_components/contract-production-status-badge.tsx` — `font-medium` → `font-semibold`.
- `apps/web/src/app/(protected)/contracts/_lib/contract-production-csv.ts` — CSV header wording (`Stock (Not Delivered)` → `Stock / Not Delivered`), matching the on-screen table; existing CSV test still passes unchanged (it reads the header from the exported constant, not a hardcoded string).

No backend files touched — confirmed during audit this was achievable as pure frontend polish; the Add/Update Production modal's own validation/save behavior (`contract-boq-production.service.ts`, `updateProductionAction`) was not touched.

### Verification Results (2026-09-01)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 304/304 (unchanged — no pure-function logic touched) |
| `pnpm --filter @recafco/api test --run` | ✓ 1218/1218 (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ up to date, 31 migrations (unchanged) |
| Live end-to-end check (`uat:seed`/`uat:cleanup`) | ✓ empty-state wording/honesty confirmed on a contract with no BOQ items; populated page confirmed new KPI/table/CSV wording, no "Physical"/"SAP"/"Auto linked" anywhere; Add/Update Production re-verified live through the same backend endpoint (produced 1100/delivered 900/total 1200 → 92% progress, stock 200, remaining 100 — calculation unchanged from CM-59) and the delivered-exceeds-produced validation still rejects with 422; CSV export reflects the same updated values and new header wording. All 12 other workspace tabs, 8 module-level pages, and both staff pages (dashboard, My Tasks) returned 200. |

### Unsupported/Deferred Items

- None — this was a pure UI/wording/layout polish pass with no new client-only interaction beyond what CM-59 already established; verified the same way (source review of the JSX polish plus the live functional check above through the real backend endpoint).

## CM-59 — Contract Production Status Approved Design Rebuild (Completed 2026-09-01)

### Summary

Full rebuild of the Contract Detail Production Status tab (previously a static stub with hardcoded "Not started" placeholders) to match the approved design: blue info bar, 6-card KPI strip, search/filter/action row, and a per-item production table — all backed by real data. Production is manually tracked inside Contract Management; no Production Module integration exists yet (the "View Production Module" link is real navigation to the separately-built `/production` module, but the two are never data-linked). Total Qty per item is the contract's own existing BOQ Qty/Area (`revisedQty ?? originalEstimatedQty`, same precedence as `boqRowQty()`/the BOQ total-price calculation) — this unit never overwrites or reinterprets that value. Casted/Produced, Delivered, Production Status and Remarks are new, additive, per-BOQ-item tracking fields; Stock/Not Delivered, Remaining to Cast and Progress % are always derived (server-computed), never stored. A contract with no BOQ items shows the real empty state ("No BOQ items available for production tracking. Add BOQ items from contract register/edit first.") — never fabricated rows.

### Backend Changed — Yes (additive only)

New table `contract_boq_item_production_status` (1 row per `ContractBoqItem`, created lazily on first update, unique on `contract_boq_item_id`) + new enum `contract_boq_production_status` (NOT_STARTED/IN_PRODUCTION/PARTIALLY_DELIVERED/COMPLETED/DELAYED). No existing column, table, or migration touched; BOQ item's own `originalEstimatedQty`/`revisedQty` meaning is untouched.

**Important documented tradeoff:** Edit Contract's BOQ save path (`contracts.service.ts` `update()`) deletes and recreates ALL of a contract's `ContractBoqItem` rows whenever the BOQ is replaced (pre-existing behavior, confirmed via audit before this unit). The new FK therefore uses `onDelete: Cascade` rather than `Restrict` — `Restrict` would have broken Edit Contract's existing save flow the moment any item had production tracked. This means **editing a contract's BOQ resets production tracking for the replaced items** — verified live: replacing a UAT contract's BOQ items via `PATCH /contracts/:id` succeeded (HTTP 200, Edit Contract unaffected) and the new item's production status came back reset to NOT_STARTED/0, exactly as designed. This is a real, honest limitation, not hidden — flagged here for awareness; no user-facing warning banner was added since the task didn't ask for one and CLAUDE.md prohibits inventing unscoped workflow.

### Changes

**Schema:** `packages/database/prisma/schema.prisma` — `ContractBoqItemProductionStatus` model + `ContractBoqProductionStatus` enum; `productionStatus` back-relation on `ContractBoqItem`; `contractBoqProductionStatusUpdated` back-relation on `User`. `packages/database/src/index.ts` — both new types exported.

**Migration:** `20260901020000_add_contract_boq_item_production_status` — hand-written (not `prisma migrate dev`, which still fails against the shadow database on this environment per the established workaround) using `prisma migrate diff --from-config-datasource --to-schema` to generate the correct DDL, then trimmed down to only the 2 new-table/new-enum statements (the raw diff also contained a large amount of pre-existing, unrelated drift between the live dev DB and migration history — index renames and FK re-creates on `production_*` tables from an earlier Prisma version upgrade — which was deliberately NOT included in this migration). Applied via `prisma migrate deploy` (bypasses the shadow database), confirmed via `prisma migrate status` → "Database schema is up to date!" (31 migrations).

**Backend:**
- `apps/api/src/contracts/dto/update-contract-boq-item-production.dto.ts` — new DTO (`producedQty`/`deliveredQty`/`status`/`remarks`, all optional, `@Min(0)` on quantities).
- `apps/api/src/contracts/contract-boq-production.service.ts` (+ test, 28 tests) — new `ContractBoqProductionService`: `findAllForContract()` (contracts.read, department-scoped, mirrors `contract-schedule.service.ts`'s unpaginated `findAllForContract` pattern) and `upsertForItem()` (contracts.update, department-scoped, lazy upsert). Pure exported functions: `computeTotalQty`, `computeStockNotDelivered`, `computeRemainingToCast`, `computePercentOfTotal`, `assertProductionAmountsValid`, `computeProductionSummary` — all divide-by-zero safe.
- `apps/api/src/contracts/contracts.controller.ts` — `GET :id/production` (contracts.read) and `PATCH production/:itemId` (contracts.update, 2-segment route avoiding collision with `:id`, same pattern as `payments/:paymentId`).
- `apps/api/src/contracts/contracts.module.ts` — `ContractBoqProductionService` registered.

**Frontend:**
- `apps/web/src/lib/contracts-api.ts` — `ContractBoqProductionStatus`, `ContractProductionItem`, `ContractProductionSummary`, `ContractProductionDetail` types; `getContractProduction()`.
- `apps/web/src/app/(protected)/contracts/_lib/contract-production-helpers.ts` (+ test, 10 tests) — status labels/badge/bar classes/filter+select options; `computeStockNotDelivered`/`computeRemainingToCast`/`computePercentOfTotal`/`formatQty`, mirroring the backend's own pure functions exactly so the Add/Update modal can show a live preview before saving.
- `apps/web/src/app/(protected)/contracts/_lib/contract-production-csv.ts` (+ test, 4 tests) — CSV builder, reuses `csvField()` from `contract-payment-csv.ts`.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/production/_components/contract-production-status-badge.tsx`, `contract-production-kpi-strip.tsx` (5 `DashboardKpiCard`s + 1 inline-SVG ring, same ring pattern as `ContractOverviewProgressCard` but a separate component — different underlying ratio), `contract-production-panel.tsx` (client-side search/status/category filtering over the full fetched item list — no pagination needed at BOQ-item scale, unlike the searchParams-driven Payments tab; table; row-level Edit action; an item-picker step for the top-level "Add / Update Production" button so it never silently edits an unstated item), `contract-production-form-modal.tsx` (Item Description/Total Qty read-only; Casted/Delivered/Status/Remarks editable; live Stock/Remaining/Progress preview).
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/production/page.tsx` — rewritten from the CM-14-era static stub to the real page.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/production/export/route.ts` — new per-contract CSV export, mirrors `../../../payments/export/route.ts`.
- `apps/web/src/app/(protected)/contracts/actions.ts` — `updateProductionAction` (+ `readProductionFields` helper), mirrors `updatePaymentAction`.

### Verification Results (2026-09-01)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 304/304 (290 + 14 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1218/1218 (1190 + 28 new) |
| `pnpm build` | ✓ 8/8 tasks, confirmed `/contracts/[id]/production` and `/contracts/[id]/production/export` both built |
| `pnpm db:migrate:status` | ✓ up to date, 31 migrations |
| Live end-to-end check | ✓ see below |

**Live verification** (UAT contract, 3 real BOQ items added via the real Edit Contract endpoint, one deliberately with `originalEstimatedQty: 0` to exercise the divide-by-zero path): empty state exact wording confirmed on a contract with no BOQ items; populated page renders real KPI values (Total Qty 3,600, correct per-item Casted/Delivered/Stock/Remaining/Progress), no "Physical" or "SAP" wording anywhere; `PATCH /contracts/production/:itemId` valid update returns correct derived fields (produced 1050/total 1200 → 88% progress); all 3 validation rules confirmed live (delivered > produced → 422 `CONTRACT_BOQ_PRODUCTION_DELIVERED_EXCEEDS_PRODUCED`; produced > totalQty → 422 `CONTRACT_BOQ_PRODUCTION_PRODUCED_EXCEEDS_TOTAL`; negative qty → 400 from DTO `@Min(0)`); zero-totalQty item correctly never blocked by the totalQty cap (nothing real to cap against). CSV export (`/contracts/:id/production/export`) returns HTTP 200 with data matching the table exactly. Permissions: `test.operator` (contracts.read, no contracts.update) can view (200) but PATCH is rejected 403; `test.nodept` (no department, fail-closed) GET is rejected 403 `DEPARTMENT_ACCESS_DENIED`. BOQ-edit cascade tradeoff verified live (see Backend Changed section above). Full regression sweep: all 12 other contract-detail workspace tabs + all 8 module-level pages returned 200 for `test.manager`; staff (`test.operator`) `/contracts/dashboard` and `/contracts/workflow?mode=my-tasks` both 200, unaffected. All UAT fixtures removed afterward (test BOQ items + lazily-generated workflow tasks manually cleared first — an unrelated pre-existing `uat-cleanup.ts` limitation that only surfaces when a UAT contract gains BOQ items or visits the Workflow tab, neither of which the normal seed does — then `pnpm uat:cleanup` completed cleanly).

### Unsupported/Deferred Items

- The Add/Update Production modal's exact client-rendered DOM (post-click) could not be curled directly, since it only mounts after a client-side state change — verified instead via careful source review plus the end-to-end functional check above through the same backend endpoint the modal calls, consistent with every other client-modal in this codebase.
- No category field synonym/mapping was invented — the Category filter's options are the real, distinct `ContractBoqItem.category` values already present on the contract's own BOQ items (empty dropdown beyond "All" for a contract with no categorized items — never a fabricated list).
- Editing a contract's BOQ resets production tracking for the replaced items (see Backend Changed section) — a real, documented tradeoff of the additive-table approach the task specified, not a defect, but worth a manager's awareness before this ships.

## CM-58C — Move Payment Terms Summary to Compact Strip (Completed 2026-09-01)

Note: this unit reuses the "CM-58C" code from the task text it was given, distinct from the earlier "CM-58C — Add Payment Modal Final UX Polish" entry directly below.

### Summary

Repositioning-only change on the Contract Detail Payments tab: Payment Terms Summary moved from a full table card below Payment Tracker (`ContractPaymentTermsSummaryCard`, deleted) to a compact horizontal chip strip (`ContractPaymentTermsStrip`, new) placed between the KPI strip and the filter/search section. Same real data (`contract.paymentTerms`, a plain `Record<string, boolean>`), no invented percentages/amounts/notes — each chip shows only that term's real saved selected/not-selected boolean, with a `Check`/`Minus` icon and `bg-success-light text-success` (selected) vs. `bg-surface-secondary text-text-muted` (not selected) styling, no third state. A manager now sees the contract's agreed payment terms before scrolling into the payment records, instead of after. Final page order is now: KPI strip → Payment Terms strip → search/filter/actions (with Export Excel) → Payment Tracker table → bottom helper note. Payment Statement/Account Statement remains removed (per the earlier CM-58B Tracker-Focused Cleanup business correction) — not reintroduced by this unit. No payment calculation, create/update API, or export route touched.

### Changes

- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/payments/_components/contract-payment-terms-strip.tsx` — **new**: compact chip-strip component, reuses the existing `PAYMENT_TERM_OPTIONS` from `contract-ui-helpers.ts`.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/payments/_components/contract-payment-terms-summary-card.tsx` — **deleted** (zero remaining consumers, confirmed via grep).
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/payments/page.tsx` — `ContractPaymentTermsStrip` now rendered between `ContractPaymentKpiStrip` and `ContractPaymentFilterBar`; old `max-w-xl` Payment Terms Summary card position (below Payment Tracker) removed.

No backend files touched — pure frontend repositioning/presentation change; `contract.paymentTerms` was already fetched and passed down unchanged.

### Verification Results (2026-09-01)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 290/290 (unchanged — no pure-function logic touched) |
| `pnpm --filter @recafco/api test --run` | ✓ 1190/1190 (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ up to date, 30 migrations |
| Live end-to-end check (`uat:seed`/`uat:cleanup`) | ✓ confirmed on a populated UAT contract: page order KPI strip → Payment Terms strip → filter bar → Payment Tracker holds (verified via HTML position of each section's marker in the rendered response); both selected (`bg-success-light text-success`) and not-selected (`bg-surface-secondary text-text-muted`) chip styles present and correctly matched to the contract's real `paymentTerms` values; no "Payment Statement"/"Account Statement" wording anywhere on the page. Created a real payment (`PAY-CM58C2-01`) via the same backend endpoint the Add Payment modal calls — confirmed it renders correctly in Payment Tracker, and that `/contracts/payments/export?contractId=…` returns HTTP 200 with a CSV correctly scoped to only that one contract's payment. Full regression sweep: all 12 other contract-detail workspace tabs (schedule, production, variations, claims, risks, documents, workflow, issues, attachments, closeout, activity, overview) and all 8 module-level pages (`/contracts`, `/contracts/dashboard`, `/contracts/new`, `/contracts/workflow`, `/contracts/payments`, `/contracts/claims`, `/contracts/issues`, `/contracts/closeouts`) returned HTTP 200 for `test.manager`. Staff (`test.operator`) `/contracts/dashboard` and `/contracts/workflow?mode=my-tasks` both returned HTTP 200, unaffected. Test payment and all other UAT fixtures removed afterward via direct SQL + `pnpm uat:cleanup`. |

### Unsupported/Deferred Items

- None — this was a pure repositioning change with no new client-only interaction to verify beyond static rendering, which was checked directly via the rendered HTML response (no client-side-only mount step, unlike the Add Payment modal).

## CM-58C — Add Payment Modal Final UX Polish (Completed 2026-09-01)

### Summary

Frontend-only UX polish on the shared `PaymentFormModal` (`contracts/payments/_components/`) — no backend, enum, or field-name change. Its `STATUS_OPTIONS` list previously showed the raw backend enum label "Draft" (confusing — a payment in that state simply hasn't been submitted yet); now built directly from the manager-friendly `PAYMENT_STATUS_LABELS` map already established in CM-58 (DRAFT→Pending, PARTIALLY_PAID→Partially Received, PAID→Received, etc.), applied to **both** modal variants per this unit's own instruction that the cleanup should reach the module-level register too. CERTIFIED is kept (existing records can still carry that status) but moved to the end of the option list, so it reads as the least prominent choice without being hidden or renamed. The contract-detail variant's plain "Contract" text was replaced with a small bordered "Adding payment for" / project name / reference number context block (real data, same hidden `contractId` field, unchanged submission), and a subtle `InfoBox` note ("Remaining Amount is calculated from Invoice Amount minus Received Amount.") was added under the amount fields — both scoped to `variant="contractDetail"` only, so the module-level register's own Add/Edit form is visually untouched beyond the shared status-label fix.

### Changes

- `apps/web/src/app/(protected)/contracts/payments/_components/payment-form-modal.tsx` — `STATUS_OPTIONS` rebuilt from `PAYMENT_STATUS_LABELS` (imported from `contract-payment-detail-helpers.ts`), reordered so CERTIFIED is last; new `contractContext` value (the single known contract, for both Add and Edit in `contractDetail` mode) rendered as a bordered read-only block instead of plain text; new subtle amount-helper `InfoBox`, shown only when `isContractDetail`.

No backend files touched — confirmed during audit this was achievable as pure frontend/UX polish; no field `name` attribute, DTO shape, or backend enum was touched anywhere.

### Verification Results (2026-09-01)

| Command | Result |
|---|---|
| `pnpm lint` / `pnpm typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 290/290 (unchanged — no pure-function logic touched) |
| `pnpm --filter @recafco/api test --run` | ✓ 1190/1190 (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ up to date |
| Live end-to-end check (`uat:seed`/`uat:cleanup`) | ✓ created a real payment via the same backend endpoint the modal's Add flow calls (`submittedAmount: 6000, paidAmount: 2000` → `outstandingAmount: 4000.000`, unchanged calculation), confirmed it renders in the tracker with the "Partially Received" label. Confirmed via source grep that the module-level register's own `PaymentFormModal` calls pass no `variant` (file untouched) — Contract dropdown and Certified Amount remain exactly as before there, while the shared status-label fix now also applies to that page per this unit's own instruction. All 12 other workspace tabs, module-level `/contracts/payments`, Contract List, Manager Dashboard, New Contract Register, Workflow/Claims/Issues/Closeout, and staff dashboard/My Tasks all 200. Test payment deleted afterward via direct SQL. |

### Unsupported/Deferred Items

- As in the previous unit, the modal's exact post-click client-rendered DOM (the new context block, helper note, and reordered status options) could not be curled directly, since it only mounts after a client-side state change. Verified instead via careful source review of the new conditional JSX plus an end-to-end functional check through the same backend endpoint the modal calls — the same approach used throughout this session for every client-modal change.

## CM-58B — Contract Payments Page Tracker-Focused Cleanup (Completed 2026-09-01)

Note: this unit reuses the "CM-58B" code from the task text it was given, distinct from the earlier "CM-58B — Contract Payments Page Final UI Polish" entry directly below.

### Summary

Business correction on top of the earlier CM-58B UI polish: manager confirmed RECAFCO FMP is not linked to any Account/SAP/accounting module, so the lower "Payment Statement" card (the approved screenshot's own "Account Statement (Linked to Account Model)", already renamed once in CM-58) was removed **entirely** rather than kept under any name — it duplicated Payment Tracker's own rows under a second title with no real added information. Payment Tracker is now the page's single, focused payments table; Payment Terms Summary remains, now as its own compact (`max-w-xl`) card directly below Payment Tracker instead of sharing a row with the removed card.

The Add Payment modal (`PaymentFormModal`, shared with the module-level `/contracts/payments` register) gained an opt-in `variant?: 'register' | 'contractDetail'` prop (default `'register'`, so the module-level register's exact original behavior — Contract picker, Certified Amount field, original labels — is completely unchanged). The Contract Detail Payments tab now passes `variant="contractDetail"`: no Contract picker (the single known contract is submitted as a hidden field and shown as read-only context instead), no Certified Amount field, and four labels renamed (Submitted Amount→Invoice Amount, Due Date→Payment Due Date, Paid Date→Received On, Paid Amount→Received Amount). Confirmed via the backend's own update logic that omitting Certified Amount from an edit never nulls an existing stored value — Prisma's `data` spread only includes fields present in the DTO, so a payment previously given a certifiedAmount via the module register keeps it silently, even when edited from the contract-detail tab where that field isn't shown.

### Changes

- `apps/web/src/app/(protected)/contracts/payments/_components/payment-form-modal.tsx` — new optional `variant` prop; conditional Contract picker vs. read-only+hidden-input; Certified Amount field hidden when `contractDetail`; four field labels computed from `variant`. Underlying `name` attributes (and therefore the create/update payload) never change between variants.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/payments/_components/contract-payment-tracker-table.tsx` — both `PaymentFormModal` calls now pass `variant="contractDetail"`.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/payments/_components/contract-payment-statement-card.tsx` — **deleted** (zero remaining consumers, confirmed via grep).
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/payments/page.tsx` — removed the `grid-cols-[2fr_1fr]` row and `ContractPaymentStatementCard` import/usage; Payment Terms Summary now rendered alone in a `max-w-xl` wrapper below Payment Tracker.
- `apps/web/src/app/(protected)/contracts/_lib/contract-payment-detail-helpers.ts` (+ test) — removed `computePercentOfContractValue()` (its only consumer, the deleted Payment Statement card's "% of Contract Value" column, no longer exists) and its 4 tests.

No backend files touched — confirmed during audit this was achievable as pure frontend/UI cleanup; the existing update endpoint's "omitted field ⇒ unchanged, never nulled" behavior (verified by reading `contract-payments.service.ts`'s `update()`) made hiding Certified Amount safe without any backend change.

### Verification Results (2026-09-01)

| Command | Result |
|---|---|
| `pnpm lint` / `pnpm typecheck` | ✓ 0 errors (no orphaned imports after the file deletion) |
| `pnpm --filter @recafco/web test --run` | ✓ 290/290 (294 − 4 removed tests for the deleted percent-of-value function) |
| `pnpm --filter @recafco/api test --run` | ✓ 1190/1190 (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ up to date |
| Live end-to-end check (`uat:seed`/`uat:cleanup`) | ✓ confirmed live: no "Payment Statement" section, no "Account Statement"/"Linked to Account Model" wording, no orphaned "View Payment Records" link, on both an empty and a populated contract. Created a real payment via the same API endpoint the modal's Add flow uses — appeared correctly in Payment Tracker with all approved-design column labels intact; Payment Terms Summary still present and correctly positioned. Confirmed the module-level `/contracts/payments` register's own `PaymentFormModal` calls pass no `variant` (via source grep — file untouched), so its Contract picker/Certified Amount/original labels are unaffected by construction. Export CSV re-verified unchanged and correctly contract-scoped. All 12 other workspace tabs, Contract List, Manager Dashboard, New Contract Register, Workflow/Claims/Issues/Closeout, and staff dashboard/My Tasks all 200. Test payment deleted afterward via direct SQL. |

### Unsupported/Deferred Items

- The Add Payment modal's exact client-rendered DOM (post-click) could not be curled directly, since it only mounts after a client-side state change — verified instead via careful source review of the new conditional JSX plus an end-to-end functional check (create via the same backend endpoint the modal calls, confirm the result renders correctly). Consistent with how every other client-modal in this codebase has been verified throughout this session.

## CM-58B — Contract Payments Page Final UI Polish (Completed 2026-09-01)

### Summary

Frontend-only UI/UX polish pass on top of CM-58 — no data, calculation, filter, Add/Edit, export, or backend change. `DashboardKpiCard` (shared with the Contract Manager Dashboard) gained an opt-in `dense` prop — a horizontal (icon left, value/label right) layout, shorter row — used only by the Payments KPI strip; verified live that the dashboard's own KPI cards still render in their original vertical layout unaffected. Export Excel was pulled out of its own floating flex row and now renders inside the filter bar's own bottom action row (next to Reset/Apply Filters) via a new `actions` slot, so it reads as part of that card instead of a detached sibling. Payment Tracker's and Payment Statement's empty states were rebuilt as compact, centered, dashed-border boxes with an icon (matching the task's exact "No payment records yet." wording) instead of a tall plain-text block. Payment Terms Summary rows tightened (`py-2`→`py-1.5`) and its Selected/Not-selected pill badges replaced with a lighter dot+text treatment. The bottom helper note shortened to the task's exact requested one-line wording.

### Changes

- `apps/web/src/app/(protected)/contracts/dashboard/_components/dashboard-kpi-card.tsx` — new optional `dense?: boolean` prop (default `false`, so every existing consumer is unaffected); when `true`, renders a horizontal icon-left/text-right layout instead of the default vertical stack.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/payments/_components/contract-payment-kpi-strip.tsx` — all 5 `DashboardKpiCard`s now pass `dense`; grid gap `gap-4`→`gap-3`.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/payments/_components/contract-payment-filter-bar.tsx` — new optional `actions?: React.ReactNode` prop rendered in the bottom action row, before Reset/Apply Filters.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/payments/page.tsx` — Export Excel now passed as the filter bar's `actions` prop (no longer a separate flex-row sibling); bottom `InfoBox` text shortened to "Overdue payments are based on Payment Due Date and Remaining Amount."
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/payments/_components/contract-payment-tracker-table.tsx` — empty state rebuilt as a compact centered dashed-border box with a `Receipt` icon; wording "No payments recorded yet."→"No payment records yet." (Add Payment button, already in the section header above, unaffected).
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/payments/_components/contract-payment-statement-card.tsx` — same compact empty-state treatment (was a bare `<p>` stretching to fill the row's full height).
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/payments/_components/contract-payment-terms-summary-card.tsx` — row/header padding tightened; Selected/Not-selected badge changed from a filled pill to a small colored dot + text.

No backend files touched — confirmed during audit this was achievable as pure frontend/UI polish.

### Verification Results (2026-09-01)

| Command | Result |
|---|---|
| `pnpm lint` / `pnpm typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 294/294 (unchanged — no logic touched) |
| `pnpm --filter @recafco/api test --run` | ✓ 1190/1190 (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ up to date |
| Live end-to-end check (`uat:seed`/`uat:cleanup`, dev servers already running and confirmed healthy after the build) | ✓ empty-state wording/dashed-box confirmed on a payment-less UAT contract; created a real overdue payment — Payment Tracker/Statement showed it correctly with all approved-design column labels unchanged, Export CSV correctly scoped to the one contract, Payment Terms Summary showed the new dot-badge style; confirmed the Contract Manager Dashboard's own KPI cards remain in their original non-dense vertical layout (`dense` is truly opt-in); all 12 other workspace tabs, Contract List, Manager Dashboard, New Contract Register, Workflow/Claims/Issues/Closeout, module-level `/contracts/payments`, and staff dashboard/My Tasks all unaffected. Test payment deleted afterward via direct SQL. |

### Deferred

None new — same deferrals as CM-58 stand.

## CM-58 — Contract Payments Page Approved Design Rebuild (Completed 2026-09-01)

### Summary

Rebuilt the Contract Detail Payments tab (`/contracts/:id/payments`) to match the approved design, reusing the module-level payments register's real, already-working components (`PaymentFormModal`, `cancelPaymentAction`, the CSV export route) wherever possible rather than duplicating logic, while giving this contract-scoped page its own leaner filter bar, its own manager-friendly status labels, and the approved design's clearer column wording. Audit confirmed no external Account/SAP module exists anywhere in this system — payments are, and remain, manual Contract Management entries only. The module-level `/contracts/payments` register (its own KPI labels, filter bar, table, and status badge) was explicitly left untouched — a brand-new set of contract-detail-scoped components was built alongside it instead of modifying the shared ones.

Two small, honest interpretive decisions were needed since the approved screenshot's own column wording didn't cleanly map to the real schema:
- **"Submitted to Client"** — no distinct submitted-date field exists on `ContractPayment` (only `invoiceDate`/`dueDate`/`paidDate`). Uses the payment record's real `createdAt` (already returned by the API, already typed on the frontend) — the closest real event to "submitted," honestly labeled as such rather than reusing `invoiceDate` under a different name.
- **"Search by payment no., invoice, remarks…"** — the backend's existing search only matched `paymentNo`/`invoiceNumber`/contract reference/title, not `remarks`, even though `remarks` is already a real stored field. Extended the existing search `OR` clause (one line, no schema change) so the placeholder text is actually true.

### Migration

None added. No schema change.

### Changes

**Backend (minimal, additive):**
- `apps/api/src/contracts/contract-payments.service.ts` — `buildPaymentListWhere()`'s search `OR` clause gained `{ remarks: { contains: s, mode: 'insensitive' } }`. Same `contracts.read` + department-scope AND clause applies regardless; no other behavior changed.
- `apps/api/src/contracts/contract-payments.service.test.ts` — existing search test extended to assert the new `remarks` clause.

**Frontend — new pure helpers (fully unit tested):**
- `apps/web/src/app/(protected)/contracts/_lib/contract-payment-detail-helpers.ts` (+11 tests) — `PAYMENT_STATUS_LABELS`/`PAYMENT_STATUS_BADGE_CLASSES` (manager-friendly display-only re-labeling of the real `ContractPaymentStatus` enum — DB values never renamed), `PAYMENT_STATUS_FILTER_OPTIONS`, `findNextDuePayment()` (soonest-due not-Received/not-Cancelled payment, real, null when none), `computePercentOfContractValue()` (real, divide-by-zero-safe, null when the contract has no current value).

**Frontend — new components** (`[id]/(workspace)/payments/_components/`):
- `contract-payment-status-badge.tsx` — manager-friendly badge (Pending/Submitted/Certified/Partially Received/Received/Overdue/Cancelled), a separate component from the module-level register's own `PaymentStatusBadge` (untouched, keeps "Paid"/"Partially Paid").
- `contract-payment-kpi-strip.tsx` — 5 KPI cards (Submitted Invoices/Received Payments/Outstanding Payment/Overdue Payment/Next Due Payment), reusing the already-established `DashboardKpiCard` (icon-in-soft-circle style) rather than the module-level `PaymentSummaryCards` (whose "Total Submitted"/"Total Paid" labels this unit's task explicitly forbids here).
- `contract-payment-filter-bar.tsx` — leaner than the module-level filter bar: Search / Payment Status / Date Range (Invoice Date) / Overdue Only only — no Contract/Company/Department/Manager pickers, since the page is already scoped to one contract.
- `contract-payment-tracker-table.tsx` — the 12-column Payment Tracker table with the approved-design wording fix (Submitted to Client / Payment Due Date / Received On / Received Amount, never both "Received Date" and "Paid On"). Reuses `PaymentFormModal`/`cancelPaymentAction` unmodified.
- `contract-payment-statement-card.tsx` — "Payment Statement" (renamed from the approved screenshot's "Account Statement (Linked to Account Model)"), with the required "Manual payment entries inside Contract Management" subtitle and a real "% of Contract Value" column.
- `contract-payment-terms-summary-card.tsx` — "Payment Terms Summary" table (Payment Term / Selected / Notes), Notes always "—" (no notes field exists), Selected always the real saved boolean.

**Frontend — rewritten:**
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/payments/page.tsx` — fully rewritten as a `searchParams`-driven page (search/status/dateFrom/dateTo/overdueOnly), scoped to `contractId` from the route (never a user-editable filter); Export Excel link built server-side with `contractId` always included (verified live to never leak cross-contract data); bottom info note states the exact real Remaining Amount / Days Overdue logic, honestly.

### Verification Results (2026-09-01)

| Command | Result |
|---|---|
| `pnpm lint` / `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 294/294 (283 + 11 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1190/1190 (existing search test extended, not a new count) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ up to date (no migration) |
| Live end-to-end check (fresh dev servers — backend changed; `.next` cleared first per the earlier build/dev-cache lesson; `uat:seed`/`uat:cleanup`) | ✓ empty-state Payments tab confirmed honest ("No payments recorded yet", all 5 KPIs still visible at KWD 0.000, zero "Linked to Account Model"/SAP/"Payment Claims" anywhere). Created a real OVERDUE payment via the API: KPI strip showed real "KWD 5,000.000" on Submitted Invoices/Overdue Payment/Next Due Payment (with "Due on 15 Aug 2026" subtext and "1 payment overdue" subtext), Payment Tracker showed 17d Days Overdue and the correct Overdue badge, Payment Statement showed "—" for % of Contract Value (this UAT contract has no contractValue — divide-by-zero correctly avoided), Payment Terms Summary showed all 6 terms as real "Not selected". Confirmed the new `remarks` search extension actually finds a payment by its remarks text. Confirmed the Export Excel CSV is correctly scoped to only this one contract's payment (no cross-contract leakage). Module-level `/contracts/payments` confirmed completely unchanged (still shows "Total Submitted"/"Total Paid"). All 12 other workspace tabs, Contract List, Manager Dashboard, New Contract Register, Workflow/Claims/Issues/Closeout, and staff dashboard/My Tasks all 200. Test payment deleted afterward via direct SQL. |

### Deferred

- "Submitted to Client" uses `createdAt` (record-entry time) as the closest real proxy for "when this was submitted" — no distinct submitted-date field exists; flagged rather than silently repurposing `invoiceDate`.
- "Certified" kept as its own manager-friendly status label (not merged into the task's 6-label list) since it is a real, distinct backend state — collapsing it would hide real information.
- Duration (payment-period days) is not shown — only the real, already-computed "Days Overdue" is; no separate duration field exists.

## CM-57B — Contract Detail Overview Final UI Polish (Completed 2026-09-01)

### Summary

Frontend-only UI/UX polish pass on top of CM-57 — no data, calculation, backend, permission, or route change. The full-width "Available Actions" section (its own bordered card with an uppercase heading, sitting between Contract Summary and the Progress/Value/Financial row) broke the approved layout's flow, so it was removed; the exact same real components (`ContractTransitions`/`ContractClosureAction`, same visibility conditions) now render inline in Contract Summary's own header row, next to the "Contract Summary" heading — a placement change only, verified live to still show "Terminate Contract"/"Request Closeout" exactly where `hasActions` says they should. The header's `Actions`/`Print / Export` remain honest disabled placeholders (task confirmed the "Actions" dropdown is not actually wired up, so nothing was moved into it — wiring real behavior into a still-fake control would itself have been "fake action behavior"); their visual hierarchy was reordered to Edit Contract → Actions → Print/Export, matching the approved screenshot, with a Pencil icon added to Edit Contract and a stronger (text-2xl font-bold) title. Progress rings grew from 76px→88px with a thicker stroke and bolder center label. Value/Financial cards gained a highlighted "Current Contract Value" box and bolder color-coded amounts. Scope of Work switched to a 2-column checklist grid (matching Payment Terms) with a subtle checked-row background. Attention Required gained a warning-triangle icon, a count badge, and each row is now a single hover-able link (rather than text + separate link). The three bottom cards were rewritten from a stat-chip grid into a genuine compact `<table>` (header row of labels, one data row of values) per the task's explicit "make it look like a compact summary table" instruction. The bottom info note switched to `InfoBox`'s existing `variant="subtle"`.

### Changes

- `apps/web/src/app/(protected)/contracts/_components/contract-overview-summary-card.tsx` — new optional `actions?: React.ReactNode` prop, rendered right-aligned in the card's own header row.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/page.tsx` — removed the boxed "Available Actions" `<section>`; `ContractTransitions`/`ContractClosureAction` now passed as `ContractOverviewSummaryCard`'s `actions` prop when `hasActions` is true; bottom `InfoBox` switched to `variant="subtle"`.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/layout.tsx` — title `text-xl font-semibold` → `text-2xl font-bold`; department/scope badges moved from the title row into the metadata row (de-emphasized, no longer competing with the title/status badge); header buttons reordered (Edit Contract → Actions → Print/Export) with a `Pencil` icon added to Edit Contract and `Print / Export` restyled as the visually strongest (dark) of the three, matching the approved screenshot's hierarchy — all three still exactly as functional/non-functional as before (Edit Contract real, Actions/Print still honest disabled placeholders).
- `apps/web/src/app/(protected)/contracts/_components/contract-overview-progress-card.tsx` — ring size 76px→88px, radius 30→36, stroke 7→8, center label `text-sm font-bold`→`text-base font-extrabold`, row labels gained `font-medium`.
- `apps/web/src/app/(protected)/contracts/_components/contract-overview-value-financial-cards.tsx` — Current Contract Value now a highlighted `bg-accent/5` box with a `text-lg font-bold` value; Approved Variations muted (`text-text-muted`) to read as an intentional placeholder; Financial Summary's four amount rows now `bold`; payment progress bar `h-1.5`→`h-2`.
- `apps/web/src/app/(protected)/contracts/_components/contract-overview-checklist-cards.tsx` — Scope of Work switched from a single column to `grid-cols-2` (matching Payment Terms); `ChecklistRow` gained a subtle `bg-success/5` background + `font-medium` label when checked.
- `apps/web/src/app/(protected)/contracts/_components/contract-overview-attention-card.tsx` — header gained an `AlertTriangle` icon and a real item-count badge; each row is now one `<Link>` (icon + text + action label, hover background) instead of separate text + link elements — same `AttentionItem[]` data, same hrefs.
- `apps/web/src/app/(protected)/contracts/_components/contract-overview-bottom-summary-cards.tsx` — replaced the `Stat` chip-grid with a new `SummaryTable` (header row of labels, one bold data row of values) for all three cards; "Pending Obligations" value styled `text-text-muted` to read as an intentional "—", not a broken 0.

No backend files touched — confirmed during audit this was achievable as pure frontend/UI polish.

### Verification Results (2026-09-01)

| Command | Result |
|---|---|
| `pnpm lint` / `pnpm typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 283/283 (unchanged — no data/logic touched) |
| `pnpm --filter @recafco/api test --run` | ✓ 1190/1190 (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ up to date |
| Live end-to-end check (`uat:seed`/`uat:cleanup`) | ✓ on the real `test project` contract (ACTIVE, real terminate/closeout permissions): no boxed "Available Actions" heading anywhere; "Terminate Contract" and "Request Closeout" confirmed rendering inline in Contract Summary's own header row; 88px progress rings, highlighted Current Contract Value box, 2-column Scope of Work grid, `<thead>`-based summary tables all present in the raw HTML; zero "Design Production"/"Risk Rating"/Account-module/Production-module/SAP wording. All 13 workspace routes (Overview + 12 tabs) and every module-level Contract Management page (List/Dashboard/New Register/Workflow/Payments/Claims/Issues/Closeouts) returned 200. Staff dashboard and My Tasks returned 200, unaffected. |

### Deferred

None new — same deferrals as CM-57 (Variations backend, document-expiry tracking, "Updated by" field, BOQ-item/scope-narrative/crane-detail viewing not yet relocated to a new tab).

## CM-57 — Contract Detail Overview Approved Design Rebuild (Completed 2026-09-01)

### Summary

Rebuilt `/contracts/:id`'s Overview tab to match the approved executive-dashboard screenshot: full-width Contract Summary, a Progress/Value/Financial row, a Scope/Payment Terms/Attention row, and a Payment Statement/Production/Documents row, plus a bottom info note. Audit confirmed almost everything needed already existed via real endpoints — `contractsApi.get()`, `listPayments({contractId})`'s server-computed `.summary` (full filtered set, not one page), and `getCloseoutChecks()`'s existing cross-module aggregation (workflow/issues/claims/payments/documents) — so this was overwhelmingly a frontend + pure-function unit. The one real gap: `getWorkflow()` lazily **generates** a contract's default workflow tasks on first call if none exist, which is fine for the real Workflow tab (a deliberate action) but would have made simply *viewing* Overview on a fresh Draft contract silently create a full task set — a write side effect the task explicitly said to avoid. Added one new read-only backend endpoint (`GET :id/workflow-summary`) that returns the same team/status/attachment data without ever generating anything, verified live (0 tasks before and after opening Overview on a task-less Draft contract).

No fake data anywhere: Variations show 0/"—" (no Variations backend exists — the `/variations` tab is itself an honest "tracking will be enabled after the Variations backend unit" stub); Production Summary falls back to real PRODUCTION-team workflow-task counts (never fabricated cast/delivered/stock numbers); Documents & Obligations shows the real sum of workflow-task + closeout-request attachment counts, with Pending Obligations shown as "—" (no such data exists); Risk Rating is never shown (Risk Assessment is itself a stub tab); a legacy `scopeOfWork.designProduction: true` value is never displayed as "Design Production" on this page.

### Migration

None added. No schema change — every field this unit reads already existed.

### Changes

**Backend (read-only addition):**
- `apps/api/src/contracts/contract-workflow.service.ts` — new `getWorkflowSummaryForContract()`: same `contracts.read` + department-scope checks as every other read here, plain `contractWorkflowTask.findMany()` (team/status/dueDate/attachment count), computes `isOverdue` via the existing `computeTaskIsOverdue()`. Never calls `generateWorkflowTaskTemplates()`/`createMany()` — no side effects.
- `apps/api/src/contracts/contracts.controller.ts` — new `GET :id/workflow-summary` (`@Permissions('contracts.read')`), separate from the existing `GET :id/workflow`.
- `apps/api/src/contracts/contract-workflow.service.test.ts` — +4 tests: rejects without `contracts.read`, 404 on missing contract, asserts department-scope check, and — the key regression guard — "never creates tasks, even when none exist yet."
- `apps/web/src/lib/contracts-api.ts` — `contractsApi.getWorkflowSummary()` + `ContractWorkflowSummaryData` type; `attachmentsCount` added to `ContractCloseoutRequest`'s already-existing field (no change needed there, already present).

**Frontend — new pure helpers (fully unit tested):**
- `apps/web/src/app/(protected)/contracts/_lib/contract-overview-helpers.ts` (+19 tests) — `computeTeamProgress()`/`computeOverallProgress()` (real completed/total workflow-task ratios per team), `computeProductionTaskSummary()` (real PRODUCTION-team task counts by bucket), `computePaymentProgressPercent()` (Received ÷ Current Value, divide-by-zero safe), `buildAttentionItems()` (every row gated behind a real count > 0 or a real overdue/closing-soon date condition — never expiring-document rows, since no expiry tracking exists), `OVERVIEW_SCOPE_DISPLAY_KEYS` (fixed 5-option scope list, `designProduction` excluded).

**Frontend — new Overview components:**
- `contract-overview-summary-card.tsx` (Section 1), `contract-overview-progress-card.tsx` (Section 2, plain inline SVG circular progress rings — no chart library added), `contract-overview-value-financial-cards.tsx` (Sections 3–4), `contract-overview-checklist-cards.tsx` (Sections 5–6), `contract-overview-attention-card.tsx` (Section 7), `contract-overview-bottom-summary-cards.tsx` (Sections 8–10).
- `contract-lifecycle-badge.tsx` — exported its label map as `LIFECYCLE_STATUS_LABEL` (was a private const) so the new Contract Status field can reuse it without duplicating the mapping.

**Frontend — rewritten/updated:**
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/page.tsx` — fully rewritten: fetches `get()`, `getWorkflowSummary()`, `listPayments({contractId, pageSize:1})`, `getCloseoutChecks()`, `listCloseoutRequests()` in parallel; renders the 10 approved-design cards; keeps the real (unchanged) Available Actions block (`ContractTransitions`/`ContractClosureAction`) conditionally, right after Contract Summary.
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/layout.tsx` — title now `<Job Order or Reference> – <Project Name>`; status badge prefers real `scheduleStatus` (colored per the existing `SCHEDULE_STATUS_BADGE_CLASSES`), falling back to the real lifecycle badge — never a guessed schedule value; metadata row simplified to Contract ID / Created on / Last Updated (Client/Contract Manager moved into the new Contract Summary card, no longer duplicated; "Updated by" omitted — no real field backs it).
- `apps/web/src/app/(protected)/contracts/_components/contract-workspace-tabs.tsx` — two label-only alignments: "Claims Registry"→"Claims / Change Orders", "Activity / Audit History"→"Activity Log". Every route/segment unchanged.

### Verification Results (2026-09-01)

| Command | Result |
|---|---|
| `pnpm lint` / `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 283/283 (264 + 19 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1190/1190 (1185 + ~5 new) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ up to date (no migration) |
| Live end-to-end check (fresh dev servers — backend changed, restarted per the established staleness check; `uat:seed`/`uat:cleanup`) | ✓ opened Overview on the real pre-existing `test project` contract (which has a legacy `scopeOfWork.designProduction: true`): all 10 section headings present, exactly 5 Scope of Work rows rendered (Shop Drawing/Production/Delivery/Erection checked, Ex-Factory unchecked) with zero "Design Production" anywhere; Contract Summary showed real Job Order/Date/Quotation/Company/Project/Manager/Status/Schedule Status/Days Remaining (24d, correctly computed); Attention Required showed real rows ("4 overdue workflow tasks", "Contract completion date is approaching (24d)") each with a working action link; Financial/Payment Statement cards showed real `KWD 0.000` (no manual payments entered yet — honest zero, not fake); zero occurrences of "Account module"/"linked account"/"Production Module"/"Payment Claims"/"Risk Rating"/"SAP" anywhere. Confirmed on a task-less Draft UAT contract that opening Overview does NOT auto-generate workflow tasks (0 tasks before and after, via a direct `GET :id/workflow-summary` check). All 14 other workspace routes (schedule/payments/production/variations/claims/risks/documents/workflow/issues/attachments/closeout/activity/edit) still 200. Contract List/dashboard/New Contract Register/workflow/payments/claims/issues/closeouts all 200. Staff redirect logic in `layout.tsx` verified byte-for-byte unchanged by this unit's diff. |

### Data Honesty Confirmation

Every number on the page is real or an honest 0/"—":
- Real, direct: Job Order, Date, Quotation #, Company Name, Project Name, Project Number, Contract Manager, Contract/Schedule Status, Days Remaining, Original/Current Contract Value, Scope of Work, Payment Terms (selected/unselected only — no invented percentages/status text).
- Real, computed: Technical/Production/Erection/Overall Progress (real workflow-task ratios), Payment Progress %, Submitted/Received/Outstanding/Overdue payment amounts, Attention Required rows, Total Attachments.
- Honest placeholders (explicitly, not silently): Approved Variations = 0, Last Variation = "—" (no Variations backend); Pending Obligations = "—" (no obligations tracking).
- Never shown: Risk Rating, expiring documents/performance bonds/insurance, "Design Production", any Account/Production/SAP-module wording.

### Unsupported/Deferred Metrics

- **Variations** — no backend exists yet (the `/variations` tab is itself a stub); Approved Variations/Last Variation are placeholders by necessity, not by choice.
- **Document expiry tracking** — no schema support; Documents & Obligations only ever shows real attachment counts, never expiry status.
- **"Updated by" name** — Contract has no generic `updatedByUser` field (only `activatedByUser`/`terminatedByUser`/`closedByUser`, each tied to a specific transition); inferring it from the latest `ContractActivity` would be an unreliable guess, so it is omitted entirely per the task's own "do not invent user names" rule.
- **"Main Contractor" field** — no distinct field exists separate from `counterpartyName` (already shown as Company Name); omitted rather than shown twice under a different label.
- **BOQ item line-by-line view, full scope narrative (scopeDescription/scopeExclusions/deliverables/milestones), and crane details** — the pre-existing `ContractInfoCard`/`ContractRegisterDetailsCard`/`ContractBadgeGroupCard`/`ContractScopeDetailsCard`/`ContractCraneDetailsCard`/`ContractBoqItemsCard` components are no longer rendered on Overview (replaced by the approved-design summary cards) but were **not deleted** — they're real, working components with no other consumer. Flagged here as a follow-up decision (e.g. a future "Details" or "BOQ" tab), not silently dropped.

### Next Recommended Unit

Decide where the now-unrendered detail components (BOQ items, full scope narrative, crane details) should resurface — most likely a new tab, since Overview is now intentionally an executive summary rather than a full record view.

## CM-56E — New Contract BOQ Table Final Readability Polish (Completed 2026-09-01)

### Summary

Frontend-only column-width rebalance on the New Contract Register BOQ table — no backend, DTO, service, or formula change. Audit confirmed the read-only calculated-cell styling, right-aligned numeric inputs, and scoped horizontal scroll from CM-56D were already in place; the remaining gap was column-width balance now that the table carries 13 columns (Drawing Qty added in the prior unit). Item Description widened (280px→320px, still a single-line input, row height unchanged); Unit Price widened slightly (96px→112px) for larger monetary values; Total Price and Amount Remaining (the two currency-formatted read-only cells, e.g. "KWD 2,400.000") widened (112px→128px) so formatted values don't crowd; Drawing Ref. and Calculation Ref. narrowed (112px→96px) to free up space, matching the "compact optional fields" guidance; BOQ Qty/Area, Drawing Qty, and Invoice Qty stayed equal-width (96px) as required. Table `min-w` bumped from 1400px to 1500px (`min-w-375`) to match.

### Changes

- `apps/web/src/app/(protected)/contracts/_components/contract-boq-register-table.tsx` — column width classes only: Item Description `min-w-70`→`min-w-80`; Unit Price `w-24`→`w-28`; Total Price / Amount Remaining `w-28`→`w-32`; Drawing Ref. / Calculation Ref. `w-28`→`w-24`; table `min-w-[1400px]`→`min-w-375` (1500px). No column added/removed/reordered, no formula touched, no field name touched.

No backend files touched — confirmed during audit this was achievable as pure column-width polish.

### Verification Results (2026-09-01)

| Command | Result |
|---|---|
| `pnpm lint` / `pnpm typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 264/264 (unchanged — no logic touched) |
| `pnpm --filter @recafco/api test --run` | ✓ 1185/1185 (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ up to date |
| Live end-to-end check (`uat:seed`/`uat:cleanup`) | ✓ all 12 required column labels present and in the correct left-to-right order (verified programmatically against the raw HTML); no "Design Production"/"P/R"; `unitOfMeasure="m²"` confirmed selected by default. Real `POST /contracts` with `drawingQty`/`invoiceQty`/`drawingReference`/`specificationReference` → 201, all round-tripped identically to CM-56D (`totalPrice` = 80×30 = 2400, unaffected by drawingQty). Contract List, dashboard, workflow, payments, schedule, and Contract Staff (`test.operator`) pages all 200 |

### Deferred

None new.

## CM-56D — Add Drawing Qty to New Contract BOQ (Completed 2026-09-01)

Note: this unit reuses the "CM-56D" code from the task text it was given, distinct from the earlier "CM-56D — New Contract Register Final UX Polish" entry directly below.

### Summary

Added an optional "Drawing Qty" column to the New Contract Register BOQ table, placed before Invoice Qty. Audit confirmed no existing field covered this (`revisedQty` exists but already feeds `boqRowQty()`/Total Price as an override — reusing it would have silently pulled Drawing Qty into the Total Price formula, violating the explicit "Drawing Qty must never affect calculations" requirement), so one new additive nullable column (`contract_boq_items.drawing_qty`) was required. Wired through the full stack: Prisma schema/migration, `CreateContractBoqItemDto`, both `create()`/`update()` BOQ `createMany` mappings and the shared `select` block in `contracts.service.ts`, the frontend `ContractBoqItem` API type, and `contract-boq-helpers.ts` (`BoqRow`, `emptyBoqRow()`, `boqRowHasAnyValue()`, `validateBoqRows()`, `BoqApiItem`/`toBoqApiItems()`, `ExistingBoqItem`/`boqRowsFromExisting()`). `boqLineTotal()`, `boqProgressPercent()`, and `boqAmountRemaining()` were deliberately left untouched — Drawing Qty is never read by any of them. The BOQ helper note was updated to the exact required wording explaining BOQ Qty / Area vs. Drawing Qty vs. Progress / Invoice %.

### Migration

`20260901010000_add_contract_boq_drawing_qty` — one new nullable column, `contract_boq_items.drawing_qty DECIMAL(14,3)`. Purely additive; no existing column, constraint, or migration touched. Applied via the established shadow-DB workaround; confirmed via `prisma migrate status` → "Database schema is up to date!".

### Changes

- `packages/database/prisma/schema.prisma` — `ContractBoqItem.drawingQty` (new, nullable), placed before `invoiceQty` with a comment explaining it is deliberately never read by any BOQ formula.
- `apps/api/src/contracts/dto/create-contract-boq-item.dto.ts` — added `drawingQty?: number` (`@IsOptional @IsNumber(maxDecimalPlaces:3) @Min(0)`), same shape as `invoiceQty`. Shared by create and update DTOs.
- `apps/api/src/contracts/contracts.service.ts` — `drawingQty: true` added to the shared BOQ item `select` block; `...(item.drawingQty !== undefined ? { drawingQty: item.drawingQty } : {})` added to both `create()`'s and `update()`'s BOQ `createMany` mappings (two separate edits, differing indentation, verified via grep afterward).
- `apps/api/src/contracts/contracts.service.test.ts` — +3 tests: drawingQty persisted on create (totalPrice unaffected), omitted (not forced to 0) when absent, persisted on update's BOQ replace.
- `apps/web/src/lib/contracts-api.ts` — `ContractBoqItem.drawingQty?: string` added.
- `apps/web/src/app/(protected)/contracts/_lib/contract-boq-helpers.ts` — `drawingQty` wired through `BoqRow`, `emptyBoqRow()`, `boqRowHasAnyValue()`, `validateBoqRows()` (rejects negative, allows blank), `BoqApiItem`/`toBoqApiItems()`, `ExistingBoqItem`/`boqRowsFromExisting()`. `boqRowQty()`, `boqLineTotal()`, `boqProgressPercent()`, `boqAmountRemaining()` untouched.
- `apps/web/src/app/(protected)/contracts/_lib/contract-boq-helpers.test.ts` — +9 tests, including three explicit "drawingQty does not affect boqLineTotal/boqProgressPercent/boqAmountRemaining" comparisons (same inputs with and without a large `drawingQty` produce identical results).
- `apps/web/src/app/(protected)/contracts/_components/contract-boq-register-table.tsx` — "Drawing Qty" column inserted between Total Price and Invoice Qty in `BOQ_COLUMNS`/`RIGHT_ALIGNED_COLUMNS`; new right-aligned numeric input cell with a title tooltip clarifying it's informational only.
- `apps/web/src/app/(protected)/contracts/new/_components/new-contract-form.tsx` — BOQ helper note updated to the exact required wording: "BOQ Qty / Area is the original contract quantity. Drawing Qty can be updated when drawing/calculation quantity is confirmed. Progress / Invoice % is calculated from Invoice Qty against BOQ Qty / Area."

### Verification Results (2026-09-01)

| Command | Result |
|---|---|
| `pnpm lint` / `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 264/264 (255 + 9 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1185/1185 (1182 + 3 new) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ "Database schema is up to date!" |
| Live end-to-end check (fresh dev servers — prior ones predated this unit's backend edits and the API has no hot reload; `uat:seed`/`uat:cleanup`) | ✓ "Drawing Qty" header confirmed to render between "Total Price (T/P) KWD" and "Invoice Qty" via raw HTML index comparison; no "Design Production"/"P/R"; helper note text matches exactly. Real `POST /contracts` with `drawingQty: 95` on one row and no `drawingQty` on a second row → 201; `drawingQty` round-tripped as `"95"`/`null` respectively; `totalPrice` stayed `100×20=2000` (unaffected); blank Drawing Qty did not block save. Contract List, dashboard, workflow, payments, schedule, and Contract Staff (`test.operator`) pages all 200. Test contract deleted afterward via direct SQL. |

### Deferred

- None new. Edit Contract's own BOQ table still doesn't expose `invoiceQty`/`drawingQty` in its UI (both are stored/API-visible regardless) — same pre-existing deferral from CM-56/CM-56C.
- No hard-delete endpoint for contracts — still requires direct SQL for test-data cleanup.

## CM-56D — New Contract Register Final UX Polish (Completed 2026-09-01)

### Summary

Final UI/UX polish pass on `/contracts/new` — no rebuild, no functional change. `InfoBox` (shared by New Register and Edit Contract) gained an opt-in `variant="subtle"` (default unchanged) for a lighter/shorter helper-note style; `ScopeOfWorkFieldset` forwards an `infoBoxVariant` prop so its own Ex-Factory note can use the subtle style too, without touching Edit Contract's rendering (which passes neither prop). New Register's own three inline notes (department banner, Progress/Invoice % note, Register Contract note) now use the subtle variant. The BOQ table's calculated columns (Total Price, Progress / Invoice %, Amount Remaining) now render inside a muted read-only-looking box instead of plain text; the three raw-number input columns (BOQ Qty/Area, Unit Price, Invoice Qty) are right-aligned with tabular numerals; Item Description's minimum width grew (220px → 280px); column headers for every numeric/amount column are now right-aligned to match; the Total Amount summary box got a stronger accent-tinted, bold treatment. Section card padding/gaps were tightened slightly (`p-6`→`p-5`, `space-y-5`/`gap-5`→`space-y-4`/`gap-4`). Bottom-row Save Draft is now visually distinct from Cancel (light accent-tinted "secondary" style instead of an identical plain outline), giving Cancel / Save Draft / Register Contract three distinct visual weights.

### Changes

- `apps/web/src/app/(protected)/contracts/_components/contract-form-fields.tsx` — `InfoBox` gained `variant?: 'default' | 'subtle'` (default `'default'`, unchanged look); `ScopeOfWorkFieldset` gained `infoBoxVariant?: 'default' | 'subtle'` (default `'default'`), forwarded to its own `InfoBox`.
- `apps/web/src/app/(protected)/contracts/_components/contract-boq-register-table.tsx` — Total Price/Progress-Invoice-%/Amount Remaining cells now render in a muted `boqReadOnlyCls` box (right-aligned, tabular-nums) instead of plain `<td>` text; BOQ Qty/Area, Unit Price, Invoice Qty inputs gained `text-right tabular-nums`; Item Description `min-w` increased to `min-w-70` (280px); table header cells for numeric/amount columns right-aligned to match; Total Amount summary box restyled with an accent border/tint and bold `text-lg` value.
- `apps/web/src/app/(protected)/contracts/new/_components/new-contract-form.tsx` — `SectionCard` padding `p-5 sm:p-6`→`p-5`, header margin `mb-4`→`mb-3`; form/grid spacing `space-y-5`/`gap-5`→`space-y-4`/`gap-4`; department banner, Progress/Invoice % note, and Register Contract note switched to `<InfoBox variant="subtle">`; `ScopeOfWorkFieldset` now passes `infoBoxVariant="subtle"`; bottom-row Save Draft button restyled (`border-accent/30 bg-accent/5 text-accent`) to read as a distinct secondary action next to the plain-outline Cancel and solid-green Register Contract.

No backend files touched — confirmed during audit that this was achievable as pure frontend/UI polish with zero field-name, action, or calculation changes.

### Verification Results (2026-09-01)

| Command | Result |
|---|---|
| `pnpm lint` / `pnpm typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 255/255 (unchanged — no pure-function/calculation changes) |
| `pnpm --filter @recafco/api test --run` | ✓ 1182/1182 (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ up to date |
| Live end-to-end check (fresh `uat:seed`/`uat:cleanup`) | ✓ all 12 BOQ columns still present, no "Design Production"/"P/R", read-only calculated-cell styling and the accent Total Amount box confirmed in the raw HTML; real `POST /contracts` with `invoiceQty`/`drawingReference`/`specificationReference`/dates/`originalContractValue` all round-tripped identically to CM-56C (contractValue stayed BOQ-derived, independent of originalContractValue); Contract List, dashboard, workflow, payments, schedule, and Contract Staff (`test.operator`) pages all 200 |

### Deferred

None new.

## CM-56C — New Contract Register Dates and Value Sections (Completed 2026-09-01)

### Summary

Added Contract Dates (Start Date / End Date / Forecast Completion Date) and Contract Value (Original Value / Currency) sections to `/contracts/new`, matching the CM-56B wide layout. Audit confirmed this was purely frontend-only: `startDate`, `endDate`, `forecastCompletionDate`, `originalContractValue`, `originalCurrency` were already declared (optional) in `create-contract.dto.ts`, already persisted by `contracts.service.ts`, and already read from `FormData` by `createContractAction` — none of that needed to change. The existing shared `ContractDatesFields`/`ContractValueFields` components (already used by Edit Contract) were reused as-is; New Register only supplies a `defaults={{ originalCurrency: 'KWD' }}` prop to `ContractValueFields` so Currency starts pre-filled — a prop-level default that leaves the shared component's own fallback (blank) untouched for Edit Contract. Section numbering was updated (Contract Dates=3, Contract Value=4, Payment Terms=5, BOQ=6, Actions=7) and a new Row 2 (`grid-cols-2` on desktop) places Contract Dates and Contract Value side by side, mirroring Row 1's side-by-side Basic Details/Scope of Work.

### Changes

- `apps/web/src/app/(protected)/contracts/new/_components/new-contract-form.tsx` — imported `ContractDatesFields`/`ContractValueFields`; inserted a new Row 2 (`grid-cols-1 lg:grid-cols-2 gap-5`) between Row 1 and Payment Terms containing Section 3 (Contract Dates) and Section 4 (Contract Value, with `defaults={{ originalCurrency: 'KWD' }}`); renumbered Payment Terms (3→5), Contract BOQ / Items (4→6), Actions (5→7).

No other files changed — `contract-form-fields.tsx` (where `ContractDatesFields`/`ContractValueFields` already lived), `actions.ts`, `contracts.service.ts`, DTOs, and the schema were all read during the audit but needed no edits.

### Migration

None added. No schema change — all six fields already existed as nullable/optional columns from earlier units.

### Verification Results (2026-09-01)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` (web) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 255/255 (unchanged — no pure-function/logic changes) |
| `pnpm --filter @recafco/api test --run` | ✓ 1182/1182 (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ "Database schema is up to date!" |
| Live end-to-end check (fresh `uat:seed`/`uat:cleanup`, real dev DB) | ✓ `/contracts/new` renders sections in order 1–7 with all required field names present, Currency pre-filled "KWD". Real `POST /contracts` with `startDate`/`endDate`/`forecastCompletionDate`/`originalContractValue: 5000`/`originalCurrency: "KWD"` plus one real BOQ item (100×20=2000) → 201; all three dates round-tripped; `contractValue` (current) = 2000 from the BOQ total, `originalContractValue` stayed 5000 — confirming the two never collide. New contract appeared correctly in Contract List (with its real dates/values in the raw payload). Dashboard/workflow/payments/schedule pages and Contract Staff (`test.operator`) `/contracts`, `/contracts/dashboard`, `/contracts/workflow` all 200. Test contract deleted afterward via direct SQL (still no hard-delete API route for contracts). |

### Key Implementation Notes

- `ContractsService.create()`'s existing rule (`effectiveContractValue = boqItems.length > 0 ? BOQ total : dto.contractValue`, with `effectiveOriginalContractValue = dto.originalContractValue ?? effectiveContractValue`) already did exactly what this unit needed: Original Value is a genuinely separate, manually-entered field, and Current (BOQ-derived) Value is untouched by it. No service change required.
- Passing `defaults={{ originalCurrency: 'KWD' }}` as a prop (rather than editing `ContractValueFields`'s own internal `?? ''` fallback) keeps Edit Contract's blank-when-unset behavior completely unchanged — only New Register's call site opts into a pre-filled default.

### Deferred

- None new. CM-56/CM-56B's existing deferrals (Edit Contract's BOQ table not yet showing invoiceQty in its UI; no hard-delete endpoint for contracts) still stand.

## CM-56B — New Contract Register Approved Layout Correction (Completed 2026-09-01)

### Summary

Layout-only correction on top of CM-56: the initial rebuild was functionally correct but visually too narrow/stacked. Widened `/contracts/new` to the same `max-w-[1920px]` wide-workspace container `contracts/page.tsx` already uses, put Basic Contract Details (~60%, `lg:grid-cols-[3fr_2fr]`) and Scope of Work (~40%) side by side on desktop, widened Payment Terms to a `lg:grid-cols-6` single-row layout with larger cards, and enlarged/restyled the Cancel/Save Draft buttons (blue primary Save Draft, white outline Cancel) in both the page header and Section 5's Actions row. `ScopeOfWorkFieldset` gained an optional `gridClassName` prop (default unchanged) so New Register's narrower column could use a 2-column checkbox grid without touching Edit Contract, which passes no override.

### Changes

- `apps/web/src/app/(protected)/contracts/_components/contract-form-fields.tsx` — `ScopeOfWorkFieldset` gained `gridClassName?: string` (default `gridCls3`).
- `apps/web/src/app/(protected)/contracts/new/_components/new-contract-form.tsx` — Row 1 wraps Basic Contract Details + Scope of Work in a `grid-cols-[3fr_2fr]` container; Payment Terms grid widened to `lg:grid-cols-6`; all `SectionCard`s gained `shadow-sm`; Actions/header buttons enlarged (`h-11 px-5`).
- `apps/web/src/app/(protected)/contracts/new/page.tsx` — container widened `max-w-5xl` → `max-w-[1920px]`; header Cancel/Save Draft buttons enlarged and restyled (Save Draft now `bg-accent` primary).

### Verification Results (2026-09-01)

| Command | Result |
|---|---|
| `pnpm lint` / `pnpm typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 255/255 (unchanged — layout-only) |
| `pnpm --filter @recafco/api test --run` | ✓ 1182/1182 (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ up to date |
| Live end-to-end check | ✓ wide layout confirmed via SSR HTML (`max-w-[1920px]`, `grid-cols-[3fr_2fr]`, `lg:grid-cols-6` all present); real `POST /contracts` with `invoiceQty`/`drawingReference`/`specificationReference` still round-tripped correctly; Contract List/dashboard/workflow/payments/schedule/claims/closeouts/issues and Contract Staff pages all 200 |

### Deferred

None new.

## CM-56 — New Contract Register Approved Design Rebuild (Completed 2026-09-01)

### Summary

Rebuilt `/contracts/new` to match the approved design screenshot: a single dedicated page (breadcrumb "Contract Management > Contract List > New Contract Register") with 5 numbered sections — Basic Contract Details, Scope of Work, Payment Terms, Contract BOQ / Items, Actions — and top-right Cancel + Save Draft buttons that operate on the same form. Audited first: found both a real page and a modal (`new-contract-register-modal.tsx`) wrapping the same shared `NewContractForm` via a `layout` prop; deleted the modal entirely and pointed the Contract List's "+ New Contract Register" button at the page, since the approved breadcrumb design is inherently page-based. Scope of Work now excludes Design Production (plus Other/Not Applicable, to match the approved 5-option list); the Ex-Factory→disables-Delivery/Erection rule is untouched. Rebuilt the BOQ table with the approved column set and renamed "P/R" to "Progress / Invoice %" everywhere. Added a real, persisted `invoiceQty` column so Progress % and Amount Remaining are genuine, live-calculated values instead of permanently-zero placeholders — Total Price stays exactly `BOQ Qty × Unit Price`, unaffected by invoiceQty. "Register Contract" replaces the old "Create Draft Contract" label; both submit buttons still produce an identical Draft-status contract (no separate register-vs-draft backend state exists), and Section 5's copy says so honestly instead of implying auto-activation.

### Migration

`20260901000000_add_contract_boq_invoice_qty` — one new nullable column, `contract_boq_items.invoice_qty DECIMAL(14,3)`. Purely additive; no existing column, constraint, or migration touched. Applied via the established shadow-DB workaround (`prisma db execute --file` → `prisma migrate resolve --applied`); confirmed via `prisma migrate status` → "Database schema is up to date!".

### Changes

- `packages/database/prisma/schema.prisma` — `ContractBoqItem.invoiceQty` (new, nullable); model header comment updated to say only Progress %/Amount Remaining stay derived (invoiceQty is now real/stored).
- `apps/api/src/contracts/dto/create-contract-boq-item.dto.ts` — added `invoiceQty?: number` (`@IsOptional @IsNumber(maxDecimalPlaces:3) @Min(0)`); added `'ls'` to `CONTRACT_BOQ_UNIT_OPTIONS`. Shared by both create and update DTOs.
- `apps/api/src/contracts/contracts.service.ts` — `invoiceQty` added to the shared BOQ `select` block and to both `create()`'s and `update()`'s BOQ `createMany` mappings (two separate edits — different indentation between the two blocks). `computeBoqItemTotal()` untouched — Total Price stays independent of invoiceQty.
- `apps/api/src/contracts/contracts.service.test.ts` — +3 tests covering invoiceQty persisted on create, omitted (not forced to 0) when absent, and persisted on update's BOQ replace.
- `apps/web/src/lib/contracts-api.ts` — `ContractBoqItem.invoiceQty?: string` added to the client type.
- `apps/web/src/app/(protected)/contracts/_lib/contract-boq-helpers.ts` — new `emptyRegisterBoqRow()` (m² default, separate from `emptyBoqRow()` so Edit Contract's row-add is unaffected), `boqInvoicedValue()`, `boqProgressPercent()`, `boqAmountRemaining()` (qty-guarded — returns 0 rather than a spurious negative when BOQ Qty is blank/0; not clamped once qty is valid, so genuine over-invoicing still shows as negative); `invoiceQty` wired through `BoqRow`, `validateBoqRows()`, `toBoqApiItems()`, `boqRowsFromExisting()`; `'ls'` added to `UNIT_OF_MEASURE_OPTIONS` (free VARCHAR column, no migration needed).
- `apps/web/src/app/(protected)/contracts/_lib/contract-boq-helpers.test.ts` — +16 tests (20→36) for the new helpers, including the blank/zero-qty divide-by-zero guards and an explicit over-invoiced negative case.
- `apps/web/src/app/(protected)/contracts/_components/contract-form-fields.tsx` — `ScopeOfWorkFieldset` gained an optional `excludeKeys?: string[]` prop to hide specific scope options (and their Other/Not Applicable helper text) without affecting Edit Contract, which passes none.
- `apps/web/src/app/(protected)/contracts/_components/contract-boq-register-table.tsx` (new) — dedicated BOQ table for New Register only: S/N, Item Description, Unit, BOQ Qty / Area, Unit Price (U/P) KWD, Total Price (T/P) KWD, Invoice Qty, Progress / Invoice %, Amount Remaining KWD, Drawing Ref., Calculation Ref., Action. Delete blocked at 1 row (disabled + tooltip). Deliberately separate from the shared `contract-boq-table.tsx`, which Edit Contract keeps using unchanged with its own larger column set.
- `apps/web/src/app/(protected)/contracts/new/_components/new-contract-form.tsx` — rewritten: dropped unused `depts`/`plantsData`/`locations`/`people`/`onCancel`/`layout` props and the entire modal-layout branch; now a single always-page form with `id={NEW_CONTRACT_FORM_ID}` (exported), 5 `SectionCard`s matching the approved design, 5 blank BOQ rows on mount, honest Section 5 copy.
- `apps/web/src/app/(protected)/contracts/new/page.tsx` — rewritten: only fetches `contractsApi.dashboard()` (scope banner); real Cancel `<Link>` + a `<button form={NEW_CONTRACT_FORM_ID}>Save Draft</button>` in the page header submit/cancel `NewContractForm`'s form via the plain HTML `form` attribute — no client wrapper or shared state needed.
- `apps/web/src/app/(protected)/contracts/page.tsx` — "+ New Contract Register" now a `<Link href="/contracts/new">` (was a modal trigger); dropped the now-unused `departments()`/`plants()`/`locations()` fetches (kept `people()` for the filter bar).
- `apps/web/src/app/(protected)/contracts/_components/new-contract-register-modal.tsx` — deleted (zero remaining consumers, confirmed via grep).

### Verification Results (2026-09-01)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 255/255 tests (239 + 16 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1182/1182 tests (1179 + 3 new) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ "Database schema is up to date!" |
| Live end-to-end check (fresh dev servers — prior ones were stale from before this unit's edits; idempotent `uat:seed`/`uat:cleanup`) | ✓ `/contracts/new` page HTML: correct title/subtitle/breadcrumb/5 section headers, zero "Design Production", zero standalone "P/R", all 8 required BOQ column labels present, "m²" present 3×, both submit buttons render. Real `POST /contracts` with `unitOfMeasure: "m²"`, `invoiceQty: 100`, `drawingReference`, `specificationReference` → 201, `contractValue` = 6250 = 500×12.5 (unaffected by invoiceQty), all fields round-tripped on the created record including the second, mostly-blank BOQ row (didn't block save). New contract appeared correctly in `/contracts` (list), `/contracts/:id` (detail), `/contracts/dashboard` (all 200). `/contracts/workflow`, `/payments`, `/schedule`, `/claims`, `/closeouts`, `/issues` and the Contract Staff (`test.operator`) `/contracts`, `/contracts/dashboard`, `/contracts/workflow` all 200. Test contract + its BOQ rows deleted afterward via direct SQL (no hard-delete API route exists for contracts yet) since it was UAT-created data, not a pre-existing record. |

### Key Implementation Notes

- The HTML native `form` attribute (`<button type="submit" form="...">`) lets a Server-Component page header submit a Client Component's `<form>` with zero shared state — a reusable pattern for any future "external action buttons for an internal client form" need. Documented in `ui-registry.md`.
- `boqAmountRemaining()`'s qty guard was added after a test failure: without it, a blank/zero BOQ Qty with a real invoiceQty×unitPrice produced a spurious negative (`0 − invoicedValue`) instead of 0. Once qty is valid, negative "over-invoiced" values are intentionally preserved (real signal), so the guard only fires when qty itself is unusable.
- `unitOfMeasure` is a free VARCHAR, not a Prisma/DB enum, so adding `'ls'` needed no migration.
- Global `ValidationPipe({ whitelist: true })` silently strips any field not declared in a DTO — `invoiceQty` had to be added to `create-contract-boq-item.dto.ts` (not just the Prisma schema) or it would never have reached the database.

### Deferred

- Edit Contract's BOQ table (`contract-boq-table.tsx`) does not yet expose `invoiceQty`/Progress %/Amount Remaining — only New Register does. The value is stored and API-visible either way; wiring it into Edit Contract's UI is a separate, contained follow-up, deliberately left out of this unit's scope (redesigning the shared table would also change Edit Contract's UX, not requested here).
- No hard-delete endpoint exists for contracts (archive/delete was added for Departments/Plants/Locations/Users in an earlier unit, not Contracts) — noted for whoever picks up contract lifecycle cleanup next; today, removing an accidental contract still requires direct SQL.

## CM-55D — Contract List Final Table Polish (Completed 2026-08-31)

### Summary

Final frontend-only polish on the CM-55/CM-55B/CM-55C Contract List — no backend, data, `scheduleStatus`, or filter change. Audited Contract ID wrapping first: CM-55C had already applied `whitespace-nowrap` to that cell, so the literal "CONTRACT-\n2026-000001" wrap wasn't actually reproducible — the real gap was that `table-layout: auto` had no reserved width for the column, so it could still render uncomfortably narrow. Added an explicit `min-w-40` (plus a defensive `title` tooltip) to close that gap for good. Restructured the Action column so only "Open" and a "···" More menu are ever visible — the status-driven primary action (Activate/Assign Tasks/Review Closeout) moved to the top of the dropdown instead of sitting as a third always-visible button — and added a compact top-of-table row with a real "Showing X to Y of Z contracts" count on the left and the Simple/Full View toggle (now labeled "View:") on the right, matching the approved design direction.

### Changes

- `contract-row-actions.tsx` — the "primary" action (Activate/Assign Tasks/Review Closeout) is now the first item inside the "···" menu (`text-accent font-medium`) instead of an inline button between Open and the menu trigger. Activate's confirm-dialog flow is unchanged, just triggered from a menu `<button>`. `computeContractRowActionPlan()` (the pure, already-tested decision function) is completely untouched — this is a rendering-only change in the one component that consumes its output.
- `contract-list-table.tsx` — Contract ID header/cells gained `min-w-40` + a `title` tooltip (on top of CM-55C's existing `whitespace-nowrap`); new top toolbar row combines a real pagination-derived count (`page`/`pageSize`/`total` — 3 new optional props, falling back to a plain "Showing N contracts" when not supplied) on the left with the "View:" + Simple/Full toggle on the right, replacing the toggle-only row.
- `page.tsx` — extracted the `pageSize: 25` literal into a named `PAGE_SIZE` constant, passed `page`/`pageSize`/`total` through to `ContractListTable`; the bottom Previous/Next block dropped its now-redundant "Showing X of Y" text (superseded by the new, more accurate top-row count) but keeps full Previous/Next navigation.
- `context/ui-registry.md` — new entries for the restructured `ContractRowActions` and the Contract ID `min-w-40` addition.

### Verification Results (2026-08-31)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 239/239 tests (unchanged — `computeContractRowActionPlan` untouched, no new pure-function surface added this unit) |
| `pnpm --filter @recafco/api test --run` | ✓ 1179/1179 tests (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks |
| Live end-to-end check (idempotent `uat:seed`/`uat:cleanup`, real dev DB) | ✓ top row renders "Showing 1 to 3 of 3 contracts" (real, matches the 3 in-scope contracts) + "View:" label; exactly one "Open" link and one "···" trigger per row (no extra visible primary button); Contract ID `min-w-40` present on header and all 3 rows; sticky-left/sticky-right classes still intact; `PATCH .../schedule-status` re-verified to persist without touching `status`/`version`; the real contract's `scheduleStatus` reverted to NULL via direct SQL afterward; Staff dashboard/My Tasks/list and manager dashboard/workflow/payments/claims all unaffected (200, no error boundaries) |

### Key Implementation Notes

- **Contract ID audit finding:** the "wraps like CONTRACT-\n2026-000001" symptom described in this unit's task was not reproducible as literally described — CM-55C had already set `whitespace-nowrap` on that cell. The real remaining gap (no reserved minimum width under `table-layout: auto`) is now closed with `min-w-40`, reported honestly rather than claiming to have fixed a bug that, on inspection, was already partially fixed.
- `ContractRowActions` has no direct component test file in this codebase (only its pure `computeContractRowActionPlan()` decision logic is unit tested) — the restructure's correctness was confirmed via live SSR-HTML rendering (element counts) rather than `pnpm test`, consistent with how every other UI-only change in this CM-54/55 series has been verified.

### Deferred

- Nothing new deferred this unit — CM-55C's already-reported deferrals (sticky Contract No., full elimination of Full View's horizontal scroll) still stand; this unit didn't attempt either.

## CM-55C — Contract List Table UX Polish (Completed 2026-08-31)

### Summary

Frontend-only UX polish on the CM-55/CM-55B Contract List table — no backend, data, or `scheduleStatus`/status-dropdown API change. Fixed the reported row-height/horizontal-scroll problem: rows were tall because text-heavy cells (Contract Name, Client, Contract Type's full comma-joined scope list) had no truncation and wrapped across multiple lines. Contract Type in particular could show 5+ scope labels as one long wrapped string. Compact padding, `truncate`/`whitespace-nowrap`/`max-w-*` + `title` tooltips on the text-heavy cells, and a new `formatScopeCompact()` ("Shop Drawing +4" instead of the full list) fix that. Full View still needs horizontal scroll on typical desktop widths — it has up to 15 real columns — so Contract ID (left) and Action (right) are now `sticky`, keeping identity and the primary action reachable without scrolling regardless of scroll position.

### Changes

- `contract-ui-helpers.ts` (+4 tests) — new `formatScopeCompact()`, a sibling to `formatScopeSummary()` (which is unchanged and still used as-is by `workflow-contract-header.tsx`/`contracts-needing-setup-section.tsx`). Returns `{ display: "Shop Drawing +4", fullList }` — `fullList` is always identical to what `formatScopeSummary()` already returns, for a `title` tooltip.
- `contract-list-table.tsx` — full visual rewrite: row padding `px-4 py-3`→`px-3 py-2`; Contract Name/Client/Contract Manager/Contract No. gained `max-w-*` + `truncate` + `title`; Contract Type now renders via the new compact `ScopeCell` (was the full, unbounded `formatScopeSummary()` string); Current Value right-aligned, Open Claims/Days Remaining centered; progress bars narrowed slightly (`w-16`→`w-12`, `gap-2`→`gap-1.5`); Contract ID column is `sticky left-0` and Action column is `sticky right-0` (both with an explicit opaque background + border, in both the navy header and the body rows) so both stay reachable without horizontal scrolling. Same columns, same `ContractScheduleStatusSelect`/`ContractRowActions`, same Full View default from CM-55 — purely `className`/JSX-structure changes.

### Verification Results (2026-08-31)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 239/239 tests (235 + 4 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1179/1179 tests (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks |
| Live end-to-end check (idempotent `uat:seed`/`uat:cleanup`, real dev DB) | ✓ sticky-left/sticky-right classes render on both header and exactly 3 body rows (matching the 3 in-scope contracts); a real 5-scope contract renders "Shop Drawing +4" (not the full wrapped list); `PATCH .../schedule-status` re-verified to persist without touching `status`/`version`; the real (non-UAT) contract's `scheduleStatus` was reverted to NULL via direct SQL afterward, as in CM-55; Staff dashboard/My Tasks and manager dashboard/workflow/payments/claims all unaffected (200, no error boundaries) |

### Key Implementation Notes

- Sticky cells need their own explicit opaque background (`bg-surface` for body, `bg-nav` for header) — a `<tr>`-level hover tint alone would let scrolled content show through a transparent sticky cell. Documented in `ui-registry.md` for reuse elsewhere.
- Full View (15 real columns) still requires horizontal scroll on typical laptop/desktop widths even after this polish pass — this is reported honestly, not hidden. The sticky columns make that scroll far less painful (identity + primary action are always reachable), but eliminating the scroll entirely would mean cutting required columns, which this unit was told not to do.

### Deferred

- Sticky Contract No. (in addition to Contract ID) — task allowed deferring this ("if not feasible, defer"); Contract ID alone already anchors row identity, and a second sticky-left column would eat into the scrollable width budget for comparatively little benefit.
- Full elimination of horizontal scroll in Full View — not achievable without removing required columns (out of scope per this unit's own instructions).

## CM-55B — Remove Contract List Bottom Explanation Cards (Completed 2026-08-31)

### Summary

Frontend-only removal — no backend, data, or behavior change. CM-55's 4-card "About This Page / Column Explanations / Statuses / Important Notes" bottom section was judged unnecessary/space-consuming after review and removed entirely from `/contracts`, along with its now-orphaned component file.

### Changes

- `contracts/page.tsx` — removed the `<ContractListInfoCards />` render call and its import. Nothing else in the page changed (header, KPI cards, filter bar, table, pagination all untouched) — `space-y-6` on the page's outer container simply ends at whatever the last real element is now (pagination when present, otherwise the table/empty-state), so no leftover gap.
- Deleted: `contracts/_components/contract-list-info-cards.tsx` — confirmed orphaned (grepped for every importer) before deletion.
- `context/ui-registry.md` — `ContractListInfoCards` entry marked deleted with a pointer back to CM-55 if the content is ever wanted again.

### Verification Results (2026-08-31)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 235/235 tests (unchanged — no logic touched) |
| `pnpm --filter @recafco/api test --run` | ✓ 1179/1179 tests (unchanged — zero backend files touched) |
| `pnpm build` | ✓ 8/8 tasks |
| Live check (idempotent `uat:seed`/`uat:cleanup`) | ✓ "About This Page"/"Column Explanations"/"Important Notes"/Statuses-heading all absent from rendered HTML; KPI cards, filter labels, Full View/Simple toggle, Contract No. column, and the schedule-status `<select>` all still render exactly as CM-55 left them; Staff dashboard/My Tasks and manager dashboard/workflow unaffected (200, no error boundaries) |

## CM-55 — Contract List Approved Design Rebuild (Completed 2026-08-31)

### Summary

Rebuilt the Contract List page (`/contracts`) to match the approved design screenshot: 4 KPI cards, a new filter row, a navy-header full table, a Simple/Full View toggle (now defaulting to Full View), and 4 bottom explanation cards — all with real data, plus the requested removals (Avg. Physical Progress KPI, Risk Rating filter/column/guide, the word "Physical"). Audited first and found no existing manager-facing schedule/progress status field, so added one additively: a new nullable `Contract.scheduleStatus` enum column (`ContractScheduleStatus`: IN_PROGRESS/ON_TRACK/DELAYED/COMPLETED/AHEAD_OF_SCHEDULE), completely separate from `Contract.status` (the real lifecycle: DRAFT/ACTIVE/TERMINATED/CLOSED) — never written by activate/terminate/close, never read by closeout eligibility, and updated through its own dedicated endpoint with no version/optimistic-concurrency coupling to the real lifecycle transitions.

The table's previously-placeholder "Physical Progress %"/"Payment Progress %"/"Risk Rating"/Contract No. columns (all rendered `"Not tracked yet"` before this unit — confirmed via audit, not fake data) are now real: Progress % from workflow-task completion ratio (same methodology as CM-54's dashboard), Payment Progress % from total-paid/current-value, Open Claims from a real filtered relation count, Contract No. from the real `jobOrder` field (falls back to the reference number when unset). Risk Rating is removed entirely, not backfilled.

### Migration

- `20260831000000_add_contract_schedule_status` — additive only: `CREATE TYPE contract_schedule_status` + one nullable `contracts.schedule_status` column. Applied via the established shadow-DB workaround (`prisma db execute --file` then `prisma migrate resolve --applied`) — see prior units (CM-08/09/10, CM-13) for the same pattern. `pnpm db:migrate:status` confirms "Database schema is up to date!" (28 migrations).

### Changes

- **Schema:** `packages/database/prisma/schema.prisma` (+migration above), `packages/database/src/index.ts` (exports `ContractScheduleStatus`).
- **Backend (`apps/api/src/contracts/`):**
  - `contracts.service.ts` — `CONTRACT_SELECT` gained `scheduleStatus`; new pure `computeEffectiveScheduleStatus()`, `computeContractProgressPercent()`, `computeContractPaymentProgressPercent()`; new `CONTRACT_LIST_SELECT`/`toListItem()` (findAll only — findOne/update/etc. untouched) computing `progressPercent`/`paymentProgressPercent`/`openClaimsCount`/`effectiveScheduleStatus` per row from real `workflowTasks`/`payments`/a filtered `_count.claims`; `buildListWhere()` extended (search now also matches `jobOrder`/`counterpartyName`; new `contractType` — a real `scopeOfWork` JSONB path filter, not an invented column; new `scheduleStatus` filter with the same null-fallback-default logic as the display; new `daysRemaining` filter, forecast-date-first with end-date fallback) — restructured onto an `AND` array so `search` no longer silently clobbers `lifecycleStatus=EXPIRING`'s own `OR` clause (a latent pre-existing bug, fixed as a side effect); new `updateScheduleStatus()` service method; `getSummary()` gained real `totalContractValue`/`totalOpenClaims` aggregates.
  - `contracts.controller.ts` — new `PATCH :id/schedule-status` (`@Permissions('contracts.update')`).
  - New: `dto/update-contract-schedule-status.dto.ts`; `dto/contract-list-query.dto.ts` extended (`contractType`/`scheduleStatus`/`daysRemaining`, all `@IsIn`-validated).
  - `contracts.service.test.ts` — 29 new tests (161 total, up from 132).
- **Frontend:**
  - `lib/contracts-api.ts` — `Contract` gained `scheduleStatus`/`effectiveScheduleStatus`/`progressPercent`/`paymentProgressPercent`/`openClaimsCount` (list-only, undefined from `get()`); `ContractSummary` gained `totalContractValue`/`totalOpenClaims`; `ContractListQuery`/`buildQuery` extended.
  - `contracts/actions.ts` — new `updateContractScheduleStatusAction`.
  - `contracts/_lib/contract-ui-helpers.ts` (+15 tests) — `SCHEDULE_STATUS_OPTIONS`, `SCHEDULE_STATUS_BADGE_CLASSES`, `scheduleStatusLabel()`, `DAYS_REMAINING_FILTER_OPTIONS`, `formatDaysRemainingDisplay()` (forecast-date-first, same fallback order as the backend filter).
  - New: `contract-schedule-status-select.tsx` (read-only badge for non-`contracts.update` actors, real `<select>` + PATCH for the rest), `contract-list-info-cards.tsx`.
  - Rewritten: `contract-summary-cards.tsx` (4 cards, reuses CM-54's `DashboardKpiCard` for one consistent executive-dashboard visual language across List and Dashboard), `contract-filter-bar.tsx` (Search/Contract Status/Contract Type/Contract Manager/Days Remaining/Reset — Department dropdown dropped, not in the approved design's filter list), `contract-list-table.tsx` (navy header, Full View default, Risk Rating column removed, real Progress %/Payment Progress %/Open Claims/Contract No.), `page.tsx` (header button order: New Contract Register/Export Excel/Open Dashboard; `lifecycleStatus` kept as a silent pass-through param — no UI field — since the Contract Manager Dashboard and root dashboard both deep-link `/contracts?lifecycleStatus=ACTIVE`).

### Verification Results (2026-08-31)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 235/235 tests (227 + 8 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1179/1179 tests (1150 + 29 new) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 28 migrations, up to date |
| Live end-to-end check (idempotent `uat:seed`/`uat:cleanup`, real dev DB) | ✓ all 4 KPI cards + navy table + filters render with real data; live `PATCH .../schedule-status` confirmed to persist across a fresh GET **without changing `status`/`version`**; live `contractType=erection`/`exFactory` confirmed the Prisma JSONB path filter genuinely matches/excludes correctly against real scope data; `scheduleStatus=DELAYED` filter confirmed exact-match only; a real (non-UAT) contract's `scheduleStatus` was reverted to NULL via direct SQL after the PATCH test, since it isn't UAT-sandboxed data; Contract Staff (`test.operator`) sees read-only badges (0 `<select>` elements) and is correctly scoped to fewer rows than the ALL_DEPARTMENTS manager; Staff dashboard/My Tasks and manager dashboard/workflow/payments/claims/issues all unaffected (200, no error boundaries) |

### Key Implementation Notes

- **Schedule/progress status decision:** audited first per the task's own instruction — no existing field could safely represent this (lifecycle `status` has fixed DRAFT/ACTIVE/TERMINATED/CLOSED values with real transition rules and closeout gating). Added the smallest safe additive column instead of overloading an existing one.
- **`toListItem()` intentionally scoped to `findAll` only** — `findOne`/`update`/`activate`/etc. still use the original `CONTRACT_SELECT` with no `workflowTasks`/`payments`/`_count` relations, so the contract detail page and every mutation payload are provably unaffected by this unit's list-only additions.
- **Fixed a latent pre-existing bug as a side effect:** `buildListWhere()` previously let `search` silently overwrite `lifecycleStatus=EXPIRING`'s own `where.OR` (both wrote to the same top-level key) — restructuring onto an `AND` array fixes this for free while adding the 3 new OR-needing filters (contractType is a plain equals, not affected).
- **"Click column headers to sort data"** — one of the approved screenshot's 4 "Important Notes" — was deliberately omitted rather than kept verbatim, since no sort implementation exists; keeping it would have been a false capability claim. Documented as a deferred item, not silently dropped.

### Unsupported/Deferred (reported honestly, not faked)

- Column-header click-to-sort (see note above) — would need dynamic `orderBy` support in `findAll()`, out of scope for this unit.
- Export Excel — unchanged from the pre-existing disabled/honest state (`title="Export to Excel is planned for a future unit"`).
- Contract Type is derived from the real `scopeOfWork` JSONB flags (Shop Drawing/Production/Delivery/Erection/Ex-Factory/Other) since no dedicated "contract type" column exists — a contract with multiple scope flags shows all of them (e.g. "Production, Delivery, Erection"), not a single canonical "type" like the approved screenshot's "PC"/"HC"/"GRC" codes (no such classification exists anywhere in this schema).
- Direct-URL access to `/contracts` by a Contract Staff actor (`contracts.read` only) is unchanged pre-existing behavior — the sidebar simply never links to it for Staff (CM-41), and this unit did not add or remove any server-side gate beyond what already existed.

## CM-54D — Manager Dashboard Final Visual Tightening (Completed 2026-08-31)

### Summary

Final small visual-tightening pass on the CM-54/CM-54B/CM-54C Contract Manager Dashboard — no backend, calculation, data-shape, or wording change. CM-54C had loosened padding/gaps/icon size for a "premium" feel; this unit pulled those values back down a notch across every dashboard component (KPI card padding/icon circle, grid gaps, chart header spacing, bottom-row spacing) so the dashboard reads as compact and tight rather than tall, while keeping every value, label, and href exactly as CM-54B/CM-54C left them. The KPI card's secondary line lost its `border-t` divider in favor of a plain lighter-muted footnote line, per the "lighter and cleaner" request.

### Changes

- `dashboard-kpi-card.tsx` — icon circle `size-10`→`size-9` (icon `size-5`→`size-4.5`), card padding `p-4.5 gap-2.5`→`p-4 gap-2`, label margin `mt-1.5`→`mt-1`, secondary line: dropped `border-t border-border/70 pt-2` in favor of a borderless `text-text-muted/90 pt-1.5` footnote.
- `manager-kpi-grid.tsx` — grid gap `gap-4`→`gap-3`.
- `discipline-progress-panel.tsx` — header `mb-5`→`mb-4`, rows `space-y-4`→`space-y-3.5`.
- `financial-performance-chart.tsx` — header `mb-5`→`mb-4`, bar area `h-44 gap-3`→`h-40 gap-2.5`, bar width `max-w-16`→`max-w-18` (fewer, slightly wider bars read less sparse at the tighter card height).
- `donut-chart.tsx` — header `mb-5`→`mb-4`, donut/legend row gap `gap-6`→`gap-5`, empty-state vertical padding `py-8`→`py-7`.
- `management-attention-required-panel.tsx` — header `mb-4`→`mb-3`, row padding `py-3`→`py-2.5`, icon circle `size-9`→`size-8` (icon `size-4.5`→`size-4`).
- `top-contracts-table.tsx` — header `mb-4`→`mb-3`, header-row padding `py-2`→`py-1.5`, body-row padding `py-2.5`→`py-2`.
- `page.tsx` — section spacing `space-y-6`→`space-y-5`, middle/bottom grid gaps `gap-6`→`gap-5`.
- `context/ui-registry.md` — `DashboardKpiCard` entry updated with the new compact sizing.

### Verification Results (2026-08-31)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 227/227 tests (unchanged — pure className tightening, no logic touched) |
| `pnpm --filter @recafco/api test --run` | ✓ 1150/1150 tests (unchanged — zero files under `apps/api` touched) |
| `pnpm build` | ✓ 8/8 tasks |
| Live end-to-end check (idempotent `uat:seed`/`uat:cleanup`, `test.manager`/`test.operator`) | ✓ identical real values to CM-54C's own live check (`KWD 9.00K` contract value, 4 overdue tasks, 1 critical contract, 1 closing soon); all 11 KPI cards confirmed rendering the new tightened `p-4 gap-2` class exactly once each; `gap-3` grid, "No claims in scope." empty state, and every CM-54B label all intact; zero forbidden wording; Contract Staff dashboard and `/contracts`, `/contracts/workflow`, `/contracts/payments` unaffected (200, no error boundaries) |

### Key Implementation Notes

- Deliberately did not touch `dashboard-insights-helpers.ts`, `contract-dashboard.service.ts`, or any chart math — every change here is `className`-only, verified by the unchanged 227/1150 test counts.
- Observed (not investigated further, out of scope): both dev servers were found already running at the start of this unit's live-verification step, under process start timestamps that predate this unit's own edits. Since this unit made zero backend changes, the API dev server's lack of hot-reload (documented since CM-24) didn't matter for verification here; the Next.js web dev server hot-reloads on file change regardless. Both were stopped again after verification, as in CM-54/CM-54B/CM-54C.

## CM-54C — Manager Dashboard UI Polish and Icon Upgrade (Completed 2026-08-31)

### Summary

Visual-only polish pass on the CM-54/CM-54B Contract Manager Dashboard — no backend, calculation, wording (beyond what CM-54B already set), or data-source change. Audited icon dependencies first: `lucide-react` (`^1.22.0`) is the sole icon library already installed and used in 74+ files repo-wide, so no new dependency was added or needed. Every KPI card now has a fully distinct icon (previously "Critical Project Contracts" and "Overdue Workflow Tasks" used icons that, while already different from each other, weren't the clearest semantic fit — `AlertTriangle`/`ClockAlert` now map onto them per the task's suggested pairing, freeing `FileWarning` from double duty). One new CSS token (`--color-teal`/`--color-teal-light`) was added, following the exact precedent CM-40B set for `--color-team-production` (documented justification comment, no raw hardcoded hex), so "Submitted Invoices" reads as a distinct payment-flow color rather than reusing the general "info" blue already used for contract-level cards.

### Changes

- `globals.css` / `context/ui-tokens.md` — added `--color-teal`/`--color-teal-light`.
- `dashboard-kpi-card.tsx` — larger icon circle (`size-9`→`size-10`, icon `size-4.5`→`size-5`), bolder value (`text-xl font-semibold`→`text-2xl font-bold`), `rounded-lg`→`rounded-xl`, refined spacing, subtle `hover:-translate-y-0.5` + `group-hover:shadow-md` lift **only** on clickable cards (non-clickable cards get zero hover styling — no fake interactivity); new `teal` accent option.
- `manager-kpi-grid.tsx` — icon swap: Submitted Invoices `Send`→`FileUp` (+ `teal` accent), Outstanding Payment `Receipt`→`CircleDollarSign`, Critical Project Contracts `FileWarning`→`AlertTriangle`, Overdue Workflow Tasks `AlertTriangle`→`ClockAlert`; grid gap `gap-3`→`gap-4`. Every other card's icon/accent/label/href/value binding unchanged.
- `discipline-progress-panel.tsx` — thicker bars (`h-2`→`h-2.5`), roomier header/rows.
- `financial-performance-chart.tsx` — baseline rule under bars, wider/rounder bars (`max-w-14`→`max-w-16`, `rounded-t-md`→`rounded-t-lg`), tabular-numeral value labels, labels moved below the baseline for a cleaner axis look.
- `donut-chart.tsx` — roomier legend rows, bold tabular-numeral center total, and a proper icon+message empty state (`PieChart` icon, was plain muted text) — most visible on "Claims Status Overview" when a scope has no claims.
- `management-attention-required-panel.tsx` / `top-contracts-table.tsx` — roomier rows, stronger count badge, shaded table header row for contrast, row hover states.
- `page.tsx` — section/grid spacing `gap-5`/`space-y-5`→`gap-6`/`space-y-6`.
- `context/ui-registry.md` — updated entries for the touched components.

### Verification Results (2026-08-31)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 227/227 tests (unchanged — pure className/markup, no logic touched) |
| `pnpm --filter @recafco/api test --run` | ✓ 1150/1150 tests (unchanged — zero files under `apps/api` touched) |
| `pnpm build` | ✓ 8/8 tasks |
| Live end-to-end check (idempotent `uat:seed`/`uat:cleanup`, `test.manager`/`test.operator`) | ✓ identical real values to CM-54B's own live check (`KWD 9.00K` contract value, 4 overdue tasks, 1 critical contract, 1 closing soon); all CM-54B wording intact; zero "Physical"/"Expiring Documents"/"Total Submitted"/"Total Paid"/"Certified"/"Payment Claims" anywhere; new icon classes (`lucide-file-up`, `lucide-clock-alert`, `lucide-triangle-alert`, `lucide-circle-dollar-sign`) and `bg-teal-light text-teal` all render; Contract Staff dashboard and `/contracts`, `/contracts/workflow`, `/contracts/payments` unaffected (200, no error boundaries) |

### Key Implementation Notes

- Confirmed via `grep -o 'lucide-[a-z-]*'` on rendered SSR HTML that lucide-react sometimes emits a different kebab-case class than the exported name suggests (e.g. `AlertTriangle` renders as `lucide-triangle-alert`, not `lucide-alert-triangle` — the export name is a backward-compatible alias for a renamed icon slug). Not a bug, just worth knowing when grepping rendered output for icon verification.
- Deliberately did not touch `dashboard-insights-helpers.ts`, `contract-dashboard.service.ts`, or any chart *math* — every polish here is `className`/JSX-structure only, verified by the unchanged 227/1150 test counts.
- Reused the exact `uat:seed`/`uat:cleanup` verification flow CM-54/CM-54B established; dev servers were stopped again afterward.

## CM-54B — Manager Dashboard Payment KPI Label Cleanup (Completed 2026-08-31)

### Summary

Pure wording cleanup on the CM-54 Contract Manager Dashboard — no backend, calculation, or data-source change. "Total Submitted"/"Total Paid" (unclear) and the rejected "Submitted Payment Claims" suggestion (collides with the separate Claim Log module's "claims" terminology) are replaced with plain payment-flow wording: **Submitted Invoices** / **Received Payments** / **Outstanding Payment**, each backed by the exact same `insights.financials` fields CM-54 already computed (`submittedTotal`/`paidTotal`/`outstandingTotal`). "Open Claims" is untouched — it correctly refers to the Claim Log/contract-claims module, not payments, and the word "Claims" is now confirmed to appear only on that one card.

### Changes

- `dashboard/_components/manager-kpi-grid.tsx` — "Total Submitted" → "Submitted Invoices" (subtext "Submitted to client"); "Total Paid" → "Received Payments" (subtext "Paid by client"); "Outstanding Payment" subtext → "Submitted but not received". Same `financials?.submittedTotal`/`paidTotal`/`outstandingTotal` bindings, unchanged.
- `dashboard/_components/financial-performance-chart.tsx` — bar labels "Current Contract"/"Submitted"/"Paid" → "Contract Value"/"Submitted Invoices"/"Received Payments" ("Outstanding" unchanged, still no Certified bar). Same `contractValueTotal`/`submittedTotal`/`paidTotal`/`outstandingTotal` values.
- `dashboard/_components/management-attention-required-panel.tsx` — "Overdue Payments" row → "Overdue Payment Follow-ups", description → "Payments pending follow-up or release" (static caption, matching the KPI cards' pattern; the real count still renders in the badge). Same `insights.financials.overduePayments` count/href.
- `context/ui-registry.md` — `FinancialPerformanceChart`/`ManagementAttentionRequiredPanel` entries updated to the new label wording.

### Verification Results (2026-08-31)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 227/227 tests (unchanged — pure label text, no logic touched) |
| `pnpm --filter @recafco/api test --run` | ✓ 1150/1150 tests (unchanged — no backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| Repo-wide grep for old strings ("Total Submitted", "Total Paid", "Overdue Payments", "Payment Claims") in `dashboard/` | ✓ zero matches outside the changelog comment explaining the rename |

### Key Implementation Notes

- Deliberately did not touch `ContractDashboardService`/`ManagerDashboardFinancials` (CM-54) — every renamed label reads the identical already-computed field; this was purely a label/subtext substitution in 3 already-existing components.
- "Claims with Action Due" (the Claim Log follow-up row) and "Open Claims" (KPI card) were left as-is — both correctly describe the contract-claims module, not payments, so keeping "Claims" there does not conflict with the "avoid Claims in payment cards" rule.

## CM-54 — Contract Manager Dashboard Approved Design Rebuild (Completed 2026-08-31)

### Summary

Rebuilt the Contract Manager Dashboard (`/contracts/dashboard`, MANAGER dashboardType only — Contract Staff's dashboard, built by CM-48, is a completely separate return path in `page.tsx` and was not touched) to match a user-approved design screenshot: an 11-card KPI grid, a middle row of Progress by Discipline / Financial Performance / Contracts by Status, and a bottom row of Management Attention Required / Top 5 Delayed Contracts / Top 5 Contracts by Value / Claims Status Overview. Every number shown is real, department-scope-respecting data — no invented counts, statuses, or financial figures. This unit superseded CM-39's manager dashboard UI entirely (its 5 orphaned components/libs — `TodaysFocusPanel`, `ManagerSummaryCards`, `ManagerAttentionTable`, `ManagerSecondaryTabs`, `WorkflowOverviewPanel`, `contract-dashboard-attention.ts`, `contract-dashboard-focus.ts` — were deleted, following the same "delete once truly orphaned" precedent CM-39 itself set for `manager-quick-actions.tsx`).

Small backend addition: `ContractDashboardService` (CM-37) gained a new `manager.insights` block (financial totals, top-5 lists, claims-by-status, critical-contract/closing-soon counts) computed entirely from data already fetched for the existing `manager` payload, reusing `computePaymentSummary`/`computeClaimSummary` (CM-28/CM-31) rather than re-deriving payment/claim math. Three new `Contract` fields (`jobOrder`, `contractValue`, `originalContractValue`) were added to the dashboard's Prisma `select` — same `contracts.read` authorization boundary as every other field already selected there, not new data exposure.

### Wording changes (per approved-design change request)
- "Physical" removed everywhere ("Overall Progress", "Progress by Discipline").
- "Outstanding Amount" → "Outstanding Payment"; "High/Critical Risks" → "Critical Project Contracts" (word "Risk" never used).
- "Expiring Documents" KPI and attention row removed (no document-expiry tracking exists in this schema).
- Financial Performance's "Certified" bar removed (Current Contract / Submitted / Paid / Outstanding only).
- Top 5 tables: "Contract ID"/"Contract Name" → "Job Order"/"Project Name" (`jobOrder ?? referenceNumber` when a contract has no job order recorded).
- Claims Status Overview excludes `PARTIALLY_APPROVED` only — every other real `ContractClaimStatus` value present in the data (including `CANCELLED`, if any exist) is still shown, so no real data is hidden beyond that one named exclusion.
- Open Claims KPI card is 7th in card order so it lands on the grid's second row (`xl:grid-cols-6`) as requested.

### Changes

- **Backend:** `apps/api/src/contracts/contract-dashboard.service.ts` — `jobOrder`/`contractValue`/`originalContractValue` added to `CONTRACT_DASHBOARD_SELECT`/`DashboardContractRow`; new `computeManagerFinancials`, `buildTopDelayedContracts`, `buildTopValueContracts`, `countClaimsByStatus`, `computeManagerInsights` pure functions + `ManagerDashboardInsights` on `ManagerDashboardData`; `contract-dashboard.service.test.ts` — 50 new/updated tests.
- **Frontend types:** `apps/web/src/lib/contracts-api.ts` — mirrors the new insights types.
- **New:** `dashboard/_lib/dashboard-insights-helpers.ts` (+ `.test.ts`, 15 tests) — `formatKwdCompact`, discipline-progress %, mutually-exclusive Contracts-by-Status segments (see Key Implementation Notes), Claims-by-Status label mapping.
- **New components:** `dashboard-kpi-card.tsx`, `manager-kpi-grid.tsx`, `discipline-progress-panel.tsx`, `financial-performance-chart.tsx`, `donut-chart.tsx`, `management-attention-required-panel.tsx`, `top-contracts-table.tsx` (see `ui-registry.md` for full details).
- **Modified:** `dashboard/page.tsx` (MANAGER branch rewritten; STAFF and legacy-fallback branches untouched byte-for-byte), `dashboard-toolbar.tsx` (added honest "Filters"/"Export" controls — Filters links to the real Contract List filters, Export is disabled with the same "planned for a future unit" tooltip pattern already used on `contracts/page.tsx`; "As of Today" is now a literal label, not a fake historical-snapshot picker).
- **Deleted:** `todays-focus-panel.tsx`, `manager-summary-cards.tsx`, `manager-attention-table.tsx`, `manager-secondary-tabs.tsx`, `workflow-overview-panel.tsx`, `_lib/contract-dashboard-attention.ts(.test.ts)`, `_lib/contract-dashboard-focus.ts(.test.ts)` — confirmed orphaned (grepped for every import site) before deletion.

### Verification Results (2026-08-31)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 227/227 tests (19 files) |
| `pnpm --filter @recafco/api test --run` | ✓ 1150/1150 tests (36 files) |
| `pnpm build` | ✓ 8/8 tasks |
| Live end-to-end check (idempotent `uat:seed`/`uat:cleanup`, `test.manager`/`test.operator`, real dev DB) | ✓ manager dashboard renders all 11 KPI cards + 3 middle + 4 bottom sections with real live-computed numbers (e.g. `KWD 9.00K` contract value, `Original: KWD 100.00K`, real "test project" row in both Top 5 tables via its real `jobOrder` "2026"); zero occurrences of "Physical"/"Expiring Documents"/"Partially Approved" anywhere in the rendered HTML; Contract Staff dashboard, `/contracts`, `/contracts/workflow`, `/contracts/payments` all unaffected (200, no error boundaries) |

### Key Implementation Notes

- **Double-count bug avoided:** the base dashboard's `metrics` block (`totalDraft/totalActive/totalExpiring/totalExpired/totalTerminated/totalClosed`, from CM-37/`ContractsService.getDashboard`) is NOT six mutually-exclusive categories — `totalExpiring`/`totalExpired` are subsets of `totalActive` (same `ContractStatus.ACTIVE` rows, refined by `renewalNoticeDate`/`endDate`, see `contracts.service.ts`). The older, unused `ContractKpiGrid` fallback component sums all 6 and double-counts; `totalContractsFromMetrics`/`buildContractsByStatusSegments` in `dashboard-insights-helpers.ts` subtract expiring/expired back out of active instead, so the KPI total and the Contracts-by-Status donut both sum correctly to the real total. Not fixed in the untouched fallback component (out of scope — that branch is dead code for real actors).
- **Latent `text-danger`/`bg-danger-light` token bug found (pre-existing, not fixed):** `--color-danger` is not defined anywhere in `globals.css` or any other stylesheet in this repo, yet `text-danger`/`bg-danger-light` are used in ~100 files (e.g. `manager-attention-table.tsx`, since deleted by this unit). These classes silently produce no color (Tailwind can't generate a utility for an undefined token). New CM-54 components use the real `error`/`error-light` token instead. Worth a dedicated cleanup unit — out of scope here (would touch ~100 unrelated files).
- **API dev server requires a manual restart to pick up service-layer changes** (no hot reload under `ts-node/register` — same caveat CM-24 already documented) — this unit's live verification initially read stale data because a pre-existing `node` process from earlier in the session was still bound to port 4000 running the pre-CM-54 code; restarting it (after confirming via `Get-NetTCPConnection`/`Get-Process` that it started well before this unit's edits) fixed it.
- **Deferred/unsupported metrics, reported honestly rather than faked:**
  - "At Risk"/"Delayed" sub-counts on the Active Contracts card, and "On Hold" on the Total Contracts card — `ContractStatus` has only `DRAFT/ACTIVE/TERMINATED/CLOSED`, no such states exist. Omitted rather than mislabeling `EXPIRING`/`EXPIRED` (a different, real concept) as "At Risk"/"Delayed".
  - No month-over-month delta (e.g. screenshot's "+3% vs last month") anywhere — this system has no historical dashboard snapshot to compute one honestly against.
  - "Critical Project Contracts" is a distinct-contract count of every HIGH-priority manager attention item (overdue task, high/critical issue, overdue payment, pending closeout review) — the closest honest analog to the approved design's "High/Critical Risks" without using the word "Risk" or inventing a new risk-scoring model.

## CM-53 — Manager Workflow Task Review Drawer Upgrade (Completed 2026-08-26)

### Summary

Frontend-only upgrade to the manager task card (`WorkflowTaskCard`) and task drawer (`WorkflowTaskDrawer`) — both used from `WorkflowBoard` on the "Contract Workflows" modal board (CM-52) and the per-contract Workflow tab. No backend change; every value shown is real data already returned by `ContractWorkflowTask`/`ContractWorkflowTaskComment`/`ContractWorkflowTaskAttachment` (contracts-api.ts) — the drawer was reorganized and had display-only additions layered in, not rewired.

**Task card**: gained a subtle single-color left-border accent (`cardAccentCls`) for at-a-glance state — overdue (danger) > rejected/on hold (warning) > completed/approved (success) > submitted/under review (info) > unassigned (muted) > default, in that priority order when more than one applies; "Due …" now reads "No due date" when `dueDate` is null instead of an em dash; and a new "Submitted: …" / "Completed: …" line appears using `completedDate` for COMPLETED tasks or `lastActivityAt` for SUBMITTED/UNDER_REVIEW tasks (no invented `submittedAt` — this project's schema has no such column, confirmed during the audit).

**Task drawer**: restructured into the spec's 7 labeled sections (Task Summary, Assignment & Dates, Staff Submission, Uploaded Documents, Progress Comments, Manager Update, Recent Activity) without changing any of the existing form/action wiring — the same `updateWorkflowTaskAction`/`addWorkflowTaskCommentAction`/`uploadWorkflowTaskAttachmentAction` bindings, the same field names, the same `canManage`/`canEdit` gating, just regrouped visually with read-only review blocks (Sections 1–3) added ahead of the pre-existing editable form (now "Manager Update", Section 6). A new `FORM_DATA_FIELD_LABELS` map (mirroring the backend's `WORKFLOW_TASK_FORM_DATA_TEXT_KEYS`/`BOOLEAN_KEYS` one-for-one) renders a saved task's `formData` as a labeled key/value grid instead of raw JSON — one flat map covers all four Technical-step task-specific forms (Drawing Received/SD/Getting Approval/FD Issuance) with no taskKey branching, since a task's `formData` only ever contains the keys its own frontend form saved. "Recent Activity" (Section 7) merges three already-fetched real sources — task created/last-updated, comments, attachments — into one time-sorted feed, explicitly labeled as not a full audit trail (this schema has no task-history table).

Contract identity ("Task Summary" → Contract) is optional and only shown when the caller already has it: `WorkflowBoard` gained optional `contractReference`/`contractTitle` props, wired from `WorkflowBoardModal` (CM-52, has `detail.contract`) and the per-contract Workflow tab (`contracts/[id]/(workspace)/workflow/page.tsx`, has `workflow.contract`) — never fabricated where absent.

### Changes

- **Modified:** `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-task-card.tsx` — `cardAccentCls()`, `submissionLine()`, "No due date" text.
- **Modified:** `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-task-drawer.tsx` — full section restructure, `FORM_DATA_FIELD_LABELS`, `recentActivity` (`useMemo`), attachment row gained an uploaded-date/time column, header gained status/priority badges, optional `contractReference`/`contractTitle` props.
- **Modified:** `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-board.tsx` — optional `contractReference`/`contractTitle` props, passed through to `WorkflowTaskDrawer`.
- **Modified:** `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-board-modal.tsx` — passes `contract.referenceNumber`/`contract.title` to `WorkflowBoard`.
- **Modified:** `apps/web/src/app/(protected)/contracts/[id]/(workspace)/workflow/page.tsx` — destructures `contract` from the existing `workflow` response, passes it to `WorkflowBoard` the same way.

### Verification Results

| Command | Result |
|---|---|
| `pnpm lint` | Pass, 0 errors |
| `pnpm typecheck` | Pass, 0 errors (12/12 turbo tasks) |
| `pnpm --filter @recafco/web test --run` | 224/224 passed (unchanged — no existing test covers these two components, confirmed via grep before editing) |
| `pnpm --filter @recafco/api test --run` | 1136/1136 passed (unchanged — no backend touched) |
| `pnpm build` | 8/8 tasks successful |

### Key Implementation Notes

- No distinct `submittedAt` column exists anywhere in the schema for `ContractWorkflowTask` — confirmed by reading `ContractWorkflowTask` in `contracts-api.ts` during the audit (only `createdAt`/`updatedAt`/`lastActivityAt`/`startDate`/`dueDate`/`completedDate`). Both the card and the drawer's "Staff Submission" section use the spec's own documented fallback (`completedDate` for COMPLETED, else `lastActivityAt`) and label it accordingly ("Last submitted/updated") rather than implying a stored instant that doesn't exist — reported here as intentionally deferred, exactly as the spec asked.
- "Manager remarks" (Section 6) is the same single `remarks` column the existing form already edited — there is no second backend field for a manager-only remark. Rather than requesting a migration for this ("prefer frontend-first using existing data" + "do not edit migrations unless absolutely required"), the drawer shows the current `remarks` value read-only in "Staff Submission" (Section 3) and keeps it editable in "Manager Update" (Section 6) — same field, reviewed then optionally overwritten, not two independent values.
- Assignment Queue (`AssignmentQueueTaskCard`/`AssignmentQueueBoard`/`AssignTaskModal`) is a completely separate component tree from `WorkflowTaskCard`/`WorkflowTaskDrawer` — confirmed during the audit — so it was correctly left untouched rather than force-fitting a "shared card" change that doesn't actually apply here.

## CM-52C — Assign Work Contract Board Modal (Completed 2026-08-26)

### Summary

Extended CM-52's "board opens in a focused modal instead of expanding inline" pattern to the Assign Work (Assignment Queue) tab. Previously, clicking "Assign Tasks" on a contract card replaced the entire landing page (summary cards, contract picker, advanced filters, contract cards, needing-setup section, advanced all-contracts section) with the selected contract's board — a full-page swap, not an overlay. Now the landing content always renders, and a new `AssignmentQueueBoardModal` (mirroring `WorkflowBoardModal` from CM-52) opens as a large focused overlay on top of it whenever `?mode=assignment&contractId=<id>` is present, closing back to `?mode=assignment` (contract cards, filters etc. were never hidden, so "closing" is just removing the modal — no re-render of hidden content).

Frontend-only. `assignment-queue-view.tsx` already computed the selected contract's board data only when `contractId` was present (existing CM-40C behavior, untouched) — the fix restructures the same computation into modal-header/modal-body pieces instead of a single inline JSX block, and stops gating the landing sections on "no contract selected". The existing `AssignmentQueueViewSwitcher` (Board/Table toggle), `AssignmentQueueBoard`, `AssignmentQueueTaskCard`, and `AssignTaskModal` are all reused completely unchanged as the modal's body — assigning a task still calls the same `updateWorkflowTaskAction` path, `router.refresh()` still re-fetches the parent server data, an assigned task still drops out of the board and the unassigned count still updates, exactly as before CM-52C.

The now-unused `assignment-queue-selected-contract-header.tsx` (the old inline panel's header, only ever imported by `assignment-queue-view.tsx`, confirmed via grep before deleting) was deleted rather than left as dead code — its "Contract ID/name/client + unassigned badge + Back to Contracts" content is now the modal's own header instead.

The one case where the modal is deliberately NOT used: when the selected `contractId` fails to resolve at all (`getWorkflow()` throws — out of department scope or invalid id), there is no real contract identity available to put in the modal's header, and fabricating one would violate "do not use fake data" — so that case stays a plain inline error banner above the landing content, same as before this unit.

### Changes

- **New:** `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-board-modal.tsx` — client component, structurally identical to CM-52's `WorkflowBoardModal` (large centered modal, Escape-to-close, header with title/contract identity/unassigned-count badge/"Open Contract Detail"/Close, independently-scrolling body).
- **Modified:** `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-view.tsx` — replaced the single `selectedContractPanel` computation/render with separate `modalHeader`/`modalBody`/`scopeError` values; landing sections (`AssignmentQueueContractList`, `ContractsNeedingSetupSection`, `AssignmentQueueAdvancedSection`) now render unconditionally; the "all tasks assigned" empty state gained an explicit `[Close] [Back to Contracts]` button pair per the spec (both currently navigate to the same `contractListHref` — there is only one "back" destination, so no functional difference between them, only the two labels the spec asked for).
- **Deleted:** `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-selected-contract-header.tsx` — superseded by the modal's own header, confirmed unused elsewhere before deleting.

### Verification Results

| Command | Result |
|---|---|
| `pnpm lint` | Pass, 0 errors |
| `pnpm typecheck` | Pass, 0 errors (12/12 turbo tasks) |
| `pnpm --filter @recafco/web test --run` | 224/224 passed (unchanged) |
| `pnpm --filter @recafco/api test --run` | 1136/1136 passed (unchanged — no backend touched) |
| `pnpm build` | 8/8 tasks successful |

### Key Implementation Notes

- Direct navigation to `/contracts/workflow?mode=assignment&contractId=<id>` already opened the (then-inline) board before this unit, since `selectedContractId` is read straight from `searchParams` on every request — CM-52C's modal wrapping doesn't change that, so the "open automatically on direct URL" requirement was satisfied with no extra logic, exactly as it was for CM-52's own modal.
- `AssignTaskModal` (opened from inside the board) and the new `AssignmentQueueBoardModal` are both `fixed inset-0 z-50` — same reasoning as CM-52's note on `WorkflowTaskDrawer`: the inner dialog mounts as a later DOM node in the same stacking context, so it continues to paint above the board modal with no z-index conflict.
- Deferred: nothing — URL persistence, automatic modal-open on direct link, and the Board/Table toggle moving inside the modal were all achieved directly from the existing query-param-driven data flow.

## CM-52B — Simplify Manager Workflow Page Tabs and Wording (Completed 2026-08-26)

### Summary

Relabeled the manager-facing `/contracts/workflow` page for plain-language business wording, with zero route/query-param changes — every href (`mode=assignment`, `mode=my-tasks`, `overdueOnly=true`, etc.) is byte-for-byte unchanged, only the visible text differs. Page title: "Workflow & Team Tasks" → "Contract Work Progress" (h1, breadcrumb, and `<title>` metadata). Subtitle: "Monitor contract tasks, assign work to staff, and follow delayed items."

`workflow-mode-tabs.tsx`'s single `label` field was split into `managerLabel`/`staffLabel` per tab entry, selected by the existing `hideAllWorkflows` flag (already the staff/manager audience signal from CM-41/45 — no new prop needed for this part). Manager labels: All Workflows → Contract Workflows, Assignment Queue → Assign Work, Overdue → Delayed Tasks. Staff labels (My Tasks, Overdue) are untouched — `StaffMyTasksView` passes `hideAllWorkflows` unconditionally, so its wording never changes.

"My Tasks" is no longer a main tab for the manager audience (`managerHidden` filter flag, mirroring the existing `staffHidden`/`managerOnly` pattern). Per the task's detection exception, a smaller secondary "My Assigned Work (N)" pill link appears next to the main tabs — but only when the manager actually has tasks assigned to them (`summary.myOpenTasks > 0`, the exact same real count `WorkflowSummaryCards` already displays as "My Open Tasks" — no new backend call, no invented count). It still routes to `mode=my-tasks`, so the URL/content behind it is completely unchanged; only its visual prominence and the surrounding "is this a main tab" framing differ.

The Assignment Queue page's own breadcrumb ("Workflow & Team Tasks" / "Assignment Queue") was updated to "Contract Work Progress" / "Assign Work" for consistency with the renamed parent page it links back to — its own h1 ("Assign Workflow Tasks") and all of its functionality were already unchanged and untouched. The manager-only `WorkflowFilterBar`'s "My Tasks only" checkbox (never rendered for staff, confirmed by grep before editing) was renamed "Assigned to me only" per the spec; "Overdue only" was left as-is since the spec named only the My-Tasks-only label for this rename.

### Changes

- **Modified:** `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-mode-tabs.tsx` — `managerLabel`/`staffLabel` split, `managerHidden` filter flag for the `my-tasks` entry, new optional `myAssignedTaskCount` prop driving the secondary "My Assigned Work" link. Routes/hrefs unchanged.
- **Modified:** `apps/web/src/app/(protected)/contracts/workflow/page.tsx` — h1/subtitle/breadcrumb/`<title>` metadata text; passes `{...(summary ? { myAssignedTaskCount: summary.myOpenTasks } : {})}` to `WorkflowModeTabs` (conditional spread, not a bare `undefined`, per this repo's `exactOptionalPropertyTypes: true` tsconfig).
- **Modified:** `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-filter-bar.tsx` — checkbox label text only.
- **Modified:** `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-view.tsx` — breadcrumb label text only.

### Verification Results

| Command | Result |
|---|---|
| `pnpm lint` | Pass, 0 errors |
| `pnpm typecheck` | Pass, 0 errors (12/12 turbo tasks) — one `exactOptionalPropertyTypes` error caught and fixed during this unit (see below) |
| `pnpm --filter @recafco/web test --run` | 224/224 passed (unchanged) |
| `pnpm --filter @recafco/api test --run` | 1136/1136 passed (unchanged — no backend touched) |
| `pnpm build` | 8/8 tasks successful |

### Key Implementation Notes

- First pass passed `myAssignedTaskCount={summary?.myOpenTasks}` directly, which is `number | undefined` — this repo's web tsconfig has `exactOptionalPropertyTypes: true`, which rejects assigning `undefined` to an optional `number` prop (as opposed to simply omitting the prop). Fixed by conditionally spreading the prop in, matching the existing `{...(myTasksOnly ? { emptyMessage: '...' } : {})}` pattern already used elsewhere in this same file (CM-51/CM-52) rather than widening the prop's type to accept `undefined`.
- The bare `/contracts/workflow` URL for a Contract Staff account without `?mode=my-tasks`/`?mode=overdue` (which would fall through to the manager-style register content with `hideAllWorkflows=true` tabs) was confirmed to be pre-existing behavior from CM-41, not something this unit touches or changes.
- Deferred/not needed: hiding "My Tasks only" for manager entirely — renaming to "Assigned to me only" satisfied the spec's stated alternative ("or renamed... if kept") and keeps the filter functional, which is simpler and lower-risk than conditionally removing a working filter control.

## CM-52 — Manager Workflow Board Modal for Selected Contract (Completed 2026-08-26)

### Summary

The manager-facing "All Workflows" / Overdue register at `/contracts/workflow` no longer expands the selected contract's details and Team Task Board inline below the table — clicking "View Board" now opens a large focused modal (`WorkflowBoardModal`, new file) instead. The table, tabs, summary cards and filters stay exactly where they were; the page itself never grows long regardless of how many tasks a selected contract has, since only the modal body scrolls.

Frontend-only, as instructed. The fix is a pure presentation change: `page.tsx` already fetched `ContractWorkflowDetail` only when `?contractId=<id>` is present (existing behavior, untouched), so opening the modal required no new data fetching — the existing `View Board` links (`workflow-contract-table.tsx`) and any other link that routes with `contractId` (dashboard shortcuts, contract-list shortcuts) open the modal automatically, with zero new wiring, because they all resolve to the same query param the page already reads. `WorkflowContractHeader` and `WorkflowBoard` (task lanes, task cards, `WorkflowTaskDrawer`) are reused completely unchanged inside the modal body — no new task-card or task-detail logic was written.

Closing the modal (✕ button or Escape) navigates to `buildHref({ contractId: undefined })` — the same existing query-builder helper, just with `contractId` cleared — so the URL always reflects what's open/closed; this is a real navigation, not client-only state, satisfying the spec's URL-persistence preference without any extra param-parsing code.

### Changes

- **New:** `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-board-modal.tsx` — client component. Large centered modal (`max-w-[1800px]`, near-full-height), header with title/contract ref/name/client/status/workflow-progress badge + "Open Contract Detail"/Close actions, Escape-to-close, `role="dialog" aria-modal="true"`. Body (independently scrollable, `flex-1 min-h-0 overflow-y-auto`) renders the unchanged `WorkflowContractHeader`, a Total/Completed/In Progress/Overdue/Unassigned summary strip (Unassigned computed client-side from `detail.tasks.filter(t => !t.responsibleUserId).length` — real per-task data, not invented), then the unchanged `WorkflowBoard`.
- **Modified:** `apps/web/src/app/(protected)/contracts/workflow/page.tsx` — replaced the `{contractId && (<div className="space-y-4 pt-2 border-t border-border">...<WorkflowContractHeader/><WorkflowBoard/>...)}` inline block with `{contractId && workflowDetail && <WorkflowBoardModal .../>}`, passing through the exact same props (`people`, `canManage`, `canUpdateAssigned`, `currentUserId`, the `myTasksOnly` empty-message override) plus a new `closeHref={buildHref({ contractId: undefined })}`. No other logic in `page.tsx` (data fetching, filters, tabs, pagination, Assignment Queue dispatch, Staff dispatch) was touched.

### Verification Results

| Command | Result |
|---|---|
| `pnpm lint` | Pass, 0 errors |
| `pnpm typecheck` | Pass, 0 errors (12/12 turbo tasks) |
| `pnpm --filter @recafco/web test --run` | 224/224 passed (unchanged — presentation-only change, no new/modified test-relevant logic) |
| `pnpm --filter @recafco/api test --run` | 1136/1136 passed (unchanged — no backend touched) |
| `pnpm build` | 8/8 tasks successful |

### Key Implementation Notes

- The per-contract Workflow tab at `/contracts/[id]/workflow` (a different page — no table above it, already scoped to one contract) still renders `WorkflowBoard` inline as before. Out of scope for this unit and deliberately untouched.
- Assignment Queue (`mode=assignment`) and the staff-only My Tasks/Overdue views (`StaffMyTasksView`) are separate code paths in `page.tsx` that return before any of this logic runs — neither was touched, and neither was exercised by this change.
- `WorkflowTaskDrawer` (opened from a task card inside `WorkflowBoard`) is itself a `fixed inset-0 z-50` dialog, same z-index as the new modal's own `fixed inset-0 z-50` wrapper. Because it mounts as a later DOM node within the same document stacking context, it continues to paint above the board modal exactly as it already painted above the page before this change — no z-index conflict introduced.
- Deferred: full query-string-driven modal state (e.g. reading `contractId` client-side to animate open/close without a full navigation) — the simpler "modal renders whenever `contractId` + `workflowDetail` are present, closes via real navigation" approach already satisfies the spec's URL-persistence preference and avoids adding client-side duplication of server-fetched state.

## CM-51 — Task-Specific Staff Work Forms: FD Issuance (Completed 2026-08-25)

### Summary

Fourth and final Technical-step task-specific form, completing the set started in CM-49. `staff-task-update-panel.tsx` now detects `technical_fd_issuance` via the same stable `taskKey` mechanism and renders a dedicated "FD Issuance Information" layout — the main-content ternary is now a clean 4-way chain (`isFdIssuance ? ... : isGettingApproval ? ... : isSdCalculation ? ... : ...`), with Drawing Received still the untouched final fallback. Reused CM-46B's `formData` column as instructed — `WORKFLOW_TASK_FORM_DATA_TEXT_KEYS` grew from 36 to 46 (10 new FD keys: fdIssueDate, issuedTo, purposeFor, issueType, approvedReferenceNo, approvedDate, scale, distribution, issueMethod, issuedBy — drawingReferenceNo, revisionNo, numberOfSheetsFiles, designation, contactNo and email all reused as-is from earlier forms). No new boolean keys, no schema or migration change; `pnpm db:migrate:status` confirmed 27 migrations, unchanged, before and after.

FD Issuance needed the exact same right rail as SD and Getting Approval, so it reuses the `compactRightRail` block CM-50 already extracted — no third copy of that markup. Its Attachments card reuses `attachmentsSection()`, titled "Final Drawing Attachments". Six of its fields (issuedTo, purposeFor, issueType, scale, distribution, issueMethod) are `<select>`s with the exact option lists the spec named, stored as plain strings in formData — no new database enum, per the task's own instruction.

The bottom action bar's existing "Submit" button (built for SD in CM-49) now also covers FD Issuance — `canSubmit` widened from `isSdCalculation` to `isSdCalculation || isFdIssuance`, both mapping to the same pre-existing `SUBMITTED` status, no new handler needed. "Mark Complete" is now a 3-way label (`isGettingApproval` → "Approve & Continue", `isFdIssuance` → "Mark Complete & Continue", otherwise → "Mark Complete") reusing the same COMPLETED-mapping handler in all three cases. No Return/Reopen button was added — the spec explicitly said only to add it if a safe existing mapping was obvious, and none of the four already-built actions (Save Draft, Save Update, Submit, Mark Complete & Continue) left an unaddressed "reopen a completed FD task" need worth inventing a mapping for.

### Persistence — Migration Reused, Not Added

- No new migration. `ContractWorkflowTask.formData` (CM-46B) is reused unchanged for a fourth task type; `pnpm db:migrate:status` confirmed 27 migrations, up to date, both before and after this unit.

### Changes

- `apps/api/src/contracts/contract-workflow.service.ts` — `WORKFLOW_TASK_FORM_DATA_TEXT_KEYS` grew from 36 to 46 keys (10 new); no boolean-key change
- `apps/api/src/contracts/contract-workflow.service.test.ts` — new test covering all 10 new FD Issuance keys together, plus reused drawingReferenceNo/revisionNo/numberOfSheetsFiles/designation/contactNo/email
- `apps/web/src/app/(protected)/contracts/actions.ts` — `TASK_FORM_DATA_TEXT_FIELDS` grew to match
- `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` — `isFdIssuance` task-type detection; header description/guidance/remarks-placeholder lookups extended to a 4-way branch; new "FD Issuance Information" main-content layout (6 select fields + 4 text/date fields, reusing `compactRightRail`/`attachmentsSection('Final Drawing Attachments')`); `canSubmit` widened to cover FD Issuance; Mark Complete's button label gained a third variant

### Verification Results (2026-08-25)

| Command | Result |
|---|---|
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm lint` (web + api, contracts area) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 224/224 (unchanged — the new logic lives in a client component form, not a separately-tested pure function) |
| `pnpm --filter @recafco/api test --run` | ✓ 1136/1136 (1 new) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 27 migrations, up to date (none added — form_data reused per instruction) |
| Live scenarios A–M | **Not run by the agent this unit** — same dev-database credentials blocker as CM-42 through CM-50; the user has already indicated they will verify live behavior themselves |

### Key Implementation Notes

- All four Technical-step task-specific forms (Drawing Received, SD & Calculation Submission, Getting Approval, FD Issuance) now exist and share one flat, task-agnostic `formData` allow-list — the pattern established in CM-49 (grow the list, never fork it by taskKey) held cleanly through all three additional forms with no backend architecture change needed.
- Deferred nothing beyond Return/Reopen, which the spec itself only asked for "if there is already a safe existing mapping and authorization" — none was obvious, so it was left out rather than guessed at.
- Multi-assignee correctness required no new code, same as CM-49/CM-50 — `StaffMyTasksView`'s per-task `responsibleUserId` filtering (CM-44) already means each staff member's My Tasks list only shows tasks actually assigned to them, so all four Technical steps on the same contract, assigned to four different people, already render correctly and independently.

## CM-50 — Task-Specific Staff Work Forms: Getting Approval (Completed 2026-08-25)

### Summary

Third task-specific form, following the exact pattern CM-49 established: `staff-task-update-panel.tsx` now detects `technical_getting_approval` (from `contract-workflow-templates.ts`) via the same stable `taskKey` mechanism and renders a dedicated "Approval Information" layout instead of Drawing Received's or SD's. Reused CM-46B's `formData` column as instructed — `WORKFLOW_TASK_FORM_DATA_TEXT_KEYS` grew from 27 to 36 (9 new Getting Approval keys: submittedOn, submittedToReviewerClient, approvalStatus, expectedApprovalDate, reviewedOn, reviewedBy, clientReviewerComments, resubmissionDate, resubmissionReasonComments — `submittedBy` and `revisionNo` reused as-is from SD/Drawing Received) and `WORKFLOW_TASK_FORM_DATA_BOOLEAN_KEYS` gained `resubmissionRequired`. No schema or migration change; `pnpm db:migrate:status` confirmed 27 migrations, unchanged, before and after.

Structurally, Getting Approval and SD & Calculation Submission turned out to need the *exact same* right rail (Workflow Steps / Task Details / Recent Activity) — this was pulled out into one shared `compactRightRail` JSX block (and the previously-duplicated Attachments card into a small `attachmentsSection(title)` function, since Getting Approval needed its own "Approval Attachments" title) rather than writing the same markup a third time, so the two task types can never silently drift apart in that shared area. `approvalStatus` is a 5-option `<select>` (Under Review / Approved / Approved with Comments / Changes Required / Rejected) stored purely in `formData` — per the spec's own instruction, it is *not* auto-synced by the bottom-bar action buttons, which map to the core `status` column independently. `resubmissionRequired` is implemented as a checkbox (not a separate Yes/No select) for consistency with the two existing boolean fields from Drawing Received, conditionally revealing Resubmission Date/Reason exactly as spec required, with neither made mandatory.

The bottom action bar gained two new buttons, Getting-Approval-only: **Send Back for Changes** (status → `ON_HOLD`) and **Reject** (status → `REJECTED`) — both existing statuses, never invented. "Approve & Continue" reuses the exact same COMPLETED-mapping handler Mark Complete already had, just relabeled for this task type. A genuinely useful side effect of the ON_HOLD/REJECTED mapping: both are already in `DELAY_REASON_STATUSES`, so clicking either button reveals the existing Delay Reason textarea automatically — a real, already-built place to record why, with zero new field added for it.

### Persistence — Migration Reused, Not Added

- No new migration. `ContractWorkflowTask.formData` (CM-46B) is reused unchanged for a third task type; `pnpm db:migrate:status` confirmed 27 migrations, up to date, both before and after this unit.

### Changes

- `apps/api/src/contracts/contract-workflow.service.ts` — `WORKFLOW_TASK_FORM_DATA_TEXT_KEYS` grew from 27 to 36 keys (9 new); `WORKFLOW_TASK_FORM_DATA_BOOLEAN_KEYS` gained `resubmissionRequired`
- `apps/api/src/contracts/contract-workflow.service.test.ts` — new test covering all 9 new Getting Approval keys (text + boolean) together, plus reused `submittedBy`/`revisionNo`
- `apps/web/src/app/(protected)/contracts/actions.ts` — `TASK_FORM_DATA_TEXT_FIELDS`/`TASK_FORM_DATA_BOOLEAN_FIELDS` grew to match
- `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` — `isGettingApproval` task-type detection; header description/guidance/remarks-placeholder lookups extended to a 3-way branch; new "Approval Information" main-content layout; `attachmentsSection(title)` extracted (was a fixed `attachmentsBlock`) so Getting Approval can title its card "Approval Attachments"; `compactRightRail` extracted and shared between SD and Getting Approval instead of being duplicated a second time; `handleSendBackForChanges`/`handleReject` added alongside the existing `handleMarkComplete`/`handleSubmitForReview`, all four sharing the same generalized `pendingStatusSubmit` flow; Mark Complete's button label becomes "Approve & Continue" for Getting Approval

### Verification Results (2026-08-25)

| Command | Result |
|---|---|
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm lint` (web + api, contracts area) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 224/224 (unchanged — the new logic lives in a client component form, not a separately-tested pure function) |
| `pnpm --filter @recafco/api test --run` | ✓ 1135/1135 (1 new) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 27 migrations, up to date (none added — form_data reused per instruction) |
| Live scenarios A–L | **Not run by the agent this unit** — same dev-database credentials blocker as CM-42 through CM-49; the user has already indicated they will verify live behavior themselves |

### Key Implementation Notes

- **Status mapping rationale, documented in the component's own doc comment so the choice isn't silently lost:** "Reject" → REJECTED and "Send Back for Changes" → ON_HOLD were chosen specifically to avoid both buttons mapping to the same status (which would make them functionally identical) — ON_HOLD reads naturally as "paused pending a resubmission," distinct from REJECTED's more terminal "rejected" meaning. Neither is a new status; both were already in `STATUS_OPTIONS` before this unit.
- Deferred nothing this unit — unlike CM-49 (which deferred "Submit & Send for Approval" and "Request Clarification"), every button the spec asked for maps cleanly to an existing status or existing comment behavior, so all of Save Draft, Save Update, Approve & Continue, Send Back for Changes, and Reject were implemented.
- Multi-assignee correctness required no new code, same as CM-49 — `StaffMyTasksView`'s per-task `responsibleUserId` filtering (CM-44) already means each staff member's My Tasks list only shows tasks actually assigned to them, so Drawing Received/SD/Getting Approval on the same contract assigned to three different people already render correctly and independently.

## CM-49 — Task-Specific Staff Work Forms: SD & Calculation Submission (Completed 2026-08-25)

### Summary

First task-type-aware unit for the focused staff work screen: until now, `StaffTaskUpdatePanel` rendered the exact same Drawing Received-shaped A/B/C/D form for every workflow task regardless of what it actually was. CM-49 adds a second, genuinely different form — SD & Calculation Submission — dispatched by the task's stable, backend-defined `taskKey` (`technical_sd_calculation_submission`, from `contract-workflow-templates.ts`), never the display `taskName`. Every other task, Drawing Received included, falls through to the exact same form it already had — confirmed unchanged by re-reading the file's Drawing Received branch after the split.

Per the task's own instruction, reused CM-46B's `formData` JSONB column rather than adding a new one: the backend's `sanitizeWorkflowTaskFormData()` allow-list grew from 13 to 27 text keys (14 new SD-specific ones — submissionDate, submissionType, submittedTo, targetApprovalDate, relatedDrawingReceived, calculationType, numberOfSheetsFiles, scopeDescription, submittedBy, designation, submissionMethod, submissionReferenceNo, contactNo, email — plus `drawingReferenceNo`/`revisionNo` reused as-is, not duplicated), with no schema or migration change. The allow-list stays deliberately task-agnostic (one flat superset, not keyed by taskKey): each task-specific frontend form only ever renders and submits its own field names, so there's no cross-task contamination risk in sharing one list — confirmed with a new sanitizer test covering all 14 new keys together. The web action (`updateWorkflowTaskAction`) grew the matching named-field list it collects from the submitted browser FormData.

The SD form itself replaces Drawing Received's A/B/C/D split with the reference design's own shape: one wide "Submission Information" card (Status + the 15 optional fields, 4-per-row on desktop, Scope Description and Remarks as full-width fields below the grid) spanning the main+middle grid columns, then Attachments, then Progress Updates — all using the exact same three server actions and the exact same `<form form="staff-task-update-form">` cross-column-association technique CM-46C established. The right rail swaps Drawing Received's Checklist/Activity Timeline/Task Details for Workflow Steps (a compact vertical version of the same real `task.teamTasks` data the horizontal stepper already used) / Task Details (now including Created On and Priority, both real fields not shown on Drawing Received's version) / Recent Activity (identical underlying `activity` data, just relabeled). Header description and Step Guidance copy are also task-specific, using the spec's own literal wording — nothing invented.

The bottom action bar gained one new button, SD-only: **Submit**, which sets the already-existing `SUBMITTED` status (never a new one) and saves through the same form, hidden once the task is already SUBMITTED/UNDER_REVIEW/APPROVED/COMPLETED. "Submit & Send for Approval" and "Request Clarification" were both deliberately deferred — see Key Implementation Notes.

### Persistence — Migration Reused, Not Added

- No new migration. `ContractWorkflowTask.formData` (added in CM-46B, `20260829000000_add_contract_workflow_task_form_data`) is reused unchanged; `pnpm db:migrate:status` confirmed 27 migrations, up to date, both before and after this unit.

### Changes

- `apps/api/src/contracts/contract-workflow.service.ts` — `WORKFLOW_TASK_FORM_DATA_TEXT_KEYS` grew from 13 to 27 keys (14 new SD-specific)
- `apps/api/src/contracts/contract-workflow.service.test.ts` — new test covering all 14 new SD keys (plus reused drawingReferenceNo/revisionNo) passing through the sanitizer together
- `apps/web/src/app/(protected)/contracts/actions.ts` — `TASK_FORM_DATA_TEXT_FIELDS` grew to match, so `updateWorkflowTaskAction` collects the new named inputs when present
- `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` — `isSdCalculation` task-type detection (by `taskKey`); task-specific header description and Step Guidance copy; the main work grid and right rail now each branch between the original, unchanged Drawing Received layout and the new SD & Calculation Submission layout; `pendingComplete` (boolean) generalized to `pendingStatusSubmit` (string | null) so Mark Complete and the new Submit button share one "set status, wait for it to land, then submit" flow; shared Attachments/Progress-Updates JSX extracted into local `attachmentsBlock`/`progressUpdatesBlock` expressions reused by both layouts instead of being duplicated

### Verification Results (2026-08-25)

| Command | Result |
|---|---|
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm lint` (web + api, contracts area) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 224/224 (unchanged — the new logic lives in a client component form, not a separately-tested pure function) |
| `pnpm --filter @recafco/api test --run` | ✓ 1134/1134 (1 new) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 27 migrations, up to date (none added — form_data reused per instruction) |
| Live scenarios A–J | **Not run by the agent this unit** — same dev-database credentials blocker as CM-42 through CM-48C; the user has already indicated they will verify live behavior themselves |

### Key Implementation Notes

- **Deferred, per the task's own instruction to report rather than invent:** "Submit & Send for Approval" was not added — it would need to combine a status change with some notification/routing behavior that doesn't exist anywhere in this codebase, and inventing one wasn't in scope. "Request Clarification" was also not added — mapping it onto a plain comment would mislabel an ordinary progress-update comment as a distinct clarification-request type the backend has no concept of. Plain **Submit** (status → SUBMITTED, an already-existing status) was added since it maps cleanly with no invention.
- Multi-assignee correctness (spec's own audit item 10/16) required no code change — it was already correct by construction: `StaffMyTasksView`'s per-task flattening already filters `responsibleUserId === currentUserId` per task (from CM-44), so each staff member's My Tasks list only ever contains tasks actually assigned to them, and the panel receives whichever specific task object was selected. A Drawing Received task assigned to one staff member and an SD & Calculation task assigned to another already render correctly and independently — confirmed by re-reading, not by adding a new check.
- Right rail's "Workflow Steps" card for SD reuses `task.teamTasks` (the same real, sortOrder-sequenced sibling-task list already powering the horizontal stepper above it) rather than a hardcoded 4-name list — so it stays accurate if a contract's actual scope ever omits one of the four TECHNICAL steps.

## CM-48C — Staff My Tasks Clickable Task Cards (Completed 2026-08-25)

### Summary

Pure frontend UX unit — no backend, DTO, service, migration, or data change; one file touched. Audit confirmed `StaffTaskCard` (`contracts/workflow/_components/staff-task-card.tsx`) is used exclusively by `staff-my-tasks-view.tsx` for both the My Tasks bucketed list and the Overdue list — never shared with any manager component — so this change carries zero manager-facing risk by construction, not just by care. Both callers already pass the correct mode-aware `updateHref` (`?mode=my-tasks&taskId=` / `?mode=overdue&taskId=`), so no URL-format change was needed.

Implemented via the standard "stretched link" technique rather than a `<div onClick>` handler: the task name is a real `<Link>` whose `::after` pseudo-element is `absolute inset-0` against the card's `relative` container, so its clickable area covers the entire card. The "Update Task" button remains a separate, sibling `<Link>` (never nested inside the stretched one — nesting anchors is invalid HTML) raised above the overlay with `relative z-10` so it stays independently clickable. Both anchors point at the identical `updateHref` and are native `<a>` elements — no JS click handler, no `stopPropagation()`, and therefore no double-navigation risk by construction: clicking the button triggers exactly one native navigation via its own href, completely independent of the stretched link underneath it. This also preserves native anchor behaviors (Ctrl/Cmd-click and middle-click open in a new tab, right-click offers "copy link") that a JS `onClick`-based card-click approach would have silently broken.

### Changes

- `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-card.tsx` — task name became a stretched `<Link>` covering the whole card; Update Task button raised to `relative z-10`; outer card gained `hover:border-accent/50 hover:bg-surface-secondary/50` and `focus-within:ring-2 focus-within:ring-focus` for hover/keyboard-focus feedback across the whole card

### Verification Results (2026-08-25)

| Command | Result |
|---|---|
| `pnpm typecheck` (web) | ✓ 0 errors |
| `pnpm lint` (contracts feature area) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 224/224 (unchanged — pure markup/CSS change, no new pure logic) |
| `pnpm --filter @recafco/api test --run` | ✓ 1133/1133 (unchanged — no backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| Live scenarios A–F | **Not run by the agent this unit** — same dev-database credentials blocker as CM-42 through CM-48B; the user has already indicated they will verify live behavior themselves. Click/keyboard/hover behavior specifically benefits from a real-browser check |

### Key Implementation Notes

- No explicit `cursor-pointer` class was added to the card — hovering any part of the card (including the area covered only by the stretched pseudo-element) is still hovering the anchor's hit-testing box, so the browser already shows the pointer cursor natively across the whole card without an extra class.
- `focus-within:ring-2` on the outer card (rather than only each link's own `focus:ring-2`) means Tabbing to either the task-name link or the Update Task button highlights the entire card, reinforcing that the whole card is the clickable unit — a deliberate accessibility choice, not just a styling one.

## CM-48B — Contract Staff Dashboard Layout Balance Polish (Completed 2026-08-25)

### Summary

Pure layout unit — no backend, DTO, service, migration, or data change, and only one file's JSX was reordered (`staff-dashboard-view.tsx`; every other CM-48 component is untouched). CM-48's `[Today's Work + Assigned Tasks] / [Summary + Schedule + Recent Updates]` column split left the left column empty below Assigned Tasks on a normal screen while stacking three sections in the right column — exactly the imbalance the task described. Fixed by moving Today's Work out of the left column entirely to its own full-width `shrink-0` row above the two-column grid, and moving My Recent Task Updates from the right column into the left column, under My Assigned Tasks. The right column now holds only My Work Summary and My Upcoming Schedule. No component's internal markup changed — `StaffTodaysWorkPanel`, `StaffTaskTable`, `StaffRecentUpdates`, `StaffSummaryCards`, and `UpcomingScheduleList` are called with the exact same props (`limit={5}`/`limit={3}` unchanged) as CM-48, just arranged differently in the parent grid.

The `h-full flex flex-col` root structure, the single `flex-1 min-h-0 overflow-y-auto` scroll region for the grid, and the `lg:grid-cols-[1.6fr_1fr]` column split are all unchanged from CM-48 — this unit is a pure rearrangement within that existing structure, not a new layout mechanism.

### Changes

- `apps/web/src/app/(protected)/contracts/dashboard/_components/staff-dashboard-view.tsx` — Today's Work moved to a full-width row above the grid; My Recent Task Updates moved from the right column to the left column (under My Assigned Tasks); right column now holds only My Work Summary + My Upcoming Schedule

### Verification Results (2026-08-25)

| Command | Result |
|---|---|
| `pnpm typecheck` (web) | ✓ 0 errors |
| `pnpm lint` (contracts feature area) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 224/224 (unchanged — pure JSX reorder, no logic touched) |
| `pnpm --filter @recafco/api test --run` | ✓ 1133/1133 (unchanged — no backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| Live scenarios A–J | **Not run by the agent this unit** — same dev-database credentials blocker as CM-42 through CM-48; the user has already indicated they will verify live behavior themselves. As with CM-46C/CM-48, this unit's visual-balance claims specifically benefit from a real-browser check |

### Key Implementation Notes

- `StaffTodaysWorkPanel`'s own root `<div>` already carried `shrink-0` from CM-48 (it needed that class as a flex child of the left column back then), so moving it to be a direct child of the new `h-full flex-col` root needed no additional wrapper — the existing class already does the right thing in the new position.
- Deliberately did not touch any component's internal markup or props this unit — every visual change is a consequence of where each `<section>` sits in the parent JSX, keeping the diff minimal and the risk of a behavioral regression close to zero.

## CM-48 — Contract Staff Dashboard Single-Window Layout (Completed 2026-08-25)

### Summary

Pure layout unit — no backend, DTO, service, migration, or data change; the same `h-full` flexbox pattern CM-46C established for the focused task screen (any direct child of `app-shell.tsx`'s `<main class="flex-1 overflow-auto">` gets a definite, viewport-derived height for free) applied here to the Staff Dashboard. The one structural decision this unit made: rather than reworking the shared `page.tsx` return tree to be conditionally height-bound, Contract Staff now gets a completely separate early-return JSX tree (`StaffDashboardView`, new) before the existing MANAGER/legacy/unavailable code is ever reached — that existing tree is untouched (title/subtitle collapsed from a now-always-manager ternary to fixed constants, with byte-identical rendered output). This mirrors CM-46C's own choice ("dispatch to a wholly separate view rather than parameterize the shared one") and gives the strongest possible guarantee against a manager-dashboard regression, at the cost of a small amount of duplicated header markup (breadcrumb/toolbar wiring) between the two trees.

`StaffDashboardView`'s root is `h-full flex flex-col`: a compact `shrink-0` header (breadcrumb + title/subtitle + `DashboardToolbar`, all close together — the "As of" date chip, scope badge and View My Tasks button the toolbar already rendered didn't need to change, just sit closer to the title) followed by the single `flex-1 min-h-0 overflow-y-auto` two-column grid (`lg:grid-cols-[1.6fr_1fr]`) that's the only region that scrolls if content overflows. Left column: Today's Work (shrunk from a taller banner to a compact card) above My Assigned Tasks (capped to 5 rows + a "View My Tasks — N more" link). Right column: My Work Summary (fixed 2-column mini-stat grid, was responsive up to 4-across), My Upcoming Schedule (capped to 3 + link), My Recent Task Updates (capped to 3 + link) — all real CM-47 data, just capped and reflowed, never paginated with fake placeholders.

`UpcomingScheduleList` (shared with the Manager Dashboard) gained optional `limit`/`moreHref`/`moreLabel` props defaulting to the old unlimited behavior — the Manager Dashboard's own call site passes none of them and is completely unaffected. `StaffTaskTable` and `StaffRecentUpdates` (already staff-only since CM-47) gained their own `limit` prop the same way.

### Changes

- `apps/web/src/app/(protected)/contracts/dashboard/_components/staff-dashboard-view.tsx` (new) — the single-window layout described above; owns the Today's Work/focused-counts/next-task derivation and the Upcoming Schedule filter+remap moved out of `page.tsx`
- `apps/web/src/app/(protected)/contracts/dashboard/page.tsx` — early-returns `<StaffDashboardView>` when `dashboardType === 'STAFF'`; MANAGER/legacy/unavailable tree below is otherwise unchanged (title/subtitle simplified from an always-manager ternary to fixed constants — same rendered output)
- `apps/web/src/app/(protected)/contracts/dashboard/_components/staff-todays-work-panel.tsx` — shrunk padding/type scale for the left-column compact card
- `apps/web/src/app/(protected)/contracts/dashboard/_components/staff-task-table.tsx` — new optional `limit` prop + "View My Tasks — N more" link when truncated
- `apps/web/src/app/(protected)/contracts/dashboard/_components/staff-recent-updates.tsx` — new optional `limit` prop + "View My Tasks — N more updates" link when truncated
- `apps/web/src/app/(protected)/contracts/dashboard/_components/upcoming-schedule-list.tsx` (shared with Manager Dashboard) — new optional `limit`/`moreHref`/`moreLabel` props, all defaulting to the prior unlimited behavior
- `apps/web/src/app/(protected)/contracts/dashboard/_components/staff-summary-cards.tsx` — fixed 2-column grid (was responsive up to 4-across) to suit the narrower right column

### Verification Results (2026-08-25)

| Command | Result |
|---|---|
| `pnpm typecheck` (web) | ✓ 0 errors |
| `pnpm lint` (contracts feature area) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 224/224 (unchanged — layout-only, no new pure logic) |
| `pnpm --filter @recafco/api test --run` | ✓ 1133/1133 (unchanged — no backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| Live scenarios A–J | **Not run by the agent this unit** — same dev-database credentials blocker as CM-42 through CM-47; the user has already indicated they will verify live behavior themselves. As with CM-46C, this unit's visual/layout claims specifically benefit from a real-browser check |

### Key Implementation Notes

- Capping "My Assigned Tasks" to 5 rows (and Upcoming Schedule/Recent Updates to 3) is itself real, honest behavior, not a fake summary — every capped list links to `/contracts/workflow?mode=my-tasks` for the rest, and the counts/labels ("N more") are computed from the actual array length, never a placeholder number.
- `DashboardToolbar` needed no changes — its existing `dashboardType === 'STAFF'` branch (View My Tasks button, unchanged since before this unit) already renders correctly inside the new compact header; `StaffDashboardView` just calls it with `canCreate={false} canClose={false}` since those two props are manager-only and irrelevant to the staff branch it renders.

## CM-47 — Contract Staff Dashboard Focused Work UX (Completed 2026-08-25)

### Summary

Audit found the Staff Dashboard's data plumbing was already almost entirely sufficient: `buildStaffTaskRows()`/`buildStaffRecentUpdates()` on the backend already return the actor's *complete, unfiltered* task/activity lists (not a capped preview), so the new "Due Today" and "Submitted/Waiting Review" counts and the "Today's Work / Next Task" pick could all be computed purely client-side from data already being fetched — no new endpoint. The one real gap was `StaffTaskRow`/`DashboardContractRow` never carrying `counterpartyName` (Client), needed for the spec's explicit "Task name / Contract ID / Project name / Client" field list in both the new focus panel and the assigned-task cards — a small, additive backend change (one more already-authorized column on an existing `contracts.read`-gated query, not new data or a new authorization boundary).

Audit also surfaced two real, pre-existing navigation bugs squarely in this unit's scope: `StaffRecentUpdate.actionUrl` and `ScheduleItem.actionUrl` (for `WORKFLOW_TASK`-sourced items) both still pointed at `/contracts/{id}/workflow` — the manager workspace CM-44's redirect guard now bounces Contract Staff away from. CM-44 had already fixed this for the assigned-task table's own action link but missed Recent Updates and Upcoming Schedule. Both are now remapped, frontend-only, to `/contracts/workflow?mode=my-tasks&taskId=<id>` using `taskId`/`sourceId` fields the API responses already carried.

The 6-card "mini manager" summary (My Open Tasks, My In Progress Tasks, My Overdue Tasks, Due This Week, Completed Tasks, My Active Contracts) is replaced by 4 focused cards — Due Today, Overdue, In Progress, Submitted/Waiting Review — with Due This Week/Completed/Active Contracts demoted to a small secondary stat strip (same `SecondaryMetricsStrip` visual pattern the Manager Dashboard already uses, but a separate implementation so the two dashboards never share this logic). A new "Today's Work" panel sits above everything: `pickNextTask()` selects the single most urgent task in the spec's stated priority order (overdue → due today → high-priority not-started → in-progress → earliest due date), with a clean "No assigned work pending. You are clear for now." empty state. "My Assigned Tasks" changed from a plain `<table>` to task-first cards (highlighting overdue/due-today), and "My Upcoming Schedule" now filters to `WORKFLOW_TASK` items only, closing the "contract-level schedule unrelated to user tasks" gap the spec explicitly called out.

### Changes

- `apps/api/src/contracts/contract-dashboard.service.ts` — `counterpartyName` added to `CONTRACT_DASHBOARD_SELECT`, `DashboardContractRow`, `StaffTaskRow`, and `buildStaffTaskRows()`'s output
- `apps/api/src/contracts/contract-dashboard.service.test.ts` — `makeContract()` factory default + one new assertion for `counterpartyName`
- `apps/web/src/lib/contracts-api.ts` — `StaffTaskRow.counterpartyName: string`
- `apps/web/src/app/(protected)/contracts/_lib/staff-dashboard-focus.ts` (new, +14 tests) — pure `computeStaffFocusedCounts()` and `pickNextTask()`, deliberately separate from the Manager Dashboard's own `contract-dashboard-focus.ts` so the two dashboards' business logic never shares a file
- `apps/web/src/app/(protected)/contracts/dashboard/_components/staff-task-badges.tsx` (new) — small status/priority badges for `StaffTaskRow`'s plain-`string` fields (the workflow module's own badge components require the narrower `ContractWorkflowTaskStatus` enum type)
- `apps/web/src/app/(protected)/contracts/dashboard/_components/staff-todays-work-panel.tsx` (new) — the focus panel described above
- `apps/web/src/app/(protected)/contracts/dashboard/_components/staff-summary-cards.tsx` — rewritten: 4 focused cards + secondary stat strip, replacing the old 6-card grid
- `apps/web/src/app/(protected)/contracts/dashboard/_components/staff-task-table.tsx` — rewritten from a `<table>` to task-first cards; takes a new `todayIso` prop for the due-today highlight
- `apps/web/src/app/(protected)/contracts/dashboard/_components/staff-recent-updates.tsx` — `actionUrl` bug fix (routes to the staff task screen, not the manager workspace) + empty-state copy now matches the spec exactly ("No recent task updates.")
- `apps/web/src/app/(protected)/contracts/dashboard/page.tsx` — STAFF branch reordered (Today's Work → Summary → Assigned Tasks → Upcoming Schedule → Recent Updates), computes `todayIso`/`focusedCounts`/`nextTask`/`staffUpcomingSchedule`; MANAGER and legacy (`!dashboardType`) branches untouched

### Verification Results (2026-08-25)

| Command | Result |
|---|---|
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm lint` (web + api, contracts area) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 224/224 (13 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1133/1133 (unchanged count — one existing test gained an added assertion, not a new test) |
| `pnpm build` | ✓ 8/8 tasks |
| Live scenarios A–H | **Not run by the agent this unit** — same dev-database credentials blocker as CM-42 through CM-46C; the user has already indicated they will verify live behavior themselves |

### Key Implementation Notes

- Deliberately did **not** touch `contract-dashboard-focus.ts` (the Manager Dashboard's own "Today's Focus" sentence builder) even though the new `staff-dashboard-focus.ts` looks structurally similar — the safety rule "do not break Contract Manager dashboard" was read as reason enough to duplicate a small amount of logic rather than risk coupling the two dashboards' business rules together.
- "My Active Contracts" was dropped as a primary card and demoted to the secondary stat strip rather than removed outright — it's real, already-available data, and the spec's own wording ("if needed, move it to a small secondary text/stat") preferred relocation over deletion.
- "Completed This Week" (spec's other named optional secondary metric) was not added — no backend computation for it exists yet and the spec marks it explicitly optional; the existing all-time "Completed" count was kept in the secondary strip instead, honest about what it actually measures rather than mislabeled.

## CM-46C — Staff Task Work Screen Single-Window Reference Layout (Completed 2026-08-25)

### Summary

Pure layout/CSS unit — no backend, DTO, service, migration, data, or action change; every hook/handler in `staff-task-update-panel.tsx` carried over from CM-46B unchanged, only the JSX/class structure moved. Audit of `app-shell.tsx` found the key enabling fact: the app's persistent chrome is already `<div className="flex h-screen overflow-hidden">` with `<main class="flex-1 overflow-auto">` as the actual scroll container (not `<body>`) — meaning any direct child of `<main>` given `h-full` already receives a definite, viewport-derived height through ordinary flexbox, with zero need for a `calc(100vh-Npx)` guess. `StaffMyTasksView` was the only other file touched: when a task is selected it now renders *only* `<StaffTaskUpdatePanel>` (skipping the list page's own breadcrumb/title/subtitle/tabs), since the panel already has its own back-link and header — repeating the list chrome above it would have burned into the single-window height budget for no benefit once a specific task is open.

`StaffTaskUpdatePanel`'s root became `h-full flex flex-col`: header, contract summary, stepper, and guidance strip are `shrink-0` fixed-height sections; the A/B/C/D + right-rail grid is the single `flex-1 min-h-0 overflow-y-auto` region (the *only* place that scrolls if content overflows); the bottom action bar is simply the last flex child — not `sticky` anymore, since a true single-window layout doesn't need position tricks to stay visible, and non-sticky avoids CM-46's small risk of the bar visually covering a focused input. The 3-column desktop grid (`grid-cols-[2fr_2fr_1fr]`) now matches the reference exactly: left column A above C, middle column B above D (Progress Updates folded inside D, no longer a separate full-width card below everything), right column Checklist/Activity/Task Details — Activity gained its own internal `max-h-32 overflow-y-auto` per the spec's explicit fallback for a long list. The page width cap for the focused screen widened to `max-w-[1900px]` (list mode's `max-w-[1400px]` is untouched). All CM-46B fields survive unchanged — B and D's optional inputs are now DOM-outside the `<form>` (they live in different grid columns) and reference it via the standard HTML `form="staff-task-update-form"` attribute, the same technique CM-46 already used for the bottom bar's buttons, just extended to input/textarea/checkbox elements — a native browser form-association feature, not React-specific, so `useActionState`'s FormData collection is unaffected.

### Changes

- `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` — full JSX/class restructuring into the single-window `h-full flex flex-col` shell + 3-column A/C-left, B/D-middle, right-rail grid; new compact `fieldCls`/`fieldLabelCls` scoped to this file only (shared `inputCls`/`labelCls` in `contract-form-fields.tsx` untouched, still used by every other contract form); Progress Updates moved inside Card D; bottom bar no longer `sticky` (now a plain last flex child)
- `apps/web/src/app/(protected)/contracts/workflow/_components/staff-my-tasks-view.tsx` — when a task is selected, renders only the panel (skips breadcrumb/title/subtitle/tabs) inside a `h-full min-h-0` wrapper; list-mode branch (My Tasks / Overdue) is byte-for-byte unchanged

### Verification Results (2026-08-25)

| Command | Result |
|---|---|
| `pnpm typecheck` (web) | ✓ 0 errors |
| `pnpm lint` (contracts feature area) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 211/211 (unchanged — layout-only, no new pure logic) |
| `pnpm --filter @recafco/api test --run` | ✓ 1133/1133 (unchanged — no backend touched) |
| `pnpm build` | ✓ compiled + typechecked + all routes generated |
| Live scenarios A–J | **Not run by the agent this unit** — same dev-database credentials blocker as CM-42 through CM-46B; the user has already indicated they will verify live behavior themselves. This unit specifically needs a real-browser check more than most prior ones (see Key Implementation Notes) |

### Key Implementation Notes

- **Verification risk worth flagging explicitly:** moving B/D's fields outside the `<form>` DOM subtree and associating them via `form="staff-task-update-form"` is standard, well-supported HTML5 behavior (form-associated elements participate in that form's submission regardless of DOM position), but it could not be exercised in a live browser this unit (no dev-database session). Scenarios C and D (save A/B fields, confirm they persist after refresh) are the ones most worth the user's first live check, specifically because this technique — while safe in principle — is new to this component in this unit.
- The single-window behavior itself rests on `app-shell.tsx`'s existing `<main class="flex-1 overflow-auto">` already being the scroll container instead of `<body>` — this was discovered by audit, not assumed; it's what makes `h-full` on this component's root a reliable, non-fragile way to bound its height without guessing pixel offsets.
- If the grid area's combined content is still taller than the available height on some real screen size, the design degrades gracefully: only the `flex-1 min-h-0 overflow-y-auto` grid region scrolls internally first; if that still isn't enough (e.g., a very short browser window), `<main>`'s own `overflow-auto` remains a safety net and the page scrolls normally rather than clipping content unrecoverably.

## CM-46B — Staff Task Work Screen Reference UI Alignment + Optional Task Fields (Completed 2026-08-25)

### Summary

First backend-touching CM-4x unit in this run: one additive nullable JSONB migration, DTO/service changes, and a full A/B/C/D redesign of the staff focused task screen from CM-46. Audit confirmed `ContractWorkflowTask` had no existing JSON/metadata column, so per the task's own instruction added one — `form_data JSONB` (Prisma `formData`) — following the exact convention already established by `contracts.scope_of_work`/`contracts.payment_terms` (`Json? @db.JsonB`, plain `ALTER TABLE ... ADD COLUMN` migration, `@IsOptional() @IsObject()` DTO field, service-side allow-list sanitization rather than a nested-DTO shape).

`sanitizeWorkflowTaskFormData()` (new, exported for testing, in `contract-workflow.service.ts`) is a fixed allow-list of exactly the fields the redesigned UI actually renders — 13 text keys (receivedDate, receivedFrom, senderName, drawingType, drawingReferenceNo, revisionNo, numberOfSheets, drawingDescription, relatedAreaPackage, linkedContractStage, internalReferenceNo, internalNotes, plannedReviewStart) and 2 boolean keys (requiresImmediateReview, additionalDocumentsReceived) — trimmed, 500-char-capped, blank/false values dropped, unknown keys silently dropped, and an all-blank result collapses to `null` (clearing the column) rather than an empty-but-present `{}`. `priority` and `assignedToLabel`, both named in the task spec's broader persistence list, were deliberately excluded: `priority` is already a real core column (the task itself says never duplicate core state), and `assignedToLabel` isn't rendered anywhere in the actual A/B/C/D field list the spec later gives — only fields the UI genuinely saves were added to the allow-list. `formData` was added to `WORKFLOW_TASK_SELECT` and to `updateTask()`'s write path, but deliberately NOT added to `MANAGER_ONLY_WORKFLOW_FIELDS` — Contract Staff can set it on their own assigned task through the exact same `assertWorkflowTaskAssigned`/`assertCanAccessDepartment` checks every other staff-writable field (remarks, delayReason) already goes through; no new authorization path, no scope bypass.

`StaffTaskUpdatePanel` was restructured into the literal A/B/C/D shape: **A. Receipt Details** (Status — core — plus 7 optional intake fields), **B. Drawing/Task Information** (description + 3 optional text fields + 2 checkboxes), **C. Attachments** (unchanged from CM-44 — no delete/remove button added, since the audit confirmed the backend has no attachment-delete support at all), **D. Remarks & Follow-up** (Remarks — core — plus Internal Notes/Planned Review Start, optional; Add Progress Update stays its own separate comment form/action, not folded into the task-update form). All optional inputs use `defaultValue`/`defaultChecked` from `task.formData` so a page refresh shows exactly what was last saved. The bottom action bar gained a genuine 4-way split — **Save Draft** (saves the same form, stays on-screen via `router.refresh()` only) and **Back to My Tasks** on the left; **Mark Complete** and **Save Update** (saves the same form, then navigates back) on the right — distinguished by a `submitIntentRef` set in each button's `onClick` before the shared form (`form="staff-task-update-form"`) submits, so "which button was pressed" survives the async action round-trip without needing three separate forms or three separate server actions.

Field naming stayed intentionally generic ("Drawing / Document Type", "Drawing / Document Reference No", "Number of Sheets / Pages") rather than hardcoded to Drawing Received specifically, per the spec's own instruction — the component has no task-type detection and doesn't need one, since every field is optional and blank for any task that isn't a drawing-intake step.

### Persistence Requirement — Migration Added

- **Migration:** `20260829000000_add_contract_workflow_task_form_data` — `ALTER TABLE "contract_workflow_tasks" ADD COLUMN "form_data" JSONB;` (additive, nullable, no default) — applied to the dev database via `prisma migrate deploy` (no shadow database needed, unlike `migrate dev`) and confirmed with `db:migrate:status` → "Database schema is up to date!" both before and after.
- **Schema:** `ContractWorkflowTask.formData Json? @map("form_data") @db.JsonB` added; Prisma client regenerated and `@recafco/database` rebuilt.

### Changes

- `packages/database/prisma/migrations/20260829000000_add_contract_workflow_task_form_data/migration.sql` (new)
- `packages/database/prisma/schema.prisma` — `ContractWorkflowTask.formData` field
- `apps/api/src/contracts/dto/update-contract-workflow-task.dto.ts` — optional `formData?: Record<string, string | boolean>` (`@IsOptional() @IsObject()`, same convention as `CreateContractDto.scopeOfWork`)
- `apps/api/src/contracts/contract-workflow.service.ts` — new exported `sanitizeWorkflowTaskFormData()`; `formData: true` added to `WORKFLOW_TASK_SELECT`; `updateTask()` sanitizes and writes `dto.formData` when present, leaves the column untouched when the dto omits it entirely
- `apps/api/src/contracts/contract-workflow.service.test.ts` — 6 new `sanitizeWorkflowTaskFormData` tests + 3 new `updateTask` formData tests (staff can save sanitized formData; formData untouched when omitted; blank formData clears to null); `makeTaskRow()` helper gained a `formData: null` default
- `apps/web/src/lib/contracts-api.ts` — `ContractWorkflowTask.formData?: Record<string, string | boolean> | null`
- `apps/web/src/app/(protected)/contracts/actions.ts` — `updateWorkflowTaskAction` reads the 13 text + 2 boolean named fields (gated by a `hasTaskFormFields` hidden-input marker so the manager drawer's unrelated form never sends an empty `formData`) and forwards them as `formData` on the PATCH
- `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` — full A/B/C/D restructure described above (layout, fields, checklist redefinition, sticky bottom bar with Save Draft/Mark Complete/Save Update/Back to My Tasks)

### Verification Results (2026-08-25)

| Command | Result |
|---|---|
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm lint` (contracts feature area, web + api) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 211/211 (unchanged — the new logic lives in a client component form, not a separately-tested pure function) |
| `pnpm --filter @recafco/api test --run` | ✓ 1133/1133 (10 new: `sanitizeWorkflowTaskFormData` + `updateTask` formData wiring) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 27 migrations, up to date (1 new, applied via `migrate deploy`) |
| Live scenarios A–K | **Not run by the agent this unit** — same dev-database credentials blocker as CM-42 through CM-46; the user has already indicated they will verify live behavior themselves |

### Key Implementation Notes

- Kept "Save Update" accent-colored (matching CM-44/45/46's existing styling and the project's `ui-tokens.md` convention that red/danger is reserved for destructive actions) rather than the spec's literal "primary red button" suggestion — a routine save action styled as a warning color would contradict the app's own semantic-color rule everywhere else. Flagged here as a deliberate, judged deviation rather than applied silently.
- "Save Draft" and "Save Update" submit the identical form/action — the only difference is post-save navigation (Save Draft stays on-screen via `router.refresh()`; Save Update returns to the task list). This gives both buttons genuinely different, working behavior rather than being decorative duplicates, and directly serves scenario H (open the task again, saved fields still visible) without leaving the screen to check.
- Contract summary strip shows only "Contract ID" and "Contract Name" — no separate "Contract No" or "Project Name" row — because the data available to this component (`StaffFlatTask`) has no field distinct from `contractReference`/`contractTitle` for either; the task's own instruction ("do not duplicate awkwardly... show only available real values") was applied literally rather than fabricating a second label for the same value.
- No delete/remove control was added to Attachments — `ContractWorkflowTaskAttachment`'s own schema comment (CM-32) already documents "No hard delete in this unit," confirmed still true; per the spec's explicit fallback ("otherwise do not show delete button"), none was added.

## CM-46 — Staff Task Work Screen Compact Layout (Completed 2026-08-25)

### Summary

Pure layout/UX unit — no backend, DTO, service, migration, RBAC, data field, or action change. `StaffTaskUpdatePanel` (CM-44/CM-45's focused task work screen) rendered every section as a full-height, generously-padded stacked card, requiring a long scroll to reach Progress Updates/Work Documents/the right rail on a normal desktop viewport. Reworked purely as a layout pass: same 7 sections the spec named (header, contract summary strip, workflow stepper, guidance strip, two-column work area, right rail, bottom action bar), each tightened and, for the stepper, reoriented.

Header now shows the task name with one compact, data-derived subtitle line (`"{Team} · Step {n} of {total}"`, computed from the same `task.teamTasks` sequence the stepper already used — not invented per-task copy) instead of nothing, alongside the same Status/Priority/Due-or-Overdue badges as before. The contract summary card collapses to a single `lg:grid-cols-6` row (Contract ID/Project/Client/Contract Manager/Current Stage, with Next Stage moved to a one-line footnote) instead of a tall multi-row grid. The workflow stepper is now horizontal (small numbered/checked circles connected by a thin line, each step's name truncated to two lines under it, wrapping on narrow screens) instead of a vertical list, which was the single biggest height contributor for any team with 4+ steps. The guidance note shrank from a full bordered card with its own heading to a single-line info strip with an inline icon. Card padding dropped from `p-4`/`space-y-4` to `p-3`/`space-y-3` throughout.

The Save Update / Mark Complete buttons moved out of the Task Update card and into a new sticky bottom action bar (`Back to My Tasks` / `Mark Complete` / `Save Update`), wired to the still-single, still-unchanged update `<form>` via the standard HTML `form="staff-task-update-form"` attribute on buttons that now live physically outside that form — not a second form, not a duplicated action. Every field that renders is exactly the same field that saved before (Status, Remarks, Delay Reason, Comment, File) through exactly the same three server actions; nothing new was added, and nothing that renders is decorative-only.

### Changes

- `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` — layout-only rewrite: compact header with derived step-context subtitle, single-row contract summary strip, horizontal workflow stepper, single-line guidance strip, tightened card padding throughout, Save Update/Mark Complete moved into a new sticky bottom action bar wired to the existing form via `form="staff-task-update-form"`

### Verification Results (2026-08-25)

| Command | Result |
|---|---|
| `pnpm typecheck` (web) | ✓ 0 errors |
| `pnpm lint` (contracts feature area) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 211/211 (unchanged — layout-only change, no new pure logic) |
| `pnpm --filter @recafco/api test --run` | ✓ 1123/1123 (unchanged — no backend touched) |
| `pnpm build` | ✓ compiled + typechecked + all routes generated |
| Live scenarios A–I | **Not run by the agent this unit** — same dev-database credentials blocker as CM-42 through CM-45; the user has already indicated they will verify live behavior themselves. Visual/pixel verification of the compact layout (actual scroll height on a real desktop viewport) was also not performed — see Key Implementation Notes |

### Key Implementation Notes

- No new data was added anywhere: the header's step-context subtitle and the summary strip's "Current Stage"/"Next Stage" all reuse fields already computed for CM-44's contract-context card and stepper (`task.teamTasks`, `task.taskName`) — nothing resembling drawing reference/revision/received date/sender name/drawing type was added, per the explicit constraint against inventing task-specific fields.
- Buttons outside a `<form>` submitting it via the `form="id"` HTML attribute (rather than moving the form itself into the bottom bar, which would have forced Progress Updates/Work Documents — genuinely separate forms — into an awkward nesting) is the standard, framework-agnostic way to relocate submit controls away from their form; confirmed this doesn't change `useActionState`/`FormData` behavior since the form element itself, not its buttons' DOM position, is what `action` binds to.
- The sticky bottom bar is a self-contained rounded card (`sticky bottom-0`) rather than an edge-to-edge fixed bar bleeding past the page's own padding — kept it inside the component's own layout flow rather than assuming the outer page's padding values, which this component doesn't own.
- Could not visually confirm actual on-screen scroll height without a live browser/rendered viewport (no dev-database session available this unit, consistent with the ongoing credentials gap) — the compaction (tighter padding, horizontal stepper, single-line guidance, single-row summary) is a substantial, verifiable *reduction* in total DOM height versus the CM-44/CM-45 version, but "visible without heavy scroll on normal desktop height" specifically should be confirmed by the user against a real screen.

## CM-45 — Contract Staff Overdue Tasks Cleanup (Completed 2026-08-25)

### Summary

Pure frontend UX unit — no backend, DTO, service, migration, or RBAC changes; closes the gap flagged at the end of CM-44 ("the top-level Overdue tab still routes Contract Staff to the generic manager-worded page"). Audit confirmed the Contract Staff tab set (`WorkflowModeTabs` with `hideAllWorkflows`) already showed only My Tasks + Overdue — that part of the spec was already satisfied. The actual gap was narrower: the Overdue *tab's link* (`?overdueOnly=true`) and the Staff Dashboard's "My Overdue Tasks" metric card (`?myTasksOnly=true&overdueOnly=true`) both still routed into the generic manager "All Workflows" register+board, which CM-44's staff dispatch in `contracts/workflow/page.tsx` never intercepted (it only matched `mode=my-tasks` / `myTasksOnly=true`).

Fixed by extending the same CM-44 dispatch pattern: `WorkflowModeTabs` now computes the Overdue tab's own href per caller — `?mode=overdue` when `hideAllWorkflows` (Contract Staff), the original `?overdueOnly=true` when not (everyone else, unchanged) — and `contracts/workflow/page.tsx` gained a symmetrical `isOverdueMode` check (`mode=overdue` or the legacy `overdueOnly=true`, for staff robustness against old links/bookmarks) dispatched to the same `StaffMyTasksView` component, now parameterized by a `mode: 'my-tasks' | 'overdue'` prop instead of being My-Tasks-only. In overdue mode it shows a single flat list — filtered by the backend's own `isOverdue` field (never a client re-derived rule) — with the spec's exact title/subtitle/empty-state copy, instead of the 5-bucket grouping used for My Tasks. The Staff Dashboard's "My Overdue Tasks" card link was corrected to point at the new route (it was silently landing on the full My Tasks bucketed view before, since `myTasksOnly=true` in the URL matched CM-44's dispatch condition first).

The CM-44 focused task screen is reused unchanged for both entry points — only a new optional `backLabel` prop was added ("Back to My Tasks" vs. "Back to Overdue Tasks") so returning from a task opened via Overdue lands back on the Overdue list, not silently on My Tasks. The header's overdue badge now reads "Overdue by N days" (computed client-side from `dueDate`, only ever shown when the backend's `isOverdue` is already true) instead of a plain due date, matching the same computation added to each `StaffTaskCard` row. Confirmed by reading `contract-workflow.service.ts`'s `computeTaskIsOverdue()` that COMPLETED/APPROVED are excluded from "overdue" server-side, so completing a task via the existing Mark Complete flow correctly drops it off the Overdue list on the `router.refresh()` that already follows a save — no new code needed for that behavior.

### Changes

- `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-mode-tabs.tsx` — Overdue tab's href now computed per-caller (`?mode=overdue` when `hideAllWorkflows`, else unchanged `?overdueOnly=true`)
- `apps/web/src/app/(protected)/contracts/workflow/page.tsx` — new `isOverdueMode` check alongside the existing `isMyTasksMode`, both dispatched to `StaffMyTasksView({ mode, taskId, currentUserId })`; the later generic-page `overdueOnly` derivation also now recognizes `mode=overdue` for non-staff actors, closing a residual gap where a manager manually visiting `mode=overdue` would have landed on an inactive tab
- `apps/web/src/app/(protected)/contracts/workflow/_components/staff-my-tasks-view.tsx` — takes a `mode: 'my-tasks' | 'overdue'` prop; title/subtitle/breadcrumb/back-href/back-label and the rendered list (5-bucket grouping vs. a flat `isOverdue`-filtered list with its own empty state) all branch on it
- `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` — new optional `backLabel` prop (defaults to "Back to My Tasks"); due-date header badge shows "Overdue by N days" when `task.isOverdue`
- `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-card.tsx` — due-date column shows "· N days overdue" when `task.isOverdue`
- `apps/web/src/app/(protected)/contracts/dashboard/_components/staff-summary-cards.tsx` — "My Overdue Tasks" card now links to `/contracts/workflow?mode=overdue`

### Verification Results (2026-08-25)

| Command | Result |
|---|---|
| `pnpm typecheck` (web) | ✓ 0 errors |
| `pnpm lint` (contracts feature area) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 211/211 (unchanged — no new pure-function file needed; overdue filtering reuses the backend's own `isOverdue` field) |
| `pnpm --filter @recafco/api test --run` | ✓ 1123/1123 (unchanged — no backend touched) |
| `pnpm build` | ✓ compiled + typechecked + all routes generated |
| Live scenarios A–H | **Not run by the agent this unit** — same dev-database credentials blocker as CM-42 through CM-44; the user has already indicated they will verify live behavior themselves |

### Key Implementation Notes

- Deliberately did **not** add a new pure-function test file for "is this task overdue" — the backend already computes and returns `isOverdue` per task (`computeTaskIsOverdue()` in `contract-workflow.service.ts`, excluding COMPLETED/APPROVED), and the spec explicitly says "use existing project status helpers if available, do not invent new task statuses." The frontend only filters on the field it's given.
- `days overdue` (client-side, in both the card and the focused panel) is a simple presentational calculation from `dueDate` to today, matching the existing untested-pure-helper convention already used by sibling `formatDate`/`formatBytes` functions in the same files — not a business rule, so not separately unit-tested.
- The Overdue tab now behaves identically in spirit to My Tasks — the same `StaffMyTasksView` component, the same N+1 fetch, the same `StaffTaskCard`/`StaffTaskUpdatePanel` — the only difference is which tasks are shown and the header copy, keeping the two staff task surfaces from silently drifting apart in behavior over time.

## CM-44 — Contract Staff Task-First Work Page (Completed 2026-08-25)

### Summary

Pure frontend UX unit — no backend, DTO, service, migration, or RBAC changes. Contract Staff (`contracts.workflow_update` without `contracts.update`/`contracts.close`, classified by the existing `isContractStaffOnlyAccess()`) previously had their Staff Dashboard's "Update Task" link route into the manager contract workspace (`/contracts/{id}/workflow`), and could reach the full manager contract detail (Payments, Claims, Closeout, Issue Log, Attachments, Activity, etc.) via any `/contracts/[id]` link or a direct URL — there was no staff-appropriate task-first work surface and no boundary stopping staff from landing on manager-only tabs.

`/contracts/workflow?mode=my-tasks` is now dispatched, for Contract Staff only, to a new self-contained `StaffMyTasksView` (title "My Tasks", subtitle "Update your assigned contract workflow tasks, comments and documents.") instead of the generic manager "All Workflows" register+board. It lists the actor's own tasks grouped into Overdue / My Open Tasks / In Progress / Submitted-Under Review / Completed, each with an "Update Task" link to `?taskId=<id>`, which swaps the list for a focused `StaffTaskUpdatePanel` styled after the reference "Drawing Received" work-form layout: a header (task name + Team/Status/Priority/Due-date badges), a Contract Context card (Contract ID, Project, Client, Contract Manager, Current Stage, Next Stage), a same-team workflow-progress stepper, a neutral step-guidance note, the Status/Remarks update form (Save Update + Mark Complete + Back to My Tasks), Progress Updates (comments) and Work Documents (attachments) sections, and a right rail with a derived Checklist (update note added / attachment uploaded / status updated), a merged Activity timeline (comments + attachments + last-updated), and Task Details (assigned to, team, last updated). No responsible-person, due-date, priority, payment, claim, or closeout fields are rendered at all (not merely disabled), and the panel binds the exact same `updateWorkflowTaskAction` / `addWorkflowTaskCommentAction` / `uploadWorkflowTaskAttachmentAction` server actions the manager's `WorkflowTaskDrawer` already uses — zero new mutations. Chose the safer of the spec's two options for direct `/contracts/[id]` access (Option B, redirect) over a new simplified read-only page (Option A): a single guard added to the shared `contracts/[id]/(workspace)/layout.tsx` redirects any Contract-Staff-only actor to My Tasks before any manager header/tabs/children render, covering all twelve workspace sub-routes (Schedule, Payments, Production, Variations, Claims, Risks, Documents, Workflow, Issues, Attachments, Closeout, Activity) at one interception point rather than hiding tabs individually.

Task data needed no new backend endpoint: `listWorkflow({myTasksOnly:true})` gives the set of contracts the actor has an assigned task on, then the FULL `getWorkflow(contractId)` (no `myTasksOnly` filter — `GET :id/workflow` only requires `contracts.read`, which every Contract Staff member already has) is fetched per contract (`Promise.allSettled`, small N — bounded by how many contracts one staff member actually has work on), filtered client-side to the actor's own tasks (`responsibleUserId === currentUserId`). Fetching the full list rather than the pre-filtered one is deliberate: each of the actor's tasks also needs its team's full sibling-task list (sorted by `sortOrder`) to power the workflow-progress stepper and the current/next-stage names — `sortOrder` within a team is a real, backend-defined step sequence (`contract-workflow-templates.ts`, e.g. TECHNICAL: Drawing Received → SD & Calculation Submission → Getting Approval → FD Issuance), not an invented concept.

### Changes

- `apps/web/src/app/(protected)/contracts/_lib/staff-task-grouping.ts` — pure `groupStaffTasksByBucket()`; overdue takes priority over status buckets (never duplicated), ON_HOLD/REJECTED fold into "In Progress"; `StaffFlatTask` also carries `contractManagerName` and `teamTasks` (sortOrder-sorted sibling tasks in the same team) for the focused screen's context/stepper
- `apps/web/src/app/(protected)/contracts/_lib/staff-task-grouping.test.ts` — 7 tests: empty input, overdue-priority, each status bucket, and a mixed-set "every task lands in exactly one bucket" check
- `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-card.tsx` — presentational task row: name, contract reference/title/counterparty, team, status/priority badges, due date, Update Task link
- `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` (client) — the full focused work screen described above; deliberately a separate component from `WorkflowTaskDrawer` rather than a "staff mode" of it, since manager-only fields must not render at all, not just be disabled; "Mark Complete" sets status to COMPLETED and submits via `formRef.current.requestSubmit()` from a `useEffect` gated on the state update landing first, so the native form submission always carries the updated value
- `apps/web/src/app/(protected)/contracts/workflow/_components/staff-my-tasks-view.tsx` — top-level dispatched view: N+1 fetch (full `getWorkflow` per contract), local filter to the actor's own tasks + same-team sibling attachment, group, and render either the grouped list or `StaffTaskUpdatePanel` depending on `?taskId=`; takes `currentUserId` since filtering is no longer server-side
- `apps/web/src/app/(protected)/contracts/workflow/page.tsx` — new dispatch branch: `(mode=my-tasks || myTasksOnly=true) && isContractStaffOnlyAccess(permissions)` renders `StaffMyTasksView` before any of the existing "All Workflows" logic runs; manager `mode=my-tasks` behavior is completely unchanged
- `apps/web/src/app/(protected)/contracts/dashboard/_components/staff-task-table.tsx` — "Update Task" link now points to `/contracts/workflow?mode=my-tasks&taskId=<id>` instead of the backend-computed `actionUrl` (which pointed at the manager workspace)
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/layout.tsx` — added `if (isContractStaffOnlyAccess(permissions)) redirect('/contracts/workflow?mode=my-tasks')` immediately after permissions are resolved, before any manager header/tabs/children render

### Verification Results (2026-08-25)

| Command | Result |
|---|---|
| `pnpm typecheck` (web) | ✓ 0 errors |
| `pnpm lint` (contracts feature area) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 211/211 (7 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1123/1123 (unchanged — no backend touched) |
| `pnpm build` | ✓ compiled + typechecked + all routes generated |
| Live scenarios A–H | **Not run by the agent this unit** — same dev-database credentials blocker as CM-42/CM-42B/CM-43; the user has already indicated they will verify live behavior themselves |

### Key Implementation Notes

- The top-level "Overdue" tab in `WorkflowModeTabs` (`?overdueOnly=true`, distinct from `?mode=my-tasks`) was deliberately left unchanged and still routes Contract Staff to the generic manager-worded workflow page — out of this unit's explicit scope (the spec's verification scenarios only cover the My Tasks page's internal Overdue *section*, which `StaffMyTasksView` does provide). Flagged here rather than silently left as a gap.
- `contracts/[id]/edit` (DRAFT-only, outside the `(workspace)` route group) was left unguarded: Contract Staff never has `contracts.update` so the page's own "Edit Contract" link never renders for them, and the underlying mutation is backend-permission-gated regardless — not a reachable path from any staff-visible UI.
- Backend restrictions (`ContractWorkflowService.assertWorkflowTaskAssigned`, `assertNoManagerOnlyFields` in `contract-workflow.service.ts`) were re-confirmed by reading, not modified — they already reject staff touching unassigned tasks or manager-only fields regardless of what the UI shows.

## CM-43 — Manager Contract List Quick Actions (Completed 2026-08-25)

### Summary

Pure frontend UX unit — no backend, DTO, service, migration, or RBAC changes. The Contract List's action column previously offered only "Open Contract" and, for Drafts a manager could edit, "Edit" — every other manager task (activating, assigning workflow tasks, reviewing closeout, checking payments/issues/claims/schedule) required navigating into the contract detail page first. It now shows **Open** (always), one status-driven **primary quick action** (Activate for Draft, Assign Tasks for Active, Review Closeout when a closeout request is awaiting review, Open as the neutral fallback for Closed/Terminated), and a **More actions** dropdown with the remaining relevant links — never a free status dropdown, never a direct Close-from-list.

The one genuinely new piece of data needed — "does this contract have a closeout request awaiting review" — is not on the contract list response, but audit found it didn't need to be added there: CM-38's existing closeout register endpoint already supports `pendingOnly: true` and returns each pending request's `contractId`. The list page now fetches that alongside its existing calls and cross-references it into a `Set<contractId>` — zero new backend surface. Every navigation target (workflow/payments/issues/claims/schedule/closeout/edit) is an existing route; the only mutation (Activate) reuses the exact same `activateContractAction` the detail page's `ContractTransitions` component already calls, wrapped in a new confirmation dialog that follows the exact same dialog/dropdown architecture already established by `administration/users/_components/user-lifecycle-actions.tsx` (useTransition + router.refresh(), a local dialog state machine for confirm/error) rather than inventing a new one.

### Changes

- `apps/web/src/app/(protected)/contracts/_lib/contract-ui-helpers.ts` — new pure `computeContractRowActionPlan(contract, permissions, hasPendingCloseout)`, reusing the existing `getVisibleContractTransitions` for the Activate-visibility check
- `apps/web/src/app/(protected)/contracts/_lib/contract-ui-helpers.test.ts` — 12 new tests covering every status/permission combination named in the spec, including the "Edit is DRAFT-only at the route level" and "pending closeout overrides the generic Active behavior, but never overrides Closed" cases
- `apps/web/src/app/(protected)/contracts/_components/contract-row-actions.tsx` (new, client) — Open link + primary action button/link + More actions dropdown + Activate confirmation dialog + error dialog
- `apps/web/src/app/(protected)/contracts/_components/contract-list-table.tsx` — action column now renders `ContractRowActions`; `canUpdate: boolean` prop replaced with the full `permissions: string[]` (needed for `computeContractRowActionPlan`'s permission-specific checks) plus `pendingCloseoutContractIds: Set<string>`
- `apps/web/src/app/(protected)/contracts/page.tsx` — fetches `contractsApi.listCloseouts({ pendingOnly: true, pageSize: 100 })` alongside its existing `Promise.allSettled` batch, derives `pendingCloseoutContractIds`, passes `permissions` (not just `canUpdate`) and the new set down to the table

### Verification Results (2026-08-25)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 204/204 (12 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1123/1123 (unchanged — no backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| Live scenarios A–I | **Not run by the agent this unit** — same dev-database credentials blocker as CM-42/CM-42B; the user has already indicated they will verify live behavior themselves |

### Key Implementation Notes

- **Draft row:** primary is Activate only when the actor holds `contracts.activate` (reuses `getVisibleContractTransitions`, never a separately-derived check); More has Edit (only if `contracts.update`), View Schedule, View Workflow.
- **Active row:** primary is Assign Tasks (routes to `/contracts/workflow?mode=assignment&contractId=<id>`, the exact CM-40 Assignment Queue URL) only when the actor holds `contracts.update`; More has Workflow/Payments/Issues/Claims/Schedule/Closeout — no Close item anywhere in this branch.
- **Pending-closeout row:** takes priority over the generic Active behavior (and over Terminated) but never overrides an already-Closed contract; primary is Review Closeout (→ `/contracts/{id}/closeout`) gated by `contracts.update` OR `contracts.close`, matching the sidebar's existing Closeout Requests `anyPermission` gate.
- **Closed row:** primary Open only; More has View Closeout/Payments/Claims/Schedule — deliberately no Workflow, no Issues, no Edit, no Activate, matching the spec's explicit list exactly.
- **Deliberate deviation from the literal spec text, documented for transparency:** section 6's fallback wording ("Edit if user has update permission and contract is not closed") would offer Edit for Terminated contracts too — but the actual `/contracts/[id]/edit/page.tsx` calls `notFound()` for any contract whose `status !== 'DRAFT'`. Offering Edit there would be a dead 404 link, so the fallback (Terminated, in practice the only status that reaches it) omits Edit — justified by the safety rule "Do not break Contract Detail actions." Every other fallback item (Workflow/Payments/Issues/Claims/Schedule/Closeout) is offered exactly as specified.
- Confirmation dialog copy matches the spec verbatim: "Activate Contract?" / "This will move the contract from Draft to Active and allow workflow tracking and task assignment." / Cancel / Activate Contract.
- "Open" is never duplicated: when the computed primary action type is `'open'` (Closed/Terminated/no-permission fallbacks), the row shows only the one always-present Open link rather than a second, visually-redundant "Open" button next to it — the spec's intent ("a way to open the contract exists") is satisfied either way.

## CM-42B — Users Page Tabs for Module Creation and All Users (Completed 2026-08-25)

### Summary

Pure frontend UX unit — no backend, DTO, service, migration, or RBAC changes. CM-42 put module cards and the full All Platform Users table on the same page; as the audit's own business problem statement noted, together they make the page long once the system has many users. CM-42B splits them into two link-based tabs — **Create by Module** (default) and **All Platform Users** — matching the established `WorkflowModeTabs` (CM-40)/`AssignmentQueueAdvancedSection` (CM-40C) pattern: plain `<Link>`s driven by a `?tab=` query param, not client state, so the active tab survives a refresh or a shared URL for free.

Only one correctness risk existed in this refactor: the All Platform Users filter form (Search/Role/Status/Module/Filter/Clear) had no way to say "stay on this tab" — submitting it, or clicking Clear, would have produced a URL with no `?tab=` param at all, which (per the spec's own default) silently bounces back to Create by Module. Fixed with a hidden `tab=all-users` field in the form and an explicit `?tab=all-users` on the Clear link — the same technique CM-40's `AssignmentQueueFilterBar` already uses for its own `mode=assignment` hidden field.

### Changes

- `apps/web/src/app/(protected)/administration/users/_components/users-page-tabs.tsx` (new) — the 2-tab link strip
- `apps/web/src/app/(protected)/administration/users/page.tsx` — reads `?tab=` (default `'modules'`), wraps `ModuleUserCards` and the entire All Platform Users section (heading/filter form/table/empty/error states) in mutually exclusive `activeTab === ...` branches; filter form gets the hidden `tab=all-users` field; Clear link updated to `?tab=all-users`
- `apps/web/src/app/(protected)/administration/users/_components/module-user-cards.tsx` — "Manage Users" href changed from `/administration/users?module=<slug>#all-platform-users` to `/administration/users?tab=all-users&module=<slug>` (drops the now-redundant anchor fragment — the target section is the only thing rendered on that tab, nothing to scroll past)
- Everything else the audit checked — `module-catalog.ts`, `module-user-counts.ts`, the wizard's `preselectedModule` prop, `new/page.tsx`'s `?module=` handling, and every backend permission check — **confirmed already correct, not modified**

### Verification Results (2026-08-25)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 192/192 (unchanged — pure presentational restructuring, no new pure-function logic) |
| `pnpm --filter @recafco/api test --run` | ✓ 1123/1123 (unchanged — no backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| Live scenarios A–G | **Not run by the agent this unit either** — same blocker as CM-42 (dev database has no working test credentials available to the agent); the user again confirmed they will verify live behavior themselves rather than share credentials |

### Key Implementation Notes

- Both tabs render off the exact same server fetch (`usersData`/`rolePermissions`/`moduleUserCounts`) the page already computes — switching tabs is a pure conditional-render change, never a second network round trip.
- The hidden `tab=all-users` field in the filter form was the one non-obvious fix this unit needed — without it, "Filter" and "Clear" would have silently thrown the admin back to the Create by Module tab after every search. Verified by code inspection (form field present, Clear href explicit) since live click-through wasn't available this unit.
- `UsersPageTabs` intentionally has no permission-based tab hiding (unlike `WorkflowModeTabs`' manager-only Assignment Queue tab) — the whole `/administration/users` page is already `users.read`-gated (Super Admin/Admin only), so both tabs are always appropriate for anyone who can reach the page at all.

## CM-42 — Module-Based User Management Cards (Completed 2026-08-24)

### Summary

Pure frontend UX unit — no backend, DTO, service, migration, or RBAC changes. `/administration/users` now leads with **"Create Users by Module"**: one card per operational module (Contract Management, Factory Tasks Management, Incident Report, Maintenance Requests, Safety & Compliance, Production Dashboard) showing a total user count (and, for Contract Management only, a Manager/Staff split), with **Create User** and **Manage Users** actions. The existing **All Platform Users** table (search/role/status filters, New User button, edit actions) is preserved below, unchanged, plus one small addition: an optional Module filter.

Audit found the user list API carries no module-access data and adding it would require a backend change — but it also found the data needed already exists elsewhere: each active role's full permission list (already fetched by the New User wizard via `rolesApi.get()` per role) plus `module-visibility.ts`'s existing `MODULE_READ_PERMISSION` map (the same rule that decides sidebar visibility) are enough to bucket the *already-fetched* user list by module, entirely client/server-composed with zero new API surface. The same audit — reading every role-seeding migration, not just the two Contract Management ones — confirmed Contract Management is the *only* module with a dedicated Staff/Manager role split (`CONTRACT_STAFF`/`CONTRACT_MANAGER`, CM-35); every other module's access today comes only through Admin/Super Admin/custom roles, so the Manager/Staff breakdown is correctly shown only on that one card, per the task's own "only if supported by roles" instruction.

The New User wizard already had an internal `targetModule` state and a `TEMPLATE_ROLE_CODE` auto-mapping (Contract Management only) — CM-42 added one optional `preselectedModule` prop that seeds those same state values on mount (mirroring what `handleTargetModuleChange` already does when picked by hand), so `?module=contracts` lands with Contract Management already selected and, since the wizard's default Access Template is already "Module Staff," Contract Staff auto-selected too — the manager path is one click away (switch template to "Module Manager"). Direct `/administration/users/new` with no query param is provably unaffected: `moduleBySlug(undefined)` is `undefined`, so the prop is omitted and every initializer falls back to its original expression.

### Changes

- `apps/web/src/app/(protected)/_lib/module-visibility.ts` — exported the existing `MODULE_READ_PERMISSION` map (was module-local) so this feature can reuse it instead of duplicating it
- `apps/web/src/app/(protected)/administration/users/_components/module-catalog.ts` (new) — `MODULE_CATALOG` (code/slug/name/shortDescription for the 6 operational modules) + `moduleBySlug()`/`moduleByCode()`, the shared slug↔module mapping used by the cards, the optional filter, and the wizard's `?module=` param
- `apps/web/src/app/(protected)/administration/users/_components/module-user-counts.ts` (new) — pure `computeModuleUserCounts(users, rolePermissions)`, bucketing already-fetched users by module read permission, with the Contract Management-only staff/manager split
- `apps/web/src/app/(protected)/administration/users/__tests__/module-user-counts.test.ts` (new) — 7 tests
- `apps/web/src/app/(protected)/administration/users/_components/module-user-cards.tsx` (new) — the "Create Users by Module" card grid
- `apps/web/src/app/(protected)/administration/users/page.tsx` — fetches each active role's full permissions (same pattern the wizard already uses), renders `ModuleUserCards`, adds an "All Platform Users" heading (`id="all-platform-users"`, matches the Manage Users card links' `#all-platform-users` anchor), adds a Module filter `<select>` to the existing filter form, applies the module filter to the table/empty-state/row-count (frontend-only, layered on top of the existing search/role/status-filtered fetch)
- `apps/web/src/app/(protected)/administration/users/new/page.tsx` — now reads `searchParams` (`module?: string`), resolves it via `moduleBySlug()`, passes `preselectedModule` to the wizard only when present
- `apps/web/src/app/(protected)/administration/users/_components/new-user-wizard.tsx` — new optional `preselectedModule?: ModuleIdentifier` prop; `targetModule`/`selectedRoleId`/`moduleScopes` initial state seeded from it (mirrors `handleTargetModuleChange`'s existing logic, not a new code path); a small confirmation banner ("Creating a user for {module}…") shown when set

### Verification Results (2026-08-24)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 192/192 (7 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1123/1123 (unchanged — no backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| Live scenarios A–H | **Not run by the agent this unit** — see note below |

**Live verification note:** mid-unit, the dev database was found to have been reset/reseeded outside this session (only 3 accounts remain: `superadmin`, and two real-looking accounts — `managercontract`/`usercontract` — that appear to be the user's own manual UI testing, not synthetic fixtures from earlier units). The agent had no working credentials and, rather than resetting a password on what looked like the user's real login, asked; the user confirmed they will run live verification (scenarios A–H) themselves. This is the first unit in this session where the "Verification Results" table's live-scenario row is user-performed rather than agent-performed — flagging this explicitly rather than fabricating results.

### Key Implementation Notes

- Module user counts are computed from the same up-to-100-users page the table already fetches (the list endpoint's existing `pageSize` cap, pre-existing and unrelated to this unit) — on an install with more than 100 users, counts would undercount exactly as the table itself already would. Documented, not fixed, since fixing it is a pre-existing pagination gap outside this unit's scope.
- Contract Management's Manager/Staff split treats every non-`CONTRACT_STAFF` role with module access (`CONTRACT_MANAGER`, the legacy `CONTRACT_MANAGEMENT_USER`, Admin/Super Admin) as "Manager" — a deliberate simplification (two buckets, matching the spec's literal "Manager: 1 · Staff: 1" example) rather than a third "Legacy"/"Admin" bucket the spec never asked for.
- The Module filter is genuinely applied (not the degraded "at minimum" fallback the spec allowed for) — audit found the same role-permission data used for the cards is sufficient to filter the table too, so `?module=contracts` does real filtering, with the row-count footer falling back to the backend's accurate `pagination.total` whenever no module filter is active (preserving the exact prior footer behavior for that case).

## CM-41 — Contract Staff Simplified Sidebar + My Tasks Experience (Completed 2026-08-24)

### Summary

Pure frontend UI-visibility unit — no backend, DTO, service, migration, or RBAC changes. Audit confirmed Contract Staff (CM-35's `CONTRACT_STAFF` role: `contracts.read`, `contracts.comment`, `contracts.workflow_update` — no `contracts.update`/`contracts.close`) were seeing the *entire* manager-facing `CONTRACT_ITEMS` sidebar list (Dashboard, Contract List, Schedule, Workflow & Team Tasks, Payments, Issue Log, Claim Log), because every one of those items was gated only by `module: 'CONTRACTS_MANAGEMENT'` (i.e. bare `contracts.read`) — none of them checked whether the actor was staff- vs. manager-tier. The Staff Dashboard (CM-37) and its 6 summary cards, "My Assigned Tasks" section, title, and subtitle already matched this task's required spec exactly (confirmed by audit, not re-built) — the only real dashboard gap was the toolbar's primary CTA text/link. The fix is a new permission-only classifier, `isContractStaffOnlyAccess()`, used to swap the sidebar's Contract Management item list down to just Dashboard + My Tasks, and to hide the "All Workflows" tab on the workflow page (Assignment Queue was already manager-gated since CM-40). Backend authorization (CM-32/33/35's field- and department-scoped checks) was not touched and was re-verified live to still reject every staff write attempt regardless of what the sidebar shows.

"My Schedule" (mentioned as optional in the spec, with an explicit "if not simple, defer" escape hatch) was evaluated and deferred: `ShellUser` (the object passed into `Sidebar`) carries `displayName`/`username`/`roleCode`/`roleName`/`permissions` but not the actor's own user id, so a properly self-filtered `/contracts/schedule?responsibleUserId=<self>` link isn't a same-file, zero-plumbing change — it would require threading the id through `app-shell.tsx` and whatever calls `/auth/me` today. Deferred per the task's own contingency, not silently dropped.

### Changes

- `apps/web/src/app/(protected)/_lib/module-visibility.ts` — new `isContractStaffOnlyAccess(permissions)`: true only when `contracts.workflow_update` is present and both `contracts.update` and `contracts.close` are absent
- `apps/web/src/app/(protected)/_lib/module-visibility.test.ts` — 6 new tests (Contract Staff true; Contract Manager, legacy `CONTRACT_MANAGEMENT_USER`, no-workflow_update, close-without-update edge case, and empty permissions all false)
- `apps/web/src/app/(protected)/_components/sidebar.tsx` — new `CONTRACT_STAFF_ITEMS` (Dashboard + My Tasks → `/contracts/workflow?mode=my-tasks`); `visibleContractItems` now sourced from `CONTRACT_STAFF_ITEMS` when `isContractStaffOnlyAccess()` is true, `CONTRACT_ITEMS` otherwise (both the nested-under-Operations and the flat Contract-Management-only rendering paths pick this up automatically, no duplicated JSX); `isContractItemActive()` generalized to strip a query string from `href` before comparing against `pathname` (needed for My Tasks' `?mode=my-tasks` suffix; no behavior change for any existing query-string-free href)
- `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-mode-tabs.tsx` — new optional `hideAllWorkflows?: boolean` prop (default `false`); the "All Workflows" tab is now also `staffHidden`-gated alongside Assignment Queue's existing `managerOnly` gate
- `apps/web/src/app/(protected)/contracts/workflow/page.tsx` — computes `isStaffOnly = isContractStaffOnlyAccess(permissions)`, passes `hideAllWorkflows={isStaffOnly}` to `WorkflowModeTabs`
- `apps/web/src/app/(protected)/contracts/dashboard/_components/dashboard-toolbar.tsx` — Staff Dashboard's primary CTA label changed "View My Workflow Tasks" → "View My Tasks", href changed `?myTasksOnly=true` → `?mode=my-tasks` (both filters are equivalent; the canonical link now matches the sidebar's)
- Everything else the audit checked — `StaffSummaryCards` (6 cards), the STAFF branch of `dashboard/page.tsx` (title/subtitle/"My Assigned Tasks" section), `AssignmentQueueView`'s manager-only gating, and every backend permission/department-scope check — **confirmed already correct, not modified**

### Verification Results (2026-08-24)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 185/185 (6 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1123/1123 (unchanged — no backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| Live A — staff sidebar + dashboard (fresh CONTRACT_STAFF user) | ✓ sidebar shows only Dashboard/My Tasks; no Contract List/Payments/Issue Log/Claim Log/Closeout Requests/Schedule/Workflow & Team Tasks anywhere in the rendered page; dashboard title "My Contract Work Dashboard"; no manager sections; CTA reads "View My Tasks" |
| Live B — My Tasks page | ✓ neither "Assignment Queue" nor "All Workflows" tab present; My Tasks tab active; Overdue tab still present |
| Live C — direct `?mode=assignment` | ✓ no Assignment Queue heading rendered; redirects (meta-refresh) to `mode=my-tasks`; API still returns 403 |
| Live D — direct manager routes | ✓ pages themselves still return 200 (sidebar-only change, not a route block, as designed) but a staff `PATCH` on a payment and an issue both still return 403 — backend authorization unaffected |
| Live E — Contract Manager (fresh CONTRACT_MANAGER user) | ✓ full sidebar (Contract List/Payments/Issue Log/Claim Log/Schedule/Workflow & Team Tasks) and "Contract Manager Dashboard" title unchanged |
| Live F — legacy `CONTRACT_MANAGEMENT_USER` (fresh user, confirmed permission set has `contracts.update`/`close`, no `workflow_update`) | ✓ full sidebar unchanged |
| Live G — Admin-tier actor (broad permission set) | ✓ Contract Management items unchanged |

### Key Implementation Notes

- `isContractStaffOnlyAccess()` is permission-only, never role-code-based — matches every other visibility rule in this app (`canSeeModule`, `isContractManagementOnlyAccess`, CM-37's dashboard-type detection). It is naturally `false` for Contract Manager (has `contracts.update`), the legacy `CONTRACT_MANAGEMENT_USER` (has `contracts.update`/`close`, predates `contracts.workflow_update` and never received it), and Admin/Super Admin (have `contracts.update`) — confirmed live with a freshly seeded user of each role rather than assumed from migration text alone.
- Hiding "All Workflows" for staff is a **UI discoverability change, not a security boundary** — the route (`/contracts/workflow` with no mode) is left fully reachable and still department-scoped exactly as before; only the tab that links to it is gated. This was an explicit, spec-permitted judgment call ("if hiding All Workflows for staff is safe, hide it") rather than a forced redirect, since the underlying data is already read-only and dept-scoped regardless of which tab a manager or staff member arrives from.
- `isContractItemActive()`'s query-string-stripping fix is additive/backward-compatible: every pre-existing `CONTRACT_ITEMS` href is bare (no `?`), so `href.split('?')[0]` is a no-op for all of them — only `CONTRACT_STAFF_ITEMS`' new `?mode=my-tasks` href needed it.

## CM-40D — Assignment Queue Search Suggestions + True Contract Kanban (Completed 2026-08-24)

### Summary

Pure frontend UX polish on top of CM-40C — no backend, DTO, service, migration, or RBAC changes; confirmed during audit that every field the new picker needs (`contractReference`, `contractTitle`, `counterpartyName`, plus the already-computed per-contract `unassignedCount`/`teams` from CM-40C's `groupAssignmentQueueByContract()`) was already present in data the page already fetches. The Assignment Queue's landing view previously required typing into a form field and clicking Apply Filters just to find one contract. It's now a genuine "Choose Contract" guided step: a search box with **live, client-side typeahead suggestions** (matched against reference/name/client as the manager types, no request per keystroke, no Apply button) sits above the existing contract-card grid. The remaining structured filters (team/department/manager/status/priority/due-date-missing) — deliberately *not including* search, which the spec excluded from the "keep" list — were demoted into a collapsed "Advanced filters" disclosure, expanded automatically only when one of those filters is already active via the URL.

Because free-text search moved entirely to the client, it also stopped being a server-submitted query parameter: `getAssignmentQueue()` is now only ever called with the structured Advanced Filters, never `search` — a small simplification of the module-level list logic, not a capability loss (the backend DTO's `search` field is untouched and still used by other callers; this view just no longer sends it).

### Changes

- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-contract-picker.tsx` (new, client) — the live search box + typeahead suggestion list, filtering the already-fetched `AssignmentQueueContractGroup[]` from CM-40C client-side (`useMemo`, capped to 6 visible matches)
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-advanced-filters.tsx` (new, client) — collapsible wrapper around the CM-40/40C filter form, same disclosure pattern as CM-40C's `AssignmentQueueAdvancedSection`
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-filter-bar.tsx` — removed the `search` field/prop entirely (now exactly "Advanced filters": Team/Department/Contract Manager/Contract Status/Priority/Due date missing)
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-contract-card.tsx` — team labels changed from plain comma-joined text to small colored badges (reusing the same info/team-production/warning/success tokens as the Kanban board), card padding tightened slightly
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-view.tsx` — dropped `search` from state/API-call/`hasActiveFilters`/`buildAssignmentHref`; subtitle updated to "Search a contract, then assign responsible users, due dates and priorities for its workflow tasks."; renders the new picker + collapsible advanced filters in place of the old always-visible filter bar; added a "Contracts needing assignment" heading above the existing card grid
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-contract-list.tsx`, `assignment-queue-selected-contract-header.tsx`, `assignment-queue-board.tsx`, `assignment-queue-view-switcher.tsx`, `assignment-queue-advanced-section.tsx`, `assignment-queue-grouping.ts`, `contracts-needing-setup-section.tsx` — **not modified** (the selected-contract Kanban board, its team-column grouping, and the "needs setup" section from CM-40/40B/40C were already exactly what this unit asked for; confirmed by audit rather than re-implemented)

### Verification Results (2026-08-24)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 179/179 (unchanged — pure presentational/UI-structure change, no new pure-function logic beyond what CM-40C's grouping already covers) |
| `pnpm --filter @recafco/api test --run` | ✓ 1123/1123 (unchanged — no backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| Live A — guided picker as first section | ✓ new subtitle present, "Choose Contract" heading + exact-placeholder search input present, Advanced filters collapsed by default (Team `<select>` absent from initial rendered body) |
| Live B — suggestion data available client-side | ✓ a sample contract's reference is present in the page's initial payload with zero extra fetch, confirming the typeahead has everything it needs without a round trip |
| Live C/D — select via URL, focused Kanban | ✓ `?contractId=` shows the correct header, all 4 team columns, Board View default, contract reference appears exactly once in the rendered body (not per card), and the contract-card grid is hidden while a contract is selected |
| Live E — assign from the board | ✓ `PATCH` 200; that contract's remaining unassigned count 7→6; task no longer listed |
| Live F — advanced filters | ✓ `?team=PRODUCTION` narrows the API response (76→40, all PRODUCTION); the Advanced filters section auto-expands (Team `<select>` present) with an "Active" badge when a filter is already applied via URL |
| Live G — staff regression | ✓ no Assignment Queue tab; API still 403 |
| Live H — other modes | ✓ All Workflows, My Tasks (tab active), Overdue all unchanged |

### Key Implementation Notes

- **Confirmed frontend-only, per the audit's own instruction**: no backend field or endpoint change was needed. Search suggestions read from `AssignmentQueueContractGroup[]`, the exact same client-computable aggregate CM-40C already built from the CM-40 API response.
- The picker (`assignment-queue-contract-picker.tsx`) is a **Client Component** — this ruled out passing CM-40C's `buildAssignmentHref` closure into it directly, since functions cannot cross the Server→Client Component prop boundary in the App Router. Solved by passing a plain `baseHref: string` (the same string previously used for "Back to Contracts") and having the client component append `&contractId=...` itself — data across the boundary, not a function.
- Advanced Filters starts **expanded** only when a filter from that set is already active (`useState(hasActiveFilters)`), so a manager arriving via a filtered link (e.g. from an email or a saved bookmark) isn't left wondering why the list looks narrowed with no visible reason; otherwise it starts collapsed, keeping the guided search as the visually dominant first action.
- Search was deliberately dropped from `hasActiveFilters` and the server-side query entirely — it's spec-scoped to the client-side picker only, matching the spec's own "Keep: Team, Department, Contract Manager, Contract Status, Priority, Due date missing only" list for Advanced Filters (Search conspicuously absent from that list).

## CM-40C — Contract-First Assignment Queue UX (Completed 2026-08-24)

### Summary

Pure frontend UX restructuring on top of CM-40/CM-40B — no backend, DTO, service, migration, or RBAC changes; entirely driven by the same `WorkflowAssignmentQueueItem[]` the CM-40 API already returns (confirmed during audit: every field the new views need — `contractId`, `contractReference`, `contractTitle`, `counterpartyName`, `team`, `taskName`, `status`, `priority`, `dueDate` — was already there). The Assignment Queue previously landed directly on a 4-column, all-contracts Kanban board (CM-40B), which the task's own audit found "becomes long and confusing" once multiple contracts have unassigned work. It now defaults to a **contract-first landing view**: one card per contract needing assignment (reference, name, client, unassigned count, teams involved, "Assign Tasks" button). Selecting a contract swaps that out for a **focused, single-contract board** — the same CM-40B team-column Kanban (plus its Board/Table toggle), but scoped to only that contract's unassigned tasks, with the contract identity shown once in a header instead of repeated on every card. The CM-40B "all contracts at once" board/table is preserved (not removed, per the safety rules) but demoted to a collapsed "Advanced" section below the contract cards, never shown by default.

Contract selection is **URL-based** (`?mode=assignment&contractId=<id>`, the spec's preferred option) rather than client state, achieved without a new endpoint: `AssignmentQueueView` (a Server Component) already fetches the full flat item list every render, so selecting a contract is a pure client-side filter (`getContractQueueItems`) of data already in hand — no second fetch on the common path. The one edge case — a stale/typed URL for a contract whose last unassigned task was *just* assigned — falls back to the existing `GET /contracts/:id/workflow` endpoint (already department-scope-checked) purely to recover the contract's name/reference for the "fully assigned" message; this fallback is skipped entirely on the normal path.

### Changes

- `apps/web/src/app/(protected)/contracts/_lib/assignment-queue-grouping.ts` (new) + `.test.ts` (new, 8 tests) — pure `groupAssignmentQueueByContract()` (one row per contract, urgent-first by earliest unassigned-task due date) and `getContractQueueItems()`
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-contract-card.tsx` (new) — one contract card
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-contract-list.tsx` (new) — the contract-first landing grid + its own empty state
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-selected-contract-header.tsx` (new) — "← Back to Contracts" + contract identity + unassigned count, shown once above a focused board
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-advanced-section.tsx` (new, client) — collapsed-by-default wrapper around the CM-40B all-contracts `AssignmentQueueViewSwitcher`
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-task-card.tsx` — added optional `hideContractInfo?: boolean` (default `false`, existing all-contracts board unaffected)
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-board.tsx` — added optional `hideContractInfo?: boolean`, forwarded to each card
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-view-switcher.tsx` — added optional `hideContractInfo?: boolean`, forwarded to the board
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-view.tsx` — rewritten composition: resolves `?contractId=`, renders the selected-contract panel (or the fallback/"not in scope" messages) when present, otherwise the contract list + contracts-needing-setup + collapsed Advanced section; subtitle updated to "Choose a contract, then assign responsible users, due dates and priorities for its workflow tasks."
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-table.tsx` — **not modified**
- `apps/web/src/app/(protected)/contracts/workflow/_components/contracts-needing-setup-section.tsx` — **not modified** (only repositioned in `assignment-queue-view.tsx`'s JSX, still below the contract cards)

### Verification Results (2026-08-24)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 179/179 (8 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1123/1123 (unchanged — no backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| Live A — contract-first landing | ✓ new subtitle present, "Assign Tasks" contract-card buttons present, no 4-column team board rendered by default, Advanced section collapsed (verified with the RSC hydration payload `<script>` blocks stripped out — see note below) |
| Live B — select a contract | ✓ header shows the correct contract reference, all 4 team columns present, contract reference appears exactly once in the rendered body (not per task card) |
| Live C — assign from selected board | ✓ `PATCH` 200; that contract's remaining unassigned count 8→7; task no longer listed |
| Live D — contract fully assigned | ✓ after assigning its last 2 tasks, revisiting `?contractId=` shows "All workflow tasks for this contract are assigned." + a working "Back to Contracts" link |
| Live E — filters | ✓ `?team=PRODUCTION` narrows both the API response (77→40 items, all PRODUCTION) and the contract-first list; a selected contract combined with the same filter shows only its Production column populated, other columns showing "No unassigned tasks for this team." |
| Live F — contracts needing setup | ✓ section and "Generate / View Board" link still present and positioned below the contract cards |
| Live G — staff regression | ✓ no Assignment Queue tab; API still 403 |
| Live H — other modes | ✓ All Workflows, My Tasks (tab active), Overdue all return 200 and render unchanged |

### Key Implementation Notes

- **Confirmed frontend-only, per the audit's own instruction**: no new backend endpoint or DTO field was needed — CM-40's `WorkflowAssignmentQueueItem` already carried every field the contract-first view uses.
- Contract selection is genuinely URL-based (not client `useState`), so a page refresh, bookmark, or shared link preserves the selected contract — the spec's "preferred" option was achievable without extra complexity, nothing was deferred to client-state as a fallback.
- `groupAssignmentQueueByContract()` sorts contracts urgent-first (earliest unassigned-task due date, no-due-date contracts last) — the same "date ascending, nulls last" convention already established by `buildAttentionRows()` (CM-39B) and the CM-40 API's own task-level sort, so the ordering logic stays consistent across the module rather than inventing a new rule.
- `hideContractInfo` was added as an optional, default-`false` prop on 3 already-existing components rather than forking them into contract-scoped duplicates — the exact same "additive prop, verify only the intended caller passes it" pattern used for `MetricCard`'s `dense` prop in CM-39C.
- Testing note: Next.js embeds a serialized RSC "flight payload" inside `<script>` tags for client hydration, which duplicates every piece of rendered text at least once more in the raw HTML response. Early live-verification checks that did plain substring counts against the full HTML produced false negatives/positives (e.g., counting a contract reference 9 times when it visually appears once); re-run with the `<script>` blocks stripped out first, which resolved cleanly. Noting this here since it will recur for any future live-HTML verification script in this app.
- Nothing was deferred for URL persistence — it works. The one intentionally-scoped-down behavior: submitting the filter bar while a contract is selected returns to the (now-filtered) contract list rather than staying on that contract's board, since the filter bar has no hidden `contractId` field — a deliberate simplification (filters change *scope*, which reasonably resets the focused view) rather than an oversight.

## CM-40B — Workflow Assignment Queue Kanban Board View (Completed 2026-08-24)

### Summary

Pure frontend UI addition on top of CM-40 — no backend, DTO, service, migration, or RBAC changes; reuses the exact same `getAssignmentQueue()` API response CM-40 already fetches. The Assignment Queue previously showed only a long table; it now defaults to a **Board View** — unassigned tasks grouped into 4 team columns (Technical/Production/Erection/QS-Commercial), each with a count badge, subtle team-accent-colored cards, and an Assign button that opens the identical CM-40 `AssignTaskModal`. A client-side **Board View / Table View** toggle (`AssignmentQueueViewSwitcher`) sits above the list; both views render off the same server-fetched `items`/`people`/`truncated` props, so switching never refetches or loses filter state — matching the toggle pattern already established by CM-39's `ManagerSecondaryTabs`. The existing `AssignmentQueueTable` component from CM-40 is completely untouched (same file, zero edits), satisfying "keep the table view available" literally.

One design-token addition was needed: `ui-tokens.md` explicitly forbids hardcoded/raw Tailwind colors in feature components, and the existing semantic palette (accent/success/warning/error/info) had no "indigo/purple" entry for the Production team accent the spec asked for. Technical (blue), Erection (orange) and QS/Commercial (green) map directly onto the existing `info`/`warning`/`success` tokens; a new `--color-team-production` / `--color-team-production-light` pair was added to `globals.css` (and mirrored in `ui-tokens.md`) rather than hardcoding an indigo hex value inline — keeping every team color routed through the same token system as the rest of the app.

### Changes

- `apps/web/src/app/globals.css` — added `--color-team-production` / `--color-team-production-light` tokens
- `context/ui-tokens.md` — mirrored the same token addition for documentation parity
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-task-card.tsx` (new) — one Kanban card: contract ref/name/client, task name, status + priority badges, due date ("No due date" when null), Assign button, team-accent top border
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-board.tsx` (new) — 4-column team grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`), per-column count + empty state ("No unassigned tasks for this team."), global empty state ("All generated workflow tasks are assigned. Use the workflow board to monitor progress."), opens `AssignTaskModal` on Assign
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-view-switcher.tsx` (new, client) — Board View / Table View toggle, Board is the default (`useState<ViewMode>('board')`)
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-view.tsx` — swapped the direct `AssignmentQueueTable` render for `AssignmentQueueViewSwitcher`; everything else (heading, subtitle, mode tabs, summary cards, filters, contracts-needing-setup section) unchanged
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-table.tsx` — **not modified** (verified via diff — zero changes)

### Verification Results (2026-08-24)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 171/171 (unchanged — pure presentational addition, no new pure-function logic) |
| `pnpm --filter @recafco/api test --run` | ✓ 1123/1123 (unchanged — no backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| Live A — default view | ✓ `aria-pressed="true"` on Board View button, `"false"` on Table View, confirmed via raw HTML inspection; all 4 team column labels present |
| Live B — assign from card | ✓ same `PATCH /contracts/workflow/tasks/:taskId` (200); queue count 81→80; task no longer returned |
| Live C — Table View | Verified by code review, not live click-through: `AssignmentQueueTable` is byte-for-byte unchanged from CM-40 and the switcher's `view === 'table'` branch renders it with identical props — a static HTTP fetch (used for all other live checks this session) can't observe a client-only `useState` toggle without executing JS, so this one relies on component reuse + the passing web test suite rather than a captured HTML diff |
| Live D — empty team column | ✓ with real data (Technical: 40, Production: 40, Erection: 0, QS-Commercial: 0 unassigned), "No unassigned tasks for this team." appears in the rendered HTML |
| Live E — fully empty | ✓ logic verified (renders only when `items.length === 0`, mutually exclusive with D's per-column check, which correctly returned false when items existed) |
| Live F — contracts needing setup | ✓ section and "Generate / View Board" link still present, untouched |
| Live G — staff regression | ✓ no "Assignment Queue" tab, no "Board View"/"Table View" toggle on the staff-visible All Workflows page; API still returns 403 |

### Key Implementation Notes

- Both views share one server fetch (`AssignmentQueueView` → `getAssignmentQueue()` once), consistent with CM-40's own data-fetching; the toggle is purely a client-side render choice, never a second network request.
- The global "all assigned" empty state and the per-column "no tasks for this team" empty state are mutually exclusive by construction: the board only reaches the per-column empty check when `items.length > 0` overall (the top-level `if (items.length === 0)` returns the global message first), so there's no risk of both messages appearing at once.
- Card design deliberately omits opening a task-detail drawer on click (unlike CM-32's `WorkflowTaskCard`, which opens the full board drawer) — an unassigned task's only relevant action here is Assign, so the card is a static block with one explicit button, not a clickable surface.
- Responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`) avoids horizontal scrolling entirely (cards reflow/stack), unlike the table view's `overflow-x-auto` — satisfies "avoid horizontal overflow" for the board specifically without needing to touch the table's existing (and unavoidable, given its column count) horizontal scroll behavior.

## CM-40 — Workflow Assignment Queue for Managers (Completed 2026-08-24)

### Summary

Fixed the "Assign Tasks" flow: clicking it from the Manager Dashboard used to open the generic Workflow & Team Tasks register (a full contract list + board), leaving the manager to hunt for unassigned work themselves. Now it lands on a focused, manager-only **Assignment Queue** (`/contracts/workflow?mode=assignment`) — a flat list of every unassigned workflow task in the manager's department scope, with contract context, team, due date and priority, and a one-click **Assign** action.

Audit findings that shaped the design: (1) workflow tasks are generated lazily, only when a contract's board is first opened (`ContractWorkflowService.getWorkflowForContract`) — the module-level list never generates anything; (2) an existing `regenerate()` method already exists and is additive-only/idempotent but is for a different purpose (re-syncing an already-initialized contract after a scope change); (3) CM-35 already enforces staff (`contracts.workflow_update`) vs. manager (`contracts.update`) field-level restrictions on `PATCH /contracts/workflow/tasks/:taskId` — `responsibleUserId`/`dueDate`/`priority` are manager-only server-side, unchanged. Given this, the **safer approach** for "Not Generated" contracts was chosen: the Assignment Queue never generates anything itself. Contracts whose saved scope would produce tasks but have none yet appear in a separate "Contracts needing workflow setup" list; clicking "Generate / View Board" simply opens the existing board view, which already lazily (and idempotently) generates on that explicit click — never silently in the background.

The Assignment Queue required one new backend read endpoint (task-level, not contract-level data the existing `findAll()` doesn't expose), but the Assign action itself reuses the existing `PATCH /contracts/workflow/tasks/:taskId` endpoint and its existing server action — no new write path, no RBAC change, no migration.

### Changes

**Backend (additive only — no migration, no existing-endpoint change):**
- `apps/api/src/contracts/dto/contract-workflow-assignment-queue-query.dto.ts` (new) — search/status/departmentId/ownerUserId/team/priority/dueDateMissing
- `apps/api/src/contracts/contract-workflow.service.ts` — new `findAssignmentQueue()` (manager-only, dept-scoped, returns unassigned task rows + summary + contractsNeedingSetup) + `AssignmentQueueSummary` interface + `ASSIGNMENT_QUEUE_MAX_ROWS = 300` cap
- `apps/api/src/contracts/contracts.controller.ts` — new `GET /contracts/workflow/assignment-queue` (`@Permissions('contracts.update')`), declared alongside the existing `GET /contracts/workflow` per the file's established route-ordering convention
- `apps/api/src/contracts/contract-workflow.service.test.ts` — 13 new tests (permission gating, dept scope, unassigned-only filtering, summary accuracy under a display filter, team/priority/dueDateMissing filters, due-date sort, contractsNeedingSetup ACTIVE/scope/existing-tasks conditions)

**Frontend:**
- `apps/web/src/lib/contracts-api.ts` — `WorkflowAssignmentQueueItem`/`Summary`/`ContractNeedingSetup`/`Response`/`Query` types + `getAssignmentQueue()` + `buildAssignmentQueueQuery()`
- `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-mode-tabs.tsx` (new) — All Workflows / Assignment Queue (manager-only) / My Tasks / Overdue link tabs
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-view.tsx` (new) — the Assignment Queue's own server-rendered page body (heading/subtitle/tabs/cards/filters/list/setup section)
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-summary-cards.tsx` (new) — 6 cards (Contracts Needing Assignment, Unassigned Tasks, + 4 per-team)
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-filter-bar.tsx` (new) — Search/Team/Department/Contract Manager/Contract Status/Priority/Due date missing
- `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-table.tsx` (new, client) — unassigned task list + Assign button, opens the modal
- `apps/web/src/app/(protected)/contracts/workflow/_components/assign-task-modal.tsx` (new, client) — compact modal (Responsible Person / Due Date / Priority / Remarks), submits through the existing `updateWorkflowTaskAction`
- `apps/web/src/app/(protected)/contracts/workflow/_components/contracts-needing-setup-section.tsx` (new) — "Contracts needing workflow setup" list, Action links to the existing board
- `apps/web/src/app/(protected)/contracts/workflow/page.tsx` — dispatches to `AssignmentQueueView` for `mode=assignment`/`assignmentOnly=true` (redirecting non-managers to `mode=my-tasks`), adds `mode=my-tasks` as a `myTasksOnly` alias, renders `WorkflowModeTabs`; the rest of the "All Workflows" logic is byte-for-byte unchanged
- `apps/web/src/app/(protected)/contracts/dashboard/_components/manager-top-actions.tsx` — dashboard "Assign Tasks" button now links to `/contracts/workflow?mode=assignment`
- `apps/web/src/app/(protected)/contracts/_lib/contract-dashboard-attention.ts` (+ its test) — the grouped Priority Actions "Assign Tasks" row's link updated to the same assignment-mode URL for consistency

### Verification Results (2026-08-24)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 171/171 (1 updated) |
| `pnpm --filter @recafco/api test --run` | ✓ 1123/1123 (13 new) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 26 migrations, up to date — no migration added |
| Live A — dashboard button + Assignment Queue page | ✓ button → `/contracts/workflow?mode=assignment`; heading "Assign Workflow Tasks", subtitle, 6 cards, all 7 filters, all 10 table columns, mode tabs all present |
| Live B — assign a task | ✓ `PATCH` 200; queue count 82→81; assigned task no longer listed; board shows the new responsible user |
| Live C — contracts needing setup | ✓ 5 contracts listed with scope summary + "Generate / View Board" link |
| Live D — staff direct access | ✓ API returns 403; web request redirects (Next dev meta-refresh) to `/contracts/workflow?mode=my-tasks`, which renders with the My Tasks tab active and no Assignment Queue tab anywhere (including the All Workflows tab strip) |
| Live E — department scope | ✓ a genuinely `OWN_DEPARTMENT`-scoped Contract Manager sees only their own department's 18 items; querying `?departmentId=<other dept>` directly returns 0 items — no leak |
| Live F — All Workflows unchanged | ✓ heading, contract table columns, pagination all unchanged; tabs show "All Workflows" active |
| Live G — dashboard link | ✓ confirmed same as A |

### Key Implementation Notes

- **Lazy-generation decision (explicit per the task's own instruction to "choose the safer approach and report it")**: the Assignment Queue never generates workflow tasks as a side effect of being viewed. Only the pre-existing `getWorkflowForContract()` board-open path generates tasks, and only when the manager explicitly clicks through from "Contracts needing workflow setup." This avoids any surprise bulk-generation and required zero changes to the generation logic itself.
- **Why a new backend endpoint was necessary despite "prefer no backend change"**: the existing `GET /contracts/workflow` list returns *contract-level* aggregates (open/overdue task counts) and deliberately never selects individual task identity (id/name/priority) for the summary computation. Assignment Queue needs one row per unassigned *task* with contract context — that shape doesn't exist anywhere in the current API and can't be assembled client-side without fetching every contract's full task list. The new endpoint is purely additive (new route, new DTO, new service method) and touches none of the 4 existing workflow endpoints' behavior or response shape.
- Summary card counts are computed from the **full** unassigned-task set in scope, before the team/priority/dueDateMissing display filters and before the 300-row display cap — so the cards stay accurate even while a manager is filtering or if the true backlog exceeds the cap (verified live: filtering by team narrowed the visible list from 2 to 1 row while both team-summary counts stayed correct).
- `contractsNeedingSetup` intentionally requires `status === 'ACTIVE'` (workflow is only expected after activation, per the stated business flow) **and** `generateWorkflowTaskTemplates(...).length > 0` (an ACTIVE contract with a genuinely empty/not-applicable scope has nothing to generate and is correctly omitted) **and** zero existing tasks.
- The Assign modal is a new, deliberately narrower client component (Responsible Person / Due Date / Priority / Remarks only — no status/comments/attachments) but submits through the exact same `updateWorkflowTaskAction` server action already used by the full `WorkflowTaskDrawer` on the board — one write path, two entry points.
- `mode=my-tasks` is a thin alias that sets the existing `myTasksOnly` filter internally; the "My Tasks" and "Overdue" tabs needed no new UI at all — they link to already-existing, already-tested filters on the same "All Workflows" page.
- Local dev note: Next.js 16 Turbopack dev mode delivers a Server Component `redirect()` call as a 200 response containing a `<meta http-equiv="refresh">` tag rather than an HTTP 3xx when the response has already begun streaming — functionally identical for a browser, but a plain HTTP client (used here for live verification) must fetch the `content="1;url=…"` target directly to see the final page. Confirmed the actual destination renders correctly.

## CM-39C — Manager Dashboard Command Center Polish (Completed 2026-08-24)

### Summary

Pure frontend visual/wording polish on top of CM-39B — no backend, DTO, service, migration, or RBAC changes; the role-based dashboard-type logic and all API fields are unchanged. Goal was to make the Manager Dashboard read as a command center rather than a data report. Added a new "Today's Focus" panel directly under the header/actions that turns the same real summary counts already used by the KPI cards into one plain-language sentence (e.g. "5 closeout requests waiting review · 3 overdue workflow tasks · 8 open issues · 6 open claims"), built by a new pure function `buildTodaysFocusSegments()` that omits zero-count items and shows "All caught up — nothing urgent right now." when nothing is outstanding. The 5 primary KPI cards were renamed (Needs Action → Manager Actions), given short helper copy and, for Manager Actions, an in-page anchor link (`#priority-actions`) down to the table below; `MetricCard` gained an additive, opt-in `dense` prop (default off, zero effect on the other 20 call sites) used only here to shave card height. The secondary metrics strip changed from one muted sentence to a row of labeled chips in a soft background. The "Needs Manager Action" section was renamed to "Priority Actions" with a one-line subtext, and its table got clearer column names (Type → Action Needed, "What needs attention" → Details), a bolder priority badge, a bolder contract reference, a pill-style action button, and spec-exact empty-state copy. The three lower tabs were renamed (Workflow Load → Team Workload, Upcoming → Upcoming Deadlines, Recent → Recent Updates); the Team Workload cards' "View" link became "View team tasks" and Unassigned/Overdue now carry a small colored dot for at-a-glance scanning. Top action buttons were restyled onto two shared button classes for consistent sizing/alignment (same 4 buttons, same hrefs, same wording). The Staff branch and the `!dashboardType` (Admin/Super Admin/legacy) fallback branch in `page.tsx` were not touched.

### Changes

- `apps/web/src/app/(protected)/contracts/_lib/contract-dashboard-focus.ts` (new) — pure `buildTodaysFocusSegments()`
- `apps/web/src/app/(protected)/contracts/_lib/contract-dashboard-focus.test.ts` (new) — 5 unit tests
- `apps/web/src/app/(protected)/contracts/dashboard/_components/todays-focus-panel.tsx` (new) — renders the focus sentence / positive empty state
- `apps/web/src/app/(protected)/_components/metric-card.tsx` — added optional `dense?: boolean` prop (default `false`; only affects callers that opt in)
- `apps/web/src/app/(protected)/contracts/dashboard/_components/manager-summary-cards.tsx` — "Needs Action"→"Manager Actions" + `#priority-actions` href, per-card helper copy, `dense` cards; `SecondaryMetricsStrip` restyled to chips
- `apps/web/src/app/(protected)/contracts/dashboard/_components/manager-attention-table.tsx` — column renames, stronger priority badge/contract reference/action pill, exact spec empty-state copy
- `apps/web/src/app/(protected)/contracts/dashboard/_components/manager-secondary-tabs.tsx` — tab label renames only
- `apps/web/src/app/(protected)/contracts/dashboard/_components/workflow-overview-panel.tsx` — "View"→"View team tasks", colored-dot indicators, reworded empty state
- `apps/web/src/app/(protected)/contracts/dashboard/_components/manager-top-actions.tsx` — shared button classes for consistent compact sizing (same 4 buttons/hrefs/labels)
- `apps/web/src/app/(protected)/contracts/dashboard/page.tsx` — renders `TodaysFocusPanel`, renamed "Priority Actions" section + subtext + `id="priority-actions"` anchor; Staff/fallback branches unchanged

### Verification Results (2026-08-24)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm exec tsc --noEmit` (web) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 171/171 (5 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1111/1111 (unchanged — no backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| Live manager dashboard (real portfolio: 5 pending closeout, 3 overdue tasks, 8 open issues, 6 open claims) | ✓ Today's Focus renders "5 closeout requests waiting review · 3 overdue workflow tasks · 8 open issues · 6 open claims"; "Manager Actions" label present, "Needs Action" gone; "Priority Actions" heading + subtext present, "Needs Manager Action" gone; anchor `id="priority-actions"` and card `href="#priority-actions"` both present; tabs read Team Workload/Upcoming Deadlines/Recent Updates, old labels gone; "View team tasks" present; Priority Actions table still capped at 5 rows |
| Live top action buttons | ✓ New Contract / Assign Tasks / Schedule / Closeout Requests all present |
| Live staff dashboard (fresh CONTRACT_STAFF user) | ✓ unaffected — no Today's Focus, no Priority Actions, no Team Workload tabs, "My Assigned Tasks" intact |

### Key Implementation Notes

- `buildTodaysFocusSegments()` reuses the exact same `summary` fields the KPI cards already read (`pendingCloseoutRequests`, `overdueWorkflowTasks`, `openIssues`, `openClaims`) — no new data, no new API call, so the sentence and the cards can never disagree.
- `MetricCard`'s new `dense` prop is additive and defaults to `false`; verified via grep that only `manager-summary-cards.tsx` passes it, so the other ~19 call sites (Staff/Production/Safety/Incidents/Maintenance/Factory Tasks dashboards, closeout/schedule/claim/issue/payment/workflow summary cards, root dashboard, contract KPI grid) render byte-identical to before.
- The Priority Actions table's grouping/capping/ordering logic from CM-39B (`buildAttentionRows`, `ATTENTION_ROW_CAP = 5`) is untouched — CM-39C only restyled the already-built rows (column labels, badge/link styling), not the data pipeline feeding them.
- Card layout vs. table for Priority Actions: kept the existing table (per the task's own "if not, keep table but polish it" fallback) rather than switching to cards — the table is already well-tested, responsive, and handles the mixed grouped/non-grouped row shapes from CM-39B cleanly; a card rewrite would have added risk for a change the spec itself treated as optional.

## CM-39B — Manager Dashboard Above-the-Fold Cleanup (Completed 2026-08-24)

### Summary

Pure frontend follow-up to CM-39 — no backend, DTO, service, migration, or RBAC changes. CM-39 had already reduced the dashboard from 9 cards to 5 and consolidated three sections into tabs, but the "Needs Manager Action" table itself was still unbounded (up to the backend's existing 30-item cap), which on a busy portfolio (e.g. 65 draft contracts, 14 contracts with unassigned tasks) pushed the Workflow Load/Upcoming/Recent tabs far below the fold. Fixed entirely on the frontend: a new pure function, `buildAttentionRows()` in `apps/web/src/app/(protected)/contracts/_lib/contract-dashboard-attention.ts`, takes the existing `attentionItems`/`summary`/`workflowOverview` API fields (all already returned, none added), collapses every `ACTIVATE_CONTRACT` item into one "N draft contracts" row (count from the accurate, uncapped `summary.contractsAwaitingActivation`, not from counting rows in the capped items array) and every `ASSIGN_TASKS` item into one "N unassigned workflow tasks across M contracts" row (task total summed from the accurate `workflowOverview[].unassignedTasks`, contract count from the matching rows in the items array), then re-sorts everything by an urgent-first type order (Closeout Review > Overdue Task > Open Issue > Open Claim > Outstanding Payment > Ending Soon > Assign Tasks > Activate Contracts) instead of the backend's plain HIGH/MEDIUM/LOW-then-date order. `ManagerAttentionTable` now displays only the top 5 rows of that grouped/reordered list and adds a compact footer ("Showing 5 of N actions. Open related registers: Draft Contracts / Workflow / Issues / Claims / Payments / Closeout") so the rest of the backlog stays reachable. The Manager section of `page.tsx` was wrapped in its own `space-y-5` (down from the page's `space-y-8`) and the attention table's row padding tightened (`py-2`→`py-1.5`) for additional vertical compactness; the Staff branch and the `!dashboardType` (Admin/Super Admin) fallback branch were not touched.

### Changes

- `apps/web/src/app/(protected)/contracts/_lib/contract-dashboard-attention.ts` (new) — pure `buildAttentionRows()` grouping/reordering function + `AttentionDisplayRow` type + `ATTENTION_ROW_CAP = 5`
- `apps/web/src/app/(protected)/contracts/_lib/contract-dashboard-attention.test.ts` (new) — 7 unit tests covering grouping counts/phrasing, urgent-first ordering, date tiebreak, empty input
- `apps/web/src/app/(protected)/contracts/dashboard/_components/manager-attention-table.tsx` — rewritten to accept pre-grouped `rows: AttentionDisplayRow[]`, caps display to `ATTENTION_ROW_CAP`, renders grouped rows without a per-contract link, adds the register-links footer, tightened row padding
- `apps/web/src/app/(protected)/contracts/dashboard/page.tsx` — computes `attentionRows` via `buildAttentionRows()`, passes to `ManagerAttentionTable`, wraps the Manager branch in a tighter `space-y-5` container (Staff/fallback branches unchanged)
- `apps/web/src/app/(protected)/contracts/dashboard/_components/manager-summary-cards.tsx` — card grid gap tightened `gap-4`→`gap-3` (no other change)

### Verification Results (2026-08-24)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm exec tsc --noEmit` (web) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 166/166 (7 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1111/1111 (unchanged — no backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| Live manager dashboard (real portfolio: 65 draft contracts, 14 contracts with unassigned tasks) | ✓ attention table renders exactly 5 rows; footer reads "Showing 5 of 11 actions" (9 ungrouped high-priority rows + 2 grouped rows, confirming grouping collapsed 21 raw items to 2); rows ordered Closeout Review first per the new urgent-first order; tabs render ~7.3k chars after the heading instead of spanning an unbounded table |
| Live footer register links (manager token) | ✓ all 6 return 200: `/contracts?status=DRAFT`, `/contracts/workflow`, `/contracts/issues`, `/contracts/claims`, `/contracts/payments`, `/contracts/closeouts?pendingOnly=true` |
| Live staff dashboard (fresh CONTRACT_STAFF user) | ✓ unaffected — no "Needs Manager Action" section, no register-links footer, no manager tabs |

### Key Implementation Notes

- Grouping intentionally uses `summary.contractsAwaitingActivation` and the sum of `workflowOverview[].unassignedTasks` — both accurate, uncapped figures already computed server-side — rather than counting rows in the (backend-capped-at-30) `attentionItems` array, so the grouped counts stay correct even when the true total exceeds the 30-item cap.
- The "N contracts" portion of the grouped Assign Tasks row (`across M contracts`) is still derived from counting `ASSIGN_TASKS` rows in the capped array; since that action type is HIGH priority it sorts near the front of the backend's own pre-cap ordering, so it is very unlikely to be trimmed away in practice. Documented as a known minor limitation, consistent with CM-39's own capped "Needs Action" caveat.
- Grouped rows are visually distinguished by having no per-contract link (`contractHref: null`) — the table renders plain text for the Contract cell instead of a `Link`, and the group's Action link goes to the relevant register rather than a single contract page.
- On a busy portfolio, the 5 visible rows can be entirely non-grouped items (verified live: 5 Closeout Review rows filled the cap, pushing both grouped rows out of view but still counted in "Showing 5 of 11 actions") — this is correct per the spec's explicit urgent-first ordering, not a bug.

## CM-38 — Closeout Register Page (Completed 2026-08-24)

### Summary

Added the module-level Closeout Requests register (`/contracts/closeouts`) that CM-37's Manager Dashboard already referenced but which didn't exist yet — completing the set of module-level registers alongside Payments/Issues/Claims/Schedule/Workflow. No new table: `ContractCloseoutService.findAll()` reads directly from `ContractCloseoutRequest` joined to its parent `Contract`, following the exact "candidate contracts scoped via `contract: { departmentId }`" pattern CM-31's Claims register established (simpler than the Workflow/Schedule "candidate-then-join" pattern since `ContractCloseoutRequest` has a direct FK to `Contract`). The register's Workflow/Issues/Claims Open and Outstanding Payment columns deliberately read from each request's own stored `riskSnapshot` (captured at submission, refreshed at review per CM-33) rather than recomputing live per row — avoiding an N+1 query fan-out across 4 more tables for every request, and more correct besides (shows the risk picture as of the request's own submission/review moment). Per the spec's own safety guidance, no quick approve/reject/final-close actions were added to the register — every action row links to the existing, already-tested per-contract Closeout tab, avoiding a duplicate/riskier second implementation of that workflow. Sidebar visibility uses a new `anyPermission` (OR) field on `NavItem`, mirroring CM-35's backend `@AnyPermission` decorator, so Contract Manager/Admin/Super Admin/legacy Contract Management User (all `contracts.update`) see the link while Contract Staff (`contracts.workflow_update` only) does not — while the API itself stays open to `contracts.read` per the spec (Contract Staff can still reach it directly, just isn't guided there by the sidebar).

### Changes

- `apps/api/src/contracts/dto/contract-closeout-list-query.dto.ts` (new) — filters: search/contractId/status/requestedByUserId/reviewedByUserId/departmentId/requestedDateFrom-To/reviewedDateFrom-To/approvedDateFrom-To/pendingOnly/page/pageSize
- `apps/api/src/contracts/contract-closeout.service.ts` — `computeCloseoutListSummary()`, `buildCloseoutListWhere()`, `toCloseoutListItem()`, `ContractCloseoutService.findAll()` (+13 new tests, 51 total)
- `apps/api/src/contracts/contracts.controller.ts` — `GET /contracts/closeouts` (plural, declared before `:id` per the established route-ordering convention)
- `apps/web/src/lib/contracts-api.ts` — `CloseoutListItem`, `CloseoutListSummary`, `ContractCloseoutListQuery`, `ContractCloseoutListResponse` types + `listCloseouts()`
- `apps/web/src/app/(protected)/contracts/_lib/contract-closeout-csv.ts` (new, +`.test.ts`, 5 tests) — reuses `csvField` from `contract-payment-csv.ts`
- `apps/web/src/app/(protected)/contracts/_lib/contract-ui-helpers.ts` — `CONTRACT_CLOSEOUT_STATUS_OPTIONS`
- `apps/web/src/app/(protected)/contracts/closeouts/` (new) — `page.tsx`, `export/route.ts`, `_components/{closeout-summary-cards,closeout-filter-bar,closeout-register-table,closeout-status-badge,closeout-actions-bar}.tsx`
- `apps/web/src/app/(protected)/_components/sidebar.tsx` — new `anyPermission?: string[]` field on `NavItem` (OR-semantics visibility check); "Closeout Requests" added to `CONTRACT_ITEMS` (last position, matching the spec's recommended order) gated on `['contracts.update', 'contracts.close']`; `'closeouts'` added to `CONTRACT_TOP_LEVEL_SLUGS`
- `apps/web/src/app/(protected)/contracts/dashboard/_components/manager-top-actions.tsx` — "Review Closeout Requests" now links to `/contracts/closeouts?pendingOnly=true` (previously `/contracts`)
- `apps/web/src/app/(protected)/contracts/dashboard/_components/manager-quick-actions.tsx` — "Review Closeout" now links to `/contracts/closeouts` (previously `/contracts`)

### Verification Results (2026-08-24)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 159/159 (+5 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1111/1111 (+13 new) |
| `pnpm build` | ✓ 8/8 tasks; `/contracts/closeouts` and `/contracts/closeouts/export` routes built |
| `pnpm db:migrate:status` | ✓ 26 migrations, unchanged — no migration needed, as designed |
| Live API scenarios A–L (+ Admin) | ✓ 26/26 |
| Rendered HTML (register page, sidebar shown for manager / hidden for staff) | ✓ all confirmed |

### Key Implementation Notes

- Quick approve/reject/final-close from the register itself was intentionally NOT built — the spec explicitly permitted deferring this ("Do not duplicate full approve/reject modal if risky... link to existing Closeout tab"), and the per-contract tab's `CloseoutReviewerPanel` already handles optimistic-concurrency (`version`) correctly; duplicating that logic in a second UI surface would risk drift.
- The register's Action column label adapts to status + `contracts.close`: "Review Closeout" for SUBMITTED/UNDER_REVIEW, "Final Close" for APPROVED, "View Closeout" otherwise (or always, for an actor without `contracts.close`) — all pointing to the same existing `/contracts/{id}/closeout` tab.
- Manager Dashboard's per-item "Contracts Requiring Manager Action" closeout entries were left unchanged (still link directly to `/contracts/{id}/closeout`), per the spec's explicit permission to keep that behavior — only the dashboard's top-level "Review Closeout Requests" button and Quick Actions' "Review Closeout" card were repointed to the new register.
- API dev server restarted standalone after backend changes; web dev server unaffected (route/component files only).

## CM-37 — Role-Based Contract Dashboard Upgrade: Manager Control + Staff My Work (Completed 2026-08-24)

### Summary

Split `/contracts/dashboard` into two purpose-built dashboards — Contract Manager Dashboard and My Contract Work Dashboard (staff) — selected server-side purely from the actor's permissions (`contracts.update` or `contracts.close` → MANAGER; everything else, including a bare `contracts.workflow_update` staff actor or a plain read-only Viewer, → STAFF), never from role code. This single rule transparently covers every case the spec named (Contract Manager, legacy Contract Management User, Super Admin, Admin all carry `contracts.update`; Contract Staff does not) with no special-casing. A new `ContractDashboardService` composes on top of the existing (untouched) `ContractsService.getDashboard()` — deliberately not modified, to keep its 132 existing tests and every other page that calls `contractsApi.dashboard()` just for `.scope` working unchanged — and aggregates live data from `Contract`/`ContractWorkflowTask`/`ContractIssue`/`ContractClaim`/`ContractPayment`/`ContractCloseoutRequest`, reusing CM-34's `ContractScheduleService.findAll()` directly for both dashboards' "Upcoming Schedule" panels (staff's additionally filtered by `responsibleUserId`). Overdue/open/outstanding logic reuses each owning module's own already-audited pure function (`computeTaskIsOverdue`, `computeIssueSummary`, `computeClaimSummary`, `computeOverdueDays`/`computeOutstandingAmount`) rather than re-deriving a new definition — the "Contracts Requiring Manager Action" list's own open/final status judgment is this unit's own (documented, separate from CM-33's closeout-readiness lists, following the same precedent CM-34 set). No new database table — deliberately, per the spec's own preference.

### Changes

- `apps/api/src/contracts/contract-dashboard.service.ts` (new) — `computeContractDashboardType()`, `buildWorkflowOverview()`, `buildManagerAttentionItems()` (8 source categories: draft contracts, unassigned tasks, overdue tasks, open high/critical issues, open claims, outstanding payments, pending closeout, contracts ending soon), `computeManagerSummary()`, `computeStaffSummary()`, `buildStaffTaskRows()`, `buildStaffRecentUpdates()`, `ContractDashboardService` (composes `ContractsService.getDashboard()` + own aggregation + `ContractScheduleService.findAll()`) + `.test.ts` (36 tests)
- `apps/api/src/contracts/contracts.controller.ts` — `GET /contracts/dashboard` now calls `ContractDashboardService.getDashboard()` instead of `ContractsService.getDashboard()` directly
- `apps/api/src/contracts/contracts.module.ts` — registers `ContractDashboardService`
- `apps/web/src/lib/contracts-api.ts` — `ContractDashboardType`, `ManagerAttentionItem`, `TeamWorkflowOverview`, `ManagerDashboardData`, `StaffTaskRow`, `StaffRecentUpdate`, `StaffDashboardData` types; `ContractDashboardData` extended additively (`dashboardType`, `manager?`, `staff?`)
- `apps/web/src/app/(protected)/contracts/dashboard/_components/` (new) — `manager-summary-cards.tsx`, `manager-top-actions.tsx`, `manager-quick-actions.tsx`, `manager-attention-table.tsx`, `workflow-overview-panel.tsx`, `upcoming-schedule-list.tsx` (shared), `staff-summary-cards.tsx`, `staff-task-table.tsx`, `staff-recent-updates.tsx`
- `apps/web/src/app/(protected)/contracts/dashboard/_components/dashboard-toolbar.tsx` — branches by `dashboardType` (manager top actions / staff "View My Workflow Tasks" CTA / legacy fallback)
- `apps/web/src/app/(protected)/contracts/dashboard/page.tsx` — rewritten to branch entirely on `data.dashboardType`, with the pre-existing `ContractKpiGrid`/`TopContractsPanels` kept as the total-API-failure fallback

### Verification Results (2026-08-24)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 154/154 (unchanged) |
| `pnpm --filter @recafco/api test --run` | ✓ 1098/1098 (+36 new) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 26 migrations, unchanged — no migration needed, as designed |
| Live API scenarios A–J | ✓ 33/33 |
| Rendered HTML (Manager dashboard, Staff dashboard incl. empty state) | ✓ all confirmed |

### Key Implementation Notes

- `ContractsService.getDashboard()` intentionally untouched — `ContractDashboardService` wraps it rather than replacing it, so its 132 tests and every other `contractsApi.dashboard()` caller (workflow/schedule/claims/issues/payments/new/list pages, root dashboard, workspace layout — all read `.scope` only) keep working with zero changes.
- "Contracts Awaiting Activation" is deliberately the same population as "Draft Contracts" — this codebase has no separate activation-readiness concept (e.g. a BOQ-complete flag); shown as two cards per the spec's literal list rather than inventing a new readiness rule.
- No module-level Closeout register page exists yet (CM-33 only built the per-contract tab) — the top-level "Review Closeout Requests" button links to the Contract List with an explanatory tooltip; actual per-request review happens via the "Contracts Requiring Manager Action" table's own `/contracts/{id}/closeout` links, which are fully functional.
- "My Recent Task Updates" is honest about what's derivable: `ContractWorkflowTask` has no field-level change log (unlike `Contract`'s own `ContractActivity`), so "status update" and "due date changed" are both represented by one generic "Task updated" entry sourced from `lastActivityAt` — no fabricated specificity about which field changed.
- API dev server restarted standalone after backend changes; web dev server unaffected (route/component files only, picked up via Next.js hot reload).

## CM-36 — Super Admin User Creation Wizard UI (Completed 2026-08-24)

### Summary

Converted the New User page's long single-scroll form into a 5-step guided wizard (Account → Organization → Access Template → Module Access → Review & Create) — a pure UI/UX unit with **zero backend changes**. All step content stays mounted the entire time (visibility toggled via CSS, never unmounted), so every field keeps its exact original `name` attribute and the final `<form>` submission produces byte-identical `FormData` to the pre-wizard form — `createUserWithAccessAction` and the REST calls it makes were not touched. `ModuleAccessEditor` was refactored from internally-managed per-row state to a controlled component (scope/department selections lifted into the wizard's own state) so the new Review step can render an accurate module-access summary and so three of the four spec'd mismatch warnings could be computed (Contract Staff + All Departments, Contract Manager + never-configured Contract Management access, Viewer + Module Manager template) alongside a fourth informational one (Platform Admin's broad-access notice). The success screen was extended with Role name, Module Access summary, an explicit "must change password after first login" note, and a combined "Copy Credentials" button, on top of the existing username/temp-password display. Two existing white-box source-regression test files (`user-admin-security.test.ts`, `uat-org-selectors.test.ts`) referenced the old `new-user-form.tsx` file path and the old `selectedPlantId`/`setSelectedPlantId` naming by literal string match — updated to the new file (`new-user-wizard.tsx`) and confirmed the wizard kept the same variable names (renamed the wizard's plant state back to `selectedPlantId` to match the established convention shared with `edit-user-tabs.tsx`, after an accidental blanket rename briefly broke the `plantId` form field name and the `LocationEntity.plantId` property reference — caught immediately by `tsc`).

### Changes

- `apps/web/src/app/(protected)/administration/users/_components/new-user-wizard.tsx` (new, replaces the deleted `new-user-form.tsx`) — 5-step wizard, step indicator, per-step controlled state, `computeAccessWarnings()`, `buildModuleAccessSummary()`, enhanced success screen
- `apps/web/src/app/(protected)/administration/users/_components/module-access-editor.tsx` — `ModuleRow`/`ModuleAccessEditor` refactored from internal `useState` to controlled props (`scopes`, `deptIdsByModule`, `onScopeChange`, `onDeptIdsChange`); compact single-line-per-module card layout (no manual collapse toggle — see Key Implementation Notes)
- `apps/web/src/app/(protected)/administration/users/new/page.tsx` — imports/renders `NewUserWizard` instead of `NewUserForm`
- `apps/web/src/app/(protected)/administration/users/__tests__/user-admin-security.test.ts`, `uat-org-selectors.test.ts` — updated file-path and variable-name string literals to match the renamed component (behavior assertions unchanged)

### Verification Results (2026-08-24)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 154/154 (unchanged count — existing tests updated in place, no new pure-function logic requiring new tests) |
| `pnpm build` | ✓ 8/8 tasks |
| Rendered HTML structural check (`/administration/users/new`) | ✓ all 5 step labels, all Account/Organization field `name` attributes, Access Template cards + role hints, all 7 module `module_scope_*` fields, required clarifying sentences all present |

### Key Implementation Notes

- **No backend change of any kind** — `apps/api` was not touched; `createUserWithAccessAction` in `actions.ts` was not modified; CM-35's roles/permissions are unaffected.
- No browser automation tool is available in this environment, so step-by-step click-through verification (Scenarios A–G) could not be performed interactively. Confidence instead comes from: rendered SSR HTML confirming every field/name attribute survives into the DOM regardless of which step is CSS-hidden, a clean production build, and the fact that the actual server-side integration point (`usersApi.create`/`usersApi.setModuleAccess`) is byte-for-byte unchanged and was already live-verified end-to-end in CM-35.
- "Collapsed by default" for Module Access (spec's minimum-acceptable fallback wording) was interpreted as a **compact single-line-per-module layout**, not an interactive expand/collapse disclosure widget — a manual collapse toggle would have required conditionally unmounting the `<select name="module_scope_*">` field, which risks silently dropping that module's scope from `FormData` on submit if left collapsed. The chosen interpretation avoids that risk entirely while still being visually denser than the pre-CM-36 per-module blocks.
- The "Contract Manager with no Contract Management module access" warning is seeded/cleared automatically: choosing the Module Manager template + Contract Management as the target module pre-populates that module's scope to My Department (so the warning correctly does NOT fire), while reaching `CONTRACT_MANAGER` any other way (e.g. Custom template, manual role pick) without ever visiting the Module Access step correctly DOES trigger it.

## CM-35 — Contract Roles, User Creation Templates, and Workflow Assignment Rules (Completed 2026-08-24)

### Summary

Split the previously-broad `CONTRACT_MANAGEMENT_USER` role into two purpose-built roles — `CONTRACT_STAFF` (daily work: view + assigned workflow tasks only) and `CONTRACT_MANAGER` (full operational access: create/edit contracts, all workflow tasks in scope, closeout approval, final close) — via a purely additive/idempotent seed migration, matching CM-18C's pattern exactly. `CONTRACT_MANAGEMENT_USER` is untouched and kept active as the legacy/full-access option; existing accounts on it continue to work identically (same 7 permissions, same behavior). A new narrower permission, `contracts.workflow_update`, lets staff update/comment/attach only on workflow tasks assigned to them, without granting the broader `contracts.update` (which since CM-28–CM-33 also covers payments, issues, claims, and closeout). Since the platform's `PermissionGuard` only supports AND semantics (`@Permissions('a','b')` requires both), a new additive `@AnyPermission(...)` decorator + guard OR-check was added so a route can accept either a manager or a staff permission, with the real assignment/field-level restriction enforced in `ContractWorkflowService`. Manager-only fields (`responsibleUserId`, `dueDate`, `priority`, and — as a conservative extension not explicit in the spec — `startDate`) are rejected server-side (403) for any actor without `contracts.update`, even on their own assigned task; staff may still change `status`, `completedDate`, `remarks`, and `delayReason`. The New User form's 3-option "Access Preset" was replaced with a 5-template "Access Template" (Module Staff / Module Manager / Multi-Module User / Platform Admin / Custom) that, for Contract Management, auto-selects the matching role and surfaces all 4 relevant role choices (Staff/Manager/Legacy/Viewer); other modules fall back to manual role selection since no dedicated staff/manager roles exist for them yet (explicitly out of scope for this unit). The Module Access editor keeps its existing dropdown UI (the task's own "minimum acceptable" fallback) rather than a full card/checklist redesign, with clearer text distinguishing role (actions) from module access (data visibility). Sidebar visibility required no changes — it was already permission-driven (`contracts.read` alone gates the whole Contract Management section), so `CONTRACT_STAFF`/`CONTRACT_MANAGER` automatically get the same single-module sidebar as `CONTRACT_MANAGEMENT_USER`. Contract-level transition buttons (Activate/Terminate/Close) and closeout actions also required no changes — they were already gated on `contracts.activate`/`contracts.terminate`/`contracts.close`, none of which `CONTRACT_STAFF` receives.

### Changes

- **Migration** `20260828000000_add_contract_staff_manager_roles` — additive/idempotent seed only (no schema change): 1 new permission (`contracts.workflow_update`, granted to `SUPER_ADMIN`/`ADMIN` explicitly), 2 new roles (`CONTRACT_STAFF`, `CONTRACT_MANAGER`) with their permission grants. `CONTRACT_MANAGEMENT_USER` untouched.
- `apps/api/src/common/decorators/any-permission.decorator.ts` (new) — `@AnyPermission(...codes)`, OR semantics, additive metadata key
- `apps/api/src/common/guards/permission.guard.ts` — checks the existing AND-list and the new OR-list independently; unaffected when no `@AnyPermission` is present (+5 new tests)
- `apps/api/src/contracts/contracts.controller.ts` — `PATCH workflow/tasks/:taskId`, `POST .../comments`, `POST .../attachments` now use `@AnyPermission('contracts.update','contracts.workflow_update')` instead of `@Permissions('contracts.update')`
- `apps/api/src/contracts/contract-workflow.service.ts` — `assertWorkflowTaskAssigned()` (manager: unrestricted; staff: must be `responsibleUserId`) and `assertNoManagerOnlyFields()` (staff may not submit `responsibleUserId`/`dueDate`/`priority`/`startDate`) applied in `updateTask`/`addComment`/`createAttachment`; `loadTaskDepartment()` extended to also return `responsibleUserId` (+13 new tests)
- `apps/api/src/roles/roles.service.ts` / `roles.controller.ts` — `findAll()` now returns `RoleListItem` (adds `permissionCount` via Prisma `_count`); mutation endpoints unchanged (`RoleSummary`)
- `apps/web/src/lib/roles-api.ts` — `RoleListItem` type, `list()` return type updated
- `apps/web/src/app/(protected)/administration/roles/page.tsx` — Permissions column (count) + short capability-hint text for `CONTRACT_STAFF`/`CONTRACT_MANAGER`/`CONTRACT_MANAGEMENT_USER`/`VIEWER`/`ADMIN`/`SUPER_ADMIN`
- `apps/web/src/app/(protected)/administration/users/_components/new-user-form.tsx` — `AccessPreset` (3 options) replaced with `AccessTemplate` (5 options); target-module selector for Module Staff/Manager; role dropdown shows capability hints; Contract Management recommended-roles callout
- `apps/web/src/app/(protected)/contracts/_lib/get-user-permissions.ts` — new `getCurrentUserContext()` (id + permissions) alongside the existing `getUserPermissions()`
- `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-board.tsx` / `workflow-task-drawer.tsx` — `canUpdate` split into `canManage` (contracts.update) and `canEdit`/`canUpdateAssigned` (contracts.workflow_update + assignment match); manager-only fields disabled with an inline "(manager only)" label for staff
- `apps/web/src/app/(protected)/contracts/workflow/page.tsx` and `contracts/[id]/(workspace)/workflow/page.tsx` — pass `canManage`/`canUpdateAssigned`/`currentUserId` to `WorkflowBoard`

### Verification Results (2026-08-24)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 154/154 (unchanged — no new pure-function frontend logic needing coverage) |
| `pnpm --filter @recafco/api test --run` | ✓ 1062/1062 (+18 new: 13 workflow assignment/field-scope, 5 AnyPermission guard) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 26 migrations, up to date |
| Live API scenarios A–N | ✓ 48/48 |
| Rendered HTML (New User form templates/roles, Roles page permission counts/hints) | ✓ all confirmed |

### Key Implementation Notes

- `startDate` was treated as manager-only even though the CM-35 spec's explicit field split only names `responsibleUserId`/`dueDate`/`priority` — the conservative reading, since it's a scheduling field like `dueDate` with no precedent for staff self-service. Documented in code comments.
- `contracts.manage` was deliberately NOT granted to `CONTRACT_MANAGER`, per the spec's explicit instruction to reserve it for Admin/Super Admin.
- Full multi-role-per-user schema and additional module-specific Staff/Manager role pairs (Factory Tasks, Incident Report, etc.) were explicitly out of scope and not built — `User.roleId` remains a single required FK, confirmed via schema audit before starting.
- Module Access UI took the spec's own "minimum acceptable" path (existing dropdowns + clearer text) rather than a card/checklist redesign — the task explicitly permitted this fallback.
- API dev server restarted standalone after backend changes; web dev server unaffected (route/component files only).

## CM-34 — Contract Schedule Backend + Timeline Register (Completed 2026-08-23)

### Summary

Converted the `/contracts/schedule` placeholder into a real, read-only aggregation register — deliberately **no new database table**, the first CM-28-through-CM-34 unit to add zero schema. `ContractScheduleService` fetches candidate contracts (dept-scoped, cap 1000) then joins the 5 already-existing source tables in parallel (`ContractWorkflowTask`, `ContractIssue`, `ContractClaim`, `ContractPayment`, `ContractCloseoutRequest`), mapping every row into a common `ScheduleItem` shape via pure exported functions and merging/filtering/sorting/paginating in-memory — the same "candidate contracts then join" pattern CM-29 established for the Workflow module list, generalized from 1 joined source to 5. Overdue logic deliberately **reuses** each source module's own already-tested pure function (`computeTaskIsOverdue` from CM-32, `computeIssueIsOverdue`/`computeIssueOverdueDays` from CM-30, `computeClaimIsOverdue`/`computeClaimOverdueDays` from CM-31, `computeOverdueDays` from CM-28) rather than re-deriving a fifth definition. Two new overdue rules were needed where no precedent existed: contract dates (`CONTRACT_START` is never overdue — a historical marker, not a deadline; `CONTRACT_END`/`FORECAST_COMPLETION` are overdue only when past AND the contract isn't `CLOSED`) and closeout milestones (`CLOSEOUT_REQUEST`/`CLOSEOUT_APPROVAL`/`CLOSEOUT_CLOSED` are always `isOverdue: false` — they're point-in-time markers, and since `requestedAt` is inherently in the past the moment a request exists, naive date-vs-today logic would flag every request as overdue from day one). The "at least 2 views" requirement is satisfied without duplicating timeline-rendering code: the module list IS the chronological Timeline/List view, and the vertical grouped "Contract Timeline View" lives once in a shared `ScheduleTimelineView` component reused both by the new per-contract Schedule tab and via a "Timeline" link in each list row's Action column.

### Changes

- `apps/api/src/contracts/dto/contract-schedule-list-query.dto.ts` (new) — `SCHEDULE_ITEM_TYPES` (10 values) + filter DTO (search/contractId/itemType/status/departmentId/responsibleUserId/ownerUserId/dateFrom/dateTo/overdueOnly/upcomingOnly/page/pageSize)
- `apps/api/src/contracts/contract-schedule.service.ts` (new) — `ScheduleItem`/`ScheduleSummary` types, per-source pure mappers (`contractToScheduleItems`, `workflowTaskToScheduleItem`, `issueToScheduleItem`, `claimToScheduleItem`, `paymentToScheduleItem`, `closeoutRequestToScheduleItems`), `filterScheduleItems`/`sortScheduleItems`/`computeScheduleSummary`, `ContractScheduleService.findAll()`/`findAllForContract()` + `.test.ts` (43 tests)
- `apps/api/src/contracts/contracts.controller.ts` — `GET /contracts/schedule` (declared before `:id`) and `GET /contracts/:id/schedule`, both gated on `contracts.read` only (no new permission code)
- `apps/api/src/contracts/contracts.module.ts` — registers `ContractScheduleService`
- `apps/web/src/lib/contracts-api.ts` — `ScheduleItem`/`ScheduleSummary`/`ContractScheduleListQuery` types + `listSchedule()`/`getContractSchedule()`
- `apps/web/src/app/(protected)/contracts/_lib/contract-schedule-csv.ts` (new) + `.test.ts` (new, 4 tests) — CSV builder, reuses `csvField` from CM-28's `contract-payment-csv.ts`
- `apps/web/src/app/(protected)/contracts/schedule/` (new) — `page.tsx` (module register), `export/route.ts` (CSV export), `_components/schedule-{summary-cards,item-type-badge,status-badge,filter-bar,list-table,actions-bar,timeline-view}.tsx`
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/schedule/page.tsx` (new) — per-contract Schedule tab, reuses `ScheduleTimelineView`
- `apps/web/src/app/(protected)/contracts/_components/contract-workspace-tabs.tsx` — added "Schedule" tab (first in `SCROLLABLE_TABS`, `CalendarDays` icon)

### Verification Results (2026-08-23)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` (web + api) | ✓ 0 errors |
| `pnpm --filter @recafco/web test --run` | ✓ 154/154 (+4 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1044/1044 (+43 new) |
| `pnpm build` | ✓ 8/8 tasks; 3 new routes built (`/contracts/schedule`, `/contracts/schedule/export`, `/contracts/[id]/schedule`) |
| `pnpm db:migrate:status` | ✓ 25 migrations, unchanged — no migration added by design |
| Live API scenarios A–L | ✓ 37/38 (1 false negative from leftover same-named test contracts across retried script runs, confirmed by inspection — not a functional defect) |
| Rendered HTML (module page title/subtitle/8 cards/filters/export/print, per-contract tab timeline, empty state, workspace tab link) | ✓ all confirmed |

### Key Implementation Notes

- API dev server restarted standalone after backend changes; web dev server unaffected (no changes needed there beyond the new route files, which Next.js picks up without restart).
- Calendar view (3rd optional view) was **not** built — the task explicitly permitted deferring it if not simple, and a real calendar grid would have meaningfully expanded scope beyond "read-only aggregation register" for no spec-required benefit.
- Excel export is the established CSV-fallback pattern (no `xlsx` dependency in this codebase) — same as every CM-28–CM-32 export. PDF is browser print-to-PDF only, no native PDF generation library.
- `ScheduleStatusBadge` is a single generic badge covering all 10 item types (heuristic `TERMINAL_STATUS_WORDS` list drives green/neutral/red), not 10 dedicated badges — each source register already has its own precise status badge, reachable via the schedule item's action link.

## CM-33 — Contract Closeout Approval Flow (Completed 2026-08-23)

### Summary

Added a controlled, auditable approval gate in front of final contract closure, per explicit business decision: workflow tasks stay approval-free (unchanged from CM-32), but a contract can now only reach CLOSED through an APPROVED `ContractCloseoutRequest`. Additive migration adds one enum and two tables: `ContractCloseoutRequest` (the request/review/approval record — `requestNo` auto-generated as `<contract reference>-CLO-<02d sequence>`, `riskSnapshot` JSONB captured at submission and refreshed at review) and `ContractCloseoutAttachment` (closeout supporting documents, reusing CM-32's validation constants — 10MB limit, 5 MIME types — via a structurally-identical-but-separate `CloseoutAttachmentStorageService` so CM-32's already-shipped storage code is never touched). The pre-existing direct `POST /contracts/:id/close` endpoint (`ContractsService.close()`) now hard-requires an APPROVED request to exist before proceeding, throwing `CONTRACT_CLOSEOUT_APPROVAL_REQUIRED` with the exact spec'd message otherwise — this is a defensive backstop; the real path is the new `POST /contracts/closeout/:requestId/close-contract`, which atomically closes the contract AND the request together in one transaction (so they can never disagree) and writes both an activity-log entry and a `SecurityAuditEvent`. Approval and closure are deliberately two separate actions (per explicit business decision: "Approval marks closeout request APPROVED... Separate 'Close Contract' action closes the contract") — live-verified the contract stays ACTIVE immediately after approval and only transitions to CLOSED on the explicit final action. Readiness checks are read-only, direct-Prisma cross-module counts (workflow/issues/claims/payments) computed fresh on every request/review, never gating request submission or approval — only surfaced as warnings, matching the explicit "do not block too aggressively" instruction. Only one active request (DRAFT/SUBMITTED/UNDER_REVIEW/APPROVED) may exist per contract at a time; a new one may only be submitted after the previous is REJECTED or CANCELLED (CANCELLED has no dedicated endpoint in this unit — see Key Implementation Notes).

### Changes

- **Migration** `20260827000000_add_contract_closeout_requests` — 1 new enum + 2 new tables (`contract_closeout_requests`, `contract_closeout_attachments`). Zero impact on existing contracts/rows.
- `packages/database/prisma/schema.prisma`, `packages/database/src/index.ts` — new models/enum + exports
- `packages/config/src/env/api.ts` — `CLOSEOUT_ATTACHMENTS_DIR` optional env var (default `./storage/closeout-attachments`)
- `apps/api/src/contracts/closeout-attachment-storage.service.ts` (new) — local-disk storage, reuses CM-32's size/type constants
- `apps/api/src/contracts/dto/{create,update,review,reject}-contract-closeout-request.dto.ts` (new)
- `apps/api/src/contracts/contract-closeout.service.ts` (new) — `computeCloseoutChecks`/`toRiskSnapshot` (pure, exported), full request lifecycle (create/update/review/approve/reject/closeContract) + attachments, + `.test.ts` (38 tests)
- `apps/api/src/contracts/contracts.service.ts` — `close()` gated on an APPROVED closeout request existing; `.test.ts` updated (default-approved mock + 1 new gate test)
- `apps/api/src/contracts/contracts.controller.ts` — 11 new routes under `:id/closeout/*` and `closeout/:requestId/*`
- `apps/api/src/contracts/contracts.module.ts` — registers `ContractCloseoutService`, `CloseoutAttachmentStorageService`
- `apps/web/src/lib/contracts-api.ts` — closeout types + `getCloseoutChecks()`/`listCloseoutRequests()`/`listCloseoutAttachments()`
- `apps/web/src/app/(protected)/contracts/actions.ts` — 7 new closeout Server Actions (request/review/approve/reject/close-contract/upload)
- `apps/web/src/app/(protected)/contracts/closeout/[requestId]/attachments/[attachmentId]/download/route.ts` (new) — download proxy, mirrors CM-32's pattern
- `apps/web/src/app/(protected)/contracts/_lib/contract-ui-helpers.ts` — `getClosureAction()`, `computeCloseoutWarnings()` (+11 new tests)
- `apps/web/src/app/(protected)/contracts/_components/contract-transitions.tsx` — direct "Close Contract" button removed
- `apps/web/src/app/(protected)/contracts/_components/contract-closure-action.tsx` (new) — closeout-state-aware Available Actions slot
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/page.tsx` — fetches latest closeout request, renders `ContractClosureAction` alongside `ContractTransitions`
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/closeout/page.tsx` + `_components/*` (5 new) — rewritten from static placeholder to the full readiness/warnings/request/review/attachments workflow

### Verification Results (2026-08-23)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 150/150 (+11 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 1001/1001 (+38 new, +1 changed) |
| `pnpm build` | ✓ 8/8 tasks; all new routes built including the download proxy |
| `pnpm db:migrate:status` | ✓ 25 migrations, up to date |
| Live scenarios A–L | ✓ 44/44 on the first run |
| Rendered HTML (Overview across DRAFT/pending/approved/closed states, Closeout tab across all states) | ✓ all confirmed |

### Key Implementation Notes

- API dev server restarted standalone after the service/controller/module changes — web dev server unaffected.
- **Deferred**: a dedicated `CANCELLED` transition endpoint — the task's own recommended endpoint list never lists one (only review/approve/reject/close-contract), so it wasn't added; `CANCELLED` remains a valid enum value but is only reachable by direct DB action for now. Also deferred: `PATCH /contracts/closeout/:requestId` exists but is intentionally restricted to DRAFT/SUBMITTED requests only (once review starts, remarks are considered part of the audit trail and shouldn't change); the `submit` endpoint from the spec's optional list #5 was skipped entirely since `POST .../request` creates SUBMITTED directly, exactly as the spec's own text permits ("If POST request creates submitted directly, this can be skipped").
- Scenario D (a user with `contracts.read`/`contracts.update` but explicitly *not* `contracts.close` attempting to approve/reject) was verified via the `ContractCloseoutService` unit tests (`ForbiddenException` path), not live — no seeded UAT user in this environment has that exact permission combination. Live testing instead confirmed the equivalent department-scope block (a `contracts.close` actor in the wrong department still gets 403), which exercises the same guard clause.
- `RESOLVED` issues and `REJECTED`/`ON_HOLD` workflow tasks are treated as still-open for closeout readiness purposes — a deliberately conservative choice the spec explicitly permitted either way, documented in code and in `ui-registry.md`.

## CM-32 — Workflow Operations Upgrade: Attachments, Comments, My Tasks, Delay Tracking, Kanban UI (Completed 2026-08-23)

### Summary

Upgraded Contract Workflow & Team Tasks (CM-29) from basic status tracking into a daily work-control system, per explicit business decisions: no approval flow added (team members update status directly; manager approval deferred to a future closeout unit), attachments added now, real-time means 20-second polling + instant refresh (no WebSocket/SSE). Additive migration adds `priority` (`ContractWorkflowTaskPriority` enum, default MEDIUM), `delayReason` (text), and `lastActivityAt` (backfilled from each task's existing `updatedAt`) to `contract_workflow_tasks`, plus two new tables: `ContractWorkflowTaskAttachment` (metadata + disk path only, never binary in the DB) and `ContractWorkflowTaskComment`. New `WorkflowAttachmentStorageService` writes files to a local, server-controlled folder (`WORKFLOW_ATTACHMENTS_DIR` env var, default `./storage/workflow-attachments`) using a random UUID filename per file (the original filename is never used on disk, eliminating path-traversal/overwrite risk) — no MinIO/S3 exists anywhere in this project (confirmed by audit), so this is intentionally a swappable local abstraction. Upload validation: exactly the 5 spec'd MIME types (PDF, PNG, JPEG, XLSX, DOCX), 10MB hard limit enforced via Multer's own `limits.fileSize` (bounds memory before any buffering completes) plus a redundant service-level check; both produce clean `{code, message}` errors via NestJS's automatic `MulterError` → `PayloadTooLargeException` translation and a custom `fileFilter` callback. All new comment/attachment/download endpoints re-verify department access through the parent task → contract chain on every call — live-verified that a dept-scoped user is blocked (403) from downloading, listing, commenting on, or updating another department's task, while an ALL_DEPARTMENTS actor is unaffected. Per-task Kanban cards replace the old compact list; a full-height task drawer (not a small modal, deliberately — it stays open after any save/comment/upload so the user can keep working, closed only via its own X button) hosts the update form, comments thread, and attachment list/upload/download. Two intentional, spec-directed behavior changes from CM-29: (1) `completedDate` auto-sets to today when a task reaches COMPLETED without one, instead of the old hard-reject; (2) a NEW per-task overdue definition (`computeTaskIsOverdue`, excludes only COMPLETED/APPROVED) drives the Kanban badge and is deliberately kept separate from the pre-existing contract-level `computeWorkflowProgress` overdue count (excludes COMPLETED/REJECTED, unchanged for backward compatibility) — documented in `ui-registry.md` so the two are never accidentally merged.

### Changes

- **Migration** `20260826000000_add_contract_workflow_task_upgrades` — 1 new enum + 3 additive columns on `contract_workflow_tasks` (with a data backfill, not just a schema change) + 2 new tables (`contract_workflow_task_attachments`, `contract_workflow_task_comments`). Zero impact on existing tasks/rows.
- `packages/database/prisma/schema.prisma`, `packages/database/src/index.ts` — new model/enum + exports
- `packages/config/src/env/api.ts` — `WORKFLOW_ATTACHMENTS_DIR` optional env var (default `./storage/workflow-attachments`)
- `apps/api/src/contracts/workflow-attachment-storage.service.ts` (new) — local-disk storage abstraction, 10MB limit, 5-type allowlist
- `apps/api/src/contracts/dto/create-contract-workflow-task-comment.dto.ts`, `get-contract-workflow-query.dto.ts` (new); `update-contract-workflow-task.dto.ts` (+priority/delayReason), `contract-workflow-list-query.dto.ts` (+myTasksOnly/taskStatus/responsibleUserId)
- `apps/api/src/contracts/contract-workflow.service.ts` — `computeTaskIsOverdue`, `resolveWorkflowTaskCompletedDate`, `withTaskDerivedFields`, `myOpenTasks`/`myTasksOnly`/`taskStatus`/`responsibleUserId` filtering in `findAll`, `myTasksOnly` support in `getWorkflowForContract`, `listComments`/`addComment`/`listAttachments`/`createAttachment`/`getAttachmentForDownload` + `.test.ts` (72 tests, +37 new/changed)
- `apps/api/src/contracts/contracts.controller.ts` — 5 new routes: `GET/POST workflow/tasks/:taskId/comments`, `GET/POST workflow/tasks/:taskId/attachments`, `GET workflow/tasks/:taskId/attachments/:attachmentId/download` (via `FileInterceptor` + `StreamableFile`)
- `apps/api/src/contracts/contracts.module.ts` — registers `WorkflowAttachmentStorageService`
- `apps/web/src/lib/contracts-api.ts` — extended `ContractWorkflowTask` (priority/delayReason/lastActivityAt/attachmentsCount/commentsCount/isOverdue), new `ContractWorkflowTaskComment`/`ContractWorkflowTaskAttachment` types, `myOpenTasks` in summary, `listWorkflowTaskComments()`/`listWorkflowTaskAttachments()`
- `apps/web/src/app/(protected)/contracts/actions.ts` — extended `updateWorkflowTaskAction` (+priority/delayReason), new `addWorkflowTaskCommentAction`, `uploadWorkflowTaskAttachmentAction` (multipart via a new `actionFetchMultipart` helper)
- `apps/web/src/app/(protected)/contracts/workflow/tasks/[taskId]/{comments,attachments}/route.ts` (new) — client-fetchable JSON proxies for the task drawer (a `'use client'` component that cannot call `contractsApi` directly)
- `apps/web/src/app/(protected)/contracts/workflow/tasks/[taskId]/attachments/[attachmentId]/download/route.ts` (new) — streams the file through with forwarded headers
- `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-task-priority-badge.tsx`, `workflow-task-card.tsx`, `workflow-task-drawer.tsx`, `workflow-polling-refresher.tsx` (new); `workflow-board.tsx` (rewritten for Kanban cards + drawer), `workflow-summary-cards.tsx` (+My Open Tasks, relabeled per spec), `workflow-filter-bar.tsx` (+Task Status/Responsible Person/My Tasks only), `workflow-contract-table.tsx` (columns aligned to spec); `workflow-update-task-modal.tsx` deleted (superseded by the drawer)
- `apps/web/src/app/(protected)/contracts/workflow/page.tsx`, `apps/web/src/app/(protected)/contracts/[id]/(workspace)/workflow/page.tsx` — rewritten for the new filters/cards/board/polling/My-Tasks-toggle

### Verification Results (2026-08-23)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 139/139 (unchanged — this unit's new logic is server-side/component-level, not covered by new web unit tests) |
| `pnpm --filter @recafco/api test --run` | ✓ 962/962 (+72 workflow service tests, was 68 in CM-29/CM-30/CM-31 sessions, +37 net new/changed for CM-32) |
| `pnpm build` | ✓ 8/8 tasks; all new routes built including the 3 proxy/download route handlers |
| `pnpm db:migrate:status` | ✓ 24 migrations, up to date |
| Live scenarios A–L | ✓ 36/38 on first pass; the 2 "failures" (Scenario I) were the same pre-existing "null-department visible to everyone" test artifact seen in every prior unit this session — re-verified 10/10 against a contract with an explicit department, confirming real cross-department blocking on download/list-comments/list-attachments/update/add-comment, with ALL_DEPARTMENTS access unaffected |
| Proxy routes (what the browser's task drawer actually calls) | ✓ comments/attachments JSON proxies and the download stream all verified end-to-end with correct `Content-Type`/`Content-Disposition` headers |

### Key Implementation Notes

- API dev server restarted standalone after the service/controller/module changes — web dev server unaffected.
- No manager-approval workflow was added anywhere in this unit (explicit business decision) — `updateTask()` still allows direct status changes by any `contracts.update` actor, unchanged from CM-29's permission model.
- Chose to keep the task drawer open after Save/Comment/Upload (unlike the small close-on-success modals used in CM-28/29/30/31's Payments/Issues/Claims) since it's a richer, session-oriented panel; `openTaskId` (not a task snapshot) drives the drawer so it always reflects the latest `tasks` prop after a `router.refresh()`.
- Deferred: `DELETE` attachment endpoint (task spec explicitly permits reporting this as future work when no existing soft-delete pattern exists in the schema to reuse — none does, checked across all prior units); polling interval timing itself could only be verified by code review + one manual two-call diff (no way to drive two independent browser sessions in this environment), consistent with this session's established "no browser automation tool" limitation noted since CM-26.

## CM-31 — Contract Claim Log Backend + Filter/Print/Export (Completed 2026-08-23)

### Summary

Converted the module-level `/contracts/claims` placeholder into a real Claim Register spanning all contracts (distinct from the per-contract `/contracts/[id]/claims` Claims Registry tab, which now reads the same backend filtered to one contract) — same architecture as CM-28 (Payments), CM-29 (Workflow), and CM-30 (Issues). New additive `ContractClaim` model with `ContractClaimType` (7 values) and `ContractClaimStatus` (10 values) enums, `NUMERIC(18,3)` value columns. No hard delete — closing/settling goes through `status = CLOSED`/`SETTLED` (dedicated `PATCH /claims/:claimId/close` accepting an optional `{status: 'CLOSED'|'SETTLED'}` body, defaulting to CLOSED). `outstandingValue` (`submittedValue - approvedValue`) and `overdueDays`/`isOverdue` are never stored — always computed fresh in the service. Two distinct status groupings are deliberately kept separate: `OVERDUE_EXCLUDED_STATUSES` (SETTLED/CLOSED/CANCELLED/REJECTED — APPROVED is NOT excluded, since an approved claim can still be overdue if the follow-up action like payment hasn't happened) versus `FINAL_STATUSES` for the Open Claims summary count (APPROVED/REJECTED/SETTLED/CLOSED/CANCELLED — an approved claim is no longer "open" even if still overdue). This is an intentional, spec-directed distinction, not an inconsistency. Summary totals (Open Claims, Submitted Value, Approved Value, Outstanding Value, Overdue Claims, Closed/Settled Claims) are computed over the full filtered result set. Reuses `contracts.read`/`contracts.update` — no new RBAC permissions. Department scope enforced identically to CM-28/29/30 (AND-combined scope filter + explicit filter, verified live in both directions). Cross-field validation added per spec: `approvedValue` cannot exceed `submittedValue` (rejected, not clamped), `dueDate` cannot be before `claimDate`, EOT days must be non-negative integers, `responsibleUserId` validated against a real user. All 40 live verification checks passed on the first run (no bugs found, unlike CM-30 where two were caught late) — attributed to directly reusing CM-30's now-corrected `raisedDate`/`responsibleUserId` patterns from the start rather than re-deriving them.

### Changes

- **Migration** `20260825000000_add_contract_claims` — 2 new enums + `contract_claims` table (FKs to `contracts` and `users`, `UNIQUE(contract_id, claim_no)` allowing multiple NULLs, 3 indexes). Zero impact on existing contracts/rows.
- `packages/database/prisma/schema.prisma`, `packages/database/src/index.ts` — new model/enums + exports
- `apps/api/src/contracts/dto/{create,update}-contract-claim.dto.ts`, `close-contract-claim.dto.ts`, `contract-claim-list-query.dto.ts` (new)
- `apps/api/src/contracts/contract-claims.service.ts` (new) + `.test.ts` (new, 57 tests) — list/create/update/close-or-settle, derived outstanding/overdue fields, summary computation
- `apps/api/src/contracts/contracts.controller.ts` — `GET /contracts/claims` (declared before `:id`), `POST /contracts/:id/claims`, `PATCH /contracts/claims/:claimId`, `PATCH /contracts/claims/:claimId/close`
- `apps/api/src/contracts/contracts.module.ts` — registers `ContractClaimsService`
- `apps/web/src/lib/contracts-api.ts` — claim types + `listClaims()`
- `apps/web/src/app/(protected)/contracts/actions.ts` — `createClaimAction`, `updateClaimAction`, `closeClaimAction` (accepts a `targetStatus` of `CLOSED` or `SETTLED`)
- `apps/web/src/app/(protected)/contracts/_lib/contract-ui-helpers.ts` — `CONTRACT_CLAIM_TYPE_OPTIONS`, `CONTRACT_CLAIM_STATUS_OPTIONS` (client-safe constants, same reasoning as `CONTRACT_ISSUE_CATEGORIES` in CM-30)
- `apps/web/src/app/(protected)/contracts/_lib/contract-claim-csv.ts` (new) + `.test.ts` (new, 4 tests) — reuses `csvField` from `contract-payment-csv.ts`
- `apps/web/src/app/(protected)/contracts/claims/page.tsx` — rewritten from placeholder to full register (title "Claim Log", 6 summary cards, filter bar, table, pagination)
- `apps/web/src/app/(protected)/contracts/claims/_components/*` (new) — summary cards, status/type badges, filter bar, register table (`fixedContractId`/`compact` props for tab reuse, Settle + Close as two distinct actions), Add/Edit modal, actions bar
- `apps/web/src/app/(protected)/contracts/claims/export/route.ts` (new) — filtered CSV download, mirrors `issues/export/route.ts`
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/claims/page.tsx` — rewritten to show real per-contract data via the same endpoint with `contractId` filter

### Verification Results (2026-08-23)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 139/139 tests (+4 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 925/925 tests (+57 new) |
| `pnpm build` | ✓ 8/8 tasks; `/contracts/claims`, `/contracts/claims/export`, `/contracts/[id]/claims` built cleanly |
| `pnpm db:migrate:status` | ✓ 23 migrations, up to date |
| Live scenarios A–J | ✓ 40/40 — all passed on the first run |
| Rendered HTML: module page, per-contract tab, dept-scoped user, export CSV content match | ✓ all confirmed via direct fetch |

### Key Implementation Notes

- API dev server restarted standalone after adding the new service/controller routes/module wiring — web dev server unaffected.
- Applied the CM-30 client/server-boundary lesson proactively this time: `CONTRACT_CLAIM_TYPE_OPTIONS`/`CONTRACT_CLAIM_STATUS_OPTIONS` were placed directly in `contract-ui-helpers.ts` from the start rather than in `contracts-api.ts`, avoiding the Turbopack build failure entirely instead of discovering and fixing it after the fact.
- Same visual/interactive-modal caveat as CM-28/29/30: no browser automation tool available, so the Add/Edit/Close/Settle modal was verified via the underlying REST endpoints directly (live script, 40/40 passing) plus rendered-HTML fetches of both the module page and the per-contract tab.

## CM-30 — Contract Issue Log Backend + Filter/Print/Export (Completed 2026-08-23)

### Summary

Converted the module-level `/contracts/issues` placeholder into a real Issue Register spanning all contracts (distinct from the per-contract `/contracts/[id]/issues` workspace tab, which now reads the same backend filtered to one contract) — same architecture as CM-28 (Payments) and CM-29 (Workflow). New additive `ContractIssue` model with `ContractIssuePriority` (LOW/MEDIUM/HIGH/CRITICAL) and `ContractIssueStatus` (OPEN/IN_PROGRESS/WAITING_RESPONSE/RESOLVED/CLOSED/CANCELLED) enums; `category` is a plain string validated against a controlled 9-item list rather than a DB enum, for flexibility. No hard delete — closing goes through `status = CLOSED` (dedicated `PATCH /issues/:issueId/close` action, or via the general update endpoint). `overdueDays`/`isOverdue` are never stored — always computed fresh in the service from `dueDate` vs. today, only when status isn't CLOSED/RESOLVED/CANCELLED. Summary totals (Total/Open/In Progress/High+Critical/Overdue/Closed) are computed over the full filtered result set, not just the current page — same dual paginated+summary query pattern as CM-28/29. Reuses `contracts.read`/`contracts.update` — no new RBAC permissions. Department scope enforced identically to CM-28/29 (AND-combined scope filter + explicit filter, verified live in both directions). Two real backend bugs were found and fixed during live verification before this report: (1) `create()` originally defaulted `raisedDate` to today when omitted, which made it impossible to log an issue with only a past `dueDate` (exactly what Scenario A requires) — fixed by leaving `raisedDate` unset unless the caller provides it; (2) `create()` never validated `responsibleUserId` against a real user (unlike `update()`, which already did), letting a bad UUID crash through to the database's foreign-key constraint as a raw 500 — fixed by copying the same validation block into `create()`.

### Changes

- **Migration** `20260824000000_add_contract_issues` — 2 new enums + `contract_issues` table (FKs to `contracts` and `users`, `UNIQUE(contract_id, issue_no)` allowing multiple NULLs, 3 indexes). Zero impact on existing contracts/rows.
- `packages/database/prisma/schema.prisma`, `packages/database/src/index.ts` — new model/enums + exports
- `apps/api/src/contracts/dto/{create,update}-contract-issue.dto.ts`, `contract-issue-list-query.dto.ts` (new)
- `apps/api/src/contracts/contract-issues.service.ts` (new) + `.test.ts` (new, 49 tests) — list/create/update/close, derived overdue fields, summary computation
- `apps/api/src/contracts/contracts.controller.ts` — `GET /contracts/issues` (declared before `:id`), `POST /contracts/:id/issues`, `PATCH /contracts/issues/:issueId`, `PATCH /contracts/issues/:issueId/close`
- `apps/api/src/contracts/contracts.module.ts` — registers `ContractIssuesService`
- `apps/web/src/lib/contracts-api.ts` — issue types + `listIssues()`
- `apps/web/src/app/(protected)/contracts/actions.ts` — `createIssueAction`, `updateIssueAction`, `closeIssueAction`
- `apps/web/src/app/(protected)/contracts/_lib/contract-ui-helpers.ts` — `CONTRACT_ISSUE_CATEGORIES` (client-safe constant; see Key Implementation Notes for why it lives here and not in `contracts-api.ts`)
- `apps/web/src/app/(protected)/contracts/_lib/contract-issue-csv.ts` (new) + `.test.ts` (new, 4 tests) — reuses `csvField` from `contract-payment-csv.ts` rather than duplicating it
- `apps/web/src/app/(protected)/contracts/issues/page.tsx` — rewritten from placeholder to full register (title "Contract Issue Log", 6 summary cards, filter bar, table, pagination)
- `apps/web/src/app/(protected)/contracts/issues/_components/*` (new) — summary cards, status/priority badges, filter bar, register table (`fixedContractId`/`compact` props for tab reuse), Add/Edit modal, actions bar
- `apps/web/src/app/(protected)/contracts/issues/export/route.ts` (new) — filtered CSV download, mirrors `payments/export/route.ts`
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/issues/page.tsx` — rewritten to show real per-contract data via the same endpoint with `contractId` filter

### Verification Results (2026-08-23)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 135/135 tests (+4 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 868/868 tests (+47 new) |
| `pnpm build` | ✓ 8/8 tasks; `/contracts/issues`, `/contracts/issues/export`, `/contracts/[id]/issues` built cleanly |
| `pnpm db:migrate:status` | ✓ 22 migrations, up to date |
| Live scenarios A–J | ✓ 35/36 (one "failure" was a stale test-script assertion for the old, intentionally-removed `raisedDate` auto-default behavior, not a product bug) |
| Rendered HTML: module page, per-contract tab, dept-scoped user | ✓ all confirmed via direct fetch — correct title/subtitle/summary/data, and other-department issue correctly absent from the dept-scoped user's page |

### Key Implementation Notes

- API dev server restarted standalone twice in this unit (once for initial routes, once after the two bugfixes) — web dev server unaffected both times.
- Reconfirmed a Turbopack client/server-boundary gotcha first seen conceptually in earlier units: `contracts-api.ts` imports `next/headers` at module scope, so any *runtime value* (not type) exported from it and imported into a `'use client'` component pulls the whole server-tainted module into the client bundle and fails the build. `CONTRACT_ISSUE_CATEGORIES` had to live in the dependency-free `contract-ui-helpers.ts` instead, even though `contracts-api.ts` is otherwise the natural home for API-shaped constants. Type-only imports are unaffected.
- Same visual/interactive-modal caveat as CM-28/29: no browser automation tool available, so the Add/Edit/Close modal was verified via the underlying REST endpoints directly (live script, 35/36 passing) plus rendered-HTML fetches of both the module page and the per-contract tab, not a live click-through.

## CM-29 — Workflow & Team Tasks Register + Real-Time Task Updates (Completed 2026-08-23)

### Summary

Converted the static "Not started" Workflow & Team Tasks tab into a real backend-driven system, plus a new module-level `/contracts/workflow` register (same pattern as CM-28's Payments register). New additive `ContractWorkflowTask` model with `ContractWorkflowTeam` (TECHNICAL/PRODUCTION/ERECTION/QS_COMMERCIAL) and `ContractWorkflowTaskStatus` (8 states) enums. Tasks are never pre-populated by the migration — they're lazily generated the first time a contract's workflow is viewed (`GET /contracts/:id/workflow`), from pure, fully-unit-tested scope-decision rules in `contract-workflow-templates.ts` (Technical needs Shop Drawing or Production Drawings; Production needs Production; Erection needs Delivery or Erection but never when Ex-Factory is set; QS/Commercial needs payment terms or a contract value, unless Not Applicable is set) — idempotent via a `(contractId, taskKey)` unique constraint, so re-viewing never duplicates. No dates or responsible persons are ever invented. A conservative additive-only `POST /contracts/:id/workflow/regenerate` endpoint can add newly-applicable default tasks (e.g. after a scope change) but structurally cannot overwrite or remove anything that already exists. Reuses `contracts.read`/`contracts.update` — no new RBAC permissions. Department scope enforced identically to CM-28 (AND-combined scope + explicit filter, verified live both for a list-visibility case and a direct-access-blocked case). "Real-time" for this unit means immediate save via server action + `router.refresh()` — no WebSocket/SSE (none exists in this project); true live push is a future enhancement.

### Changes

- **Migration** `20260823000000_add_contract_workflow_tasks` — 2 new enums + `contract_workflow_tasks` table (FKs to `contracts` and `users`, `UNIQUE(contract_id, task_key)`, 3 indexes). Zero impact on existing contracts/rows.
- `packages/database/prisma/schema.prisma`, `packages/database/src/index.ts` — new model/enums + exports
- `apps/api/src/contracts/dto/update-contract-workflow-task.dto.ts`, `contract-workflow-list-query.dto.ts` (new)
- `apps/api/src/contracts/contract-workflow-templates.ts` (new) + `.test.ts` (new, 22 tests) — pure scope-decision logic
- `apps/api/src/contracts/contract-workflow.service.ts` (new) + `.test.ts` (new, 35 tests) — list/get-or-init/regenerate/update
- `apps/api/src/contracts/contracts.controller.ts` — `GET /contracts/workflow` (declared before `:id`), `GET /contracts/:id/workflow`, `POST /contracts/:id/workflow/regenerate`, `PATCH /contracts/workflow/tasks/:taskId`
- `apps/api/src/contracts/contracts.module.ts` — registers `ContractWorkflowService`
- `apps/web/src/app/(protected)/_components/sidebar.tsx` — "Workflow & Team Tasks" added between Schedule and Payments (`/contracts/workflow`)
- `apps/web/src/lib/contracts-api.ts` — workflow types + `listWorkflow()`/`getWorkflow()`
- `apps/web/src/app/(protected)/contracts/actions.ts` — `updateWorkflowTaskAction`
- `apps/web/src/app/(protected)/contracts/_lib/contract-ui-helpers.ts` — new `formatScopeSummary()` helper (+4 tests)
- `apps/web/src/app/(protected)/contracts/workflow/page.tsx` (new) — module-level register: summary cards, filters, contract table, selected-contract header, team task board
- `apps/web/src/app/(protected)/contracts/workflow/_components/*` (new) — summary cards, filter bar, contract table, contract header, board, task/contract status badges, update-task modal
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/workflow/page.tsx` — rewritten to use the same backend/board, no more static lanes

### Verification Results (2026-08-23)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 131/131 tests (+4 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 821/821 tests (+57 new) |
| `pnpm build` | ✓ 8/8 tasks; `/contracts/workflow` built cleanly |
| `pnpm db:migrate:status` | ✓ 21 migrations, up to date |
| Live scenarios A–G | ✓ 36/36 (one initial "failure" was a test-script artifact — a null-department contract is intentionally visible to everyone under the existing, already-audited `DepartmentAccessService` rules; re-verified Scenario F correctly blocks access to a contract with an explicit *different* department) |

### Key Implementation Notes

- API dev server restarted standalone after adding the new service/controller routes/module wiring — web dev server unaffected.
- Same visual/interactive-modal caveat as CM-28: no browser automation tool available, so the Update Task modal was verified via the underlying REST endpoints directly plus careful code review of the `useActionState` + `form="workflow-task-form"` wiring, not a live click-through.

## CM-28 — Contract Payments Register Backend + Filter/Print/Export (Completed 2026-08-20)

### Summary

Converted the module-level `/contracts/payments` placeholder into a real Payments Register spanning all contracts (distinct from the per-contract `/contracts/[id]/payments` workspace tab). New additive `ContractPayment` model/table with a `ContractPaymentStatus` enum (DRAFT/SUBMITTED/CERTIFIED/PARTIALLY_PAID/PAID/OVERDUE/CANCELLED), `NUMERIC(18,3)` amount columns, no hard delete (cancel = status update). `outstandingAmount` and `overdueDays` are never stored — always computed in the service/response from `certifiedAmount ?? submittedAmount` minus `paidAmount`, and `today − dueDate` when unpaid and past due, respectively. New `ContractPaymentsService` (list with filters + department-scope enforcement + full-filtered-set summary totals, create, update/cancel) reuses the existing `contracts.read`/`contracts.update` permissions — no new RBAC codes added. Department scoping combines the actor's scope filter with any explicit department filter via `AND` (stricter than, and consistent with, the existing contracts-list overwrite pattern — never wider). Frontend: summary cards, a full filter bar (search, contract, company, status, department, manager, invoice/due date ranges, overdue-only), an Add/Edit Payment modal (no hard delete — Cancel sets status), Print (browser print-to-PDF layout via `@media print`), and Export Excel as a filtered CSV (no xlsx/pdf library exists in this project, so CSV + print-to-PDF is the deliberate "first version" per the task's explicit instruction not to add a heavy dependency without approval). The individual contract payments tab was safely converted from static placeholder rows to a real read-only view sourced from the same `GET /contracts/payments?contractId=` endpoint — pure read reuse, no new write paths, judged safe rather than left as a follow-up.

### Changes

- **Migration** `20260822000000_add_contract_payments` — new `contract_payment_status` enum + `contract_payments` table (FKs to `contracts` and `users`, `UNIQUE(contract_id, payment_no)` allowing multiple NULLs, 3 indexes). Zero impact on existing contracts/rows.
- `packages/database/prisma/schema.prisma`, `packages/database/src/index.ts` — new model/enum + exports
- `apps/api/src/contracts/dto/{create,update}-contract-payment.dto.ts`, `contract-payment-list-query.dto.ts` (new)
- `apps/api/src/contracts/contract-payments.service.ts` (new) + `contract-payments.service.test.ts` (new, 39 tests)
- `apps/api/src/contracts/contracts.controller.ts` — `GET /contracts/payments` (declared before `:id`, same reason as `summary`/`people`), `POST /contracts/:id/payments`, `PATCH /contracts/payments/:paymentId`
- `apps/api/src/contracts/contracts.module.ts` — registers `ContractPaymentsService`
- `apps/web/src/lib/contracts-api.ts` — `ContractPayment`/`ContractPaymentSummary`/list-query types + `listPayments()`
- `apps/web/src/app/(protected)/contracts/actions.ts` — `createPaymentAction`, `updatePaymentAction`, `cancelPaymentAction`
- `apps/web/src/app/(protected)/contracts/payments/page.tsx` — rewritten from placeholder to full register
- `apps/web/src/app/(protected)/contracts/payments/_components/*` (new) — summary cards, filter bar, status badge, register table, Add/Edit modal, actions bar
- `apps/web/src/app/(protected)/contracts/payments/export/route.ts` (new) — filtered CSV download; first Route Handler in the web app
- `apps/web/src/app/(protected)/contracts/_lib/contract-payment-csv.ts` (new) + `.test.ts` (new, 8 tests) — extracted CSV building/escaping for testability, matching this codebase's established `_lib` pattern
- `apps/web/src/app/(protected)/contracts/[id]/(workspace)/payments/page.tsx` — rewritten to show real per-contract data via the same endpoint (read-only; Add/Edit still happens in the module register)

### Verification Results (2026-08-20)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 127/127 tests (+8 new) |
| `pnpm --filter @recafco/api test --run` | ✓ 764/764 tests (+39 new) |
| `pnpm build` | ✓ 8/8 tasks; new routes `/contracts/payments`, `/contracts/payments/export` built cleanly |
| `pnpm db:migrate:status` | ✓ 20 migrations, up to date |
| Live scenarios A–H (create/derived fields, status/company/contract filters, invalid-amount and duplicate-paymentNo rejection, cancel-not-delete, dept isolation both directions, CSV export respects filters, empty states, individual-tab reuse) | ✓ 19/20 automated (1 "failure" was a test-script assumption error, not a product bug — re-verified passing) |

### Key Implementation Notes

- API dev server restarted standalone (`pnpm --filter @recafco/api dev`) after adding the new service/controller routes/module wiring — plain `ts-node` process, no hot reload, web dev server unaffected.
- No visual/interactive browser test of the Add/Edit modal was possible (no browser automation tool in this environment, same limitation noted in the CM-26 modal-polish unit) — confidence comes from the underlying REST endpoints being directly verified live, clean build/typecheck/lint, and careful code review of the `useActionState` + `form="payment-form"` wiring.

## CM-26 — Contract Management Sidebar Navigation Cleanup (Completed 2026-08-20)

### Summary

Note: this unit shares the "CM-26" code with the New Contract Register Modal UI/UX Polish unit logged just below — both were dated 2026-08-20 and are kept as separate entries since they touch different files. No backend/schema changes. Removed the duplicate top-level "Dashboard" link and the "Operations" grouping for Contract-Management-only users (`isContractManagementOnlyAccess()`, already existed in `module-visibility.ts`): they now see a single flat "Contract Management" section with no dropdown/chevron, listing all 6 items directly. Admin/Super Admin (and any user with more than just Contract Management) keep the existing nested "Contract Management" dropdown under "Operations," now with the same 6 items. Extended `CONTRACT_ITEMS` from 2 to 6 entries (Dashboard, Contract List, Schedule, Payments, Issue Log, Claim Log) and rewrote `isContractItemActive()` — the old 2-item version treated "not the dashboard" as "must be Contract List," which would have made all 4 new sibling pages incorrectly highlight Contract List as active; the new version matches each item on its own path and only falls through to Contract List for pathnames whose first segment isn't one of the 5 fixed module-level slugs (correctly still covering `/contracts/new` and `/contracts/{id}/...`). Added 4 new placeholder pages (`/contracts/schedule`, `/payments`, `/issues`, `/claims`) via a shared `ContractPlaceholderPage` component — plain "Not started" copy only, no backend calls, no fake data — each gated by a `contracts.read` permission check (`notFound()` otherwise), since these pages have no API call of their own to fall back on for authorization the way existing contract pages do.

### Changes

- `apps/web/src/app/(protected)/_components/sidebar.tsx` — `CONTRACT_ITEMS` extended to 6 items; `isContractItemActive()` rewritten; flat top-level "Contract Management" section added for `isContractManagementOnlyAccess()` users; top "Dashboard" link and nested Operations nesting suppressed for that same case
- `apps/web/src/app/(protected)/contracts/_components/contract-placeholder-page.tsx` (NEW) — shared placeholder shell
- `apps/web/src/app/(protected)/contracts/{schedule,payments,issues,claims}/page.tsx` (NEW, 4 files) — permission-gated placeholder pages

### Verification Results (2026-08-20)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 119/119 tests (unchanged) |
| `pnpm build` | ✓ 8/8 tasks; 4 new routes built (`/contracts/schedule`, `/payments`, `/issues`, `/claims`) with no static/dynamic route conflicts |
| Live: CM-only user (`cm18e.uat`) sidebar — flat "Contract Management" section, no top Dashboard, no dropdown, no other modules | ✓ |
| Live: Admin (`test.manager`) sidebar — unchanged Operations/nested dropdown, all modules, 6 contract items | ✓ |
| Live: active-state highlighting on all 6 contract routes + `/contracts` + `/contracts/dashboard` | ✓ 6/6 |
| Live: all 4 new pages render exact required copy, "Not started" badge, no fake data | ✓ |
| Live: unauthenticated request → 307 redirect (existing protected-layout guard, unaffected) | ✓ |

### Key Implementation Notes

- All seeded UAT test accounts (`test.manager`, `test.operator`, `test.selected`, `test.nodept`) carry a broad role that includes `contracts.read`, so the negative half of Scenario D (a logged-in user with no contract permission hitting the new pages) could not be exercised live without creating new test data — verified by code review instead: the `notFound()` guard uses the exact same `permissions.includes('contracts.read')` pattern already used and tested throughout this module (e.g. `canCreate`/`canUpdate` in `contracts/page.tsx`).

## CM-26 — New Contract Register Modal UI/UX Polish (Completed 2026-08-20)

### Summary

Pure UI/UX unit — no backend, DTO, service, or schema changes. Widened the New Contract Register modal (`w-[min(96vw,1320px)]`/`max-h-[90vh]` → `w-[min(94vw,1700px)]`/`h-[92vh]`) so it reads as a workspace rather than a cramped dialog. Split the previously-inline "Actions" section card out of the modal's scrollable body into a genuinely sticky footer (`shrink-0` flex row below the `overflow-y-auto` body, inside the same `<form>`) so Cancel/Save Draft/Create Draft Contract and the BOQ/validation error banner stay visible regardless of scroll position; the page route (`/contracts/new`) keeps the numbered Section 10 card unchanged. Tightened `SectionCard` spacing (`p-6`→`p-5 sm:p-6`, added a `border-b` under each heading, bumped heading to `text-base`) and reduced inter-section spacing (`space-y-6`→`space-y-5`) for less wasted vertical space. Widened BOQ table columns to fit the wider modal (`min-w-[1400px]`, Description `min-w-[240px]`, Concrete Grade/Unit Price bumped to `w-28`, explicit `w-14` on the Action column), strengthened the header row (`border-b-2 border-border-strong`), and gave the Total Amount a bordered card treatment at `text-base` for visibility. All changes are Tailwind className edits only — no state, handlers, field `name`/`id` attributes, or business logic touched, so Add/Remove item, total calculation, validation, and submit behavior are provably unchanged.

### Changes

- `apps/web/src/app/(protected)/contracts/_components/new-contract-register-modal.tsx` — dialog width/height
- `apps/web/src/app/(protected)/contracts/new/_components/new-contract-form.tsx` — `SectionCard` spacing, sticky footer for `layout="modal"` (shared with `/contracts/new` page layout, which keeps its inline Section 10)
- `apps/web/src/app/(protected)/contracts/_components/contract-boq-table.tsx` — column widths, header contrast, Total Amount styling

### Verification Results (2026-08-20)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 119/119 tests (unchanged) |
| `pnpm build` | ✓ 8/8 tasks |
| Structural HTML regression check (`/contracts/new`, all section headings/BOQ columns/buttons/helper text/new width classes present) | ✓ |

### Key Implementation Notes

- No browser automation tool is available in this environment — visual/interactive confirmation of the modal itself wasn't possible. Confidence instead comes from: the modal shares 100% of its section JSX with the already-verified `/contracts/new` page route (only the wrapping — scrollable body vs. natural flow, sticky footer vs. inline — differs); the edits were exclusively `className` changes (no state/handler/attribute changes); and a clean production build.

## CM-25 — Save Draft and Register Contract UX (Completed 2026-08-20)

### Summary

Audit-driven UX unit — no schema, DTO, or service changes. Confirmed `ContractsService.create()` always writes `ContractStatus.DRAFT` (no separate draft/register backend status exists, per design) and that BOQ validation (description required, positive qty, non-negative price, duplicate item-code rejection) is already enforced both client-side (`validateBoqRows`) and server-side. Reworded `new-contract-form.tsx` so the UI stops implying the contract becomes active/registered on creation: "Register Contract" → "Create Draft Contract" (primary), and the previously-disabled "Save Draft" button is now enabled (secondary). Both buttons submit the same `<form>` to the same `createContractAction`/`ContractsService.create()` and therefore produce an identical Draft contract today — documented inline in code and in the unit report rather than inventing a backend distinction that doesn't exist. Added the required helper text near the action buttons clarifying that both stay in Draft and that Activate Contract (a separate lifecycle action) is the next step. Searched the whole Contract Management UI for "Register Contract"/"Registered"/"Submitted Contract"/"SAP"/"Planned" — only the New Contract form's own copy was misleading; all other "Register" occurrences are the module's own naming (Contract Register, Risk Register, Team Task Register) and were left untouched.

### Changes

- `apps/web/src/app/(protected)/contracts/new/_components/new-contract-form.tsx` — button labels/behavior, helper text; no backend changes

### Verification Results (2026-08-20)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 119/119 tests (unchanged) |
| `pnpm --filter @recafco/api test --run` | ✓ 725/725 tests (unchanged — no backend touched) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 19 migrations, up to date (no new migration) |
| Live scenarios A–G (minimum-fields draft, full-data draft, duplicate BOQ code, Ex-Factory/Erection conflict, edit Save Changes, dept-scoped user) | ✓ 15/15 API checks + button/text checks on rendered HTML |

## CM-24 — Required Contract Information and Erection/Crane Fields (Completed 2026-08-20)

### Summary

Added reviewer-requested Contract fields (client contact, forecast completion date, original vs. current contract value, project/site/scope details, and erection/crane details) to both New Contract Register and Edit Contract, plus extended Scope of Work with `other`/`notApplicable` options. Continues the CM-18E→CM-23B contract module hardening work (not separately logged in this tracker prior to this entry).

### Changes

- **Migration** `20260821000000_add_contract_client_dates_value_scope_crane_fields` — 15 additive nullable columns on `contracts` (clientContactName/Phone, forecastCompletionDate, originalContractValue/Currency, projectSiteLocation, scopeDescription, scopeExclusions, deliverables, milestones, scheduleSummary, quantitiesSpecifications, craneRequired, craneProvidedBy, estimatedCraneCapacity)
- `CreateContractDto`/`UpdateContractDto` — new fields + `CRANE_REQUIRED_OPTIONS`/`CRANE_PROVIDED_BY_OPTIONS`; `scopeOfWork` widened to `Record<string, boolean | string>` to carry `otherDescription`
- `ContractsService` — `assertScopeOfWorkValid()` extended (Not Applicable conflicts with any other option; Other requires `otherDescription`); new `assertCraneFieldsValid()` (crane fields require Erection in scope, including on update where erection state may come from existing stored data); `originalContractValue`/`originalCurrency` default to the initial `contractValue`/`currency` on create when not supplied
- Frontend: new shared `contract-form-fields.tsx` field-group components consumed identically by New Contract Register and Edit Contract; `ScopeOfWorkFieldset` enforces Ex-Factory/Not Applicable/Other mutual exclusivity client-side; Erection/Crane section conditional on Erection being selected; Contract Detail Overview shows all new fields (`—` when empty) via `ContractRegisterDetailsCard`, new `ContractScopeDetailsCard`, and conditional `ContractCraneDetailsCard`; Contract List "Full View" gained End Date, Forecast Completion (fixed a pre-existing mislabeled column that was rendering End Date under that header), Original Value, Site Location

### Verification Results (2026-08-20)

| Command | Result |
|---|---|
| `pnpm lint` | ✓ 0 errors |
| `pnpm typecheck` | ✓ 0 errors (12/12 tasks) |
| `pnpm --filter @recafco/web test --run` | ✓ 119/119 tests |
| `pnpm --filter @recafco/api test --run` | ✓ 725/725 tests (16 new) |
| `pnpm build` | ✓ 8/8 tasks |
| `pnpm db:migrate:status` | ✓ 19 migrations, up to date |
| Live API scenario checks (create/update, scope conflicts, crane/erection, defaulting) | ✓ 19/19 |

### Key Implementation Notes

- API dev server (`node -r ts-node/register src/main.ts`) has no hot reload — must be restarted standalone (`pnpm --filter @recafco/api dev`) after service/DTO changes before live verification; killing only that PID does not affect the standalone web dev server
- `originalContractValue` is only auto-defaulted on **create**, never on **update**, to avoid silently overwriting a value the user intentionally left unset

## Risks

- Incomplete module requirements
- Undocumented SAP customizations
- Unknown server capacity
- Existing maintenance migration risk
- Dependence on external SAP consultant
- Pressure to make unfinished workflows appear complete
