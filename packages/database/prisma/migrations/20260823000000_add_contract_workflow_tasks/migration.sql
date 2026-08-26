-- CM-29: Contract Workflow & Team Tasks Register (module-level, across all contracts).
--
-- Purely additive — two new enums, one new table referencing "contracts" and
-- "users". No changes to any existing column, constraint, or migration.
-- Existing contracts get zero workflow task rows and continue to work
-- unchanged; tasks are lazily generated on first view of a contract's
-- workflow, not backfilled here.

-- ---------------------------------------------------------------------------
-- Enum: contract_workflow_team
-- ---------------------------------------------------------------------------
CREATE TYPE "contract_workflow_team" AS ENUM (
  'TECHNICAL', 'PRODUCTION', 'ERECTION', 'QS_COMMERCIAL'
);

-- ---------------------------------------------------------------------------
-- Enum: contract_workflow_task_status
-- ---------------------------------------------------------------------------
CREATE TYPE "contract_workflow_task_status" AS ENUM (
  'NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED', 'ON_HOLD'
);

-- ---------------------------------------------------------------------------
-- contract_workflow_tasks
-- ---------------------------------------------------------------------------
CREATE TABLE "contract_workflow_tasks" (
  "id"                  uuid                           NOT NULL DEFAULT gen_random_uuid(),
  "contract_id"         uuid                           NOT NULL,
  "team"                "contract_workflow_team"       NOT NULL,
  "task_key"            varchar(100)                   NOT NULL,
  "task_name"           varchar(200)                   NOT NULL,
  "sort_order"          integer                        NOT NULL,
  "status"              "contract_workflow_task_status" NOT NULL DEFAULT 'NOT_STARTED',
  "responsible_user_id" uuid,
  "start_date"          date,
  "due_date"            date,
  "completed_date"      date,
  "remarks"             text,
  "created_by_user_id"  uuid                           NOT NULL,
  "updated_by_user_id"  uuid,
  "created_at"          timestamptz(3)                 NOT NULL DEFAULT now(),
  "updated_at"          timestamptz(3)                 NOT NULL,
  CONSTRAINT "contract_workflow_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_workflow_tasks_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT,
  CONSTRAINT "contract_workflow_tasks_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "contract_workflow_tasks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "contract_workflow_tasks_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "contract_workflow_tasks_contract_id_task_key_key" UNIQUE ("contract_id", "task_key")
);

CREATE INDEX "contract_workflow_tasks_contract_id_sort_order_idx"
  ON "contract_workflow_tasks"("contract_id", "sort_order");

CREATE INDEX "contract_workflow_tasks_status_idx"
  ON "contract_workflow_tasks"("status");

CREATE INDEX "contract_workflow_tasks_due_date_status_idx"
  ON "contract_workflow_tasks"("due_date", "status");
