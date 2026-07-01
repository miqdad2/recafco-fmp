-- Factory Tasks Management Foundation
-- Unit 09 — 2026-07-01
-- Additive only. No existing tables or columns are modified.
-- All permissions seeded by code; role assignments resolved by role code.
-- Never run prisma migrate reset against any company database.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "task_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TYPE "task_status" AS ENUM ('DRAFT', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- ---------------------------------------------------------------------------
-- Sequence table
-- last_seq CHECK enforces 0–999999 range (TASK_SEQUENCE_EXHAUSTED in app)
-- ---------------------------------------------------------------------------

CREATE TABLE "task_sequences" (
    "year"     INTEGER NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "task_sequences_pkey" PRIMARY KEY ("year"),
    CONSTRAINT "task_sequences_last_seq_check" CHECK ("last_seq" >= 0 AND "last_seq" <= 999999)
);

-- ---------------------------------------------------------------------------
-- Main task table
-- ---------------------------------------------------------------------------

CREATE TABLE "factory_tasks" (
    "id"                       UUID           NOT NULL,
    "reference_number"         VARCHAR(20)    NOT NULL,
    "title"                    VARCHAR(300)   NOT NULL,
    "description"              TEXT,
    "priority"                 "task_priority" NOT NULL DEFAULT 'MEDIUM',
    "status"                   "task_status"  NOT NULL DEFAULT 'DRAFT',
    "created_by_user_id"       UUID           NOT NULL,
    "requested_by_user_id"     UUID,
    "assigned_to_user_id"      UUID,
    "requesting_department_id" UUID,
    "responsible_department_id" UUID,
    "plant_id"                 UUID,
    "location_id"              UUID,
    "incident_id"              UUID,
    "due_at"                   TIMESTAMPTZ(3),
    "started_at"               TIMESTAMPTZ(3),
    "completed_at"             TIMESTAMPTZ(3),
    "completed_by_user_id"     UUID,
    "closed_at"                TIMESTAMPTZ(3),
    "closed_by_user_id"        UUID,
    "blocked_at"               TIMESTAMPTZ(3),
    "blocked_by_user_id"       UUID,
    "blocked_reason"           VARCHAR(2000),
    "completion_summary"       VARCHAR(4000),
    "created_at"               TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"               TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "factory_tasks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "factory_tasks_title_not_blank"
        CHECK (LENGTH(TRIM("title")) > 0),
    CONSTRAINT "factory_tasks_reference_number_format"
        CHECK ("reference_number" ~ '^TASK-[0-9]{4}-[0-9]{6}$')
);

-- ---------------------------------------------------------------------------
-- Progress records
-- ---------------------------------------------------------------------------

CREATE TABLE "factory_task_progress" (
    "id"               UUID         NOT NULL,
    "task_id"          UUID         NOT NULL,
    "author_user_id"   UUID         NOT NULL,
    "author_name"      VARCHAR(200) NOT NULL,
    "progress_percent" INTEGER,
    "note"             VARCHAR(2000) NOT NULL,
    "created_at"       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factory_task_progress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "factory_task_progress_percent_check"
        CHECK ("progress_percent" IS NULL OR ("progress_percent" >= 0 AND "progress_percent" <= 100)),
    CONSTRAINT "factory_task_progress_note_not_blank"
        CHECK (LENGTH(TRIM("note")) > 0)
);

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

CREATE TABLE "factory_task_comments" (
    "id"             UUID         NOT NULL,
    "task_id"        UUID         NOT NULL,
    "author_user_id" UUID         NOT NULL,
    "body"           VARCHAR(5000) NOT NULL,
    "created_at"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factory_task_comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "factory_task_comments_body_not_blank"
        CHECK (LENGTH(TRIM("body")) > 0)
);

-- ---------------------------------------------------------------------------
-- Activity log (actorUserId intentionally has no FK)
-- ---------------------------------------------------------------------------

