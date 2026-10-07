-- FMP-CONTRACT-01 - Contract Party master.
-- Additive only: one enum, one table, two nullable columns on contracts, and
-- the default Second Party "RECAFCO". No existing data is changed.

-- CreateEnum
CREATE TYPE "ContractPartyType" AS ENUM ('FIRST_PARTY', 'SECOND_PARTY');

-- CreateTable
CREATE TABLE "contract_parties" (
    "id" UUID NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "party_type" "ContractPartyType" NOT NULL,
    "contact_no" VARCHAR(50),
    "email" VARCHAR(200),
    "address" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_parties_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN "first_party_id" UUID,
ADD COLUMN "second_party_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "contract_parties_name_party_type_key" ON "contract_parties"("name", "party_type");

-- CreateIndex
CREATE INDEX "contract_parties_party_type_is_active_idx" ON "contract_parties"("party_type", "is_active");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_first_party_id_fkey" FOREIGN KEY ("first_party_id") REFERENCES "contract_parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_second_party_id_fkey" FOREIGN KEY ("second_party_id") REFERENCES "contract_parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Default Second Party (idempotent)
INSERT INTO "contract_parties" ("id", "name", "party_type", "is_active", "updated_at")
VALUES (gen_random_uuid(), 'RECAFCO', 'SECOND_PARTY', true, CURRENT_TIMESTAMP)
ON CONFLICT ("name", "party_type") DO NOTHING;
