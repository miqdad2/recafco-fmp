-- CM-55: Contract List approved-design rebuild — adds a manager-facing
-- schedule/progress status (In Progress / On Track / Delayed / Completed /
-- Ahead of Schedule) for the Contract List's Status column.
--
-- Purely additive — one new nullable enum column on "contracts", no changes
-- to any existing column, constraint, or migration. Existing rows get NULL.
--
-- Deliberately SEPARATE from the "contract_status" enum/"status" column
-- (the real lifecycle: DRAFT/ACTIVE/TERMINATED/CLOSED). Nothing in
-- activate/terminate/close ever writes this column; the closeout approval
-- flow never reads it. Only PATCH /contracts/:id/schedule-status
-- (contracts.update permission, department-scoped) ever sets it.

CREATE TYPE "contract_schedule_status" AS ENUM ('IN_PROGRESS', 'ON_TRACK', 'DELAYED', 'COMPLETED', 'AHEAD_OF_SCHEDULE');

ALTER TABLE "contracts" ADD COLUMN "schedule_status" "contract_schedule_status";
