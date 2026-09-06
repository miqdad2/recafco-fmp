-- CM-60C — Real uploaded supporting documents for a variation. Purely
-- additive: one new table, no existing column/constraint/migration touched.
-- ContractVariation's own supporting_document_name/supporting_document_url
-- columns are untouched — real uploads are additive, not a replacement.
-- ON DELETE CASCADE on variation_id: no delete endpoint exists for a
-- variation today, but if one is ever added its attachments should never
-- become orphaned rows pointing at nothing.

-- CreateTable
CREATE TABLE "contract_variation_attachments" (
    "id" UUID NOT NULL,
    "variation_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_variation_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_variation_attachments_variation_id_created_at_idx" ON "contract_variation_attachments"("variation_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "contract_variation_attachments" ADD CONSTRAINT "contract_variation_attachments_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "contract_variations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_variation_attachments" ADD CONSTRAINT "contract_variation_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
