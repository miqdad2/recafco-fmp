-- FMP-MIC-01 — Management Intelligence Center access. Additive and idempotent:
-- no existing permission, role, role mapping or user is changed or removed.
--
-- One new permission and one new role that holds ONLY that permission. The role
-- deliberately carries no operational, administration or access_scope.* code, and
-- no existing role (including SUPER_ADMIN / ADMIN) is granted the permission here:
-- an administrator who should see the Center is given it explicitly through
-- Administration -> Users (assign the role) so access stays a deliberate decision.

INSERT INTO "permissions" ("id", "code", "name", "description", "module", "created_at")
VALUES
  (gen_random_uuid(), 'management_intelligence.read', 'View Management Intelligence',
   'Open the read-only Management Intelligence Center and its reporting API. Grants no operational access.',
   'management_intelligence', now())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "roles" ("id", "code", "name", "description", "is_system", "is_active", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'MANAGEMENT_INTELLIGENCE_VIEWER', 'Management Intelligence Viewer',
   'Read-only access to the Management Intelligence Center only. No Contract Management, Technical, Production, Storage, Erection, Safety, Incident, Maintenance, Task or Administration access.',
   true, true, now(), now())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now() FROM "roles" r CROSS JOIN "permissions" p
WHERE r.code = 'MANAGEMENT_INTELLIGENCE_VIEWER' AND p.code = 'management_intelligence.read'
ON CONFLICT DO NOTHING;
