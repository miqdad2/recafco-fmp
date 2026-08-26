-- CM-31: Contract Claim Log Register (module-level, across all contracts).
--
-- Purely additive — two new enums, one new table referencing "contracts" and
-- "users". No changes to any existing column, constraint, or migration.
-- Existing contracts get zero claim rows and continue to work unchanged.
--
-- No hard delete: closing/settling is a status update (status = 'CLOSED' or
-- 'SETTLED'), never a DELETE, so the register always reflects full history.

-- ---------------------------------------------------------------------------
-- Enum: contract_claim_type
-- ---------------------------------------------------------------------------
CREATE TYPE "contract_claim_type" AS ENUM (
  'VARIATION', 'EXTENSION_OF_TIME', 'DELAY', 'PAYMENT', 'DAMAGE', 'SCOPE_CHANGE', 'OTHER'
);

-- ---------------------------------------------------------------------------
-- Enum: contract_claim_status
-- ---------------------------------------------------------------------------
CREATE TYPE "contract_claim_status" AS ENUM (
  'DRAFT', 'UNDER_REVIEW', 'SUBMITTED', 'UNDER_NEGOTIATION', 'APPROVED',
  'PARTIALLY_APPROVED', 'REJECTED', 'SETTLED', 'CLOSED', 'CANCELLED'
);

-- ---------------------------------------------------------------------------
-- contract_claims
-- ---------------------------------------------------------------------------
CREATE TABLE "contract_claims" (
  "id"                  uuid                    NOT NULL DEFAULT gen_random_uuid(),
  "contract_id"         uuid                    NOT NULL,
  "claim_no"            varchar(50),
  "claim_title"         varchar(300)            NOT NULL,
  "claim_type"          "contract_claim_type"   NOT NULL DEFAULT 'OTHER',
  "event_date"          date,
  "claim_date"          date,
  "status"              "contract_claim_status" NOT NULL DEFAULT 'DRAFT',
  "submitted_value"     numeric(18,3),
  "approved_value"      numeric(18,3),
  "eot_claimed_days"    integer,
  "eot_approved_days"   integer,
  "responsible_user_id" uuid,
  "next_action"         varchar(500),
  "due_date"            date,
  "closed_date"         date,
  "remarks"             text,
  "created_by_user_id"  uuid                    NOT NULL,
  "updated_by_user_id"  uuid,
  "created_at"          timestamptz(3)          NOT NULL DEFAULT now(),
  "updated_at"          timestamptz(3)          NOT NULL,
  CONSTRAINT "contract_claims_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_claims_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT,
  CONSTRAINT "contract_claims_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "contract_claims_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "contract_claims_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "contract_claims_contract_id_claim_no_key" UNIQUE ("contract_id", "claim_no")
);

CREATE INDEX "contract_claims_contract_id_created_at_idx"
  ON "contract_claims"("contract_id", "created_at" DESC);

CREATE INDEX "contract_claims_status_idx"
  ON "contract_claims"("status");

CREATE INDEX "contract_claims_due_date_status_idx"
  ON "contract_claims"("due_date", "status");
