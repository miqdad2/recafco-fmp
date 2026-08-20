-- CM-28: Contract Payments Register (module-level, across all contracts).
--
-- Purely additive — one new enum, one new table referencing "contracts" and
-- "users". No changes to any existing column, constraint, or migration.
-- Existing contracts get zero payment rows and continue to work unchanged.
--
-- No hard delete: cancellation is a status update (status = 'CANCELLED'),
-- never a DELETE, so the register always reflects full history.

-- ---------------------------------------------------------------------------
-- Enum: contract_payment_status
-- ---------------------------------------------------------------------------
CREATE TYPE "contract_payment_status" AS ENUM (
  'DRAFT', 'SUBMITTED', 'CERTIFIED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'
);

-- ---------------------------------------------------------------------------
-- contract_payments
-- ---------------------------------------------------------------------------
CREATE TABLE "contract_payments" (
  "id"                 uuid                      NOT NULL DEFAULT gen_random_uuid(),
  "contract_id"        uuid                      NOT NULL,
  "payment_no"         varchar(50),
  "invoice_number"     varchar(100),
  "invoice_date"       date,
  "payment_term"       varchar(100),
  "submitted_amount"   numeric(18, 3),
  "certified_amount"   numeric(18, 3),
  "paid_amount"        numeric(18, 3),
  "due_date"           date,
  "paid_date"          date,
  "status"             "contract_payment_status" NOT NULL DEFAULT 'DRAFT',
  "remarks"            text,
  "created_by_user_id" uuid                      NOT NULL,
  "updated_by_user_id" uuid,
  "created_at"         timestamptz(3)            NOT NULL DEFAULT now(),
  "updated_at"         timestamptz(3)            NOT NULL,
  CONSTRAINT "contract_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_payments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT,
  CONSTRAINT "contract_payments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "contract_payments_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "contract_payments_contract_id_payment_no_key" UNIQUE ("contract_id", "payment_no")
);

CREATE INDEX "contract_payments_contract_id_created_at_idx"
  ON "contract_payments"("contract_id", "created_at" DESC);

CREATE INDEX "contract_payments_status_idx"
  ON "contract_payments"("status");

CREATE INDEX "contract_payments_due_date_status_idx"
  ON "contract_payments"("due_date", "status");
