-- FMP-SALES-09 — two active "waiting" statuses, who/when confirmed, and the optional enquiry -> contract link.
-- Additive only: no existing value, column or row is changed.

ALTER TYPE "SalesEnquiryStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_DRAWINGS';
ALTER TYPE "SalesEnquiryStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_CLIENT';

ALTER TABLE "sales_enquiries"
  ADD COLUMN "confirmed_by_user_id" UUID,
  ADD COLUMN "confirmed_at" TIMESTAMPTZ(3),
  ADD COLUMN "contract_id" UUID,
  ADD COLUMN "contract_linked_by_user_id" UUID,
  ADD COLUMN "contract_linked_at" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "sales_enquiries_contract_id_key" ON "sales_enquiries"("contract_id");

ALTER TABLE "sales_enquiries"
  ADD CONSTRAINT "sales_enquiries_confirmed_by_user_id_fkey" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "sales_enquiries_contract_linked_by_user_id_fkey" FOREIGN KEY ("contract_linked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "sales_enquiries_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
