-- FMP-BOQ-03 - Technical drawing-confirmed pieces per BOQ item.
-- Additive only: one enum, one table, indexes and foreign keys. No existing
-- table or data is changed. Hand-written to match the schema (shadow-DB workaround).

-- CreateEnum
CREATE TYPE "contract_boq_confirmation_status" AS ENUM ('DRAFT', 'CONFIRMED', 'REVISED', 'CANCELLED');

-- CreateTable
CREATE TABLE "contract_boq_drawing_confirmations" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "boq_item_id" UUID NOT NULL,
    "drawing_no" VARCHAR(100) NOT NULL,
    "drawing_title" VARCHAR(200),
    "confirmed_pieces" INTEGER,
    "size_or_specification" VARCHAR(300),
    "revision" VARCHAR(50),
    "confirmation_status" "contract_boq_confirmation_status" NOT NULL DEFAULT 'DRAFT',
    "remarks" VARCHAR(2000),
    "confirmed_by_id" UUID,
    "confirmed_at" TIMESTAMPTZ(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_boq_drawing_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_boq_drawing_confirmations_contract_id_idx" ON "contract_boq_drawing_confirmations"("contract_id");

-- CreateIndex
CREATE INDEX "contract_boq_drawing_confirmations_boq_item_id_confirmation_status_idx" ON "contract_boq_drawing_confirmations"("boq_item_id", "confirmation_status");

-- AddForeignKey
ALTER TABLE "contract_boq_drawing_confirmations" ADD CONSTRAINT "contract_boq_drawing_confirmations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_boq_drawing_confirmations" ADD CONSTRAINT "contract_boq_drawing_confirmations_boq_item_id_fkey" FOREIGN KEY ("boq_item_id") REFERENCES "contract_boq_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_boq_drawing_confirmations" ADD CONSTRAINT "contract_boq_drawing_confirmations_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_boq_drawing_confirmations" ADD CONSTRAINT "contract_boq_drawing_confirmations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
