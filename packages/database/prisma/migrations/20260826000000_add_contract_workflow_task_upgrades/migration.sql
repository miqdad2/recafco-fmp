-- CM-32: Workflow Operations Upgrade — attachments, comments, priority,
-- delay reason, and last-activity tracking for contract_workflow_tasks.
--
-- Purely additive:
--   - 3 new nullable/defaulted columns on the existing contract_workflow_tasks
--     table (no existing column, constraint, or migration touched).
--   - 2 new tables (attachments, comments) referencing contract_workflow_tasks
--     and users.
-- Existing tasks remain valid: priority defaults to MEDIUM, delay_reason stays
-- NULL, and last_activity_at is backfilled from each task's own updated_at
-- (a more accurate "last known activity" value than the migration timestamp).
-- No hard delete anywhere in this migration or the service that uses it.

-- ---------------------------------------------------------------------------
-- Enum: contract_workflow_task_priority
-- ---------------------------------------------------------------------------
CREATE TYPE "contract_workflow_task_priority" AS ENUM (
  'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
);

-- ---------------------------------------------------------------------------
-- contract_workflow_tasks: additive columns
-- ---------------------------------------------------------------------------
ALTER TABLE "contract_workflow_tasks"
  ADD COLUMN "priority" "contract_workflow_task_priority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "delay_reason" text,
  ADD COLUMN "last_activity_at" timestamptz(3);

-- Backfill last_activity_at from each existing row's own updated_at (already
-- NOT NULL on every row) before enforcing NOT NULL + a default for new rows.
UPDATE "contract_workflow_tasks" SET "last_activity_at" = "updated_at";

ALTER TABLE "contract_workflow_tasks"
  ALTER COLUMN "last_activity_at" SET NOT NULL,
  ALTER COLUMN "last_activity_at" SET DEFAULT now();

-- ---------------------------------------------------------------------------
-- contract_workflow_task_attachments
-- ---------------------------------------------------------------------------
CREATE TABLE "contract_workflow_task_attachments" (
  "id"                  uuid           NOT NULL DEFAULT gen_random_uuid(),
  "task_id"             uuid           NOT NULL,
  "file_name"           varchar(255)   NOT NULL,
  "original_file_name"  varchar(255)   NOT NULL,
  "mime_type"           varchar(150)   NOT NULL,
  "file_size"           integer        NOT NULL,
  "storage_path"        varchar(500)   NOT NULL,
  "uploaded_by_user_id" uuid           NOT NULL,
  "created_at"          timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "contract_workflow_task_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_workflow_task_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "contract_workflow_tasks"("id") ON DELETE RESTRICT,
  CONSTRAINT "contract_workflow_task_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "contract_workflow_task_attachments_task_id_created_at_idx"
  ON "contract_workflow_task_attachments"("task_id", "created_at" DESC);

-- ---------------------------------------------------------------------------
-- contract_workflow_task_comments
-- ---------------------------------------------------------------------------
CREATE TABLE "contract_workflow_task_comments" (
  "id"                 uuid           NOT NULL DEFAULT gen_random_uuid(),
  "task_id"            uuid           NOT NULL,
  "comment"            text           NOT NULL,
  "created_by_user_id" uuid           NOT NULL,
  "created_at"         timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at"         timestamptz(3) NOT NULL,
  CONSTRAINT "contract_workflow_task_comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_workflow_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "contract_workflow_tasks"("id") ON DELETE RESTRICT,
  CONSTRAINT "contract_workflow_task_comments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "contract_workflow_task_comments_task_id_created_at_idx"
  ON "contract_workflow_task_comments"("task_id", "created_at" DESC);
