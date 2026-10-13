-- FMP-BOQ-17 — additive only: reference files attached to BOQ items.
CREATE TYPE "contract_boq_attachment_source" AS ENUM ('CLIENT_INITIAL_DRAWING', 'TECHNICAL_REFERENCE');

CREATE TABLE "contract_boq_item_attachments" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "boq_item_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "source_type" "contract_boq_attachment_source" NOT NULL DEFAULT 'CLIENT_INITIAL_DRAWING',
    "notes" VARCHAR(1000),
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_boq_item_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contract_boq_item_attachments_contract_id_boq_item_id_idx" ON "contract_boq_item_attachments"("contract_id", "boq_item_id");
CREATE INDEX "contract_boq_item_attachments_boq_item_id_created_at_idx" ON "contract_boq_item_attachments"("boq_item_id", "created_at");

ALTER TABLE "contract_boq_item_attachments" ADD CONSTRAINT "contract_boq_item_attachments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_boq_item_attachments" ADD CONSTRAINT "contract_boq_item_attachments_boq_item_id_fkey" FOREIGN KEY ("boq_item_id") REFERENCES "contract_boq_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_boq_item_attachments" ADD CONSTRAINT "contract_boq_item_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
