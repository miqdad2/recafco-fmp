import Link from 'next/link';
import { ShieldCheck, ClipboardList, LayoutGrid } from 'lucide-react';

const NAV_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-sm font-semibold text-text-primary transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2';

/**
 * FMP-UI-21D — the Safety Inspection Detail page had no way back except the
 * browser's own back button, per this unit's own brief, which explicitly
 * names 3 destinations rather than the 2-destination shape
 * `TaskModuleNav`/`SafetyModuleNav` use elsewhere in the app: Back to
 * Safety Dashboard (`/safety-compliance/executive`), Back to Safety
 * Records (`/safety-compliance`), and Back to Platform Dashboard
 * (`/dashboard`). A dedicated component rather than reusing
 * `SafetyModuleNav` — that one is built for the List page (one level
 * below the Dashboard) and has no "back to records" button of its own,
 * since being ON the list, that link would be circular there.
 */
export function SafetyDetailNav(): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/safety-compliance/executive" className={NAV_BUTTON_CLASS}>
        <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
        Back to Safety Dashboard
      </Link>
      <Link href="/safety-compliance" className={NAV_BUTTON_CLASS}>
        <ClipboardList className="size-4 shrink-0" aria-hidden="true" />
        Back to Safety Records
      </Link>
      <Link href="/dashboard" className={NAV_BUTTON_CLASS}>
        <LayoutGrid className="size-4 shrink-0" aria-hidden="true" />
        Back to Platform Dashboard
      </Link>
    </div>
  );
}
