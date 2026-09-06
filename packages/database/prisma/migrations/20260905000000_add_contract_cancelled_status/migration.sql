-- CM-69A — Safe Cancel/Void flow for contracts.
-- Additive only: new enum value + audit columns on the existing contracts
-- table. No data migration, no column drops, no cascading deletes anywhere.

-- AlterEnum
ALTER TYPE "contract_status" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "cancellation_reason" VARCHAR(1000),
ADD COLUMN     "cancelled_at" TIMESTAMPTZ(3),
ADD COLUMN     "cancelled_by_user_id" UUID;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
