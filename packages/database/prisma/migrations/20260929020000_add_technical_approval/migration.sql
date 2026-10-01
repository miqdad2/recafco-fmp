-- FMP-TECH-03 — Technical Stage 3: Getting Approval. Purely additive: 2 new
-- enums, 2 new tables, their indexes and foreign keys. No existing table,
-- column, or constraint is touched. Hand-extracted from `prisma migrate
-- diff --from-config-datasource --to-schema` output (the shadow database
-- still fails `migrate dev` in this environment — established workaround,
-- see progress-tracker.md's earlier migration entries) — the raw diff also
-- contained unrelated drift on pre-existing tables, deliberately excluded
-- here.

-- CreateEnum
CREATE TYPE "technical_approval_status" AS ENUM ('UNDER_REVIEW', 'APPROVED', 'APPROVED_WITH_COMMENTS', 'CHANGES_REQUIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "technical_approval_record_status" AS ENUM ('DRAFT', 'IN_PROGRESS', 'UNDER_REVIEW', 'CHANGES_REQUIRED', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "technical_approvals" (
    "id" UUID NOT NULL,
    "technical_workflow_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "related_sd_submission_id" UUID,
    "submitted_on" DATE,
    "submitted_by_id" UUID,
    "submitted_by_name" VARCHAR(200),
    "submitted_to" VARCHAR(200),
    "approval_status" "technical_approval_status",
    "expected_approval_date" DATE,
    "reviewed_on" DATE,
    "reviewed_by" VARCHAR(200),
    "revision_no" VARCHAR(50),
    "reviewer_comments" VARCHAR(4000),
    "resubmission_required" BOOLEAN NOT NULL DEFAULT false,
    "resubmission_date" DATE,
    "resubmission_reason" VARCHAR(4000),
    "priority" "technical_priority" NOT NULL DEFAULT 'NORMAL',
    "status" "technical_approval_record_status" NOT NULL DEFAULT 'DRAFT',
    "created_by_user_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "technical_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_approval_attachments" (
    "id" UUID NOT NULL,
    "technical_approval_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technical_approval_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "technical_approvals_technical_workflow_id_idx" ON "technical_approvals"("technical_workflow_id");

-- CreateIndex
CREATE INDEX "technical_approvals_contract_id_idx" ON "technical_approvals"("contract_id");

-- CreateIndex
CREATE INDEX "technical_approvals_related_sd_submission_id_idx" ON "technical_approvals"("related_sd_submission_id");

-- CreateIndex
CREATE INDEX "technical_approval_attachments_technical_approval_id_create_idx" ON "technical_approval_attachments"("technical_approval_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "technical_approvals" ADD CONSTRAINT "technical_approvals_technical_workflow_id_fkey" FOREIGN KEY ("technical_workflow_id") REFERENCES "technical_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_approvals" ADD CONSTRAINT "technical_approvals_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_approvals" ADD CONSTRAINT "technical_approvals_related_sd_submission_id_fkey" FOREIGN KEY ("related_sd_submission_id") REFERENCES "technical_sd_calculation_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_approvals" ADD CONSTRAINT "technical_approvals_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_approvals" ADD CONSTRAINT "technical_approvals_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_approval_attachments" ADD CONSTRAINT "technical_approval_attachments_technical_approval_id_fkey" FOREIGN KEY ("technical_approval_id") REFERENCES "technical_approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_approval_attachments" ADD CONSTRAINT "technical_approval_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
