-- FMP-TECH-04 — Technical Stage 4: FD Issuance (final stage).
-- Additive-only: new enums + 2 new tables, no changes to any existing table.

-- CreateEnum
CREATE TYPE "technical_fd_purpose" AS ENUM ('PRODUCTION', 'ERECTION', 'STORAGE_YARD_DELIVERY', 'QUALITY_CONTROL', 'CLIENT_CONSULTANT', 'INTERNAL_RECORD', 'OTHER');

-- CreateEnum
CREATE TYPE "technical_fd_issue_type" AS ENUM ('FINAL_DRAWING', 'FINAL_DOCUMENT', 'REVISED_FINAL_DRAWING', 'APPROVED_PACKAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "technical_fd_distribution" AS ENUM ('ELECTRONIC', 'PRINTED_COPY', 'BOTH', 'PORTAL', 'OTHER');

-- CreateEnum
CREATE TYPE "technical_fd_issue_method" AS ENUM ('EMAIL', 'PORTAL', 'HANDOVER', 'INTERNAL_SYSTEM', 'COURIER', 'OTHER');

-- CreateEnum
CREATE TYPE "technical_fd_status" AS ENUM ('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'ISSUED', 'RETURNED_REOPENED', 'COMPLETED');

-- CreateTable
CREATE TABLE "technical_fd_issuances" (
    "id" UUID NOT NULL,
    "technical_workflow_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "related_approval_id" UUID,
    "fd_issue_date" DATE,
    "issued_to" VARCHAR(200),
    "purpose_for" "technical_fd_purpose",
    "issue_type" "technical_fd_issue_type",
    "drawing_reference_no" VARCHAR(100),
    "revision_no" VARCHAR(50),
    "approved_reference_no" VARCHAR(100),
    "approved_date" DATE,
    "number_of_sheets_or_files" INTEGER,
    "distribution" "technical_fd_distribution",
    "issue_method" "technical_fd_issue_method",
    "issued_by_id" UUID,
    "issued_by_name" VARCHAR(200),
    "designation" VARCHAR(150),
    "contact_no" VARCHAR(50),
    "email" VARCHAR(254),
    "remarks" VARCHAR(4000),
    "priority" "technical_priority" NOT NULL DEFAULT 'NORMAL',
    "status" "technical_fd_status" NOT NULL DEFAULT 'DRAFT',
    "created_by_user_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "technical_fd_issuances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_fd_issuance_attachments" (
    "id" UUID NOT NULL,
    "technical_fd_issuance_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technical_fd_issuance_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "technical_fd_issuances_technical_workflow_id_idx" ON "technical_fd_issuances"("technical_workflow_id");

-- CreateIndex
CREATE INDEX "technical_fd_issuances_contract_id_idx" ON "technical_fd_issuances"("contract_id");

-- CreateIndex
CREATE INDEX "technical_fd_issuances_related_approval_id_idx" ON "technical_fd_issuances"("related_approval_id");

-- CreateIndex
CREATE INDEX "technical_fd_issuance_attachments_technical_fd_issuance_id__idx" ON "technical_fd_issuance_attachments"("technical_fd_issuance_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "technical_fd_issuances" ADD CONSTRAINT "technical_fd_issuances_technical_workflow_id_fkey" FOREIGN KEY ("technical_workflow_id") REFERENCES "technical_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_fd_issuances" ADD CONSTRAINT "technical_fd_issuances_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_fd_issuances" ADD CONSTRAINT "technical_fd_issuances_related_approval_id_fkey" FOREIGN KEY ("related_approval_id") REFERENCES "technical_approvals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_fd_issuances" ADD CONSTRAINT "technical_fd_issuances_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_fd_issuances" ADD CONSTRAINT "technical_fd_issuances_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_fd_issuance_attachments" ADD CONSTRAINT "technical_fd_issuance_attachments_technical_fd_issuance_id_fkey" FOREIGN KEY ("technical_fd_issuance_id") REFERENCES "technical_fd_issuances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_fd_issuance_attachments" ADD CONSTRAINT "technical_fd_issuance_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
