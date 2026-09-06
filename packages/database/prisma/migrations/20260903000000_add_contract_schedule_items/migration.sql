-- CM-68A — additive: real Planned vs Actual contract schedule.
-- ContractScheduleItem stores only PLANNED stage entries; actual values are
-- always derived live from real workflow/payment/production/closeout
-- records (see contract-schedule-plan.service.ts), never stored here.

-- CreateEnum
CREATE TYPE "contract_schedule_stage_key" AS ENUM ('CONTRACT_SIGN', 'ADVANCE_PAYMENT', 'DRAWING_APPROVAL', 'ESTIMATION_SHEET', 'CASTING_PRODUCTION', 'DELIVERY', 'ERECTION', 'FINAL_CLOSEOUT');

-- CreateTable
CREATE TABLE "contract_schedule_items" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "stage_key" "contract_schedule_stage_key" NOT NULL,
    "stage_name" VARCHAR(150) NOT NULL,
    "responsible_team" VARCHAR(100),
    "planned_start_date" DATE,
    "planned_end_date" DATE,
    "planned_quantity" DECIMAL(14,3),
    "planned_molds" INTEGER,
    "remarks" TEXT,
    "sort_order" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_schedule_items_contract_id_idx" ON "contract_schedule_items"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_schedule_items_contract_id_stage_key_key" ON "contract_schedule_items"("contract_id", "stage_key");

-- AddForeignKey
ALTER TABLE "contract_schedule_items" ADD CONSTRAINT "contract_schedule_items_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_schedule_items" ADD CONSTRAINT "contract_schedule_items_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_schedule_items" ADD CONSTRAINT "contract_schedule_items_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
