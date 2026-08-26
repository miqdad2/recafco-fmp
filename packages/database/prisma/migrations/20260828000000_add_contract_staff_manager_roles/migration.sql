-- CM-35: Split Contract Management access into Staff and Manager roles.
--
-- Purely additive/idempotent seed data — no schema changes, no edits to
-- existing roles/permissions/role_permissions rows, safe to re-run.
--
-- Business context: the existing CONTRACT_MANAGEMENT_USER role (CM-18C) grants
-- contracts.update, which since CM-32/CM-33 also covers workflow task updates,
-- payments, issues, claims, and (combined with contracts.close) closeout —
-- too broad for normal staff. Two new roles are added; CONTRACT_MANAGEMENT_USER
-- itself is untouched and keeps working exactly as before (kept as the
-- legacy/full-access option per the CM-35 spec).
--
-- New permission: contracts.workflow_update — a narrower permission than
-- contracts.update, used ONLY for workflow task updates/comments/attachments
-- (see ContractWorkflowService), scoped further at the service layer to tasks
-- assigned to the actor. Granted to SUPER_ADMIN/ADMIN explicitly so their
-- access is never narrower than before (they already pass via contracts.update
-- through the new AnyPermission OR-check, but explicit grants keep every
-- permission check self-consistent regardless of which check path is used).

-- ---------------------------------------------------------------------------
-- Permission: contracts.workflow_update
-- ---------------------------------------------------------------------------
INSERT INTO "permissions" ("id", "code", "name", "description", "module", "created_at")
SELECT gen_random_uuid(), 'contracts.workflow_update', 'Update Assigned Workflow Tasks',
       'Update, comment on, and upload attachments to workflow tasks assigned to the actor', 'contracts', now()
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'contracts.workflow_update');

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN')
  AND p.code = 'contracts.workflow_update'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Role: CONTRACT_STAFF
-- contracts.read, contracts.comment, contracts.workflow_update — no
-- contracts.update/create/activate/terminate/close/manage.
-- ---------------------------------------------------------------------------
INSERT INTO "roles" ("id", "code", "name", "description", "is_system", "is_active", "created_at", "updated_at")
VALUES (
    gen_random_uuid(),
    'CONTRACT_STAFF',
    'Contract Staff',
    'Staff access for Contract Management daily work. Can view contract records, update assigned workflow tasks, add comments and upload workflow attachments. Cannot approve closeout or close contracts.',
    true,
    true,
    now(),
    now()
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'CONTRACT_STAFF'
  AND p.code IN ('contracts.read', 'contracts.comment', 'contracts.workflow_update')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Role: CONTRACT_MANAGER
-- Full operational access (create/update/activate/terminate/close) plus
-- contracts.workflow_update for department-wide workflow task management.
-- Deliberately NOT granted contracts.manage — reserved for Admin/Super Admin.
-- ---------------------------------------------------------------------------
INSERT INTO "roles" ("id", "code", "name", "description", "is_system", "is_active", "created_at", "updated_at")
VALUES (
    gen_random_uuid(),
    'CONTRACT_MANAGER',
    'Contract Manager',
    'Manager access for Contract Management. Can create/edit contracts, assign and update workflow tasks, manage contract operational records, approve/reject closeout and close contracts.',
    true,
    true,
    now(),
    now()
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'CONTRACT_MANAGER'
  AND p.code IN (
    'contracts.read', 'contracts.create', 'contracts.update',
    'contracts.activate', 'contracts.terminate', 'contracts.close',
    'contracts.comment', 'contracts.workflow_update'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