CREATE TABLE "factory_task_activities" (
    "id"              UUID         NOT NULL,
    "task_id"         UUID         NOT NULL,
    "actor_user_id"   UUID,
    "actor_name"      VARCHAR(200),
    "event"           VARCHAR(100) NOT NULL,
    "previous_status" "task_status",
    "new_status"      "task_status",
    "metadata"        JSONB,
    "created_at"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factory_task_activities_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Unique and indexes
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "factory_tasks_reference_number_key"
    ON "factory_tasks"("reference_number");

CREATE INDEX "factory_tasks_status_created_at_idx"
    ON "factory_tasks"("status", "created_at" DESC);

CREATE INDEX "factory_tasks_priority_status_idx"
    ON "factory_tasks"("priority", "status");

CREATE INDEX "factory_tasks_assigned_to_user_id_status_idx"
    ON "factory_tasks"("assigned_to_user_id", "status");

CREATE INDEX "factory_tasks_created_by_user_id_idx"
    ON "factory_tasks"("created_by_user_id");

CREATE INDEX "factory_tasks_responsible_department_id_idx"
    ON "factory_tasks"("responsible_department_id");

CREATE INDEX "factory_tasks_plant_id_idx"
    ON "factory_tasks"("plant_id");

CREATE INDEX "factory_tasks_incident_id_idx"
    ON "factory_tasks"("incident_id");

CREATE INDEX "factory_tasks_due_at_idx"
    ON "factory_tasks"("due_at");

CREATE INDEX "factory_task_progress_task_id_created_at_idx"
    ON "factory_task_progress"("task_id", "created_at" ASC);

CREATE INDEX "factory_task_comments_task_id_created_at_idx"
    ON "factory_task_comments"("task_id", "created_at" ASC);

CREATE INDEX "factory_task_activities_task_id_created_at_idx"
    ON "factory_task_activities"("task_id", "created_at" ASC);

-- ---------------------------------------------------------------------------
-- Foreign keys
-- ---------------------------------------------------------------------------

ALTER TABLE "factory_tasks"
    ADD CONSTRAINT "factory_tasks_created_by_user_id_fkey"
        FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "factory_tasks"
    ADD CONSTRAINT "factory_tasks_requested_by_user_id_fkey"
        FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "factory_tasks"
    ADD CONSTRAINT "factory_tasks_assigned_to_user_id_fkey"
        FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "factory_tasks"
    ADD CONSTRAINT "factory_tasks_completed_by_user_id_fkey"
        FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "factory_tasks"
    ADD CONSTRAINT "factory_tasks_closed_by_user_id_fkey"
        FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "factory_tasks"
    ADD CONSTRAINT "factory_tasks_blocked_by_user_id_fkey"
        FOREIGN KEY ("blocked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "factory_tasks"
    ADD CONSTRAINT "factory_tasks_requesting_department_id_fkey"
        FOREIGN KEY ("requesting_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "factory_tasks"
    ADD CONSTRAINT "factory_tasks_responsible_department_id_fkey"
        FOREIGN KEY ("responsible_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "factory_tasks"
    ADD CONSTRAINT "factory_tasks_plant_id_fkey"
        FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "factory_tasks"
    ADD CONSTRAINT "factory_tasks_location_id_fkey"
        FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "factory_tasks"
    ADD CONSTRAINT "factory_tasks_incident_id_fkey"
        FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "factory_task_progress"
    ADD CONSTRAINT "factory_task_progress_task_id_fkey"
        FOREIGN KEY ("task_id") REFERENCES "factory_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "factory_task_comments"
    ADD CONSTRAINT "factory_task_comments_task_id_fkey"
        FOREIGN KEY ("task_id") REFERENCES "factory_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "factory_task_comments"
    ADD CONSTRAINT "factory_task_comments_author_user_id_fkey"
        FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "factory_task_activities"
    ADD CONSTRAINT "factory_task_activities_task_id_fkey"
        FOREIGN KEY ("task_id") REFERENCES "factory_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Permissions — 11 codes, module = 'factory_tasks'
-- Seeded by code; ON CONFLICT DO NOTHING is idempotent.
-- ---------------------------------------------------------------------------

INSERT INTO "permissions" ("id", "code", "name", "description", "module")
VALUES
    (gen_random_uuid(), 'tasks.read',             'View Tasks',            'View all factory tasks',                              'factory_tasks'),
    (gen_random_uuid(), 'tasks.create',           'Create Tasks',          'Create new tasks and open them',                      'factory_tasks'),
    (gen_random_uuid(), 'tasks.update_own_draft', 'Edit Own Draft Task',   'Edit own DRAFT tasks before opening',                 'factory_tasks'),
    (gen_random_uuid(), 'tasks.assign',           'Assign Tasks',          'Assign or reassign tasks to users; update due dates', 'factory_tasks'),
    (gen_random_uuid(), 'tasks.start',            'Start Task',            'Mark an assigned task as IN_PROGRESS',                'factory_tasks'),
    (gen_random_uuid(), 'tasks.update_progress',  'Update Task Progress',  'Add progress records to a task',                      'factory_tasks'),
    (gen_random_uuid(), 'tasks.block',            'Block/Unblock Task',    'Block or unblock a task',                             'factory_tasks'),
    (gen_random_uuid(), 'tasks.complete',         'Complete Task',         'Mark an in-progress task as COMPLETED',               'factory_tasks'),
    (gen_random_uuid(), 'tasks.close',            'Close Task',            'Supervisor sign-off: close a completed task',         'factory_tasks'),
    (gen_random_uuid(), 'tasks.comment',          'Comment on Task',       'Add comments to tasks',                               'factory_tasks'),
    (gen_random_uuid(), 'tasks.manage',           'Manage Tasks',          'Cancel any state, reopen, reassign, admin overrides', 'factory_tasks')
ON CONFLICT ("code") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Role assignments by role code — no hardcoded role UUIDs
-- SUPER_ADMIN: all 11
-- ADMIN: all 11
-- VIEWER: 8 operational permissions (no assign, close, manage)
-- ---------------------------------------------------------------------------

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r, "permissions" p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code IN (
      'tasks.read', 'tasks.create', 'tasks.update_own_draft', 'tasks.assign',
      'tasks.start', 'tasks.update_progress', 'tasks.block', 'tasks.complete',
      'tasks.close', 'tasks.comment', 'tasks.manage'
  )
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r, "permissions" p
WHERE r.code = 'ADMIN'
  AND p.code IN (
      'tasks.read', 'tasks.create', 'tasks.update_own_draft', 'tasks.assign',
      'tasks.start', 'tasks.update_progress', 'tasks.block', 'tasks.complete',
      'tasks.close', 'tasks.comment', 'tasks.manage'
  )
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r, "permissions" p
WHERE r.code = 'VIEWER'
  AND p.code IN (
      'tasks.read', 'tasks.create', 'tasks.update_own_draft',
      'tasks.start', 'tasks.update_progress', 'tasks.block',
      'tasks.complete', 'tasks.comment'
  )
ON CONFLICT DO NOTHING;
