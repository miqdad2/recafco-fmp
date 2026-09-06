-- CM-62 — Contract Risk Assessment. Purely additive: 3 new enums + 1 new
-- table, no existing column/constraint/migration touched. Not an ISO
-- risk-scoring system: risk_evaluation and residual_risk are plain manual
-- dropdown values, never auto-calculated — no numeric risk-score column
-- exists anywhere on this table.

-- CreateEnum
CREATE TYPE "contract_risk_level" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "contract_risk_response" AS ENUM ('MITIGATE', 'ACCEPT', 'AVOID', 'TRANSFER');

-- CreateEnum
CREATE TYPE "contract_risk_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'MITIGATED', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "contract_risks" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "risk_no" VARCHAR(50),
    "description" VARCHAR(500) NOT NULL,
    "risk_evaluation" "contract_risk_level" NOT NULL DEFAULT 'MEDIUM',
    "risk_response" "contract_risk_response" NOT NULL DEFAULT 'MITIGATE',
    "risk_response_description" TEXT,
    "residual_risk" "contract_risk_level",
    "status" "contract_risk_status" NOT NULL DEFAULT 'OPEN',
    "responsible_user_id" UUID,
    "action_due_date" DATE,
    "remarks" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_risks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_risks_contract_id_created_at_idx" ON "contract_risks"("contract_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "contract_risks_status_idx" ON "contract_risks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "contract_risks_contract_id_risk_no_key" ON "contract_risks"("contract_id", "risk_no");

-- AddForeignKey
ALTER TABLE "contract_risks" ADD CONSTRAINT "contract_risks_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_risks" ADD CONSTRAINT "contract_risks_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_risks" ADD CONSTRAINT "contract_risks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_risks" ADD CONSTRAINT "contract_risks_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
