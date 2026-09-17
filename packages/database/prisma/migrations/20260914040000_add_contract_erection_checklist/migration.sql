-- CreateEnum
CREATE TYPE "contract_erection_checklist_status" AS ENUM ('DRAFT', 'SUBMITTED_FOR_VERIFICATION', 'VERIFIED', 'HOLD', 'RETURNED');

-- CreateEnum
CREATE TYPE "contract_erection_checklist_item_status" AS ENUM ('COMPLETED', 'IN_PROGRESS', 'NOT_COMPLETED', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "contract_erection_checklists" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "erection_start_id" UUID,
    "checklist_ref_no" VARCHAR(50) NOT NULL,
    "checklist_date" DATE NOT NULL,
    "job_order_no" VARCHAR(50) NOT NULL,
    "checklist_type" VARCHAR(100) NOT NULL,
    "prepared_by" VARCHAR(150) NOT NULL,
    "reviewed_by_qaqc" VARCHAR(150),
    "verified_by_client_representative" VARCHAR(150),
    "status" "contract_erection_checklist_status" NOT NULL DEFAULT 'DRAFT',
    "work_location_yard" VARCHAR(200),
    "comments" TEXT,
    "submitted_at" TIMESTAMPTZ(3),
    "verified_at" TIMESTAMPTZ(3),
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_erection_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_erection_checklist_items" (
    "id" UUID NOT NULL,
    "checklist_id" UUID NOT NULL,
    "checklist_item" VARCHAR(255) NOT NULL,
    "status" "contract_erection_checklist_item_status" NOT NULL DEFAULT 'NOT_COMPLETED',
    "remarks" TEXT,
    "attachment_ref" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_erection_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_erection_checklist_attachments" (
    "id" UUID NOT NULL,
    "checklist_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_erection_checklist_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_erection_checklists_contract_id_key" ON "contract_erection_checklists"("contract_id");

-- CreateIndex
CREATE INDEX "contract_erection_checklists_status_idx" ON "contract_erection_checklists"("status");

-- CreateIndex
CREATE INDEX "contract_erection_checklist_items_checklist_id_sort_order_idx" ON "contract_erection_checklist_items"("checklist_id", "sort_order");

-- CreateIndex
CREATE INDEX "contract_erection_checklist_attachments_checklist_id_create_idx" ON "contract_erection_checklist_attachments"("checklist_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "contract_erection_checklists" ADD CONSTRAINT "contract_erection_checklists_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_checklists" ADD CONSTRAINT "contract_erection_checklists_erection_start_id_fkey" FOREIGN KEY ("erection_start_id") REFERENCES "contract_erection_starts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_checklists" ADD CONSTRAINT "contract_erection_checklists_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_checklists" ADD CONSTRAINT "contract_erection_checklists_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_checklist_items" ADD CONSTRAINT "contract_erection_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "contract_erection_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_checklist_attachments" ADD CONSTRAINT "contract_erection_checklist_attachments_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "contract_erection_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_checklist_attachments" ADD CONSTRAINT "contract_erection_checklist_attachments_uploaded_by_user_i_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
