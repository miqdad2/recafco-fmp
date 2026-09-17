-- CM-71D — Erection Workflow, Step 3: Issue Erection Schedule. Purely
-- additive: 1 new enum + 2 new tables, no existing column/constraint/
-- migration touched. contract_id is UNIQUE — at most one schedule per
-- contract, matching Step 1's own "create once, edit forever" shape.
-- method_statement_id/approval_id are nullable informational links (ON
-- DELETE SET NULL) — never a hard DB-level requirement; the API layer
-- enforces the real "Step 1 must exist" gate. status only stores the 4
-- real save-triggered values (DRAFT, ISSUED, HOLD, RETURNED) — "Ready to
-- Issue" stays a frontend-only computed label, same as CM-71A's Step 1.

-- CreateEnum
CREATE TYPE "contract_erection_schedule_status" AS ENUM ('DRAFT', 'ISSUED', 'HOLD', 'RETURNED');

-- CreateTable
CREATE TABLE "contract_erection_schedules" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "method_statement_id" UUID,
    "approval_id" UUID,
    "schedule_reference_no" VARCHAR(50) NOT NULL,
    "schedule_date" DATE NOT NULL,
    "planned_start_date" DATE NOT NULL,
    "planned_end_date" DATE NOT NULL,
    "job_order_no" VARCHAR(50) NOT NULL,
    "erection_crew_team" VARCHAR(150) NOT NULL,
    "estimated_manpower_planned" INTEGER NOT NULL,
    "required_equipment_planned" INTEGER NOT NULL,
    "prepared_by" VARCHAR(150) NOT NULL,
    "reviewed_by_erection_manager" VARCHAR(150),
    "reviewed_on" DATE,
    "document_revision" VARCHAR(50),
    "total_activities" INTEGER NOT NULL DEFAULT 0,
    "critical_activities" INTEGER NOT NULL DEFAULT 0,
    "status" "contract_erection_schedule_status" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "issued_at" TIMESTAMPTZ(3),
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_erection_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_erection_schedule_attachments" (
    "id" UUID NOT NULL,
    "erection_schedule_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_erection_schedule_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_erection_schedules_contract_id_key" ON "contract_erection_schedules"("contract_id");

-- CreateIndex
CREATE INDEX "contract_erection_schedules_status_idx" ON "contract_erection_schedules"("status");

-- CreateIndex
CREATE INDEX "contract_erection_schedule_attachments_erection_schedule_id_idx" ON "contract_erection_schedule_attachments"("erection_schedule_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "contract_erection_schedules" ADD CONSTRAINT "contract_erection_schedules_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_schedules" ADD CONSTRAINT "contract_erection_schedules_method_statement_id_fkey" FOREIGN KEY ("method_statement_id") REFERENCES "contract_erection_method_statements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_schedules" ADD CONSTRAINT "contract_erection_schedules_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "contract_erection_method_statement_approvals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_schedules" ADD CONSTRAINT "contract_erection_schedules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_schedules" ADD CONSTRAINT "contract_erection_schedules_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_schedule_attachments" ADD CONSTRAINT "contract_erection_schedule_attachments_erection_schedule_i_fkey" FOREIGN KEY ("erection_schedule_id") REFERENCES "contract_erection_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_schedule_attachments" ADD CONSTRAINT "contract_erection_schedule_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
