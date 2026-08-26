-- CM-33: Contract Closeout Approval Flow.
--
-- Purely additive — one new enum, two new tables referencing "contracts" and
-- "users". No changes to any existing column, constraint, or migration.
-- Existing contracts get zero closeout request rows and continue to work
-- unchanged. No hard delete anywhere: rejection/cancellation/closure are
-- status transitions on the request row, never a DELETE.

-- ---------------------------------------------------------------------------
-- Enum: contract_closeout_request_status
-- ---------------------------------------------------------------------------
CREATE TYPE "contract_closeout_request_status" AS ENUM (
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED', 'CANCELLED'
);

-- ---------------------------------------------------------------------------
-- contract_closeout_requests
-- ---------------------------------------------------------------------------
CREATE TABLE "contract_closeout_requests" (
  "id"                   uuid                                NOT NULL DEFAULT gen_random_uuid(),
  "contract_id"          uuid                                NOT NULL,
  "request_no"           varchar(60)                         NOT NULL,
  "status"               "contract_closeout_request_status"  NOT NULL DEFAULT 'SUBMITTED',
  "requested_by_user_id" uuid                                NOT NULL,
  "requested_at"         timestamptz(3)                      NOT NULL DEFAULT now(),
  "reviewed_by_user_id"  uuid,
  "reviewed_at"          timestamptz(3),
  "approved_at"          timestamptz(3),
  "rejected_at"          timestamptz(3),
  "closed_at"            timestamptz(3),
  "closeout_summary"     text,
  "requested_remarks"    text,
  "review_remarks"       text,
  "rejection_reason"     text,
  "risk_snapshot"        jsonb,
  "created_at"           timestamptz(3)                      NOT NULL DEFAULT now(),
  "updated_at"           timestamptz(3)                      NOT NULL,
  CONSTRAINT "contract_closeout_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_closeout_requests_request_no_key" UNIQUE ("request_no"),
  CONSTRAINT "contract_closeout_requests_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT,
  CONSTRAINT "contract_closeout_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "contract_closeout_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "contract_closeout_requests_contract_id_created_at_idx"
  ON "contract_closeout_requests"("contract_id", "created_at" DESC);

CREATE INDEX "contract_closeout_requests_status_idx"
  ON "contract_closeout_requests"("status");

-- ---------------------------------------------------------------------------
-- contract_closeout_attachments
-- ---------------------------------------------------------------------------
CREATE TABLE "contract_closeout_attachments" (
  "id"                   uuid           NOT NULL DEFAULT gen_random_uuid(),
  "closeout_request_id"  uuid           NOT NULL,
  "file_name"            varchar(255)   NOT NULL,
  "original_file_name"   varchar(255)   NOT NULL,
  "mime_type"            varchar(150)   NOT NULL,
  "file_size"            integer        NOT NULL,
  "storage_path"         varchar(500)   NOT NULL,
  "uploaded_by_user_id"  uuid           NOT NULL,
  "created_at"           timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "contract_closeout_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_closeout_attachments_closeout_request_id_fkey" FOREIGN KEY ("closeout_request_id") REFERENCES "contract_closeout_requests"("id") ON DELETE RESTRICT,
  CONSTRAINT "contract_closeout_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "contract_closeout_attachments_request_id_created_at_idx"
  ON "contract_closeout_attachments"("closeout_request_id", "created_at" DESC);
