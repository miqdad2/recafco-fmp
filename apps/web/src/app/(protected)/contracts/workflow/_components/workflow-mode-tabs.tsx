import Link from 'next/link';

export type WorkflowModeTabKey = 'all' | 'assignment' | 'my-tasks' | 'overdue';

interface Props {
  active: WorkflowModeTabKey;
  /** Has contracts.update — the Assignment Queue tab is a manager-only feature. */
  canManage: boolean;
  /** CM-41 — true for Contract Staff (isContractStaffOnlyAccess): hides "All Workflows" too, since it's the full manager-facing register/board, not just the assignment tool. Defaults to false — no change for anyone else. */
  hideAllWorkflows?: boolean;
  /**
   * CM-52B — count of workflow tasks assigned to the viewing manager
   * personally (the same `summary.myOpenTasks` the page already fetches for
   * the summary cards — no new data). When truthy for a manager audience, a
   * small secondary "My Assigned Work" link appears next to the main tabs
   * instead of promoting "My Tasks" to a full tab. Ignored entirely for
   * staff (hideAllWorkflows), who keep their own main "My Tasks" tab.
   */
  myAssignedTaskCount?: number;
}

const MY_TASKS_HREF = '/contracts/workflow?mode=my-tasks';

const ALL_TABS: {
  key: WorkflowModeTabKey;
  managerLabel: string;
  staffLabel: string;
  href: string;
  managerOnly?: boolean;
  staffHidden?: boolean;
  managerHidden?: boolean;
}[] = [
  { key: 'all', managerLabel: 'Contract Workflows', staffLabel: 'All Workflows', href: '/contracts/workflow', staffHidden: true },
  { key: 'assignment', managerLabel: 'Assign Work', staffLabel: 'Assignment Queue', href: '/contracts/workflow?mode=assignment', managerOnly: true },
  { key: 'my-tasks', managerLabel: 'My Tasks', staffLabel: 'My Tasks', href: MY_TASKS_HREF, managerHidden: true },
  { key: 'overdue', managerLabel: 'Delayed Tasks', staffLabel: 'Overdue', href: '/contracts/workflow?overdueOnly=true' },
];

/**
 * CM-40 — link-based mode switcher (not a client-side toggle) since each
 * mode fetches meaningfully different server data (contract register vs.
 * flat unassigned-task queue vs. filtered "my tasks"/"overdue" views of the
 * same register). The Assignment Queue tab is hidden entirely for Contract
 * Staff — it is a manager-only feature, not just a disabled control.
 * CM-41 — "All Workflows" is hidden too for Contract Staff specifically (not
 * for every non-manager): this is a UI simplification, not a security
 * boundary — the route itself still works and is still department-scoped
 * server-side, exactly as before.
 * CM-45 — the Overdue tab's own href is staff/manager-specific: Contract
 * Staff (hideAllWorkflows) route to `mode=overdue` (dispatched by page.tsx
 * to the staff-only overdue-tasks view), while everyone else keeps the
 * original `overdueOnly=true` link into the generic "All Workflows" page —
 * unchanged manager behavior.
 * CM-52B — labels now differ by audience (`managerLabel`/`staffLabel`);
 * routes/query params are completely unchanged, only the text shown
 * differs. "My Tasks" is dropped as a main tab for the manager audience
 * (`managerHidden`) since managers assign/monitor rather than complete
 * tasks themselves — but the route (`mode=my-tasks`, still dispatched to
 * the exact same content for a manager: the full "All Workflows" page
 * filtered to their own tasks) is untouched, so a manager who already has
 * this URL bookmarked, or who follows the small "My Assigned Work" link
 * below, still lands on working content, not a dead end.
 */
export function WorkflowModeTabs({
  active,
  canManage,
  hideAllWorkflows = false,
  myAssignedTaskCount,
}: Props): React.JSX.Element {
  const overdueHref = hideAllWorkflows ? '/contracts/workflow?mode=overdue' : '/contracts/workflow?overdueOnly=true';
  const tabs = ALL_TABS
    .filter((t) =>
      (!t.managerOnly || canManage) &&
      (!t.staffHidden || !hideAllWorkflows) &&
      (!t.managerHidden || hideAllWorkflows),
    )
    .map((t) => ({
      key: t.key,
      label: hideAllWorkflows ? t.staffLabel : t.managerLabel,
      href: t.key === 'overdue' ? overdueHref : t.href,
    }));

  const showMyAssignedWorkLink = !hideAllWorkflows && Boolean(myAssignedTaskCount);

  return (
    <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border">
      <div role="tablist" aria-label="Workflow view" className="flex items-center gap-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            role="tab"
            aria-selected={active === t.key}
            className={[
              'px-4 py-2 -mb-px text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              active === t.key
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            ].join(' ')}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {showMyAssignedWorkLink && (
        <Link
          href={MY_TASKS_HREF}
          className={[
            'mb-2 shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
            active === 'my-tasks'
              ? 'border-accent text-accent bg-accent/5'
              : 'border-border text-text-secondary hover:border-border-strong hover:text-text-primary',
          ].join(' ')}
        >
          My Assigned Work ({myAssignedTaskCount})
        </Link>
      )}
    </div>
  );
}
