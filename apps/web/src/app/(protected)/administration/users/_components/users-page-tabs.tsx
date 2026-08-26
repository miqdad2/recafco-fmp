import Link from 'next/link';

export type UsersPageTabKey = 'modules' | 'all-users';

interface Props {
  active: UsersPageTabKey;
}

const TABS: { key: UsersPageTabKey; label: string; href: string }[] = [
  { key: 'modules', label: 'Create by Module', href: '/administration/users?tab=modules' },
  { key: 'all-users', label: 'All Platform Users', href: '/administration/users?tab=all-users' },
];

/**
 * CM-42B — link-based tabs (not a client-side toggle) so the active tab
 * survives a refresh or a shared link (?tab=modules|all-users), matching the
 * established pattern from WorkflowModeTabs (CM-40). Both tabs render off
 * the same server fetch the page already does — switching never refetches
 * anything new, it only changes which section is shown.
 */
export function UsersPageTabs({ active }: Props): React.JSX.Element {
  return (
    <div role="tablist" aria-label="Users page view" className="flex items-center gap-1 border-b border-border mb-6 overflow-x-auto">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          role="tab"
          aria-selected={active === t.key}
          className={[
            'px-4 py-2 -mb-px text-sm font-medium border-b-2 whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
            active === t.key
              ? 'border-accent text-accent'
              : 'border-transparent text-text-secondary hover:text-text-primary',
          ].join(' ')}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
