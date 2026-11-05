-- FMP-SALES-11 — how an enquiry's contract link came about: created through the enquiry's "Create Contract" flow, or an
-- existing contract linked afterwards. Additive and nullable: links made before this column existed stay NULL
-- (origin unknown) and are never counted as "created from an enquiry".
CREATE TYPE "SalesContractLinkSource" AS ENUM ('CREATED', 'LINKED');

ALTER TABLE "sales_enquiries" ADD COLUMN "contract_link_source" "SalesContractLinkSource";

CREATE INDEX "sales_enquiries_contract_link_source_contract_linked_at_idx" ON "sales_enquiries"("contract_link_source", "contract_linked_at");
