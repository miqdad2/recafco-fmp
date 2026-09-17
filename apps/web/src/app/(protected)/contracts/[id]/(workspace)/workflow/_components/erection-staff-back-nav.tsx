import Link from 'next/link';

const linkCls = 'rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus';

/**
 * CM-71H.6 — the 2 extra back-links a staff-tier (Erection Manager /
 * Contract Staff) viewer gets alongside each guided step's own existing
 * "Back to Workflow" link: Back to Erection Dashboard and Back to My
 * Tasks — their 2 real home surfaces (see sidebar.tsx's own
 * CONTRACT_STAFF_ITEMS). Never rendered for a manager-tier viewer, who
 * already has the full Contract Detail tab bar (including "Workflow &
 * Team Tasks") to navigate from — this component is only ever used inside
 * a guided panel's own `{isStaffTier && ...}` branch.
 */
export function ErectionStaffBackNav(): React.JSX.Element {
  return (
    <>
      <Link href="/contracts/erection-dashboard" className={linkCls}>
        Back to Erection Dashboard
      </Link>
      <Link href="/contracts/workflow?mode=my-tasks" className={linkCls}>
        Back to My Tasks
      </Link>
    </>
  );
}
