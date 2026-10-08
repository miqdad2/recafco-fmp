-- FMP-ACCESS-01 — additive, non-destructive: explicit "Full Platform Access" display mode.
-- Existing users default to false (no behaviour change). Presentation only; grants no permissions.
ALTER TABLE "users" ADD COLUMN "full_platform_access" BOOLEAN NOT NULL DEFAULT false;
