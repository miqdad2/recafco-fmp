-- Migration: add_production_management_foundation
-- Unit 13 — 2026-07-02
-- Adds ProductionLine, ProductionOrder (with version-based optimistic concurrency),
-- ProductionEntry (append-only), ProductionComment, ProductionActivity, and
-- ProductionSequence (PROD-YYYY-NNNNNN atomic yearly reference numbers).
-- Permissions for production.* (12) and production_lines.* (4) are inserted.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "production_order_status" AS ENUM (
  'DRAFT',
  'SCHEDULED',
  'IN_PROGRESS',
  'PAUSED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "production_entry_type" AS ENUM (
  'OUTPUT',
  'DOWNTIME',
  'ADJUSTMENT'
);

-- ---------------------------------------------------------------------------
-- Sequence table (atomic PROD-YYYY-NNNNNN)
-- ---------------------------------------------------------------------------

CREATE TABLE "production_sequences" (
  "year"     INTEGER NOT NULL,
  "last_seq" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "production_sequences_pkey" PRIMARY KEY ("year"),
  CONSTRAINT "production_sequences_last_seq_range" CHECK ("last_seq" BETWEEN 0 AND 999999)
);

-- ---------------------------------------------------------------------------
-- ProductionLine
-- ---------------------------------------------------------------------------

CREATE TABLE "production_lines" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "code"        VARCHAR(32)  NOT NULL,
  "name"        VARCHAR(200) NOT NULL,
  "description" VARCHAR(500),
  "plant_id"    UUID,
  "location_id" UUID,
  "capacity"    INTEGER,
  "is_active"   BOOLEAN      NOT NULL DEFAULT TRUE,
  "version"     INTEGER      NOT NULL DEFAULT 1,
  "created_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "production_lines_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "production_lines_code_unique" UNIQUE ("code"),
  CONSTRAINT "production_lines_plant_fk"    FOREIGN KEY ("plant_id")    REFERENCES "plants"    ("id") ON DELETE SET NULL,
  CONSTRAINT "production_lines_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations" ("id") ON DELETE SET NULL
);

CREATE INDEX "production_lines_is_active_plant_id_idx" ON "production_lines" ("is_active", "plant_id");

-- ---------------------------------------------------------------------------
-- ProductionOrder
-- ---------------------------------------------------------------------------

CREATE TABLE "production_orders" (
  "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
  "reference_number"    VARCHAR(20)  NOT NULL,
  "title"               VARCHAR(300) NOT NULL,
  "description"         VARCHAR(10000),
  "status"              "production_order_status" NOT NULL DEFAULT 'DRAFT',
  "version"             INTEGER      NOT NULL DEFAULT 1,
  "production_line_id"  UUID,
  "department_id"       UUID,
  "plant_id"            UUID,
  "product_code"        VARCHAR(100),
  "product_name"        VARCHAR(300),
  "target_quantity"     INTEGER      NOT NULL,
  "unit"                VARCHAR(50)  NOT NULL,
  "scheduled_start_at"  TIMESTAMPTZ(3),
  "scheduled_end_at"    TIMESTAMPTZ(3),
  "started_at"          TIMESTAMPTZ(3),
  "started_by_user_id"  UUID,
  "paused_at"           TIMESTAMPTZ(3),
  "paused_by_user_id"   UUID,
  "pause_reason"        VARCHAR(1000),
  "resumed_at"          TIMESTAMPTZ(3),
  "resumed_by_user_id"  UUID,
  "completed_at"        TIMESTAMPTZ(3),
  "completed_by_user_id" UUID,
  "completion_note"     VARCHAR(4000),
  "cancelled_at"        TIMESTAMPTZ(3),
  "cancelled_by_user_id" UUID,
  "cancellation_reason" VARCHAR(1000),
  "supervisor_user_id"  UUID,
  "created_by_user_id"  UUID         NOT NULL,
  "created_at"          TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "production_orders_pkey"             PRIMARY KEY ("id"),
  CONSTRAINT "production_orders_ref_unique"       UNIQUE ("reference_number"),
  CONSTRAINT "production_orders_target_qty_pos"   CHECK ("target_quantity" > 0),
  CONSTRAINT "production_orders_line_fk"          FOREIGN KEY ("production_line_id")  REFERENCES "production_lines" ("id") ON DELETE SET NULL,
  CONSTRAINT "production_orders_dept_fk"          FOREIGN KEY ("department_id")       REFERENCES "departments"       ("id") ON DELETE SET NULL,
  CONSTRAINT "production_orders_plant_fk"         FOREIGN KEY ("plant_id")            REFERENCES "plants"            ("id") ON DELETE SET NULL,
  CONSTRAINT "production_orders_created_by_fk"    FOREIGN KEY ("created_by_user_id")  REFERENCES "users"             ("id") ON DELETE RESTRICT,
  CONSTRAINT "production_orders_supervisor_fk"    FOREIGN KEY ("supervisor_user_id")  REFERENCES "users"             ("id") ON DELETE SET NULL,
  CONSTRAINT "production_orders_started_by_fk"    FOREIGN KEY ("started_by_user_id")  REFERENCES "users"             ("id") ON DELETE SET NULL,
  CONSTRAINT "production_orders_paused_by_fk"     FOREIGN KEY ("paused_by_user_id")   REFERENCES "users"             ("id") ON DELETE SET NULL,
  CONSTRAINT "production_orders_resumed_by_fk"    FOREIGN KEY ("resumed_by_user_id")  REFERENCES "users"             ("id") ON DELETE SET NULL,
  CONSTRAINT "production_orders_completed_by_fk"  FOREIGN KEY ("completed_by_user_id") REFERENCES "users"            ("id") ON DELETE SET NULL,
  CONSTRAINT "production_orders_cancelled_by_fk"  FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"            ("id") ON DELETE SET NULL
);

