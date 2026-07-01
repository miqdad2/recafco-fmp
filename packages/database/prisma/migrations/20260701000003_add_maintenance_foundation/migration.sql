-- Maintenance Requests Foundation
-- Unit 10 — 2026-07-01
-- Additive only. No existing tables or columns are modified.
-- All permissions seeded by code; role assignments resolved by role code.
-- Never run prisma migrate reset against any company database.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "maintenance_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TYPE "maintenance_status" AS ENUM (
    'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'ASSIGNED',
    'IN_PROGRESS', 'WAITING_FOR_PARTS', 'COMPLETED', 'CLOSED',
    'REJECTED', 'CANCELLED'
);

-- ---------------------------------------------------------------------------
-- Sequence table
-- last_seq CHECK enforces 0–999999 range (MR_SEQUENCE_EXHAUSTED in app)
-- ---------------------------------------------------------------------------

CREATE TABLE "maintenance_sequences" (
    "year"     INTEGER NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "maintenance_sequences_pkey" PRIMARY KEY ("year"),
    CONSTRAINT "maintenance_sequences_last_seq_check"
        CHECK ("last_seq" >= 0 AND "last_seq" <= 999999)
);

-- ---------------------------------------------------------------------------
-- Main maintenance request table
-- ---------------------------------------------------------------------------

