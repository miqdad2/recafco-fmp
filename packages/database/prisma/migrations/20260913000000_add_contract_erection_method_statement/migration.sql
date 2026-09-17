-- CM-71A — Erection Workflow, Step 1: Issue Erection Method Statement.
-- Purely additive: 1 new enum + 2 new tables, no existing column/constraint/
-- migration touched. contract_id is UNIQUE — at most one Method Statement
-- per contract, matching the design ("Step 1 of the workflow", not a
-- repeatable register). status only ever stores the 3 real save-triggered
-- values (DRAFT, SUBMITTED_FOR_APPROVAL, ISSUED) — the "Ready to Issue"
-- badge shown in the approved design is a computed frontend-only label, not
-- a stored value.

-- CreateEnum
CREATE TYPE "contract_erection_method_statement_status" AS ENUM ('DRAFT', 'SUBMITTED_FOR_APPROVAL', 'ISSUED');

-- CreateTable
CREATE TABLE "contract_erection_method_statements" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "planned_issue_date" DATE,
    "method_statement_ref_no" VARCHAR(50) NOT NULL,
    "job_order_no" VARCHAR(50) NOT NULL,
    "work_location_yard" VARCHAR(200) NOT NULL,
    "prepared_by" VARCHAR(150) NOT NULL,
    "department_area" VARCHAR(150) NOT NULL,
    "reviewed_by_internal" VARCHAR(150),
    "document_revision" VARCHAR(50),
    "applicable_standards" TEXT,
    "includes_lift_plan" BOOLEAN NOT NULL DEFAULT false,
    "includes_risk_assessment" BOOLEAN NOT NULL DEFAULT false,
    "requires_client_approval" BOOLEAN NOT NULL DEFAULT true,
    "scope_description" TEXT NOT NULL,
    "status" "contract_erection_method_statement_status" NOT NULL DEFAULT 'DRAFT',
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_erection_method_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_erection_method_statement_attachments" (
    "id" UUID NOT NULL,
    "method_statement_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_erection_method_statement_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_erection_method_statements_contract_id_key" ON "contract_erection_method_statements"("contract_id");

-- CreateIndex
CREATE INDEX "contract_erection_method_statements_status_idx" ON "contract_erection_method_statements"("status");

-- CreateIndex
CREATE INDEX "contract_erection_method_statement_attachments_method_state_idx" ON "contract_erection_method_statement_attachments"("method_statement_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "contract_erection_method_statements" ADD CONSTRAINT "contract_erection_method_statements_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_method_statements" ADD CONSTRAINT "contract_erection_method_statements_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_method_statements" ADD CONSTRAINT "contract_erection_method_statements_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_method_statement_attachments" ADD CONSTRAINT "contract_erection_method_statement_attachments_method_stat_fkey" FOREIGN KEY ("method_statement_id") REFERENCES "contract_erection_method_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_method_statement_attachments" ADD CONSTRAINT "contract_erection_method_statement_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
