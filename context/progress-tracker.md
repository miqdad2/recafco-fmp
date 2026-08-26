# Progress Tracker

## Current Status

- **Project:** RECAFCO Factory Management Platform
- **Short name:** RECAFCO FMP
- **Phase:** Platform Hardening / Deployment Ready
- **Last completed:** CM-53 — Manager Workflow Task Review Drawer Upgrade (2026-08-26)
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
