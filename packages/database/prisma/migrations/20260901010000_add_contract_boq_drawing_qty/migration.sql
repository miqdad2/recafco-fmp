-- CM-56D — "Drawing Qty" per BOQ item: quantity confirmed during
-- drawing/calculation stages. Purely additive — one new nullable column on
-- "contract_boq_items", no changes to any existing column, constraint, or
-- migration. Existing rows get NULL.
--
-- Deliberately never read by any BOQ formula (Total Price, Progress /
-- Invoice %, Amount Remaining) — informational/technical quantity
-- confirmation only, distinct from revised_qty (which IS used as a
-- Total-Price override).

ALTER TABLE "contract_boq_items" ADD COLUMN "drawing_qty" DECIMAL(14,3);
