import Link from 'next/link';
import { AlertTriangle, ClipboardList, LayoutGrid } from 'lucide-react';

const NAV_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-sm font-semibold text-text-primary transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2';

/**
 * FMP-UI-22 — the Incident Detail page had no way back except the
 * browser's own back button, per this unit's own brief, which explicitly
 * names 3 destinations rather than the 2-destination shape
 * `IncidentModuleNav`/`SafetyModuleNav` use elsewhere: Back to Incident
 * Dashboard (`/incidents/executive`), Back to All Incidents
 * (`/incidents`), and Back to Platform Dashboard (`/dashboard`). A
 * dedicated component rather than reusing `IncidentModuleNav` — that one
 * is built for the List page (one level below the Dashboard) and has no
 * "back to all incidents" button of its own, since being ON the list,
 * that link would be circular there. Mirrors
 * `safety-compliance/_components/safety-detail-nav.tsx` (FMP-UI-21D)
 * exactly.
 */
export function IncidentDetailNav(): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/incidents/executive" className={NAV_BUTTON_CLASS}>
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        Back to Incident Dashboard
      </Link>
      <Link href="/incidents" className={NAV_BUTTON_CLASS}>
        <ClipboardList className="size-4 shrink-0" aria-hidden="true" />
        Back to All Incidents
      </Link>
      <Link href="/dashboard" className={NAV_BUTTON_CLASS}>
        <LayoutGrid className="size-4 shrink-0" aria-hidden="true" />
        Back to Platform Dashboard
      </Link>
    </div>
  );
}
