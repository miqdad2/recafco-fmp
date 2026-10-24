-- FMP-OPS-03 — Operations project discovery bookkeeping and the richer progress report. Additive only:
-- nullable/defaulted columns on three FMP-OPS-01 tables. Nothing existing is changed, removed or rewritten.

ALTER TABLE "operations_source_projects"
  ADD COLUMN "source_is_training" BOOLEAN,
  ADD COLUMN "excluded_reason" VARCHAR(40),
  ADD COLUMN "first_listed_at" TIMESTAMPTZ(3),
  ADD COLUMN "last_listed_at" TIMESTAMPTZ(3),
  ADD COLUMN "missing_from_list_since" TIMESTAMPTZ(3);

ALTER TABLE "operations_progress_snapshots"
  ADD COLUMN "measures" JSONB,
  ADD COLUMN "breakdown" JSONB,
  ADD COLUMN "historical" JSONB,
  ADD COLUMN "review_notes" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "conflict_marks_count" INTEGER,
  ADD COLUMN "conflict_marks_raw" JSONB;

ALTER TABLE "operations_source_status"
  ADD COLUMN "auth_mode" VARCHAR(20),
  ADD COLUMN "discovery_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "last_discovery_at" TIMESTAMPTZ(3),
  ADD COLUMN "last_discovery_outcome" VARCHAR(30),
  ADD COLUMN "last_discovery_message" VARCHAR(500),
  ADD COLUMN "last_discovery_project_count" INTEGER,
  ADD COLUMN "next_discovery_at" TIMESTAMPTZ(3),
  ADD COLUMN "discovery_lease_until" TIMESTAMPTZ(3);

CREATE INDEX "operations_source_projects_excluded_reason_idx" ON "operations_source_projects"("excluded_reason");
