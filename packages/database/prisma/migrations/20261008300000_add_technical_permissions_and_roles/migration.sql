-- FMP-ACCESS-02 — real Technical module permissions and roles. Additive and idempotent:
-- no existing permission, role, role mapping or user is changed or removed.
-- Contract Manager / Contract Staff keep opening Technical through contracts.* (the API accepts either).

INSERT INTO "permissions" ("id", "code", "name", "description", "module", "created_at")
VALUES
  (gen_random_uuid(), 'technical.read',   'View Technical',   'View the Technical dashboard, jobs, drawings, SD calculation, approval, FD issuance, drawing groups and released information', 'technical', now()),
  (gen_random_uuid(), 'technical.update', 'Update Technical', 'Update Technical workflow steps, attachments, BOQ confirmation and drawing groups', 'technical', now()),
  (gen_random_uuid(), 'technical.manage', 'Manage Technical', 'Manager-level Technical actions (for example deleting files uploaded by others)', 'technical', now())
ON CONFLICT ("code") DO NOTHING;

-- Roles
INSERT INTO "roles" ("id", "code", "name", "description", "is_system", "is_active", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'TECHNICAL_STAFF', 'Technical Staff',
   'Works inside the Technical module: view and update Technical workflow steps and drawing groups. No Contract Management, Production, Storage or Administration access.',
   true, true, now(), now()),
  (gen_random_uuid(), 'TECHNICAL_MANAGER', 'Technical Manager',
   'Manages the Technical module: everything Technical Staff can do plus manager-level Technical actions. No Contract Management, Production, Storage or Administration access.',
   true, true, now(), now())
ON CONFLICT ("code") DO NOTHING;

-- Technical Staff: read + update
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now() FROM "roles" r CROSS JOIN "permissions" p
WHERE r.code = 'TECHNICAL_STAFF' AND p.code IN ('technical.read', 'technical.update')
ON CONFLICT DO NOTHING;

-- Technical Manager, Executive Manager, Admin, Super Admin: read + update + manage
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now() FROM "roles" r CROSS JOIN "permissions" p
WHERE r.code IN ('TECHNICAL_MANAGER', 'EXECUTIVE_MANAGER', 'ADMIN', 'SUPER_ADMIN')
  AND p.code IN ('technical.read', 'technical.update', 'technical.manage')
ON CONFLICT DO NOTHING;

-- Viewer: view only (already reads Technical today through contracts.read)
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now() FROM "roles" r CROSS JOIN "permissions" p
WHERE r.code = 'VIEWER' AND p.code = 'technical.read'
ON CONFLICT DO NOTHING;
