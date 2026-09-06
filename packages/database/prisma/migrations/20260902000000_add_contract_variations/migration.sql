-- CM-60 — Contract Variations / Change Orders. Purely additive: new enum +
-- new table, no existing column/constraint/migration touched. amount is
-- nullable and signed (no CHECK >= 0) — a deductive variation is a real
-- negative value, never clamped. Contract.contract_value itself is never
-- touched by this migration or by the backend that reads this table.

-- CreateEnum
CREATE TYPE "contract_variation_status" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "contract_variations" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "variation_no" VARCHAR(50),
    "description" VARCHAR(500) NOT NULL,
    "amount" DECIMAL(18,3),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'KWD',
    "affects_contract_value" BOOLEAN NOT NULL DEFAULT true,
    "status" "contract_variation_status" NOT NULL DEFAULT 'DRAFT',
    "submitted_date" DATE,
    "approved_date" DATE,
    "supporting_document_name" VARCHAR(300),
    "supporting_document_url" VARCHAR(1000),
    "remarks" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_variations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_variations_contract_id_created_at_idx" ON "contract_variations"("contract_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "contract_variations_status_idx" ON "contract_variations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "contract_variations_contract_id_variation_no_key" ON "contract_variations"("contract_id", "variation_no");

-- AddForeignKey
ALTER TABLE "contract_variations" ADD CONSTRAINT "contract_variations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_variations" ADD CONSTRAINT "contract_variations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_variations" ADD CONSTRAINT "contract_variations_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
