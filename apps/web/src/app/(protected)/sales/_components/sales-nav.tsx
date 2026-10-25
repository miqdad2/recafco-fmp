'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ListChecks, CalendarClock } from 'lucide-react';

/**
 * FMP-SALES-07 — the one navigation row of Sales Activities (same three items, same position on every Sales page):
 * large labelled targets, a strong filled active state, and a visible keyboard focus ring.
 */
export function SalesNav(): React.JSX.Element {
  const pathname = usePathname();
  const items = [
    { href: '/sales', label: 'Dashboard', icon: LayoutDashboard, active: pathname === '/sales' },
    { href: '/sales/enquiries', label: 'All Enquiries', icon: ListChecks, active: pathname.startsWith('/sales/enquiries') },
    { href: '/sales/follow-ups', label: 'Follow-ups', icon: CalendarClock, active: pathname.startsWith('/sales/follow-ups') },
  ];
  return (
    <nav aria-label="Sales Activities navigation" className="flex flex-wrap items-center gap-2">
      {items.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? 'page' : undefined}
          className={`inline-flex min-h-12 items-center gap-2 rounded-lg border-2 px-5 py-2 text-lg font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${
            active ? 'border-text-primary bg-text-primary text-white shadow-sm' : 'border-slate-400 bg-white text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Icon className="size-5" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
