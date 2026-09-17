import Link from 'next/link';
import { redirect } from 'next/navigation';
import { contractsApi } from '../../../../../lib/contracts-api';
import { WorkflowModeTabs } from './workflow-mode-tabs';
import { StaffTaskCard } from './staff-task-card';
import { StaffTaskUpdatePanel } from './staff-task-update-panel';
import { groupStaffTasksByBucket, type StaffFlatTask } from '../../_lib/staff-task-grouping';
import { getGuidedErectionWorkflowRoute, isGuidedErectionWorkflowTask } from '../../_lib/guided-erection-workflow-route';
import {
  isErectionStep2Locked, isErectionStep3Locked, isErectionStep4Locked, isErectionStep5Locked, isErectionStep6Locked,
} from '../../_lib/erection-step-lock';

export type StaffWorkflowMode = 'my-tasks' | 'overdue';

interface Props {
  mode: StaffWorkflowMode;
  taskId: string | undefined;
  currentUserId: string;
}

const MY_TASKS_HREF = '/contracts/workflow?mode=my-tasks';
const OVERDUE_HREF = '/contracts/workflow?mode=overdue';

/**
 * CM-44/CM-45 — Contract Staff's task-first work pages for
 * /contracts/workflow?mode=my-tasks and ?mode=overdue, dispatched from
 * page.tsx (see isContractStaffOnlyAccess check there) instead of the
 * generic manager-facing "All Workflows" register + board. Never shows a
 * contract list or a per-contract board — only the actor's own assigned
 * tasks, with a focused single-task update view when ?taskId= is present
 * (same "select an entity via URL, swap the list for a focused panel"
 * pattern as CM-40C's Assignment Queue).
 *
 * mode='my-tasks' groups every one of the actor's tasks into the 5 status
 * buckets (CM-44). mode='overdue' (CM-45) instead shows one flat list of
 * just the tasks whose `isOverdue` the backend already computed from
 * dueDate + status — never a separately re-derived overdue rule.
 *
 * Data comes entirely from existing endpoints: listWorkflow({myTasksOnly})
 * gives the set of contracts the actor has an assigned task on, then
 * getWorkflow(contractId) — the FULL task list, not myTasksOnly-filtered —
 * is fetched per contract (small N, bounded by how many contracts one staff
 * member actually has tasks on; GET :id/workflow only requires
 * contracts.read, which every Contract Staff member has). The full list is
 * needed, not just the actor's own tasks, so each of their tasks can carry
 * its team's full step sequence (sortOrder-ordered sibling tasks) for the
 * focused screen's workflow-progress stepper. No new backend endpoint.
 */
