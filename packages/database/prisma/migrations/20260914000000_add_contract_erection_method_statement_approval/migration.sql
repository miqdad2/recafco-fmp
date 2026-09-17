-- CM-71C — Erection Workflow, Step 2: Erection Method Statement Approval.
-- Purely additive: 2 new enums + 2 new tables, no existing column/
-- constraint/migration touched. method_statement_id is UNIQUE — at most
-- one approval record per CM-71A method statement (a revision cycle
-- updates the SAME record rather than creating a new one). Reuses the
-- existing contract_workflow_task_priority enum for the priority column
-- rather than defining a duplicate near-identical enum.

-- CreateEnum
CREATE TYPE "contract_erection_method_statement_approval_status" AS ENUM ('PENDING_APPROVAL', 'DRAFT_REVIEW', 'APPROVED', 'REVISION_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "contract_erection_method_statement_approval_decision" AS ENUM ('APPROVE', 'REQUEST_REVISION', 'REJECT');

-- CreateTable
CREATE TABLE "contract_erection_method_statement_approvals" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "method_statement_id" UUID NOT NULL,
    "review_required_by" DATE,
    "reviewing_engineer" VARCHAR(150),
    "review_type" VARCHAR(150),
    "priority" "contract_workflow_task_priority" NOT NULL DEFAULT 'MEDIUM',
    "review_status" "contract_erection_method_statement_approval_status" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "decision" "contract_erection_method_statement_approval_decision",
    "requires_client_approval" BOOLEAN NOT NULL DEFAULT true,
    "comments" TEXT,
    "approved_at" TIMESTAMPTZ(3),
    "revision_requested_at" TIMESTAMPTZ(3),
    "rejected_at" TIMESTAMPTZ(3),
    "reviewed_by_user_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_erection_method_statement_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_erection_method_statement_approval_attachments" (
    "id" UUID NOT NULL,
    "approval_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_erection_method_statement_approval_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_erection_method_statement_approvals_method_stateme_key" ON "contract_erection_method_statement_approvals"("method_statement_id");

-- CreateIndex
CREATE INDEX "contract_erection_method_statement_approvals_review_status_idx" ON "contract_erection_method_statement_approvals"("review_status");

-- CreateIndex
CREATE INDEX "contract_erection_method_statement_approval_attachments_app_idx" ON "contract_erection_method_statement_approval_attachments"("approval_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "contract_erection_method_statement_approvals" ADD CONSTRAINT "contract_erection_method_statement_approvals_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_method_statement_approvals" ADD CONSTRAINT "contract_erection_method_statement_approvals_method_statem_fkey" FOREIGN KEY ("method_statement_id") REFERENCES "contract_erection_method_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_method_statement_approvals" ADD CONSTRAINT "contract_erection_method_statement_approvals_reviewed_by_u_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_method_statement_approvals" ADD CONSTRAINT "contract_erection_method_statement_approvals_created_by_us_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_method_statement_approvals" ADD CONSTRAINT "contract_erection_method_statement_approvals_updated_by_us_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_method_statement_approval_attachments" ADD CONSTRAINT "contract_erection_method_statement_approval_attachments_ap_fkey" FOREIGN KEY ("approval_id") REFERENCES "contract_erection_method_statement_approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_method_statement_approval_attachments" ADD CONSTRAINT "contract_erection_method_statement_approval_attachments_up_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
