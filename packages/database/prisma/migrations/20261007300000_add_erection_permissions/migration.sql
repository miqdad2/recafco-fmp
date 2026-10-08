-- FMP-BOQ-09 - Erection piece screen permissions.
-- Additive data only (no table changes): two new permission codes and their role grants.
-- Erection is a sub-view of Contract Management with no permissions of its own; without these the
-- piece screen would have to borrow Contract Management access, which is broader than intended.

INSERT INTO "permissions" ("id", "code", "name", "module")
VALUES
  (gen_random_uuid(), 'erection.read',   'View erection pieces',   'erection'),
  (gen_random_uuid(), 'erection.update', 'Update erection pieces', 'erection')
ON CONFLICT ("code") DO NOTHING;

-- Super Admin, Admin and Executive Manager: view + update
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN', 'EXECUTIVE_MANAGER')
  AND p.code IN ('erection.read', 'erection.update')
ON CONFLICT DO NOTHING;

-- Viewer: view only (matches the read-only access Viewer already has to production, storage and contracts)
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'VIEWER'
  AND p.code = 'erection.read'
ON CONFLICT DO NOTHING;
