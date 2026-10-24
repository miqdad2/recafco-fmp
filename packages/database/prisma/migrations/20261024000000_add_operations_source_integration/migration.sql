-- FMP-OPS-01 — read-only integration with the external RECAFCO Operations system.
-- Additive only: 5 enums, 6 tables, indexes and foreign keys, then one permission
-- (contracts.operations_link) granted to SUPER_ADMIN and CONTRACT_MANAGER. No existing table,
-- column, role mapping or user is changed or removed. Reviewed: the generated diff against the
-- dev database also listed unrelated historical drift (constraint/index renames); it is NOT included.

-- CreateEnum
CREATE TYPE "OperationsLinkMethod" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "OperationsSnapshotOrigin" AS ENUM ('LIVE', 'FIXTURE');

-- CreateEnum
CREATE TYPE "OperationsSyncOutcome" AS ENUM ('ACCEPTED', 'UNCHANGED', 'REJECTED_OLDER', 'REJECTED_INVALID', 'AUTH_FAILED', 'FORBIDDEN', 'NOT_FOUND', 'RATE_LIMITED', 'TIMEOUT', 'NETWORK_ERROR', 'SOURCE_ERROR');

-- CreateEnum
CREATE TYPE "OperationsConnectionState" AS ENUM ('NOT_CONFIGURED', 'OK', 'DEGRADED', 'AUTH_FAILED', 'PAUSED');

-- CreateEnum
CREATE TYPE "OperationsLinkAction" AS ENUM ('REGISTERED', 'LINKED', 'RELINKED', 'UNLINKED', 'AUTO_LINKED', 'SYNC_DISABLED', 'SYNC_ENABLED');

