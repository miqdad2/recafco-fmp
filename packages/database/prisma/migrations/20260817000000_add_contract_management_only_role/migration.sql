-- CM-18C: Add a seeded, module-scoped role for Contract Management-only users.
--
-- This is purely additive/idempotent seed data — no schema changes, no edits to
-- existing roles/permissions/role_permissions, safe to re-run.
--
-- Business context: users assigned this role should see only Contract Management
-- in the sidebar (per CM-18B's permission-driven visibility). Only the 7 contracts.*
-- permissions listed below are granted — no other module, no admin permission, and
-- explicitly not contracts.manage (broader than a normal contract user needs).

-- Seed: Contract Management User role (idempotent — no-op if it already exists)
INSERT INTO "roles" ("id", "code", "name", "description", "is_system", "is_active", "created_at", "updated_at")
VALUES (
    gen_random_uuid(),
    'CONTRACT_MANAGEMENT_USER',
    'Contract Management User',
    'Access to Contract Management module only.',
    true,
    true,
    now(),
    now()
)
ON CONFLICT ("code") DO NOTHING;

-- Grant exactly the 7 Contract Management permissions (idempotent — safe to re-run)
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'CONTRACT_MANAGEMENT_USER'
  AND p.code IN (
    'contracts.read',
    'contracts.create',
    'contracts.update',
    'contracts.activate',
    'contracts.terminate',
    'contracts.close',
    'contracts.comment'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
