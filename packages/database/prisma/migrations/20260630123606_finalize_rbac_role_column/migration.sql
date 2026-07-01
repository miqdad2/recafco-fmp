-- Migration 0004: Finalize RBAC — make role_id NOT NULL, remove legacy role column
--
-- Prerequisites (verified before this migration runs):
--   - Migration 0003 applied and data backfill confirmed:
--       every user in the users table has a non-NULL role_id
--   - No users remain with the legacy enum values (ADMIN / USER) without a role_id
--   - All pnpm db:validate, db:generate, lint, typecheck, test, build checks pass
--
-- IMPORTANT: Do not apply this migration until migration 0003 data backfill
-- has been manually verified with:
--   SELECT COUNT(*) FROM users WHERE role_id IS NULL;   -- must return 0
--
-- This migration is intentionally NOT run automatically on API startup.
-- Apply explicitly with: pnpm db:migrate:deploy

-- Step 1: Safety guard — abort the entire migration if any user has NULL role_id.
-- This prevents data loss if the migration 0003 backfill did not complete.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "users" WHERE "role_id" IS NULL LIMIT 1
    ) THEN
        RAISE EXCEPTION
            'Migration 0004 aborted: at least one user has a NULL role_id. '
            'Verify that migration 0003 data backfill completed successfully '
            'before running this migration. '
            'Run: SELECT COUNT(*) FROM users WHERE role_id IS NULL;';
    END IF;
END $$;

-- Step 2: Make role_id NOT NULL now that every user has been backfilled.
ALTER TABLE "users" ALTER COLUMN "role_id" SET NOT NULL;

-- Step 3: Remove the legacy role enum column (replaced by role_id FK).
ALTER TABLE "users" DROP COLUMN "role";

-- Step 4: Drop the legacy enum type (no longer referenced by any column).
DROP TYPE "user_role";
