-- CM-24: Reviewer-requested contract information — client contact, dates,
-- original value, project/scope details, and erection/crane fields.
--
-- Purely additive — 15 new nullable columns on "contracts". No changes to
-- any existing column, constraint, or migration. Existing contracts get
-- NULL for all of these and continue to work unchanged.

ALTER TABLE "contracts" ADD COLUMN "client_contact_name" VARCHAR(150);
ALTER TABLE "contracts" ADD COLUMN "client_contact_phone" VARCHAR(50);
ALTER TABLE "contracts" ADD COLUMN "forecast_completion_date" DATE;
ALTER TABLE "contracts" ADD COLUMN "original_contract_value" NUMERIC(18, 3);
ALTER TABLE "contracts" ADD COLUMN "original_currency" VARCHAR(3);
ALTER TABLE "contracts" ADD COLUMN "project_site_location" VARCHAR(255);
ALTER TABLE "contracts" ADD COLUMN "scope_description" TEXT;
ALTER TABLE "contracts" ADD COLUMN "scope_exclusions" TEXT;
ALTER TABLE "contracts" ADD COLUMN "deliverables" TEXT;
ALTER TABLE "contracts" ADD COLUMN "milestones" TEXT;
ALTER TABLE "contracts" ADD COLUMN "schedule_summary" TEXT;
ALTER TABLE "contracts" ADD COLUMN "quantities_specifications" TEXT;
ALTER TABLE "contracts" ADD COLUMN "crane_required" VARCHAR(30);
ALTER TABLE "contracts" ADD COLUMN "crane_provided_by" VARCHAR(30);
ALTER TABLE "contracts" ADD COLUMN "estimated_crane_capacity" VARCHAR(100);