export async function StaffMyTasksView({ mode, taskId, currentUserId }: Props): Promise<React.JSX.Element> {
  const listRes = await contractsApi.listWorkflow({ myTasksOnly: true, pageSize: 100 }).catch(() => null);
  const contractIds = listRes?.items.map((c) => c.id) ?? [];

  const detailResults = await Promise.allSettled(
    contractIds.map((id) => contractsApi.getWorkflow(id)),
  );

  // CM-71H.3 — "My Tasks should show only Step 1 as actionable, or show
  // future steps locked/disabled": the generic ContractWorkflowTask.status
  // is a SEPARATE, independently-tracked field from each guided step's own
  // real record (ContractErectionMethodStatement.status etc.) — using it as
  // a lock proxy could drift from what the guided screen itself enforces.
  // So the lock check here fetches the SAME 5 dedicated erection records the
  // guided pages themselves check (erection-step-lock.ts), but only for a
  // contract that actually has a guided erection task assigned to this
  // actor — never for the common case of a staff member with only
  // Technical/Production/QS tasks.
  const erectionPrereqsByContract = new Map<
    string,
    { statement: { status: string } | null; approval: { reviewStatus: string } | null; schedule: { status: string } | null; deliveryStart: { status: string } | null; erectionStart: { status: string } | null }
  >();
  const contractsNeedingErectionPrereqs: string[] = [];
  for (const [i, res] of detailResults.entries()) {
    if (res.status !== 'fulfilled') continue;
    const hasGuidedTask = res.value.tasks.some(
      (t) => t.responsibleUserId === currentUserId && isGuidedErectionWorkflowTask(t),
    );
    if (hasGuidedTask) contractsNeedingErectionPrereqs.push(contractIds[i]!);
  }

  await Promise.all(
    contractsNeedingErectionPrereqs.map(async (contractId) => {
      const [statement, approval, schedule, deliveryStart, erectionStart] = await Promise.all([
        contractsApi.getErectionMethodStatement(contractId).catch(() => null),
        contractsApi.getErectionMethodStatementApproval(contractId).catch(() => null),
        contractsApi.getErectionSchedule(contractId).catch(() => null),
        contractsApi.getErectionDeliveryStart(contractId).catch(() => null),
        contractsApi.getErectionStart(contractId).catch(() => null),
      ]);
      erectionPrereqsByContract.set(contractId, { statement, approval, schedule, deliveryStart, erectionStart });
    }),
  );

  function computeGuidedStepLocked(task: { contractId: string; taskKey: string }): boolean | undefined {
    const prereqs = erectionPrereqsByContract.get(task.contractId);
    if (!prereqs) return undefined;
    switch (task.taskKey) {
      case 'erection_statement_approval': return isErectionStep2Locked(prereqs.statement);
      case 'erection_schedule_issued': return isErectionStep3Locked(prereqs.approval);
      case 'erection_delivery_start': return isErectionStep4Locked(prereqs.schedule);
      case 'erection_start': return isErectionStep5Locked(prereqs.deliveryStart);
      case 'erection_issue_checklist': return isErectionStep6Locked(prereqs.erectionStart);
      default: return undefined;
    }
  }

  const allTasks: StaffFlatTask[] = [];
  for (const res of detailResults) {
    if (res.status !== 'fulfilled') continue;
    const { contract, tasks } = res.value;
    const myTasks = tasks.filter((t) => t.responsibleUserId === currentUserId);
    for (const task of myTasks) {
      const teamTasks = tasks
        .filter((t) => t.team === task.team)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const guidedStepLocked = computeGuidedStepLocked(task);
      allTasks.push({
        ...task,
        contractReference: contract.referenceNumber,
        contractTitle: contract.title,
        counterpartyName: contract.counterpartyName,
        contractManagerName: contract.ownerUser.displayName,
        teamTasks,
        ...(guidedStepLocked !== undefined ? { guidedStepLocked } : {}),
      });
    }
  }

  const backHref = mode === 'overdue' ? OVERDUE_HREF : MY_TASKS_HREF;
  const backLabel = mode === 'overdue' ? 'Back to Overdue Tasks' : 'Back to My Tasks';
  const selectedTask = taskId ? allTasks.find((t) => t.id === taskId) : undefined;

  // CM-71H.2 — defense in depth: even a stale/manually-crafted ?taskId= link
  // (StaffTaskCard itself never generates one for a guided task anymore)
  // must never render the generic StaffTaskUpdatePanel for one of the 6
  // guided erection steps — redirect straight to that step's own CM-71A-G
  // screen instead.
  if (selectedTask) {
    const guided = getGuidedErectionWorkflowRoute(selectedTask, selectedTask.contractId);
    if (guided) redirect(guided.href);
  }

  // CM-46C — the focused task screen owns its own compact header (task
  // name/badges) and its own "Back to My Tasks" link, and needs the full
  // available height under the app's top bar for its single-window layout
  // (see staff-task-update-panel.tsx's own comment on why `h-full` works
  // here via app-shell.tsx's flex layout). Repeating the list page's own
  // breadcrumb/title/subtitle/tabs above it would eat into that height
  // budget for no benefit once the user has drilled into one task, so this
  // branch renders ONLY the panel — the list page's chrome is unchanged.
  if (selectedTask) {
    return (
      <div className="h-full min-h-0">
        <StaffTaskUpdatePanel task={selectedTask} backHref={backHref} backLabel={backLabel} />
      </div>
    );
  }

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1400px] mx-auto space-y-5">
      <div>
        <h1 className="text-3xl font-semibold text-text-primary tracking-tight">
          {mode === 'overdue' ? 'Overdue Tasks' : 'My Tasks'}
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary max-w-2xl">
          {mode === 'overdue'
            ? 'Update overdue workflow tasks assigned to you.'
            : 'Update your assigned contract workflow tasks, comments and documents.'}
        </p>
      </div>

      <WorkflowModeTabs active={mode} canManage={false} hideAllWorkflows />

      {mode === 'overdue' ? (
        <OverdueList tasks={allTasks.filter((t) => t.isOverdue)} />
      ) : (
        <MyTasksBuckets tasks={allTasks} />
      )}
    </div>
  );
}

function OverdueList({ tasks }: { tasks: StaffFlatTask[] }): React.JSX.Element {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-10 text-center">
        <p className="text-sm font-medium text-text-primary">No overdue tasks</p>
        <p className="text-xs text-text-muted mt-1">
          You do not have any overdue workflow tasks assigned to you.
        </p>
        <Link
          href={MY_TASKS_HREF}
          className="mt-4 inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Back to My Tasks
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <StaffTaskCard key={task.id} task={task} updateHref={`/contracts/workflow?mode=overdue&taskId=${task.id}`} />
      ))}
    </div>
  );
}

function MyTasksBuckets({ tasks }: { tasks: StaffFlatTask[] }): React.JSX.Element {
  const buckets = groupStaffTasksByBucket(tasks);
  const hasAnyTask = tasks.length > 0;

  if (!hasAnyTask) {
    return (
      <div className="rounded-lg border border-border bg-surface p-10 text-center">
        <p className="text-sm text-text-secondary">No workflow tasks assigned to you yet.</p>
        <p className="text-xs text-text-muted mt-1">
          When a manager assigns you a workflow task, it will appear here with its due date and priority.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {buckets.map((bucket) => {
        if (bucket.tasks.length === 0) return null;
        return (
          <section key={bucket.key} aria-labelledby={`bucket-${bucket.key}`}>
            <h2
              id={`bucket-${bucket.key}`}
              className={`text-sm font-semibold mb-2 ${bucket.key === 'overdue' ? 'text-error' : 'text-text-primary'}`}
            >
              {bucket.label} ({bucket.tasks.length})
            </h2>
            <div className="space-y-2">
              {bucket.tasks.map((task) => (
                <StaffTaskCard
                  key={task.id}
                  task={task}
                  updateHref={`/contracts/workflow?mode=my-tasks&taskId=${task.id}`}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
