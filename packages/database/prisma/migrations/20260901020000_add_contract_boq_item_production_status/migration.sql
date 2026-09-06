-- CM-59 — Contract Production Status. Purely additive: new enum + new table,
-- no existing column/constraint/migration touched. One optional row per BOQ
-- item (contract_boq_item_id UNIQUE), created lazily on first update.
-- ON DELETE CASCADE on contract_boq_item_id: Edit Contract's BOQ save path
-- deletes and recreates ALL of a contract's contract_boq_items rows whenever
-- the BOQ is replaced, so this FK must cascade rather than restrict, or that
-- existing save flow would break the moment any item had production tracked.

-- CreateEnum
CREATE TYPE "contract_boq_production_status" AS ENUM ('NOT_STARTED', 'IN_PRODUCTION', 'PARTIALLY_DELIVERED', 'COMPLETED', 'DELAYED');

-- CreateTable
CREATE TABLE "contract_boq_item_production_status" (
    "id" UUID NOT NULL,
    "contract_boq_item_id" UUID NOT NULL,
    "produced_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "delivered_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "status" "contract_boq_production_status" NOT NULL DEFAULT 'NOT_STARTED',
    "remarks" TEXT,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_boq_item_production_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_boq_item_production_status_contract_boq_item_id_key" ON "contract_boq_item_production_status"("contract_boq_item_id");

-- AddForeignKey
ALTER TABLE "contract_boq_item_production_status" ADD CONSTRAINT "contract_boq_item_production_status_contract_boq_item_id_fkey" FOREIGN KEY ("contract_boq_item_id") REFERENCES "contract_boq_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_boq_item_production_status" ADD CONSTRAINT "contract_boq_item_production_status_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
