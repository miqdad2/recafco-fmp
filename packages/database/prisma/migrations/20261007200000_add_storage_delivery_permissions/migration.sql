-- FMP-BOQ-08 - Storage Yard & Delivery piece screen permissions.
-- Additive data only (no table changes): two new permission codes and their role grants.
-- Storage Yard & Delivery had no permissions of its own; without these the piece screen would
-- have to borrow Contract Management or Production access, which is broader than intended.

INSERT INTO "permissions" ("id", "code", "name", "module")
VALUES
  (gen_random_uuid(), 'storage_delivery.read',   'View storage yard and delivery pieces',   'storage_delivery'),
  (gen_random_uuid(), 'storage_delivery.update', 'Update storage yard and delivery pieces', 'storage_delivery')
ON CONFLICT ("code") DO NOTHING;

-- Super Admin, Admin and Executive Manager: view + update
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN', 'EXECUTIVE_MANAGER')
  AND p.code IN ('storage_delivery.read', 'storage_delivery.update')
ON CONFLICT DO NOTHING;

-- Viewer: view only (matches the read-only access Viewer already has to production and contracts)
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'VIEWER'
  AND p.code = 'storage_delivery.read'
ON CONFLICT DO NOTHING;
