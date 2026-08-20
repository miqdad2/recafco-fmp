-- CM-23: Persist Contract BOQ Items.
--
-- Purely additive — one new enum, one new table referencing "contracts".
-- No changes to any existing column, constraint, or migration. Existing
-- contracts get zero rows here and continue to work unchanged.
--
-- Invoice Qty, P/R, and Remaining Amount are deliberately not columns here —
-- those will be calculated later from the payment/progress modules.

-- ---------------------------------------------------------------------------
-- Enum: contract_boq_mix_design_type
-- ---------------------------------------------------------------------------
CREATE TYPE "contract_boq_mix_design_type" AS ENUM ('GRAY', 'WHITE', 'NOT_APPLICABLE');

-- ---------------------------------------------------------------------------
-- contract_boq_items
-- ---------------------------------------------------------------------------
CREATE TABLE "contract_boq_items" (
  "id"                       uuid           NOT NULL DEFAULT gen_random_uuid(),
  "contract_id"              uuid           NOT NULL,
  "sort_order"               integer        NOT NULL,
  "item_code"                varchar(100),
  "category"                 varchar(100),
  "description"              varchar(500)   NOT NULL,
  "drawing_reference"        varchar(150),
  "specification_reference"  varchar(150),
  "original_estimated_qty"   numeric(14, 3),
  "revised_qty"              numeric(14, 3),
  "unit_of_measure"          varchar(50),
  "mix_design_type"          "contract_boq_mix_design_type",
  "concrete_grade"           varchar(50),
  "unit_price"               numeric(18, 3),
  "total_price"              numeric(18, 3),
  "created_at"               timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at"               timestamptz(3) NOT NULL,
  CONSTRAINT "contract_boq_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_boq_items_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT,
  CONSTRAINT "contract_boq_items_contract_id_item_code_key" UNIQUE ("contract_id", "item_code")
);

CREATE INDEX "contract_boq_items_contract_id_sort_order_idx"
  ON "contract_boq_items"("contract_id", "sort_order");
