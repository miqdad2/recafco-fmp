-- CM-21: Add manual Contract Register fields (no SAP dependency).
--
-- Purely additive — 6 new nullable columns on "contracts", no changes to any
-- existing column, constraint, or migration. Existing rows get NULL for all
-- of these and continue to work unchanged (all reads treat NULL as "not provided").

ALTER TABLE "contracts" ADD COLUMN "job_order" VARCHAR(100);
ALTER TABLE "contracts" ADD COLUMN "contract_date" DATE;
ALTER TABLE "contracts" ADD COLUMN "quotation_number" VARCHAR(100);
ALTER TABLE "contracts" ADD COLUMN "project_number" VARCHAR(100);
ALTER TABLE "contracts" ADD COLUMN "scope_of_work" JSONB;
ALTER TABLE "contracts" ADD COLUMN "payment_terms" JSONB;
