-- FMP-TECH-02 — Technical Stage 2: SD & Calculation Submission. Purely
-- additive: 4 new enums, 2 new tables, their indexes and foreign keys. No
-- existing table, column, or constraint is touched. Hand-extracted from
-- `prisma migrate diff --from-config-datasource --to-schema` output (the
-- shadow database still fails `migrate dev` in this environment —
-- established workaround, see progress-tracker.md's earlier migration
-- entries) — the raw diff also contained unrelated drift on pre-existing
-- tables, deliberately excluded here.

-- CreateEnum
CREATE TYPE "technical_submission_type" AS ENUM ('SHOP_DRAWING', 'CALCULATION', 'SHOP_DRAWING_AND_CALCULATION', 'REVISION_SUBMISSION', 'OTHER');

-- CreateEnum
CREATE TYPE "technical_calculation_type" AS ENUM ('STRUCTURAL_CALCULATION', 'PRECAST_CALCULATION', 'CONNECTION_DESIGN', 'LOAD_CALCULATION', 'GENERAL_TECHNICAL_CALCULATION', 'OTHER');

-- CreateEnum
CREATE TYPE "technical_submission_method" AS ENUM ('EMAIL', 'PORTAL', 'HAND_SUBMISSION', 'COURIER', 'INTERNAL_HANDOVER', 'OTHER');

-- CreateEnum
CREATE TYPE "technical_sd_submission_status" AS ENUM ('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'CLARIFICATION_REQUESTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "technical_sd_calculation_submissions" (
    "id" UUID NOT NULL,
    "technical_workflow_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "related_drawing_id" UUID,
    "submission_date" DATE,
    "submission_type" "technical_submission_type",
    "submitted_to" VARCHAR(200),
    "target_approval_date" DATE,
    "drawing_reference_no" VARCHAR(100),
    "revision_no" VARCHAR(50),
    "calculation_type" "technical_calculation_type",
    "number_of_sheets_or_files" INTEGER,
    "scope_description" VARCHAR(2000),
    "submitted_by_id" UUID,
    "submitted_by_name" VARCHAR(200),
    "designation" VARCHAR(150),
    "submission_method" "technical_submission_method",
    "reference_submission_no" VARCHAR(100),
    "contact_no" VARCHAR(50),
    "email" VARCHAR(254),
    "remarks" VARCHAR(4000),
    "status" "technical_sd_submission_status" NOT NULL DEFAULT 'DRAFT',
    "priority" "technical_priority" NOT NULL DEFAULT 'NORMAL',
    "created_by_user_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "technical_sd_calculation_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_sd_submission_attachments" (
    "id" UUID NOT NULL,
    "technical_sd_submission_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technical_sd_submission_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "technical_sd_calculation_submissions_technical_workflow_id_idx" ON "technical_sd_calculation_submissions"("technical_workflow_id");

-- CreateIndex
CREATE INDEX "technical_sd_calculation_submissions_contract_id_idx" ON "technical_sd_calculation_submissions"("contract_id");

-- CreateIndex
CREATE INDEX "technical_sd_calculation_submissions_related_drawing_id_idx" ON "technical_sd_calculation_submissions"("related_drawing_id");

-- CreateIndex
CREATE INDEX "technical_sd_submission_attachments_technical_sd_submission_idx" ON "technical_sd_submission_attachments"("technical_sd_submission_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "technical_sd_calculation_submissions" ADD CONSTRAINT "technical_sd_calculation_submissions_technical_workflow_id_fkey" FOREIGN KEY ("technical_workflow_id") REFERENCES "technical_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_sd_calculation_submissions" ADD CONSTRAINT "technical_sd_calculation_submissions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_sd_calculation_submissions" ADD CONSTRAINT "technical_sd_calculation_submissions_related_drawing_id_fkey" FOREIGN KEY ("related_drawing_id") REFERENCES "technical_drawings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_sd_calculation_submissions" ADD CONSTRAINT "technical_sd_calculation_submissions_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_sd_calculation_submissions" ADD CONSTRAINT "technical_sd_calculation_submissions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_sd_submission_attachments" ADD CONSTRAINT "technical_sd_submission_attachments_technical_sd_submissio_fkey" FOREIGN KEY ("technical_sd_submission_id") REFERENCES "technical_sd_calculation_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_sd_submission_attachments" ADD CONSTRAINT "technical_sd_submission_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
