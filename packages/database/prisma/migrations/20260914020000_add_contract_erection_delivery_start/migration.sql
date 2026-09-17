-- CreateEnum
CREATE TYPE "contract_erection_delivery_start_status" AS ENUM ('DRAFT', 'STARTED', 'HOLD', 'RETURNED');

-- CreateEnum
CREATE TYPE "contract_erection_delivery_item_status" AS ENUM ('READY_TO_DISPATCH', 'DISPATCHED', 'DELIVERED', 'HOLD');

-- CreateEnum
CREATE TYPE "contract_erection_delivery_document_status" AS ENUM ('PENDING', 'ATTACHED', 'NOT_REQUIRED');

-- CreateTable
CREATE TABLE "contract_erection_delivery_starts" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "erection_schedule_id" UUID,
    "delivery_reference_no" VARCHAR(50) NOT NULL,
    "delivery_date" DATE NOT NULL,
    "planned_delivery_window_start" DATE NOT NULL,
    "planned_delivery_window_end" DATE NOT NULL,
    "transport_mode" VARCHAR(100) NOT NULL,
    "dispatch_production_source" VARCHAR(200) NOT NULL,
    "dispatch_from_yard" VARCHAR(200) NOT NULL,
    "delivery_to_site_location" VARCHAR(200) NOT NULL,
    "gate_entry_contact" VARCHAR(150),
    "delivery_note_or_lr_no" VARCHAR(100),
    "vehicle_no" VARCHAR(50),
    "driver_name" VARCHAR(150),
    "driver_contact" VARCHAR(50),
    "total_packages" INTEGER NOT NULL DEFAULT 0,
    "total_weight" DECIMAL(14,3),
    "total_volume" DECIMAL(14,3),
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "status" "contract_erection_delivery_start_status" NOT NULL DEFAULT 'DRAFT',
    "comments" TEXT,
    "confirmed_at" TIMESTAMPTZ(3),
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_erection_delivery_starts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_erection_delivery_items" (
    "id" UUID NOT NULL,
    "delivery_start_id" UUID NOT NULL,
    "sr_no" INTEGER NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "package_no" VARCHAR(50),
    "weight" DECIMAL(14,3),
    "volume" DECIMAL(14,3),
    "quantity" DECIMAL(14,3) NOT NULL,
    "status" "contract_erection_delivery_item_status" NOT NULL DEFAULT 'READY_TO_DISPATCH',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_erection_delivery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_erection_delivery_documents" (
    "id" UUID NOT NULL,
    "delivery_start_id" UUID NOT NULL,
    "document_name" VARCHAR(150) NOT NULL,
    "status" "contract_erection_delivery_document_status" NOT NULL DEFAULT 'PENDING',
    "attachment_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_erection_delivery_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_erection_delivery_start_attachments" (
    "id" UUID NOT NULL,
    "delivery_start_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_erection_delivery_start_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_erection_delivery_starts_contract_id_key" ON "contract_erection_delivery_starts"("contract_id");

-- CreateIndex
CREATE INDEX "contract_erection_delivery_starts_status_idx" ON "contract_erection_delivery_starts"("status");

-- CreateIndex
CREATE INDEX "contract_erection_delivery_items_delivery_start_id_sr_no_idx" ON "contract_erection_delivery_items"("delivery_start_id", "sr_no");

-- CreateIndex
CREATE UNIQUE INDEX "contract_erection_delivery_documents_delivery_start_id_docu_key" ON "contract_erection_delivery_documents"("delivery_start_id", "document_name");

-- CreateIndex
CREATE INDEX "contract_erection_delivery_start_attachments_delivery_start_idx" ON "contract_erection_delivery_start_attachments"("delivery_start_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "contract_erection_delivery_starts" ADD CONSTRAINT "contract_erection_delivery_starts_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_delivery_starts" ADD CONSTRAINT "contract_erection_delivery_starts_erection_schedule_id_fkey" FOREIGN KEY ("erection_schedule_id") REFERENCES "contract_erection_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_delivery_starts" ADD CONSTRAINT "contract_erection_delivery_starts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_delivery_starts" ADD CONSTRAINT "contract_erection_delivery_starts_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_delivery_items" ADD CONSTRAINT "contract_erection_delivery_items_delivery_start_id_fkey" FOREIGN KEY ("delivery_start_id") REFERENCES "contract_erection_delivery_starts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_delivery_documents" ADD CONSTRAINT "contract_erection_delivery_documents_delivery_start_id_fkey" FOREIGN KEY ("delivery_start_id") REFERENCES "contract_erection_delivery_starts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_delivery_documents" ADD CONSTRAINT "contract_erection_delivery_documents_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "contract_erection_delivery_start_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_delivery_start_attachments" ADD CONSTRAINT "contract_erection_delivery_start_attachments_delivery_star_fkey" FOREIGN KEY ("delivery_start_id") REFERENCES "contract_erection_delivery_starts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_delivery_start_attachments" ADD CONSTRAINT "contract_erection_delivery_start_attachments_uploaded_by_u_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
