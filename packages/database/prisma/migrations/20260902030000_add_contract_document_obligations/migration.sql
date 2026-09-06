-- CreateEnum
CREATE TYPE "contract_document_obligation_category" AS ENUM ('PERFORMANCE_BOND', 'INSURANCE', 'GUARANTEE', 'TAX_STATUTORY', 'TECHNICAL_SUBMISSION', 'APPROVAL_DOCUMENT', 'HEALTH_SAFETY', 'OTHER');

-- CreateEnum
CREATE TYPE "contract_document_obligation_status" AS ENUM ('PENDING', 'SUBMITTED', 'EXPIRING_SOON', 'EXPIRED_OVERDUE', 'NOT_REQUIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "contract_document_obligations" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "item_no" VARCHAR(50),
    "title" VARCHAR(300) NOT NULL,
    "category" "contract_document_obligation_category" NOT NULL DEFAULT 'OTHER',
    "responsible_party" VARCHAR(150),
    "required_date" DATE,
    "submission_or_expiry_date" DATE,
    "status" "contract_document_obligation_status" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_document_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_document_obligation_attachments" (
    "id" UUID NOT NULL,
    "document_obligation_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_document_obligation_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_document_obligations_contract_id_created_at_idx" ON "contract_document_obligations"("contract_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "contract_document_obligations_status_idx" ON "contract_document_obligations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "contract_document_obligations_contract_id_item_no_key" ON "contract_document_obligations"("contract_id", "item_no");

-- CreateIndex
CREATE INDEX "contract_document_obligation_attachments_document_obligatio_idx" ON "contract_document_obligation_attachments"("document_obligation_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "contract_document_obligations" ADD CONSTRAINT "contract_document_obligations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_document_obligations" ADD CONSTRAINT "contract_document_obligations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_document_obligations" ADD CONSTRAINT "contract_document_obligations_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_document_obligation_attachments" ADD CONSTRAINT "contract_document_obligation_attachments_document_obligati_fkey" FOREIGN KEY ("document_obligation_id") REFERENCES "contract_document_obligations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_document_obligation_attachments" ADD CONSTRAINT "contract_document_obligation_attachments_uploaded_by_user__fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
