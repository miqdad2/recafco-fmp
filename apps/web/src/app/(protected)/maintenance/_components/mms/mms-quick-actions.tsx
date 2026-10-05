import { Boxes, ClipboardList, ExternalLink, HardHat, PackageSearch, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MmsLinks } from '@/lib/mms-api';

interface Props {
  links: MmsLinks;
}

// FMP-MAINT-03/04/05 — every link is a REAL MMS route, supplied by the FMP API
// on the configured MMS origin. FMP-MAINT-05: a compact 2-column button grid
// (was a tall list of rows with descriptions); the description is the
// tooltip. FMP-MAINT-06: the first action is worded for users who don't know
// the abbreviation "MMS" ("Open Maintenance System"; the header button has the
// full name), and spacing is tightened below 2xl so that label fits unclipped
// at 1366px. FMP's own local request log moved to a small link in the card
// header (maintenance-control-center.tsx), still labelled as FMP-local.
export function MmsQuickActions({ links }: Props): React.JSX.Element {
  const actions: { label: string; description: string; href: string; icon: LucideIcon }[] = [
    { label: 'Open Maintenance System', description: 'Open the Maintenance Management System dashboard', href: links.dashboard, icon: ExternalLink },
    { label: 'Job Cards', description: 'All job cards in the Maintenance Management System', href: links.jobCards, icon: ClipboardList },
    { label: 'Materials Requests', description: 'Job card and general materials requests', href: links.materialsRequests, icon: PackageSearch },
    { label: 'Inventory Control', description: 'Stock balances, receipts, and issues', href: links.inventory, icon: Boxes },
    { label: 'Assets & Equipment', description: 'Asset register and site movements', href: links.assets, icon: Truck },
    { label: 'Worker Activity', description: 'Who is working, paused, or available', href: links.workerActivity, icon: HardHat },
  ];

  return (
    <ul className="grid grid-cols-2 gap-1.5 p-2">
      {actions.map(({ label, description, href, icon: Icon }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={description}
            className="flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-1.5 text-[11px] font-semibold tracking-tight text-text-primary 2xl:gap-1.5 2xl:px-2 2xl:text-xs 2xl:tracking-normal transition hover:border-teal hover:bg-teal-light focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <Icon className="size-3.5 shrink-0 text-teal" aria-hidden="true" />
            <span className="line-clamp-2 leading-[1.1]">{label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
