# RECAFCO FMP — Endpoint–Permission Matrix

All API endpoints require `JwtAuthGuard` + `PermissionGuard` unless noted otherwise.
Auth endpoints are public or require only a valid JWT (no specific permission code).

> **Format**: `METHOD /path` — `permission.code`

---

## Auth (`/auth`)

| Endpoint | Guard | Notes |
|----------|-------|-------|
| `POST /auth/login` | `IpThrottleGuard` | Rate-limited by IP; no JWT required |
| `POST /auth/refresh` | `IpThrottleGuard` | Rotates tokens using refresh cookie |
| `POST /auth/logout` | None | Clears session from DB; accepts expired tokens |
| `GET /auth/me` | `JwtAuthGuard` + `@AllowMustChangePassword` | Returns current user profile |
| `POST /auth/change-password` | `JwtAuthGuard` + `@AllowMustChangePassword` | Works even when `mustChangePassword=true` |

---

## Health (no auth)

| Endpoint | Guard | Notes |
|----------|-------|-------|
| `GET /health` | None | Always 200 |
| `GET /ready` | None | 503 until DB+init OK |

---

## Users (`/administration/users`)

| Endpoint | Permission |
|----------|------------|
| `GET /administration/users` | `users.read` |
| `GET /administration/users/:id` | `users.read` |
| `POST /administration/users` | `users.create` |
| `PATCH /administration/users/:id` | `users.update` |
| `PATCH /administration/users/:id/role` | `users.assign_role` |
| `POST /administration/users/:id/activate` | `users.activate` |
| `POST /administration/users/:id/deactivate` | `users.activate` |
| `POST /administration/users/:id/reset-password` | `users.reset_password` |
| `POST /administration/users/:id/unlock` | `users.unlock` |

---

## Roles (`/administration/roles`)

| Endpoint | Permission |
|----------|------------|
| `GET /administration/roles` | `roles.read` |
| `GET /administration/roles/permissions` | `roles.read` |
| `GET /administration/roles/:id` | `roles.read` |
| `GET /administration/roles/:id/permissions` | `roles.read` |
| `POST /administration/roles` | `roles.create` |
| `PATCH /administration/roles/:id` | `roles.update` |
| `PUT /administration/roles/:id/permissions` | `roles.assign_permissions` |
| `POST /administration/roles/:id/deactivate` | `roles.update` |

---

## Organization (`/organizations/...`)

| Endpoint | Permission |
|----------|------------|
| `GET /organizations/departments` | `org.departments.read` |
| `GET /organizations/departments/:id` | `org.departments.read` |
| `POST /organizations/departments` | `org.departments.write` |
| `PATCH /organizations/departments/:id` | `org.departments.write` |
| `POST /organizations/departments/:id/activate` | `org.departments.write` |
| `POST /organizations/departments/:id/deactivate` | `org.departments.write` |
| `GET /organizations/plants` | `org.plants.read` |
| `GET /organizations/plants/:id` | `org.plants.read` |
| `POST /organizations/plants` | `org.plants.write` |
| `PATCH /organizations/plants/:id` | `org.plants.write` |
| `POST /organizations/plants/:id/activate` | `org.plants.write` |
| `POST /organizations/plants/:id/deactivate` | `org.plants.write` |
| `GET /organizations/locations` | `org.locations.read` |
| `GET /organizations/locations/:id` | `org.locations.read` |
| `POST /organizations/locations` | `org.locations.write` |
| `PATCH /organizations/locations/:id` | `org.locations.write` |
| `POST /organizations/locations/:id/activate` | `org.locations.write` |
| `POST /organizations/locations/:id/deactivate` | `org.locations.write` |

---

## Incidents (`/incidents`)

| Endpoint | Permission |
|----------|------------|
| `GET /incidents/summary` | `incidents.read` |
| `GET /incidents/people` | `incidents.read` |
| `GET /incidents` | `incidents.read` |
| `GET /incidents/:id` | `incidents.read` |
| `GET /incidents/:id/comments` | `incidents.read` |
| `GET /incidents/:id/activities` | `incidents.read` |
| `GET /incidents/:id/actions` | `incidents.read` |
| `POST /incidents` | `incidents.create` |
| `PATCH /incidents/:id` | `incidents.update_own_draft` |
| `POST /incidents/:id/submit` | `incidents.create` |
| `POST /incidents/:id/cancel` | `incidents.create` |
| `PATCH /incidents/:id/severity` | `incidents.review` |
| `POST /incidents/:id/start-review` | `incidents.review` |
| `POST /incidents/:id/assign` | `incidents.assign` |
| `PATCH /incidents/:id/investigation` | `incidents.investigate` |
| `POST /incidents/:id/begin-investigation` | `incidents.investigate` |
| `POST /incidents/:id/request-actions` | `incidents.investigate` |
| `POST /incidents/:id/actions` | `incidents.investigate` |
| `PATCH /incidents/:id/actions/:actionId` | `incidents.investigate` |
| `POST /incidents/:id/resolve` | `incidents.resolve` |
| `POST /incidents/:id/close` | `incidents.close` |
| `POST /incidents/:id/reopen` | `incidents.manage` |
| `POST /incidents/:id/comments` | `incidents.comment` |

