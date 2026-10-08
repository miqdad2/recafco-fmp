-- FMP-BOQ-11 - Technical Drawing / Calculation Groups.
-- Additive only: one enum, two tables, indexes and foreign keys. No existing table or data changes.

-- CreateEnum
CREATE TYPE "technical_drawing_group_status" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'RELEASED_TO_PRODUCTION', 'REVISED', 'CANCELLED');

-- CreateTable
CREATE TABLE "technical_drawing_groups" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "boq_item_id" UUID NOT NULL,
    "drawing_confirmation_id" UUID,
    "drawing_no" VARCHAR(100) NOT NULL,
    "calculation_ref" VARCHAR(100),
    "group_title" VARCHAR(200),
    "status" "technical_drawing_group_status" NOT NULL DEFAULT 'DRAFT',
    "remarks" VARCHAR(2000),
    "created_by_id" UUID,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "released_by_id" UUID,
    "released_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "technical_drawing_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_drawing_group_pieces" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "piece_id" UUID NOT NULL,
    "active_slot" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technical_drawing_group_pieces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "technical_drawing_groups_contract_id_idx" ON "technical_drawing_groups"("contract_id");

-- CreateIndex
CREATE INDEX "technical_drawing_groups_boq_item_id_status_idx" ON "technical_drawing_groups"("boq_item_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "technical_drawing_group_pieces_group_id_piece_id_key" ON "technical_drawing_group_pieces"("group_id", "piece_id");

-- CreateIndex
CREATE UNIQUE INDEX "technical_drawing_group_pieces_piece_id_active_slot_key" ON "technical_drawing_group_pieces"("piece_id", "active_slot");

-- CreateIndex
CREATE INDEX "technical_drawing_group_pieces_piece_id_idx" ON "technical_drawing_group_pieces"("piece_id");

-- AddForeignKey
ALTER TABLE "technical_drawing_groups" ADD CONSTRAINT "technical_drawing_groups_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_drawing_groups" ADD CONSTRAINT "technical_drawing_groups_boq_item_id_fkey" FOREIGN KEY ("boq_item_id") REFERENCES "contract_boq_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_drawing_groups" ADD CONSTRAINT "technical_drawing_groups_drawing_confirmation_id_fkey" FOREIGN KEY ("drawing_confirmation_id") REFERENCES "contract_boq_drawing_confirmations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_drawing_groups" ADD CONSTRAINT "technical_drawing_groups_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_drawing_groups" ADD CONSTRAINT "technical_drawing_groups_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_drawing_groups" ADD CONSTRAINT "technical_drawing_groups_released_by_id_fkey" FOREIGN KEY ("released_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_drawing_group_pieces" ADD CONSTRAINT "technical_drawing_group_pieces_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "technical_drawing_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_drawing_group_pieces" ADD CONSTRAINT "technical_drawing_group_pieces_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "contract_boq_pieces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
