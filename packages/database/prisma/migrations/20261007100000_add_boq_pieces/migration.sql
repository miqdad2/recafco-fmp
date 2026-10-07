-- FMP-BOQ-04 - piece tracking foundation (pieces generated from CONFIRMED drawing confirmations).
-- Additive only: one enum, two tables, indexes and foreign keys. No existing table or data changes.

-- CreateEnum
CREATE TYPE "contract_boq_piece_status" AS ENUM ('NOT_STARTED', 'DRAWING_READY', 'IN_PRODUCTION', 'PRODUCED', 'IN_STORE', 'DELIVERED', 'ERECTED', 'COMPLETED', 'ON_HOLD', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "contract_boq_pieces" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "boq_item_id" UUID NOT NULL,
    "drawing_confirmation_id" UUID NOT NULL,
    "piece_no" INTEGER NOT NULL,
    "piece_code" VARCHAR(150) NOT NULL,
    "current_status" "contract_boq_piece_status" NOT NULL DEFAULT 'DRAWING_READY',
    "drawing_no" VARCHAR(100) NOT NULL,
    "size_or_specification" VARCHAR(300),
    "current_location" VARCHAR(200),
    "remarks" VARCHAR(2000),
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_boq_pieces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_boq_piece_status_history" (
    "id" UUID NOT NULL,
    "piece_id" UUID NOT NULL,
    "old_status" "contract_boq_piece_status",
    "new_status" "contract_boq_piece_status" NOT NULL,
    "note" VARCHAR(1000),
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_boq_piece_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_boq_pieces_contract_id_piece_code_key" ON "contract_boq_pieces"("contract_id", "piece_code");

-- CreateIndex
CREATE UNIQUE INDEX "contract_boq_pieces_drawing_confirmation_id_piece_no_key" ON "contract_boq_pieces"("drawing_confirmation_id", "piece_no");

-- CreateIndex
CREATE INDEX "contract_boq_pieces_boq_item_id_current_status_idx" ON "contract_boq_pieces"("boq_item_id", "current_status");

-- CreateIndex
CREATE INDEX "contract_boq_pieces_contract_id_idx" ON "contract_boq_pieces"("contract_id");

-- CreateIndex
CREATE INDEX "contract_boq_piece_status_history_piece_id_created_at_idx" ON "contract_boq_piece_status_history"("piece_id", "created_at");

-- AddForeignKey
ALTER TABLE "contract_boq_pieces" ADD CONSTRAINT "contract_boq_pieces_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_boq_pieces" ADD CONSTRAINT "contract_boq_pieces_boq_item_id_fkey" FOREIGN KEY ("boq_item_id") REFERENCES "contract_boq_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_boq_pieces" ADD CONSTRAINT "contract_boq_pieces_drawing_confirmation_id_fkey" FOREIGN KEY ("drawing_confirmation_id") REFERENCES "contract_boq_drawing_confirmations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_boq_piece_status_history" ADD CONSTRAINT "contract_boq_piece_status_history_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "contract_boq_pieces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_boq_piece_status_history" ADD CONSTRAINT "contract_boq_piece_status_history_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
