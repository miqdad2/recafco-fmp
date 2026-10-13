-- FMP-TECH-27 — additive only: final drawing files per element, and a release marker for individually covered elements.
ALTER TABLE "contract_boq_pieces"
  ADD COLUMN "released_to_production_at" TIMESTAMPTZ(3),
  ADD COLUMN "released_to_production_by_id" UUID;

CREATE TABLE "contract_boq_piece_attachments" (
    "id" UUID NOT NULL,
    "piece_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "boq_item_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "drawing_ref_no" VARCHAR(100),
    "revision" VARCHAR(50),
    "remarks" VARCHAR(1000),
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_boq_piece_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contract_boq_piece_attachments_piece_id_created_at_idx" ON "contract_boq_piece_attachments"("piece_id", "created_at");
CREATE INDEX "contract_boq_piece_attachments_contract_id_idx" ON "contract_boq_piece_attachments"("contract_id");

ALTER TABLE "contract_boq_piece_attachments" ADD CONSTRAINT "contract_boq_piece_attachments_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "contract_boq_pieces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_boq_piece_attachments" ADD CONSTRAINT "contract_boq_piece_attachments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_boq_piece_attachments" ADD CONSTRAINT "contract_boq_piece_attachments_boq_item_id_fkey" FOREIGN KEY ("boq_item_id") REFERENCES "contract_boq_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_boq_piece_attachments" ADD CONSTRAINT "contract_boq_piece_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