CREATE INDEX "production_orders_status_created_at_idx"   ON "production_orders" ("status", "created_at" DESC);
CREATE INDEX "production_orders_line_status_idx"         ON "production_orders" ("production_line_id", "status");
CREATE INDEX "production_orders_dept_idx"                ON "production_orders" ("department_id");
CREATE INDEX "production_orders_plant_idx"               ON "production_orders" ("plant_id");
CREATE INDEX "production_orders_created_by_idx"          ON "production_orders" ("created_by_user_id");
CREATE INDEX "production_orders_supervisor_status_idx"   ON "production_orders" ("supervisor_user_id", "status");
CREATE INDEX "production_orders_scheduled_start_idx"     ON "production_orders" ("scheduled_start_at");

-- ---------------------------------------------------------------------------
-- ProductionEntry (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE "production_entries" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "order_id"          UUID        NOT NULL,
  "type"              "production_entry_type" NOT NULL,
  "author_user_id"    UUID        NOT NULL,
  "author_name"       VARCHAR(200) NOT NULL,
  "quantity_produced" INTEGER,
  "quantity_accepted" INTEGER,
  "quantity_rejected" INTEGER,
  "downtime_minutes"  INTEGER,
  "adjustment_qty"    INTEGER,
  "note"              VARCHAR(2000),
  "recorded_at"       TIMESTAMPTZ(3) NOT NULL,
  "created_at"        TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "production_entries_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "production_entries_order_fk" FOREIGN KEY ("order_id") REFERENCES "production_orders" ("id") ON DELETE RESTRICT
  -- author_user_id intentionally has no FK — mirrors IncidentActivity pattern
);

CREATE INDEX "production_entries_order_created_at_idx" ON "production_entries" ("order_id", "created_at" ASC);
CREATE INDEX "production_entries_order_type_idx"       ON "production_entries" ("order_id", "type");

-- ---------------------------------------------------------------------------
-- ProductionComment (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE "production_comments" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "order_id"       UUID         NOT NULL,
  "author_user_id" UUID         NOT NULL,
  "body"           VARCHAR(5000) NOT NULL,
  "created_at"     TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "production_comments_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "production_comments_order_fk"  FOREIGN KEY ("order_id")       REFERENCES "production_orders" ("id") ON DELETE RESTRICT,
  CONSTRAINT "production_comments_author_fk" FOREIGN KEY ("author_user_id") REFERENCES "users"             ("id") ON DELETE RESTRICT
);

CREATE INDEX "production_comments_order_created_at_idx" ON "production_comments" ("order_id", "created_at" ASC);

-- ---------------------------------------------------------------------------
-- ProductionActivity (append-only audit trail)
-- ---------------------------------------------------------------------------

CREATE TABLE "production_activities" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "order_id"        UUID         NOT NULL,
  "actor_user_id"   UUID,
  "actor_name"      VARCHAR(200),
  "event"           VARCHAR(100) NOT NULL,
  "previous_status" "production_order_status",
  "new_status"      "production_order_status",
  "metadata"        JSONB,
  "created_at"      TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "production_activities_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "production_activities_order_fk" FOREIGN KEY ("order_id") REFERENCES "production_orders" ("id") ON DELETE RESTRICT
  -- actor_user_id intentionally has no FK — mirrors IncidentActivity pattern
);

CREATE INDEX "production_activities_order_created_at_idx" ON "production_activities" ("order_id", "created_at" ASC);

-- ---------------------------------------------------------------------------
-- Permissions (16 total: 12 production.* + 4 production_lines.*)
-- ---------------------------------------------------------------------------

INSERT INTO "permissions" ("id", "code", "name", "module")
VALUES
  (gen_random_uuid(), 'production.read',            'View production orders',              'production'),
  (gen_random_uuid(), 'production.create',          'Create production orders',            'production'),
  (gen_random_uuid(), 'production.update',          'Update draft production orders',      'production'),
  (gen_random_uuid(), 'production.schedule',        'Schedule production orders',          'production'),
  (gen_random_uuid(), 'production.start',           'Start production orders',             'production'),
  (gen_random_uuid(), 'production.pause',           'Pause production orders',             'production'),
  (gen_random_uuid(), 'production.resume',          'Resume paused production orders',     'production'),
  (gen_random_uuid(), 'production.complete',        'Complete production orders',          'production'),
  (gen_random_uuid(), 'production.cancel',          'Cancel production orders',            'production'),
  (gen_random_uuid(), 'production.comment',         'Comment on production orders',        'production'),
  (gen_random_uuid(), 'production.entries.create',  'Add production entries',              'production'),
  (gen_random_uuid(), 'production.manage',          'Full production management',          'production'),
  (gen_random_uuid(), 'production.lines.read',      'View production lines',               'production'),
  (gen_random_uuid(), 'production.lines.create',    'Create production lines',             'production'),
  (gen_random_uuid(), 'production.lines.update',    'Update production lines',             'production'),
  (gen_random_uuid(), 'production.lines.manage',    'Full production line management',     'production');