CREATE TABLE "maintenance_requests" (
    "id"                       UUID                   NOT NULL,
    "reference_number"         VARCHAR(20)            NOT NULL,
    "title"                    VARCHAR(300)           NOT NULL,
    "problem_description"      VARCHAR(10000)         NOT NULL,
    "priority"                 "maintenance_priority" NOT NULL DEFAULT 'MEDIUM',
    "status"                   "maintenance_status"   NOT NULL DEFAULT 'DRAFT',
    "created_by_user_id"       UUID                   NOT NULL,
    "requested_by_user_id"     UUID,
    "assigned_to_user_id"      UUID,
    "affected_department_id"   UUID,
    "plant_id"                 UUID,
    "location_id"              UUID,
    "equipment_description"    VARCHAR(1000),
    "requested_completion_at"  TIMESTAMPTZ(3),
    "started_at"               TIMESTAMPTZ(3),
    "waiting_for_parts_at"     TIMESTAMPTZ(3),
    "waiting_for_parts_reason" VARCHAR(2000),
    "completed_at"             TIMESTAMPTZ(3),
    "completed_by_user_id"     UUID,
    "completion_summary"       VARCHAR(4000),
    "closed_at"                TIMESTAMPTZ(3),
    "closed_by_user_id"        UUID,
    "rejected_at"              TIMESTAMPTZ(3),
    "rejected_by_user_id"      UUID,
    "rejection_reason"         VARCHAR(1000),
    "cancelled_at"             TIMESTAMPTZ(3),
    "cancelled_by_user_id"     UUID,
    "cancellation_reason"      VARCHAR(1000),
    "created_at"               TIMESTAMPTZ(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"               TIMESTAMPTZ(3)         NOT NULL,

    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "maintenance_requests_title_not_blank"
        CHECK (LENGTH(TRIM("title")) > 0),
    CONSTRAINT "maintenance_requests_problem_description_not_blank"
        CHECK (LENGTH(TRIM("problem_description")) > 0),
    CONSTRAINT "maintenance_requests_reference_number_format"
        CHECK ("reference_number" ~ '^MR-[0-9]{4}-[0-9]{6}$')
);

-- ---------------------------------------------------------------------------
-- Comments (append-only, onDelete: RESTRICT preserves history)
-- ---------------------------------------------------------------------------

CREATE TABLE "maintenance_request_comments" (
    "id"             UUID         NOT NULL,
    "request_id"     UUID         NOT NULL,
    "author_user_id" UUID         NOT NULL,
    "body"           VARCHAR(5000) NOT NULL,
    "created_at"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_request_comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "maintenance_request_comments_body_not_blank"
        CHECK (LENGTH(TRIM("body")) > 0)
);

-- ---------------------------------------------------------------------------
-- Activity log (actor_user_id intentionally has no FK — mirrors incident pattern)
-- ---------------------------------------------------------------------------

CREATE TABLE "maintenance_request_activities" (
    "id"              UUID                   NOT NULL,
    "request_id"      UUID                   NOT NULL,
    "actor_user_id"   UUID,
    "actor_name"      VARCHAR(200),
    "event"           VARCHAR(100)           NOT NULL,
    "previous_status" "maintenance_status",
    "new_status"      "maintenance_status",
    "metadata"        JSONB,
    "created_at"      TIMESTAMPTZ(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_request_activities_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Unique and indexes
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "maintenance_requests_reference_number_key"
    ON "maintenance_requests"("reference_number");

CREATE INDEX "maintenance_requests_status_created_at_idx"
    ON "maintenance_requests"("status", "created_at" DESC);

CREATE INDEX "maintenance_requests_priority_status_idx"
    ON "maintenance_requests"("priority", "status");

CREATE INDEX "maintenance_requests_assigned_to_user_id_status_idx"
    ON "maintenance_requests"("assigned_to_user_id", "status");

CREATE INDEX "maintenance_requests_created_by_user_id_idx"
    ON "maintenance_requests"("created_by_user_id");

CREATE INDEX "maintenance_requests_affected_department_id_idx"
    ON "maintenance_requests"("affected_department_id");

CREATE INDEX "maintenance_requests_plant_id_idx"
    ON "maintenance_requests"("plant_id");

CREATE INDEX "maintenance_requests_requested_completion_at_idx"
    ON "maintenance_requests"("requested_completion_at");

CREATE INDEX "maintenance_request_comments_request_id_created_at_idx"
    ON "maintenance_request_comments"("request_id", "created_at" ASC);

CREATE INDEX "maintenance_request_activities_request_id_created_at_idx"
    ON "maintenance_request_activities"("request_id", "created_at" ASC);

-- ---------------------------------------------------------------------------
-- Foreign keys
-- ---------------------------------------------------------------------------

ALTER TABLE "maintenance_requests"
    ADD CONSTRAINT "maintenance_requests_created_by_user_id_fkey"
        FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "maintenance_requests"
    ADD CONSTRAINT "maintenance_requests_requested_by_user_id_fkey"
        FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "maintenance_requests"
    ADD CONSTRAINT "maintenance_requests_assigned_to_user_id_fkey"
        FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "maintenance_requests"
    ADD CONSTRAINT "maintenance_requests_completed_by_user_id_fkey"
        FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "maintenance_requests"
    ADD CONSTRAINT "maintenance_requests_closed_by_user_id_fkey"
        FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "maintenance_requests"
    ADD CONSTRAINT "maintenance_requests_rejected_by_user_id_fkey"
        FOREIGN KEY ("rejected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "maintenance_requests"
    ADD CONSTRAINT "maintenance_requests_cancelled_by_user_id_fkey"
        FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "maintenance_requests"
    ADD CONSTRAINT "maintenance_requests_affected_department_id_fkey"
        FOREIGN KEY ("affected_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "maintenance_requests"
    ADD CONSTRAINT "maintenance_requests_plant_id_fkey"
        FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "maintenance_requests"
    ADD CONSTRAINT "maintenance_requests_location_id_fkey"
        FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "maintenance_request_comments"
    ADD CONSTRAINT "maintenance_request_comments_request_id_fkey"
        FOREIGN KEY ("request_id") REFERENCES "maintenance_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "maintenance_request_comments"
    ADD CONSTRAINT "maintenance_request_comments_author_user_id_fkey"
        FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "maintenance_request_activities"
    ADD CONSTRAINT "maintenance_request_activities_request_id_fkey"
        FOREIGN KEY ("request_id") REFERENCES "maintenance_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Permissions — 11 codes, module = 'maintenance'
-- Seeded by code; ON CONFLICT DO NOTHING is idempotent.
-- ---------------------------------------------------------------------------

INSERT INTO "permissions" ("id", "code", "name", "description", "module")
VALUES
    (gen_random_uuid(), 'maintenance.read',     'View Maintenance Requests', 'View all maintenance requests',                                'maintenance'),
    (gen_random_uuid(), 'maintenance.create',   'Create Maintenance Request','Create requests (DRAFT) and submit own drafts',                'maintenance'),
    (gen_random_uuid(), 'maintenance.review',   'Review Maintenance Request','Take a submitted request under review (→ UNDER_REVIEW)',       'maintenance'),
    (gen_random_uuid(), 'maintenance.approve',  'Approve Maintenance Request','Approve a reviewed request (→ APPROVED)',                     'maintenance'),
    (gen_random_uuid(), 'maintenance.reject',   'Reject Maintenance Request', 'Reject a submitted or reviewed request',                      'maintenance'),
    (gen_random_uuid(), 'maintenance.assign',   'Assign Maintenance Request', 'Assign an approved request to a maintainer (→ ASSIGNED)',     'maintenance'),
    (gen_random_uuid(), 'maintenance.start',    'Start Maintenance Work',     'Start work on an assigned request (→ IN_PROGRESS)',           'maintenance'),
    (gen_random_uuid(), 'maintenance.complete', 'Complete Maintenance Request','Mark a request as completed',                                'maintenance'),
    (gen_random_uuid(), 'maintenance.close',    'Close Maintenance Request',  'Supervisor sign-off: close a completed request (→ CLOSED)',   'maintenance'),
    (gen_random_uuid(), 'maintenance.comment',  'Comment on Maintenance',     'Add comments to maintenance requests',                        'maintenance'),
    (gen_random_uuid(), 'maintenance.manage',   'Manage Maintenance Requests','Cancel any state, reopen, waiting-for-parts, admin overrides','maintenance')
ON CONFLICT ("code") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Role assignments by role code — no hardcoded role UUIDs
-- SUPER_ADMIN: all 11
-- ADMIN: all 11
-- VIEWER: 8 operational permissions (no reject, close, manage)
-- ---------------------------------------------------------------------------

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r, "permissions" p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code IN (
      'maintenance.read', 'maintenance.create', 'maintenance.review',
      'maintenance.approve', 'maintenance.reject', 'maintenance.assign',
      'maintenance.start', 'maintenance.complete', 'maintenance.close',
      'maintenance.comment', 'maintenance.manage'
  )
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r, "permissions" p
WHERE r.code = 'ADMIN'
  AND p.code IN (
      'maintenance.read', 'maintenance.create', 'maintenance.review',
      'maintenance.approve', 'maintenance.reject', 'maintenance.assign',
      'maintenance.start', 'maintenance.complete', 'maintenance.close',
      'maintenance.comment', 'maintenance.manage'
  )
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r, "permissions" p
WHERE r.code = 'VIEWER'
  AND p.code IN (
      'maintenance.read', 'maintenance.create', 'maintenance.review',
      'maintenance.approve', 'maintenance.assign',
      'maintenance.start', 'maintenance.complete', 'maintenance.comment'
  )
ON CONFLICT DO NOTHING;
