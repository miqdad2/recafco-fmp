-- FMP-SALES-01B — Sales visibility for operational users, editing for management only.
-- Additive and idempotent: only INSERTs into role_permissions (ON CONFLICT DO NOTHING). No role,
-- permission, user or Sales row is changed or removed, and no existing grant is touched.
--
-- Read-only (sales.read + sales.reports.read) for the operational roles that open the Control Center
-- and the module dashboards:
--   ADMIN, VIEWER, CONTRACT_MANAGER, CONTRACT_MANAGEMENT_USER
-- Management (view + create + update + manage):
--   EXECUTIVE_MANAGER   (SUPER_ADMIN already holds all five from FMP-SALES-01)
--
-- Deliberately NOT granted: MANAGEMENT_INTELLIGENCE_VIEWER (isolated), CONTRACT_STAFF (task-only
-- accounts, kept away from manager screens), TECHNICAL_MANAGER / TECHNICAL_STAFF (single-module
-- roles). SALES_MANAGER and SALES_VIEWER are unchanged. Users keep their current role.

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
JOIN "permissions" p ON p.code IN ('sales.read', 'sales.reports.read')
WHERE r.code IN ('ADMIN', 'VIEWER', 'CONTRACT_MANAGER', 'CONTRACT_MANAGEMENT_USER')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
JOIN "permissions" p ON p.code IN ('sales.read', 'sales.reports.read', 'sales.create', 'sales.update', 'sales.manage')
WHERE r.code = 'EXECUTIVE_MANAGER'
ON CONFLICT DO NOTHING;