---

## Factory Tasks (`/factory-tasks`)

| Endpoint | Permission |
|----------|------------|
| `GET /factory-tasks/summary` | `tasks.read` |
| `GET /factory-tasks/my` | `tasks.read` |
| `GET /factory-tasks/people` | `tasks.read` |
| `GET /factory-tasks` | `tasks.read` |
| `GET /factory-tasks/:id` | `tasks.read` |
| `GET /factory-tasks/:id/progress` | `tasks.read` |
| `GET /factory-tasks/:id/comments` | `tasks.read` |
| `GET /factory-tasks/:id/activities` | `tasks.read` |
| `POST /factory-tasks` | `tasks.create` |
| `PATCH /factory-tasks/:id` | `tasks.update_own_draft` |
| `PATCH /factory-tasks/:id/priority` | `tasks.update_own_draft` |
| `POST /factory-tasks/:id/open` | `tasks.create` |
| `POST /factory-tasks/:id/cancel` | `tasks.create` |
| `PATCH /factory-tasks/:id/due-date` | `tasks.assign` |
| `POST /factory-tasks/:id/assign` | `tasks.assign` |
| `POST /factory-tasks/:id/unassign` | `tasks.assign` |
| `POST /factory-tasks/:id/start` | `tasks.start` |
| `POST /factory-tasks/:id/block` | `tasks.block` |
| `POST /factory-tasks/:id/unblock` | `tasks.block` |
| `POST /factory-tasks/:id/complete` | `tasks.complete` |
| `POST /factory-tasks/:id/close` | `tasks.close` |
| `POST /factory-tasks/:id/reopen` | `tasks.manage` |
| `POST /factory-tasks/:id/progress` | `tasks.update_progress` |
| `POST /factory-tasks/:id/comments` | `tasks.comment` |

---

## Maintenance (`/maintenance`)

| Endpoint | Permission |
|----------|------------|
| `GET /maintenance/summary` | `maintenance.read` |
| `GET /maintenance/my` | `maintenance.read` |
| `GET /maintenance/people` | `maintenance.read` |
| `GET /maintenance` | `maintenance.read` |
| `GET /maintenance/:id` | `maintenance.read` |
| `GET /maintenance/:id/comments` | `maintenance.read` |
| `GET /maintenance/:id/activities` | `maintenance.read` |
| `POST /maintenance` | `maintenance.create` |
| `PATCH /maintenance/:id` | `maintenance.create` |
| `POST /maintenance/:id/submit` | `maintenance.create` |
| `POST /maintenance/:id/cancel` | `maintenance.create` |
| `POST /maintenance/:id/review` | `maintenance.review` |
| `POST /maintenance/:id/approve` | `maintenance.approve` |
| `POST /maintenance/:id/reject` | `maintenance.reject` |
| `POST /maintenance/:id/assign` | `maintenance.assign` |
| `POST /maintenance/:id/unassign` | `maintenance.assign` |
| `POST /maintenance/:id/start` | `maintenance.start` |
| `POST /maintenance/:id/waiting-for-parts` | `maintenance.start` |
| `POST /maintenance/:id/resume` | `maintenance.start` |
| `POST /maintenance/:id/complete` | `maintenance.complete` |
| `POST /maintenance/:id/close` | `maintenance.close` |
| `POST /maintenance/:id/reopen` | `maintenance.manage` |
| `POST /maintenance/:id/comments` | `maintenance.comment` |

---

## Safety & Compliance (`/safety-compliance`)

