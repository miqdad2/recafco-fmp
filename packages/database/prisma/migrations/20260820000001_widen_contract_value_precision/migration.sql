-- CM-23: Widen contracts.contract_value from numeric(18,2) to numeric(18,3).
--
-- Purely additive precision widening — no data loss, existing values remain
-- exactly representable (a 2-decimal value is always exactly representable
-- with 3 decimals). Needed because contractValue can now be derived as the
-- sum of ContractBoqItem.total_price values, which are numeric(18,3)
-- (KWD has 3-decimal fils subdivisions) — keeping contract_value at 2
-- decimals would silently round away real BOQ precision.

ALTER TABLE "contracts" ALTER COLUMN "contract_value" TYPE numeric(18, 3);
