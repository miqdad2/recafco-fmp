-- FMP-TECH-01 — Technical Workflow Foundation. Purely additive: 7 new enums,
-- 4 new tables, their indexes and foreign keys. No existing table, column,
-- or constraint is touched. Hand-extracted from `prisma migrate diff
-- --from-config-datasource --to-schema` output (the shadow database still
-- fails `migrate dev` in this environment — established workaround, see
-- progress-tracker.md's earlier migration entries) — the raw diff also
-- contained large unrelated DROP/ADD CONSTRAINT drift on pre-existing
-- contract_* tables from an earlier Prisma version upgrade, deliberately
-- excluded here.

-- CreateEnum
CREATE TYPE "technical_stage" AS ENUM ('DRAWING_RECEIVED', 'SD_CALCULATION_SUBMISSION', 'GETTING_APPROVAL', 'FD_ISSUANCE');

-- CreateEnum
CREATE TYPE "technical_workflow_status" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "technical_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "technical_received_from" AS ENUM ('CLIENT', 'CONSULTANT', 'EMPLOYER', 'MAIN_CONTRACTOR', 'INTERNAL');

-- CreateEnum
CREATE TYPE "technical_drawing_type" AS ENUM ('SHOP_DRAWING', 'ARCHITECTURAL', 'STRUCTURAL', 'MEP', 'PRECAST', 'COORDINATION', 'AS_BUILT', 'OTHER');

-- CreateEnum
CREATE TYPE "technical_drawing_status" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "technical_linked_stage" AS ENUM ('TECHNICAL_REVIEW', 'SD_CALCULATION', 'GETTING_APPROVAL', 'FD_ISSUANCE');

-- CreateTable
CREATE TABLE "technical_workflows" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "current_stage" "technical_stage" NOT NULL DEFAULT 'DRAWING_RECEIVED',
    "status" "technical_workflow_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "priority" "technical_priority" NOT NULL DEFAULT 'NORMAL',
    "assigned_department" VARCHAR(50) NOT NULL DEFAULT 'TECHNICAL',
    "assigned_to_user_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "technical_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_drawings" (
    "id" UUID NOT NULL,
    "technical_workflow_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "drawing_reference_no" VARCHAR(100),
    "revision_no" VARCHAR(50),
    "drawing_type" "technical_drawing_type",
    "drawing_description" VARCHAR(2000),
    "related_area_package" VARCHAR(300),
    "received_date" DATE,
    "received_from" "technical_received_from",
    "sender_name" VARCHAR(200),
    "number_of_sheets" INTEGER,
    "priority" "technical_priority" NOT NULL DEFAULT 'NORMAL',
    "status" "technical_drawing_status" NOT NULL DEFAULT 'DRAFT',
    "internal_reference_no" VARCHAR(100),
    "requires_immediate_review" BOOLEAN NOT NULL DEFAULT false,
    "additional_documents_received" BOOLEAN NOT NULL DEFAULT false,
    "linked_workflow_stage" "technical_linked_stage" NOT NULL DEFAULT 'TECHNICAL_REVIEW',
    "remarks" VARCHAR(4000),
    "internal_notes" VARCHAR(4000),
    "assigned_to_user_id" UUID,
    "planned_review_start" DATE,
    "created_by_user_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "technical_drawings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_workflow_activities" (
    "id" UUID NOT NULL,
    "technical_workflow_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_name" VARCHAR(200),
    "event" VARCHAR(100) NOT NULL,
    "previous_stage" "technical_stage",
    "new_stage" "technical_stage",
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technical_workflow_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_drawing_attachments" (
    "id" UUID NOT NULL,
    "technical_drawing_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technical_drawing_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "technical_workflows_contract_id_key" ON "technical_workflows"("contract_id");

-- CreateIndex
CREATE INDEX "technical_workflows_status_current_stage_idx" ON "technical_workflows"("status", "current_stage");

-- CreateIndex
CREATE INDEX "technical_drawings_technical_workflow_id_idx" ON "technical_drawings"("technical_workflow_id");

-- CreateIndex
CREATE INDEX "technical_drawings_contract_id_idx" ON "technical_drawings"("contract_id");

-- CreateIndex
CREATE INDEX "technical_workflow_activities_technical_workflow_id_created_idx" ON "technical_workflow_activities"("technical_workflow_id", "created_at" ASC);

-- CreateIndex
CREATE INDEX "technical_drawing_attachments_technical_drawing_id_created__idx" ON "technical_drawing_attachments"("technical_drawing_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "technical_workflows" ADD CONSTRAINT "technical_workflows_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_workflows" ADD CONSTRAINT "technical_workflows_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_workflows" ADD CONSTRAINT "technical_workflows_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_drawings" ADD CONSTRAINT "technical_drawings_technical_workflow_id_fkey" FOREIGN KEY ("technical_workflow_id") REFERENCES "technical_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_drawings" ADD CONSTRAINT "technical_drawings_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_drawings" ADD CONSTRAINT "technical_drawings_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_drawings" ADD CONSTRAINT "technical_drawings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_workflow_activities" ADD CONSTRAINT "technical_workflow_activities_technical_workflow_id_fkey" FOREIGN KEY ("technical_workflow_id") REFERENCES "technical_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_drawing_attachments" ADD CONSTRAINT "technical_drawing_attachments_technical_drawing_id_fkey" FOREIGN KEY ("technical_drawing_id") REFERENCES "technical_drawings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_drawing_attachments" ADD CONSTRAINT "technical_drawing_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
