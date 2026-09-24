-- FMP-UI-02: Executive Manager role.
--
-- Purely additive/idempotent seed data — no schema changes, no edits to any
-- existing role/permission/role_permissions row. Safe to re-run.
--
-- Business context: FMP-UI-02 needs a role for higher-management users who
-- need full VIEW + OPERATE access across every operational module (Contract
-- Management, Technical/Erection sub-views, Safety & Compliance, Incident
-- Report, Production Planning, Maintenance Management, Task Management) —
-- but who are explicitly NOT system administrators. Auditing the existing 6
-- roles (SUPER_ADMIN, ADMIN, VIEWER, CONTRACT_MANAGEMENT_USER, CONTRACT_STAFF,
-- CONTRACT_MANAGER) found none that fit: SUPER_ADMIN/ADMIN both also carry
-- users.*/roles.*/org.*/audit.* system-administration permissions, and every
-- other role is scoped to Contract Management only. No new permission codes
-- are created here — EXECUTIVE_MANAGER receives exactly the same per-module
-- operational permission set ADMIN already holds for incidents/tasks/
-- maintenance/safety/contracts/production (copied verbatim from each
-- module's own foundation migration), with users.*/roles.*/org.*/audit.*/
-- access_scope.* deliberately withheld — that withholding IS the safe,
-- documented boundary between "Executive Manager" (operational) and
-- "Platform Admin" (system administration) the task asked for.
--
-- Apply with: pnpm db:migrate:deploy

INSERT INTO "roles" ("id", "code", "name", "description", "is_system", "is_active", "created_at", "updated_at")
VALUES (
    gen_random_uuid(),
    'EXECUTIVE_MANAGER',
    'Executive Manager',
    'Higher-management access with full view/operate permissions across every operational module (Contract Management, Safety & Compliance, Incident Report, Production Planning, Maintenance Management, Task Management). Does not include user, role, or organization administration — see the ADMIN role for that.',
    true,
    true,
    now(),
    now()
)
ON CONFLICT ("code") DO NOTHING;

-- Incidents (10) — identical to ADMIN's own grant in 20260701000001_add_incident_foundation.
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'EXECUTIVE_MANAGER'
  AND p.code IN (
    'incidents.read', 'incidents.create', 'incidents.update_own_draft',
    'incidents.review', 'incidents.assign', 'incidents.investigate',
    'incidents.resolve', 'incidents.close', 'incidents.comment',
    'incidents.manage'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Factory Tasks / Task Management (11) — identical to ADMIN's own grant in 20260701000002_add_factory_tasks_foundation.
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'EXECUTIVE_MANAGER'
  AND p.code IN (
    'tasks.read', 'tasks.create', 'tasks.update_own_draft', 'tasks.assign',
    'tasks.start', 'tasks.update_progress', 'tasks.block', 'tasks.complete',
    'tasks.close', 'tasks.comment', 'tasks.manage'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Maintenance Management (11) — identical to ADMIN's own grant in 20260701000003_add_maintenance_foundation.
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'EXECUTIVE_MANAGER'
  AND p.code IN (
    'maintenance.read', 'maintenance.create', 'maintenance.review',
    'maintenance.approve', 'maintenance.reject', 'maintenance.assign',
    'maintenance.start', 'maintenance.complete', 'maintenance.close',
    'maintenance.comment', 'maintenance.manage'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Safety & Compliance (11) — identical to ADMIN's own grant in 20260701000004_add_safety_foundation.
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'EXECUTIVE_MANAGER'
  AND p.code IN (
    'safety.read', 'safety.create', 'safety.schedule', 'safety.inspect',
    'safety.finding_create', 'safety.finding_assign', 'safety.finding_resolve',
    'safety.verify', 'safety.close', 'safety.comment', 'safety.manage'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Contract Management, incl. Technical/Erection sub-views (9) — identical to
-- ADMIN's own grant across 20260701000005_add_contracts_management_foundation
-- and 20260828000000_add_contract_staff_manager_roles (contracts.workflow_update).
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'EXECUTIVE_MANAGER'
  AND p.code IN (
    'contracts.read', 'contracts.create', 'contracts.update',
    'contracts.activate', 'contracts.terminate', 'contracts.close',
    'contracts.comment', 'contracts.manage', 'contracts.workflow_update'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Production Planning (16) — identical to ADMIN's own grant in 20260702000001_add_production_role_permissions.
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'EXECUTIVE_MANAGER'
  AND p.code IN (
    'production.read', 'production.create', 'production.update',
    'production.schedule', 'production.start', 'production.pause',
    'production.resume', 'production.complete', 'production.cancel',
    'production.comment', 'production.entries.create', 'production.manage',
    'production.lines.read', 'production.lines.create',
    'production.lines.update', 'production.lines.manage'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
