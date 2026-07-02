-- Migration: add_production_role_permissions
-- Unit 13 patch — 2026-07-02
-- Assigns production.* and production.lines.* permissions to SUPER_ADMIN, ADMIN, VIEWER roles.
-- These were omitted from the initial production migration and are added here additively.

-- SUPER_ADMIN + ADMIN receive all 16 production permissions
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN')
  AND p.code IN (
    'production.read', 'production.create', 'production.update',
    'production.schedule', 'production.start', 'production.pause',
    'production.resume', 'production.complete', 'production.cancel',
    'production.comment', 'production.entries.create', 'production.manage',
    'production.lines.read', 'production.lines.create',
    'production.lines.update', 'production.lines.manage'
  )
ON CONFLICT DO NOTHING;

-- VIEWER receives production.read, production.lines.read, production.comment
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'VIEWER'
  AND p.code IN ('production.read', 'production.lines.read', 'production.comment')
ON CONFLICT DO NOTHING;
