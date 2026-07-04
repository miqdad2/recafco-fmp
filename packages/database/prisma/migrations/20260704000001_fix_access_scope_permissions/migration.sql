-- Migration: fix_access_scope_permissions
-- Unit 15 corrective — 2026-07-04
-- Fixes three deviations from the approved specification:
--   1. Relax the permissions code check constraint to allow underscores in the first segment
--      (required for access_scope.* codes)
--   2. Insert the approved access_scope.* permission codes
--   3. Correct role assignments: SUPER_ADMIN gets all three; ADMIN gets read+manage only;
--      VIEWER gets none; remove wrong scope.* role-permission links
--   4. Bootstrap SUPER_ADMIN users with ALL_DEPARTMENTS UserModuleAccess for all 7 modules
--      (idempotent: ON CONFLICT DO NOTHING)
-- Additive-only with respect to data: old scope.* permission rows are left as unused orphans.

-- ---------------------------------------------------------------------------
-- 1. Relax the permission code check constraint
--    Old: ^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)*$  — no underscore in first segment
--    New: ^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$  — underscores allowed everywhere
-- ---------------------------------------------------------------------------

ALTER TABLE "permissions" DROP CONSTRAINT "permissions_code_format_check";

ALTER TABLE "permissions"
    ADD CONSTRAINT "permissions_code_format_check"
        CHECK ("code" ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$');

-- ---------------------------------------------------------------------------
-- 2. Insert the approved access_scope.* permission codes
-- ---------------------------------------------------------------------------

INSERT INTO "permissions" ("id", "code", "name", "description", "module", "created_at")
VALUES
  (gen_random_uuid(), 'access_scope.read',
   'View module access configuration',
   'Can view per-user department scope settings',
   'access_scope', NOW()),
  (gen_random_uuid(), 'access_scope.manage',
   'Manage module access (own dept or selected)',
   'Can assign OWN_DEPARTMENT or SELECTED_DEPARTMENTS scope to users',
   'access_scope', NOW()),
  (gen_random_uuid(), 'access_scope.manage_all_departments',
   'Manage module access (all departments)',
   'Can assign ALL_DEPARTMENTS scope — does NOT automatically grant operational all-dept visibility',
   'access_scope', NOW())
ON CONFLICT ("code") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Remove incorrect scope.* role-permission links
--    (The scope.* permission rows themselves are left as unused orphans.)
-- ---------------------------------------------------------------------------

DELETE FROM "role_permissions"
WHERE "permission_id" IN (
  SELECT id FROM "permissions"
  WHERE code IN ('scope.read', 'scope.manage', 'scope.manage_all')
);

-- ---------------------------------------------------------------------------
-- 4. Correct role assignments
-- ---------------------------------------------------------------------------

-- SUPER_ADMIN: all three access_scope permissions
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code IN ('access_scope.read', 'access_scope.manage', 'access_scope.manage_all_departments')
ON CONFLICT DO NOTHING;

-- ADMIN: read + manage only (NOT manage_all_departments)
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'ADMIN'
  AND p.code IN ('access_scope.read', 'access_scope.manage')
ON CONFLICT DO NOTHING;

-- VIEWER: none — intentionally no access_scope permissions

-- ---------------------------------------------------------------------------
-- 5. Bootstrap SUPER_ADMIN users with ALL_DEPARTMENTS for all 7 modules
--    Only creates rows where none exist (ON CONFLICT DO NOTHING).
--    Does NOT overwrite existing customized module access.
--    Applies only to currently active SUPER_ADMIN users.
-- ---------------------------------------------------------------------------

INSERT INTO "user_module_access" (
  "id", "user_id", "module", "scope", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  u.id,
  m.module::module_identifier,
  'ALL_DEPARTMENTS'::department_access_scope,
  NOW(),
  NOW()
FROM "users" u
JOIN "roles" r ON u."role_id" = r.id
CROSS JOIN (VALUES
  ('FACTORY_TASKS'),
  ('INCIDENT_REPORT'),
  ('MAINTENANCE_REQUESTS'),
  ('SAFETY_COMPLIANCE'),
  ('CONTRACTS_MANAGEMENT'),
  ('PRODUCTION_DASHBOARD'),
  ('ADMINISTRATION')
) AS m(module)
WHERE r.code = 'SUPER_ADMIN'
  AND u."is_active" = true
ON CONFLICT ("user_id", "module") DO NOTHING;
