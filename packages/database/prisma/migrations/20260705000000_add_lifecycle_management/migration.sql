-- Migration: add_lifecycle_management
-- 2026-07-05
--
-- Adds safe lifecycle management for Users, Departments, Plants, and Locations.
-- All changes are additive (nullable columns). No DROP, no TRUNCATE, no cascade delete.
--
-- What this migration does:
--   1. Adds archived_at + archived_by_user_id to departments, plants, locations, users
--      (no FK on archived_by_user_id — preserves history if archiving user is later deleted)
--   2. Inserts 12 new lifecycle permission codes
--   3. Assigns permissions to roles:
--      SUPER_ADMIN: all 12
--      ADMIN: deactivate + archive only (no permanent-delete permissions)
--      VIEWER: none

-- ---------------------------------------------------------------------------
-- 1. Archive columns
-- ---------------------------------------------------------------------------

ALTER TABLE "departments"
  ADD COLUMN "archived_at" TIMESTAMPTZ(3),
  ADD COLUMN "archived_by_user_id" UUID;

ALTER TABLE "plants"
  ADD COLUMN "archived_at" TIMESTAMPTZ(3),
  ADD COLUMN "archived_by_user_id" UUID;

ALTER TABLE "locations"
  ADD COLUMN "archived_at" TIMESTAMPTZ(3),
  ADD COLUMN "archived_by_user_id" UUID;

ALTER TABLE "users"
  ADD COLUMN "archived_at" TIMESTAMPTZ(3),
  ADD COLUMN "archived_by_user_id" UUID;

-- ---------------------------------------------------------------------------
-- 2. New lifecycle permissions
-- ---------------------------------------------------------------------------

INSERT INTO "permissions" ("id", "code", "name", "description", "module", "created_at")
VALUES
  -- Users lifecycle
  (gen_random_uuid(), 'users.deactivate',
   'Deactivate Users',
   'Deactivate a user account and invalidate all active sessions.',
   'users', NOW()),
  (gen_random_uuid(), 'users.archive',
   'Archive Users',
   'Archive a user account (soft-removed from active views, history preserved).',
   'users', NOW()),
  (gen_random_uuid(), 'users.delete_test',
   'Permanently Delete Test Users',
   'Hard-delete a test user (username starts with test.) when no business history exists. Requires confirmation text.',
   'users', NOW()),
  -- Departments lifecycle
  (gen_random_uuid(), 'org.departments.deactivate',
   'Deactivate Departments',
   'Deactivate a department without deleting operational records.',
   'org', NOW()),
  (gen_random_uuid(), 'org.departments.archive',
   'Archive Departments',
   'Archive a department (excluded from active selectors, visible in administration).',
   'org', NOW()),
  (gen_random_uuid(), 'org.departments.delete',
   'Permanently Delete Departments',
   'Hard-delete an unused department. Blocked when any records reference it.',
   'org', NOW()),
  -- Plants lifecycle
  (gen_random_uuid(), 'org.plants.deactivate',
   'Deactivate Plants',
   'Deactivate a plant without deleting it.',
   'org', NOW()),
  (gen_random_uuid(), 'org.plants.archive',
   'Archive Plants',
   'Archive a plant (excluded from active selectors, visible in administration).',
   'org', NOW()),
  (gen_random_uuid(), 'org.plants.delete',
   'Permanently Delete Plants',
   'Hard-delete an unused plant. Blocked when any location or record references it.',
   'org', NOW()),
  -- Locations lifecycle
  (gen_random_uuid(), 'org.locations.deactivate',
   'Deactivate Locations',
   'Deactivate a location without deleting it.',
   'org', NOW()),
  (gen_random_uuid(), 'org.locations.archive',
   'Archive Locations',
   'Archive a location (excluded from active selectors, visible in administration).',
   'org', NOW()),
  (gen_random_uuid(), 'org.locations.delete',
   'Permanently Delete Locations',
   'Hard-delete an unused location. Blocked when any user or record references it.',
   'org', NOW())
ON CONFLICT ("code") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Role assignments
-- ---------------------------------------------------------------------------

-- SUPER_ADMIN: all 12 new permissions
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code IN (
    'users.deactivate', 'users.archive', 'users.delete_test',
    'org.departments.deactivate', 'org.departments.archive', 'org.departments.delete',
    'org.plants.deactivate', 'org.plants.archive', 'org.plants.delete',
    'org.locations.deactivate', 'org.locations.archive', 'org.locations.delete'
  )
ON CONFLICT DO NOTHING;

-- ADMIN: deactivate + archive only (NO permanent-delete permissions)
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'ADMIN'
  AND p.code IN (
    'users.deactivate', 'users.archive',
    'org.departments.deactivate', 'org.departments.archive',
    'org.plants.deactivate', 'org.plants.archive',
    'org.locations.deactivate', 'org.locations.archive'
  )
ON CONFLICT DO NOTHING;