-- CreateTable
CREATE TABLE "operations_source_projects" (
    "id" UUID NOT NULL,
    "source_project_id" VARCHAR(200) NOT NULL,
    "source_code" VARCHAR(100),
    "job_order_normalized" VARCHAR(100),
    "factory_code" VARCHAR(20),
    "source_name" VARCHAR(300),
    "identity_verified_at" TIMESTAMPTZ(3),
    "contract_id" UUID,
    "link_method" "OperationsLinkMethod",
    "linked_at" TIMESTAMPTZ(3),
    "linked_by_user_id" UUID,
    "linked_by_name" VARCHAR(200),
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "current_snapshot_id" UUID,
    "last_attempt_at" TIMESTAMPTZ(3),
    "last_success_at" TIMESTAMPTZ(3),
    "last_outcome" "OperationsSyncOutcome",
    "last_error_message" VARCHAR(500),
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3),
    "refresh_requested_at" TIMESTAMPTZ(3),
    "refresh_requested_by_user_id" UUID,
    "lease_until" TIMESTAMPTZ(3),
    "lease_owner" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "operations_source_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations_progress_snapshots" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "origin" "OperationsSnapshotOrigin" NOT NULL DEFAULT 'LIVE',
    "retrieved_at" TIMESTAMPTZ(3) NOT NULL,
    "generated_at" TIMESTAMPTZ(3) NOT NULL,
    "source_code" VARCHAR(100),
    "source_factory" VARCHAR(20),
    "source_name" VARCHAR(300),
    "total" INTEGER NOT NULL,
    "issued" INTEGER NOT NULL,
    "produced" INTEGER NOT NULL,
    "delivered" INTEGER NOT NULL,
    "installed" INTEGER NOT NULL,
    "pending_inputs" INTEGER NOT NULL,
    "review_required_flag" BOOLEAN,
    "review_required_raw" JSONB,
    "source_notes" JSONB NOT NULL DEFAULT '[]',
    "group_by" VARCHAR(40) NOT NULL DEFAULT 'building',
    "columns" VARCHAR(200) NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "previous_snapshot_id" UUID,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "flags" JSONB NOT NULL DEFAULT '[]',
    "http_status" INTEGER,
    "duration_ms" INTEGER,
    "response_bytes" INTEGER,
    "unrecognised_keys" JSONB NOT NULL DEFAULT '[]',
    "historical_present" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operations_progress_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations_sync_runs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "trigger" VARCHAR(30) NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "finished_at" TIMESTAMPTZ(3),
    "outcome" "OperationsSyncOutcome" NOT NULL,
    "http_status" INTEGER,
    "duration_ms" INTEGER,
    "message" VARCHAR(500),

    CONSTRAINT "operations_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations_source_status" (
    "id" VARCHAR(20) NOT NULL,
    "connection_state" "OperationsConnectionState" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "circuit_open_until" TIMESTAMPTZ(3),
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMPTZ(3),
    "last_message" VARCHAR(500),
    "worker_heartbeat_at" TIMESTAMPTZ(3),
    "poll_interval_seconds" INTEGER,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "operations_source_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations_factory_mappings" (
    "id" UUID NOT NULL,
    "factory_code" VARCHAR(20) NOT NULL,
    "plant_id" UUID NOT NULL,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operations_factory_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations_project_link_events" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "action" "OperationsLinkAction" NOT NULL,
    "previous_contract_id" UUID,
    "new_contract_id" UUID,
    "actor_user_id" UUID,
    "actor_name" VARCHAR(200),
    "reason" VARCHAR(500),
    "details" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operations_project_link_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operations_source_projects_source_project_id_key" ON "operations_source_projects"("source_project_id");

-- CreateIndex
CREATE UNIQUE INDEX "operations_source_projects_contract_id_key" ON "operations_source_projects"("contract_id");

-- CreateIndex
CREATE INDEX "operations_source_projects_sync_enabled_next_attempt_at_idx" ON "operations_source_projects"("sync_enabled", "next_attempt_at");

-- CreateIndex
CREATE INDEX "operations_source_projects_job_order_normalized_factory_cod_idx" ON "operations_source_projects"("job_order_normalized", "factory_code");

-- CreateIndex
CREATE INDEX "operations_progress_snapshots_project_id_generated_at_idx" ON "operations_progress_snapshots"("project_id", "generated_at" DESC);

-- CreateIndex
CREATE INDEX "operations_progress_snapshots_project_id_retrieved_at_idx" ON "operations_progress_snapshots"("project_id", "retrieved_at" DESC);

-- CreateIndex
CREATE INDEX "operations_sync_runs_project_id_started_at_idx" ON "operations_sync_runs"("project_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "operations_sync_runs_started_at_idx" ON "operations_sync_runs"("started_at");

-- CreateIndex
CREATE UNIQUE INDEX "operations_factory_mappings_factory_code_key" ON "operations_factory_mappings"("factory_code");

-- CreateIndex
CREATE UNIQUE INDEX "operations_factory_mappings_plant_id_key" ON "operations_factory_mappings"("plant_id");

-- CreateIndex
CREATE INDEX "operations_project_link_events_project_id_created_at_idx" ON "operations_project_link_events"("project_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "operations_source_projects" ADD CONSTRAINT "operations_source_projects_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_progress_snapshots" ADD CONSTRAINT "operations_progress_snapshots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "operations_source_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_sync_runs" ADD CONSTRAINT "operations_sync_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "operations_source_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_factory_mappings" ADD CONSTRAINT "operations_factory_mappings_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_project_link_events" ADD CONSTRAINT "operations_project_link_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "operations_source_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "description", "module", "created_at")
VALUES
  (gen_random_uuid(), 'contracts.operations_link', 'Manage Operations project links', 'Confirm, change or remove the link between a contract and an external Operations project, and map factory codes to plants.', 'contracts', now())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, now() FROM "roles" r CROSS JOIN "permissions" p
WHERE r.code IN ('SUPER_ADMIN', 'CONTRACT_MANAGER') AND p.code = 'contracts.operations_link'
ON CONFLICT DO NOTHING;

-- Counts are never negative (the application rejects such responses before they reach here).
ALTER TABLE "operations_progress_snapshots" ADD CONSTRAINT "operations_progress_snapshots_counts_check"
  CHECK ("total" >= 0 AND "issued" >= 0 AND "produced" >= 0 AND "delivered" >= 0 AND "installed" >= 0 AND "pending_inputs" >= 0);
