-- CM-46B: Contract Staff focused task screen — optional Receipt Details /
-- Drawing-Task Information / Follow-up intake fields (received date, sender,
-- drawing reference/revision, related area, internal notes, etc.).
--
-- Purely additive — one new nullable JSONB column on
-- "contract_workflow_tasks", no changes to any existing column, constraint,
-- or migration. Existing rows get NULL and continue to work unchanged.
--
-- This column NEVER carries core workflow state that already has its own
-- real column (status, remarks, dueDate, priority, responsibleUserId) — see
-- contract-workflow.service.ts's sanitizeWorkflowTaskFormData() for the
-- fixed allow-list of keys actually ever written here.

ALTER TABLE "contract_workflow_tasks" ADD COLUMN "form_data" JSONB;
