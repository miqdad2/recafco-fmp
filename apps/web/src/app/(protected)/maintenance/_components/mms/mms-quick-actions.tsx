import Link from 'next/link';
import { ArrowUpRight, ClipboardCheck, ClipboardList, ExternalLink, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { mmsJobCardsUrl } from '../../_lib/mms-format';

interface Props {
  mmsBaseUrl: string;
}

interface Action {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  external: boolean;
}

const ROW_CLASS =
  'group flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition hover:border-border-strong hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-focus';

// FMP-MAINT-03 — replaces the old Quick Links + oversized "View Maintenance
// Requests" button. Every link is a REAL route:
// - MMS job-card list tabs `?status=Active` / `?status=ClosureRequested`
//   (MMS app/(dashboard)/maintenance/work-orders). MMS has no exact
//   "waiting for parts" or "past start time" list view (its report modes
//   filter on legacy statuses no live record holds), so no link is offered
//   for those rather than a misleading one.
// - FMP's own pre-existing maintenance request log, clearly labelled as
//   FMP-local records so it's never mistaken for MMS live data.
export function MmsQuickActions({ mmsBaseUrl }: Props): React.JSX.Element {
  const actions: Action[] = [
    { label: 'Open MMS', description: 'Maintenance Management System home', href: mmsBaseUrl, icon: ExternalLink, external: true },
    { label: 'Active Job Cards', description: 'All in-flight job cards in MMS', href: mmsJobCardsUrl(mmsBaseUrl, 'Active'), icon: ClipboardList, external: true },
    { label: 'Closure Requests', description: 'Job cards awaiting closure approval in MMS', href: mmsJobCardsUrl(mmsBaseUrl, 'ClosureRequested'), icon: ClipboardCheck, external: true },
    { label: 'FMP Maintenance Requests', description: 'FMP local maintenance records (not MMS)', href: '/maintenance', icon: FileText, external: false },
  ];

  return (
    <ul className="space-y-2">
      {actions.map(({ label, description, href, icon: Icon, external }) => {
        const body = (
          <>
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${external ? 'bg-teal-light text-teal' : 'bg-surface-secondary text-text-secondary'}`}>
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-text-primary">{label}</span>
              <span className="block truncate text-xs text-text-muted">{description}</span>
            </span>
            <ArrowUpRight className="size-3.5 shrink-0 text-text-muted transition group-hover:text-text-primary" aria-hidden="true" />
          </>
        );
        return (
          <li key={label}>
            {external ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className={ROW_CLASS}>
                {body}
              </a>
            ) : (
              <Link href={href} className={ROW_CLASS}>
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