| Endpoint | Permission |
|----------|------------|
| `GET /safety-compliance/summary` | `safety.read` |
| `GET /safety-compliance/people` | `safety.read` |
| `GET /safety-compliance` | `safety.read` |
| `GET /safety-compliance/:id` | `safety.read` |
| `GET /safety-compliance/:id/findings` | `safety.read` |
| `GET /safety-compliance/:id/comments` | `safety.read` |
| `GET /safety-compliance/:id/activities` | `safety.read` |
| `POST /safety-compliance` | `safety.create` |
| `PATCH /safety-compliance/:id` | `safety.create` |
| `POST /safety-compliance/:id/cancel` | `safety.create` |
| `POST /safety-compliance/:id/schedule` | `safety.schedule` |
| `POST /safety-compliance/:id/start` | `safety.inspect` |
| `POST /safety-compliance/:id/complete` | `safety.inspect` |
| `POST /safety-compliance/:id/close` | `safety.close` |
| `POST /safety-compliance/:id/reopen` | `safety.manage` |
| `POST /safety-compliance/:id/findings` | `safety.finding_create` |
| `POST /safety-compliance/:id/findings/:fid/assign` | `safety.finding_assign` |
| `POST /safety-compliance/:id/findings/:fid/require-action` | `safety.finding_assign` |
| `POST /safety-compliance/:id/findings/:fid/resolve` | `safety.finding_resolve` |
| `POST /safety-compliance/:id/findings/:fid/verify` | `safety.verify` |
| `POST /safety-compliance/:id/findings/:fid/close` | `safety.close` |
| `POST /safety-compliance/:id/findings/:fid/reopen` | `safety.manage` |
| `POST /safety-compliance/:id/comments` | `safety.comment` |

---

## Contracts (`/contracts`)

| Endpoint | Permission |
|----------|------------|
| `GET /contracts/summary` | `contracts.read` |
| `GET /contracts/people` | `contracts.read` |
| `GET /contracts/departments` | `contracts.read` |
| `GET /contracts/plants` | `contracts.read` |
| `GET /contracts/locations` | `contracts.read` |
| `GET /contracts` | `contracts.read` |
| `GET /contracts/:id` | `contracts.read` |
| `GET /contracts/:id/comments` | `contracts.read` |
| `GET /contracts/:id/activities` | `contracts.read` |
| `POST /contracts` | `contracts.create` |
| `PATCH /contracts/:id` | `contracts.update` |
| `POST /contracts/:id/activate` | `contracts.activate` |
| `POST /contracts/:id/terminate` | `contracts.terminate` |
| `POST /contracts/:id/close` | `contracts.close` |
| `POST /contracts/:id/comments` | `contracts.comment` |

---

## Production (`/production`)

| Endpoint | Permission |
|----------|------------|
| `GET /production/summary` | `production.read` |
| `GET /production/departments` | `production.read` |
| `GET /production/plants` | `production.read` |
| `GET /production/people` | `production.read` |
| `GET /production/locations` | `production.read` |
| `GET /production/lines` | `production.lines.read` |
| `GET /production/lines/active` | `production.read` |
| `GET /production/lines/:lineId` | `production.lines.read` |
| `POST /production/lines` | `production.lines.create` |
| `PATCH /production/lines/:lineId` | `production.lines.update` |
| `POST /production/lines/:lineId/activate` | `production.lines.update` |
| `POST /production/lines/:lineId/deactivate` | `production.lines.manage` |
| `GET /production` | `production.read` |
| `GET /production/:id` | `production.read` |
| `GET /production/:id/entries` | `production.read` |
| `GET /production/:id/metrics` | `production.read` |
| `GET /production/:id/comments` | `production.read` |
| `GET /production/:id/activities` | `production.read` |
| `POST /production` | `production.create` |
| `PATCH /production/:id` | `production.update` |
| `POST /production/:id/schedule` | `production.schedule` |
| `POST /production/:id/start` | `production.start` |
| `POST /production/:id/pause` | `production.pause` |
| `POST /production/:id/resume` | `production.resume` |
| `POST /production/:id/complete` | `production.complete` |
| `POST /production/:id/cancel` | `production.cancel` |
| `POST /production/:id/entries/output` | `production.entries.create` |
| `POST /production/:id/entries/downtime` | `production.entries.create` |
| `POST /production/:id/entries/adjustment` | `production.manage` |
| `POST /production/:id/comments` | `production.comment` |

---

## Append-only invariant

The following resource types have **no DELETE endpoints** by design:
- `ProductionEntry` — output, downtime, adjustment records
- `ProductionActivity` — audit trail
- `IncidentActivity` — audit trail
- `TaskActivity` — audit trail
- Comments across all modules

Data is never hard-deleted. Soft-deactivation via `isActive=false` applies to: users, roles, departments, plants, locations, production lines.
