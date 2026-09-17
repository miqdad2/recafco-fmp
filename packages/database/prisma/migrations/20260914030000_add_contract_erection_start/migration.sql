-- CreateEnum
CREATE TYPE "contract_erection_start_status" AS ENUM ('DRAFT', 'STARTED', 'HOLD', 'RETURNED');

-- CreateEnum
CREATE TYPE "contract_erection_start_checklist_status" AS ENUM ('PENDING', 'COMPLETED', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "contract_erection_starts" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "delivery_start_id" UUID,
    "erection_schedule_id" UUID,
    "job_order_no" VARCHAR(50) NOT NULL,
    "planned_start_date" DATE,
    "actual_start_date_time" TIMESTAMPTZ(3),
    "work_location_yard" VARCHAR(200) NOT NULL,
    "erection_crew_team" VARCHAR(150) NOT NULL,
    "supervisor" VARCHAR(150) NOT NULL,
    "weather_condition" VARCHAR(100),
    "wind_speed" VARCHAR(50),
    "method_statement_ref_no" VARCHAR(50),
    "scope_of_work_today" TEXT NOT NULL,
    "status" "contract_erection_start_status" NOT NULL DEFAULT 'DRAFT',
    "comments" TEXT,
    "confirmed_at" TIMESTAMPTZ(3),
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_erection_starts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_erection_start_manpower" (
    "id" UUID NOT NULL,
    "erection_start_id" UUID NOT NULL,
    "trade" VARCHAR(100) NOT NULL,
    "planned_nos" INTEGER NOT NULL DEFAULT 0,
    "actual_deployed_nos" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_erection_start_manpower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_erection_start_equipment" (
    "id" UUID NOT NULL,
    "erection_start_id" UUID NOT NULL,
    "equipment_type" VARCHAR(100) NOT NULL,
    "description_capacity" VARCHAR(200) NOT NULL,
    "owned_or_rental" VARCHAR(50) NOT NULL,
    "assigned_qty" INTEGER NOT NULL DEFAULT 0,
    "operator_driver" VARCHAR(150),
    "remarks" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_erection_start_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_erection_start_checklist" (
    "id" UUID NOT NULL,
    "erection_start_id" UUID NOT NULL,
    "checklist_item" VARCHAR(150) NOT NULL,
    "status" "contract_erection_start_checklist_status" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_erection_start_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_erection_start_attachments" (
    "id" UUID NOT NULL,
    "erection_start_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_erection_start_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_erection_starts_contract_id_key" ON "contract_erection_starts"("contract_id");

-- CreateIndex
CREATE INDEX "contract_erection_starts_status_idx" ON "contract_erection_starts"("status");

-- CreateIndex
CREATE INDEX "contract_erection_start_manpower_erection_start_id_sort_ord_idx" ON "contract_erection_start_manpower"("erection_start_id", "sort_order");

-- CreateIndex
CREATE INDEX "contract_erection_start_equipment_erection_start_id_sort_or_idx" ON "contract_erection_start_equipment"("erection_start_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "contract_erection_start_checklist_erection_start_id_checkli_key" ON "contract_erection_start_checklist"("erection_start_id", "checklist_item");

-- CreateIndex
CREATE INDEX "contract_erection_start_attachments_erection_start_id_creat_idx" ON "contract_erection_start_attachments"("erection_start_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "contract_erection_starts" ADD CONSTRAINT "contract_erection_starts_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_starts" ADD CONSTRAINT "contract_erection_starts_delivery_start_id_fkey" FOREIGN KEY ("delivery_start_id") REFERENCES "contract_erection_delivery_starts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_starts" ADD CONSTRAINT "contract_erection_starts_erection_schedule_id_fkey" FOREIGN KEY ("erection_schedule_id") REFERENCES "contract_erection_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_starts" ADD CONSTRAINT "contract_erection_starts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_starts" ADD CONSTRAINT "contract_erection_starts_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_start_manpower" ADD CONSTRAINT "contract_erection_start_manpower_erection_start_id_fkey" FOREIGN KEY ("erection_start_id") REFERENCES "contract_erection_starts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_start_equipment" ADD CONSTRAINT "contract_erection_start_equipment_erection_start_id_fkey" FOREIGN KEY ("erection_start_id") REFERENCES "contract_erection_starts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_start_checklist" ADD CONSTRAINT "contract_erection_start_checklist_erection_start_id_fkey" FOREIGN KEY ("erection_start_id") REFERENCES "contract_erection_starts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_start_attachments" ADD CONSTRAINT "contract_erection_start_attachments_erection_start_id_fkey" FOREIGN KEY ("erection_start_id") REFERENCES "contract_erection_starts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_start_attachments" ADD CONSTRAINT "contract_erection_start_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
