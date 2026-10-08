-- FMP-BOQ-12 - drawing / calculation files attached to Technical Drawing / Calculation Groups.
-- Additive only: one enum, one table, indexes and foreign keys. Only file metadata is stored here;
-- the files themselves live on disk. No existing table or data changes.

-- CreateEnum
CREATE TYPE "technical_drawing_group_file_category" AS ENUM ('DRAWING', 'CALCULATION', 'APPROVAL_DOCUMENT', 'OTHER');

-- CreateTable
CREATE TABLE "technical_drawing_group_attachments" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "boq_item_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "category" "technical_drawing_group_file_category" NOT NULL,
    "remarks" VARCHAR(1000),
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "technical_drawing_group_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "technical_drawing_group_attachments_group_id_created_at_idx" ON "technical_drawing_group_attachments"("group_id", "created_at");

-- CreateIndex
CREATE INDEX "technical_drawing_group_attachments_contract_id_idx" ON "technical_drawing_group_attachments"("contract_id");

-- AddForeignKey
ALTER TABLE "technical_drawing_group_attachments" ADD CONSTRAINT "technical_drawing_group_attachments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "technical_drawing_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_drawing_group_attachments" ADD CONSTRAINT "technical_drawing_group_attachments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_drawing_group_attachments" ADD CONSTRAINT "technical_drawing_group_attachments_boq_item_id_fkey" FOREIGN KEY ("boq_item_id") REFERENCES "contract_boq_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_drawing_group_attachments" ADD CONSTRAINT "technical_drawing_group_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
