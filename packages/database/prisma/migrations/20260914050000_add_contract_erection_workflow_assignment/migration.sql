-- CM-71H — Erection Workflow Assignment ownership (additive; no existing table touched)

-- CreateEnum
CREATE TYPE "contract_erection_workflow_assignment_status" AS ENUM ('ASSIGNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "contract_erection_workflow_assignments" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "assigned_to_user_id" UUID,
    "assigned_to_name" VARCHAR(200),
    "assigned_department" VARCHAR(150) NOT NULL DEFAULT 'Erection Department',
    "assigned_by_user_id" UUID,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "contract_erection_workflow_assignment_status" NOT NULL DEFAULT 'ASSIGNED',
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_erection_workflow_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_erection_workflow_assignments_contract_id_key" ON "contract_erection_workflow_assignments"("contract_id");

-- CreateIndex
CREATE INDEX "contract_erection_workflow_assignments_assigned_to_user_id_idx" ON "contract_erection_workflow_assignments"("assigned_to_user_id");

-- AddForeignKey
ALTER TABLE "contract_erection_workflow_assignments" ADD CONSTRAINT "contract_erection_workflow_assignments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_workflow_assignments" ADD CONSTRAINT "contract_erection_workflow_assignments_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_erection_workflow_assignments" ADD CONSTRAINT "contract_erection_workflow_assignments_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
