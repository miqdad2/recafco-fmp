-- CM-30: Contract Issue Log Register (module-level, across all contracts).
--
-- Purely additive — two new enums, one new table referencing "contracts" and
-- "users". No changes to any existing column, constraint, or migration.
-- Existing contracts get zero issue rows and continue to work unchanged.
--
-- No hard delete: closing is a status update (status = 'CLOSED'), never a
-- DELETE, so the register always reflects full history.

-- ---------------------------------------------------------------------------
-- Enum: contract_issue_priority
-- ---------------------------------------------------------------------------
CREATE TYPE "contract_issue_priority" AS ENUM (
  'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
);

-- ---------------------------------------------------------------------------
-- Enum: contract_issue_status
-- ---------------------------------------------------------------------------
CREATE TYPE "contract_issue_status" AS ENUM (
  'OPEN', 'IN_PROGRESS', 'WAITING_RESPONSE', 'RESOLVED', 'CLOSED', 'CANCELLED'
);

-- ---------------------------------------------------------------------------
-- contract_issues
-- ---------------------------------------------------------------------------
CREATE TABLE "contract_issues" (
  "id"                  uuid                      NOT NULL DEFAULT gen_random_uuid(),
  "contract_id"         uuid                      NOT NULL,
  "issue_no"            varchar(50),
  "title"               varchar(300)              NOT NULL,
  "description"         text,
  "category"            varchar(50),
  "priority"            "contract_issue_priority" NOT NULL DEFAULT 'MEDIUM',
  "status"              "contract_issue_status"   NOT NULL DEFAULT 'OPEN',
  "responsible_user_id" uuid,
  "raised_date"         date,
  "due_date"            date,
  "closed_date"         date,
  "resolution"          text,
  "remarks"             text,
  "created_by_user_id"  uuid                      NOT NULL,
  "updated_by_user_id"  uuid,
  "created_at"          timestamptz(3)            NOT NULL DEFAULT now(),
  "updated_at"          timestamptz(3)            NOT NULL,
  CONSTRAINT "contract_issues_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_issues_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT,
  CONSTRAINT "contract_issues_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "contract_issues_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "contract_issues_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "contract_issues_contract_id_issue_no_key" UNIQUE ("contract_id", "issue_no")
);

CREATE INDEX "contract_issues_contract_id_created_at_idx"
  ON "contract_issues"("contract_id", "created_at" DESC);

CREATE INDEX "contract_issues_status_idx"
  ON "contract_issues"("status");

CREATE INDEX "contract_issues_due_date_status_idx"
  ON "contract_issues"("due_date", "status");
