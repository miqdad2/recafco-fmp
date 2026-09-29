import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

/**
 * FMP-UI-19 — a small, single-line shortcut, never a whole section/card, per
 * the brief's own "should not dominate the page". Only rendered by the page
 * when the current viewer actually has an assigned erection contract
 * (assignedToUserId matches them) in the already-fetched work queue — never
 * shown unconditionally. Links to the existing generic Workflow "My Tasks"
 * view pre-filtered to the ERECTION team (`?mode=my-tasks&team=ERECTION`,
 * both already-supported query params — no new route/page needed).
 */
export function ErectionMyTasksShortcut(): React.JSX.Element {
  return (
    <Link
      href="/contracts/workflow?mode=my-tasks&team=ERECTION"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
    >
      View My Erection Tasks
      <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
    </Link>
  );
}
