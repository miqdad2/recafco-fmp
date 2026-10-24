-- FMP-OPS-01 — newest accepted source generated_at per project (ordering guard: an older response
-- never replaces newer data, even when the content was unchanged and no new snapshot was written).
-- Additive and nullable.
ALTER TABLE "operations_source_projects" ADD COLUMN "last_generated_at" TIMESTAMPTZ(3);
