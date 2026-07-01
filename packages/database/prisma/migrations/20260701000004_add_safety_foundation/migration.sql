-- Safety & Compliance Foundation
-- Unit 11 — 2026-07-01
-- Additive only. No existing tables or columns are modified.
-- All permissions seeded by code; role assignments resolved by role code.
-- Never run prisma migrate reset against any company database.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "inspection_status" AS ENUM (
    'DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED'
);

CREATE TYPE "finding_severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE "finding_status" AS ENUM (
    'OPEN', 'ACTION_REQUIRED', 'RESOLVED', 'VERIFIED', 'CLOSED'
);

-- ---------------------------------------------------------------------------
-- Sequence table
-- last_seq CHECK enforces 0–999999 range (SAFETY_SEQUENCE_EXHAUSTED in app)
-- ---------------------------------------------------------------------------

CREATE TABLE "safety_inspection_sequences" (
    "year"     INTEGER NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "safety_inspection_sequences_pkey" PRIMARY KEY ("year"),
    CONSTRAINT "safety_inspection_sequences_last_seq_check"
        CHECK ("last_seq" >= 0 AND "last_seq" <= 999999)
);

-- ---------------------------------------------------------------------------
-- Main safety inspections table
-- ---------------------------------------------------------------------------

CREATE TABLE "safety_inspections" (
    "id"                  UUID                 NOT NULL,
    "reference_number"    VARCHAR(20)          NOT NULL,
    "title"               VARCHAR(300)         NOT NULL,
    "summary"             VARCHAR(10000),
    "status"              "inspection_status"  NOT NULL DEFAULT 'DRAFT',
    "scheduled_at"        TIMESTAMPTZ(3),
    "started_at"          TIMESTAMPTZ(3),
    "completed_at"        TIMESTAMPTZ(3),
    "completed_by_user_id" UUID,
    "closed_at"           TIMESTAMPTZ(3),
    "closed_by_user_id"   UUID,
    "cancelled_at"        TIMESTAMPTZ(3),
    "cancelled_by_user_id" UUID,
    "cancellation_reason" VARCHAR(1000),
    "created_by_user_id"  UUID                 NOT NULL,
    "inspector_user_id"   UUID,
    "department_id"       UUID,
    "plant_id"            UUID,
    "location_id"         UUID,
    "checklist_summary"   VARCHAR(10000),
    "conclusion"          VARCHAR(10000),
    "created_at"          TIMESTAMPTZ(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMPTZ(3)       NOT NULL,

    CONSTRAINT "safety_inspections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "safety_inspections_title_not_blank"
        CHECK (LENGTH(TRIM("title")) > 0),
    CONSTRAINT "safety_inspections_reference_number_format"
        CHECK ("reference_number" ~ '^SAFE-[0-9]{4}-[0-9]{6}$')
);

-- ---------------------------------------------------------------------------
-- Safety findings (child records; onDelete: Restrict preserves history)
-- ---------------------------------------------------------------------------

CREATE TABLE "safety_findings" (
    "id"                  UUID               NOT NULL,
    "inspection_id"       UUID               NOT NULL,
    "title"               VARCHAR(300)       NOT NULL,
    "description"         VARCHAR(10000)     NOT NULL,
    "severity"            "finding_severity" NOT NULL,
    "status"              "finding_status"   NOT NULL DEFAULT 'OPEN',
    "assigned_to_user_id" UUID,
    "due_at"              TIMESTAMPTZ(3),
    "action_required"     VARCHAR(5000),
    "resolution_summary"  VARCHAR(10000),
    "resolved_at"         TIMESTAMPTZ(3),
    "resolved_by_user_id" UUID,
    "verified_at"         TIMESTAMPTZ(3),
    "verified_by_user_id" UUID,
    "closed_at"           TIMESTAMPTZ(3),
    "closed_by_user_id"   UUID,
    "reopened_at"         TIMESTAMPTZ(3),
    "reopened_by_user_id" UUID,
    "reopen_reason"       VARCHAR(1000),
    "created_by_user_id"  UUID               NOT NULL,
    "created_at"          TIMESTAMPTZ(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMPTZ(3)     NOT NULL,

    CONSTRAINT "safety_findings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "safety_findings_title_not_blank"
        CHECK (LENGTH(TRIM("title")) > 0),
    CONSTRAINT "safety_findings_description_not_blank"
        CHECK (LENGTH(TRIM("description")) > 0)
);

-- ---------------------------------------------------------------------------
-- Comments (append-only, onDelete: RESTRICT preserves history)
-- ---------------------------------------------------------------------------

CREATE TABLE "safety_inspection_comments" (
    "id"             UUID           NOT NULL,
    "inspection_id"  UUID           NOT NULL,
    "author_user_id" UUID           NOT NULL,
    "body"           VARCHAR(5000)  NOT NULL,
    "created_at"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_inspection_comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "safety_inspection_comments_body_not_blank"
        CHECK (LENGTH(TRIM("body")) > 0)
);

-- ---------------------------------------------------------------------------
-- Activity log (actor_user_id intentionally has no FK — mirrors incident pattern)
-- ---------------------------------------------------------------------------

CREATE TABLE "safety_inspection_activities" (
    "id"              UUID                 NOT NULL,
    "inspection_id"   UUID                 NOT NULL,
    "actor_user_id"   UUID,
    "actor_name"      VARCHAR(200),
    "event"           VARCHAR(100)         NOT NULL,
    "previous_status" "inspection_status",
    "new_status"      "inspection_status",
    "metadata"        JSONB,
    "created_at"      TIMESTAMPTZ(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_inspection_activities_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Unique constraints and indexes
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "safety_inspections_reference_number_key"
    ON "safety_inspections"("reference_number");

CREATE INDEX "safety_inspections_status_created_at_idx"
    ON "safety_inspections"("status", "created_at" DESC);

CREATE INDEX "safety_inspections_inspector_user_id_status_idx"
    ON "safety_inspections"("inspector_user_id", "status");

CREATE INDEX "safety_inspections_created_by_user_id_idx"
    ON "safety_inspections"("created_by_user_id");

CREATE INDEX "safety_inspections_department_id_idx"
    ON "safety_inspections"("department_id");

CREATE INDEX "safety_inspections_plant_id_idx"
    ON "safety_inspections"("plant_id");

CREATE INDEX "safety_inspections_scheduled_at_idx"
    ON "safety_inspections"("scheduled_at");

CREATE INDEX "safety_findings_inspection_id_status_idx"
    ON "safety_findings"("inspection_id", "status");

CREATE INDEX "safety_findings_severity_status_idx"
    ON "safety_findings"("severity", "status");

CREATE INDEX "safety_findings_assigned_to_user_id_status_idx"
    ON "safety_findings"("assigned_to_user_id", "status");

CREATE INDEX "safety_findings_due_at_status_idx"
    ON "safety_findings"("due_at", "status");

CREATE INDEX "safety_inspection_comments_inspection_id_created_at_idx"
    ON "safety_inspection_comments"("inspection_id", "created_at" ASC);

CREATE INDEX "safety_inspection_activities_inspection_id_created_at_idx"
    ON "safety_inspection_activities"("inspection_id", "created_at" ASC);

-- ---------------------------------------------------------------------------
-- Foreign keys — safety_inspections
-- ---------------------------------------------------------------------------

ALTER TABLE "safety_inspections"
    ADD CONSTRAINT "safety_inspections_created_by_user_id_fkey"
        FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "safety_inspections"
    ADD CONSTRAINT "safety_inspections_inspector_user_id_fkey"
        FOREIGN KEY ("inspector_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "safety_inspections"
    ADD CONSTRAINT "safety_inspections_completed_by_user_id_fkey"
        FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "safety_inspections"
    ADD CONSTRAINT "safety_inspections_closed_by_user_id_fkey"
        FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "safety_inspections"
    ADD CONSTRAINT "safety_inspections_cancelled_by_user_id_fkey"
        FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "safety_inspections"
    ADD CONSTRAINT "safety_inspections_department_id_fkey"
        FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "safety_inspections"
    ADD CONSTRAINT "safety_inspections_plant_id_fkey"
        FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "safety_inspections"
    ADD CONSTRAINT "safety_inspections_location_id_fkey"
        FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Foreign keys — safety_findings
-- ---------------------------------------------------------------------------

ALTER TABLE "safety_findings"
    ADD CONSTRAINT "safety_findings_inspection_id_fkey"
        FOREIGN KEY ("inspection_id") REFERENCES "safety_inspections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "safety_findings"
    ADD CONSTRAINT "safety_findings_created_by_user_id_fkey"
        FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "safety_findings"
    ADD CONSTRAINT "safety_findings_assigned_to_user_id_fkey"
        FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "safety_findings"
    ADD CONSTRAINT "safety_findings_resolved_by_user_id_fkey"
        FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "safety_findings"
    ADD CONSTRAINT "safety_findings_verified_by_user_id_fkey"
        FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "safety_findings"
    ADD CONSTRAINT "safety_findings_closed_by_user_id_fkey"
        FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "safety_findings"
    ADD CONSTRAINT "safety_findings_reopened_by_user_id_fkey"
        FOREIGN KEY ("reopened_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Foreign keys — safety_inspection_comments
-- ---------------------------------------------------------------------------

ALTER TABLE "safety_inspection_comments"
    ADD CONSTRAINT "safety_inspection_comments_inspection_id_fkey"
        FOREIGN KEY ("inspection_id") REFERENCES "safety_inspections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "safety_inspection_comments"
    ADD CONSTRAINT "safety_inspection_comments_author_user_id_fkey"
        FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Foreign keys — safety_inspection_activities
-- ---------------------------------------------------------------------------

ALTER TABLE "safety_inspection_activities"
    ADD CONSTRAINT "safety_inspection_activities_inspection_id_fkey"
        FOREIGN KEY ("inspection_id") REFERENCES "safety_inspections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Permission seeds (module = 'safety')
-- ON CONFLICT ensures idempotency
-- ---------------------------------------------------------------------------

INSERT INTO "permissions" ("id", "code", "name", "module")
VALUES
    (gen_random_uuid(), 'safety.read',            'Read safety inspections',         'safety'),
    (gen_random_uuid(), 'safety.create',           'Create safety inspections',        'safety'),
    (gen_random_uuid(), 'safety.schedule',         'Schedule safety inspections',      'safety'),
    (gen_random_uuid(), 'safety.inspect',          'Conduct safety inspections',       'safety'),
    (gen_random_uuid(), 'safety.finding_create',   'Create safety findings',           'safety'),
    (gen_random_uuid(), 'safety.finding_assign',   'Assign safety findings',           'safety'),
    (gen_random_uuid(), 'safety.finding_resolve',  'Resolve safety findings',          'safety'),
    (gen_random_uuid(), 'safety.verify',           'Verify resolved findings',         'safety'),
    (gen_random_uuid(), 'safety.close',            'Close inspections and findings',   'safety'),
    (gen_random_uuid(), 'safety.comment',          'Comment on safety inspections',    'safety'),
    (gen_random_uuid(), 'safety.manage',           'Manage safety inspections',        'safety')
ON CONFLICT ("code") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Role-permission assignments (by role code — no hardcoded UUIDs)
-- SUPER_ADMIN and ADMIN get all 11 safety permissions.
-- VIEWER gets safety.read, safety.create, safety.comment only (3 of 11).
-- ---------------------------------------------------------------------------

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('SUPER_ADMIN', 'ADMIN')
  AND p."code" IN (
    'safety.read', 'safety.create', 'safety.schedule', 'safety.inspect',
    'safety.finding_create', 'safety.finding_assign', 'safety.finding_resolve',
    'safety.verify', 'safety.close', 'safety.comment', 'safety.manage'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" = 'VIEWER'
  AND p."code" IN ('safety.read', 'safety.create', 'safety.comment')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
