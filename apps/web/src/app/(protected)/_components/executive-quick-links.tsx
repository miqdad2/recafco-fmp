import Link from 'next/link';

export interface QuickLink {
  label: string;
  href: string;
}

interface Props {
  links: QuickLink[];
}

/**
 * FMP-UI-07 (nav pass) — the Executive Module Landing Page's "Quick Links"
 * row: a few secondary shortcuts straight into a module's own existing
 * filtered views (e.g. Maintenance's "Waiting for Parts", Production's
 * "Scheduled"), sitting alongside the page's one primary "View [Records]"
 * button. Every href passed in is a route/query param that module's own
 * list page already supports today — never a fabricated link.
 */
export function ExecutiveQuickLinks({ links }: Props): React.JSX.Element | null {
  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text-primary transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
