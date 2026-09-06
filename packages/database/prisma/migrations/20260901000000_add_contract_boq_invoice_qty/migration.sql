-- CM-56: New Contract Register approved-design rebuild — real, editable
-- "Invoice Qty" per BOQ item (matches BOQ Qty / Area's own precision/scale).
--
-- Purely additive — one new nullable column on "contract_boq_items", no
-- changes to any existing column, constraint, or migration. Existing rows
-- get NULL.
--
-- Progress / Invoice % and Amount Remaining are deliberately NOT stored —
-- both are always derived from invoiceQty/totalPrice in the web app
-- (contract-boq-helpers.ts), never trusted/stored values.

ALTER TABLE "contract_boq_items" ADD COLUMN "invoice_qty" DECIMAL(14,3);
