'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ListChecks, CalendarClock } from 'lucide-react';

/** FMP-SALES-01 — the small Sales-only navigation (not added to the main sidebar). */
export function SalesNav(): React.JSX.Element {
  const pathname = usePathname();
  const items = [
    { href: '/sales', label: 'Dashboard', icon: LayoutDashboard, active: pathname === '/sales' },
    { href: '/sales/enquiries', label: 'All Enquiries', icon: ListChecks, active: pathname.startsWith('/sales/enquiries') },
    { href: '/sales/follow-ups', label: 'Follow-ups', icon: CalendarClock, active: pathname.startsWith('/sales/follow-ups') },
  ];
  return (
    <nav aria-label="Sales navigation" className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
      {items.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? 'page' : undefined}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-base font-semibold transition focus:outline-none focus:ring-2 focus:ring-focus ${
            active ? 'bg-text-primary text-white' : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
          }`}
        >
          <Icon className="size-5" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
