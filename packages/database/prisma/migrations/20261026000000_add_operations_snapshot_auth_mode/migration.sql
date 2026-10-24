-- FMP-OPS-03 — provenance: how the worker signed in when a snapshot was retrieved (password | demo). Additive, nullable.
ALTER TABLE "operations_progress_snapshots" ADD COLUMN "auth_mode" VARCHAR(20);
