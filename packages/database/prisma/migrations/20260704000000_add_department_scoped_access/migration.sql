-- Migration: add_department_scoped_access
-- Unit 15 — 2026-07-04
-- Adds per-user, per-module department access scope control.
-- Enums: DepartmentAccessScope, ModuleIdentifier
-- Tables: user_module_access (scope row), user_module_department_grants (grant rows for SELECTED_DEPARTMENTS)
-- Permissions: access_scope.read, access_scope.manage, access_scope.manage_all_departments
-- Additive-only: no existing tables altered.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "department_access_scope" AS ENUM (
  'OWN_DEPARTMENT',
  'SELECTED_DEPARTMENTS',
  'ALL_DEPARTMENTS'
);

CREATE TYPE "module_identifier" AS ENUM (
  'FACTORY_TASKS',
  'INCIDENT_REPORT',
  'MAINTENANCE_REQUESTS',
  'SAFETY_COMPLIANCE',
  'CONTRACTS_MANAGEMENT',
  'PRODUCTION_DASHBOARD',
  'ADMINISTRATION'
);

-- ---------------------------------------------------------------------------
-- UserModuleAccess
-- One row per (user, module). Scope defaults to OWN_DEPARTMENT when absent.
-- ---------------------------------------------------------------------------

CREATE TABLE "user_module_access" (
  "id"         UUID                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID                     NOT NULL,
  "module"     "module_identifier"      NOT NULL,
  "scope"      "department_access_scope" NOT NULL DEFAULT 'OWN_DEPARTMENT',
  "granted_by" UUID,
  "created_at" TIMESTAMPTZ(3)           NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(3)           NOT NULL DEFAULT NOW(),

  CONSTRAINT "user_module_access_pkey"       PRIMARY KEY ("id"),
  CONSTRAINT "user_module_access_user_module" UNIQUE ("user_id", "module"),
  CONSTRAINT "user_module_access_user_fk"    FOREIGN KEY ("user_id")    REFERENCES "users"    ("id") ON DELETE CASCADE,
  CONSTRAINT "user_module_access_grantor_fk" FOREIGN KEY ("granted_by") REFERENCES "users"    ("id") ON DELETE SET NULL
);

CREATE INDEX "user_module_access_user_id_idx" ON "user_module_access" ("user_id");

-- ---------------------------------------------------------------------------
-- UserModuleDepartmentGrant
-- Rows only exist when scope = SELECTED_DEPARTMENTS.
-- Removing all grant rows from a SELECTED_DEPARTMENTS record → no departments visible.
-- ---------------------------------------------------------------------------

CREATE TABLE "user_module_department_grants" (
  "id"                   UUID           NOT NULL DEFAULT gen_random_uuid(),
  "user_module_access_id" UUID          NOT NULL,
  "department_id"        UUID           NOT NULL,
  "created_at"           TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "user_module_dept_grants_pkey"       PRIMARY KEY ("id"),
  CONSTRAINT "user_module_dept_grants_unique"     UNIQUE ("user_module_access_id", "department_id"),
  CONSTRAINT "user_module_dept_grants_access_fk"  FOREIGN KEY ("user_module_access_id") REFERENCES "user_module_access" ("id") ON DELETE CASCADE,
  CONSTRAINT "user_module_dept_grants_dept_fk"    FOREIGN KEY ("department_id")          REFERENCES "departments"        ("id") ON DELETE CASCADE
);

CREATE INDEX "user_module_dept_grants_access_id_idx" ON "user_module_department_grants" ("user_module_access_id");

-- ---------------------------------------------------------------------------
-- Permissions for access_scope module
-- ---------------------------------------------------------------------------

INSERT INTO "permissions" ("id", "code", "name", "description", "module", "created_at")
VALUES
  (gen_random_uuid(), 'scope.read',
   'View module access configuration', 'Can view per-user department scope settings', 'scope', NOW()),
  (gen_random_uuid(), 'scope.manage',
   'Manage module access (own dept or selected)', 'Can assign OWN_DEPARTMENT or SELECTED_DEPARTMENTS scope to users', 'scope', NOW()),
  (gen_random_uuid(), 'scope.manage_all',
   'Manage module access (all departments)', 'Can assign ALL_DEPARTMENTS scope and always sees all records', 'scope', NOW());

-- SUPER_ADMIN + ADMIN receive all 3 scope permissions
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN')
  AND p.code IN ('scope.read', 'scope.manage', 'scope.manage_all')
ON CONFLICT DO NOTHING;

-- VIEWER receives scope.read only (can view, not manage)
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'VIEWER'
  AND p.code = 'scope.read'
ON CONFLICT DO NOTHING;
