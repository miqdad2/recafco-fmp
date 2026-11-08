-- FMP-SALES-18 — in-progress enquiry statuses added by management from the Change Status menu.
-- Additive only: one new enum value (added once, never per status), one new table, one nullable column, one CHECK.
-- No existing value, column or row is changed.

ALTER TYPE "SalesEnquiryStatus" ADD VALUE IF NOT EXISTS 'CUSTOM';

CREATE TABLE "sales_custom_statuses" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "name_key" VARCHAR(60) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_custom_statuses_pkey" PRIMARY KEY ("id")
);

-- Case/spacing variants share one name_key, so the same status can never be created twice (also under concurrent requests).
CREATE UNIQUE INDEX "sales_custom_statuses_name_key_key" ON "sales_custom_statuses"("name_key");

ALTER TABLE "sales_custom_statuses"
  ADD CONSTRAINT "sales_custom_statuses_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_enquiries" ADD COLUMN "custom_status_id" UUID;

CREATE INDEX "sales_enquiries_custom_status_id_idx" ON "sales_enquiries"("custom_status_id");

ALTER TABLE "sales_enquiries"
  ADD CONSTRAINT "sales_enquiries_custom_status_id_fkey" FOREIGN KEY ("custom_status_id") REFERENCES "sales_custom_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A custom status id is present exactly when the stored status is CUSTOM. Compared as text so the new enum value is not
-- used inside the transaction that adds it. Every existing row has a system status and a null id, so it passes.
ALTER TABLE "sales_enquiries"
  ADD CONSTRAINT "sales_enquiries_custom_status_check" CHECK (("status"::text = 'CUSTOM') = ("custom_status_id" IS NOT NULL));
