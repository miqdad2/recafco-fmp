import Link from 'next/link';
import { MODULE_CATALOG } from './module-catalog';
import type { ModuleUserCounts } from './module-user-counts';

interface Props {
  counts: Record<string, ModuleUserCounts>;
}

/**
 * CM-42 — "Create Users by Module": lets Super Admin start from a module
 * instead of a blank Users table. Counts come from `computeModuleUserCounts()`
 * (pure, derived from data this page already fetches — no new backend call).
 * "Create User" carries the module into the wizard via ?module=<slug>;
 * "Manage Users" re-renders this same page with the All Platform Users tab
 * active (CM-42B) and the table filtered to that module.
 */
export function ModuleUserCards({ counts }: Props): React.JSX.Element {
  return (
    <section aria-labelledby="module-cards-heading" className="mb-8">
      <h2 id="module-cards-heading" className="text-lg font-semibold text-text-primary">
        Create Users by Module
      </h2>
      <p className="text-sm text-text-secondary mt-1 mb-4">
        Choose a module to create or manage users with the correct access template.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULE_CATALOG.map((mod) => {
          const c = counts[mod.code] ?? { total: 0 };
          const hasStaffManagerSplit = c.staffCount !== undefined && c.managerCount !== undefined;
          return (
            <div key={mod.code} className="rounded-lg border border-border bg-surface p-4 flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-text-primary">{mod.name}</h3>
              <p className="text-xs text-text-secondary flex-1">{mod.shortDescription}</p>

              <p className="text-xs text-text-muted">
                {c.total} user{c.total === 1 ? '' : 's'}
                {hasStaffManagerSplit && (
                  <span className="block mt-0.5">
                    Manager: {c.managerCount} · Staff: {c.staffCount}
                  </span>
                )}
              </p>

              <div className="mt-1 flex flex-wrap gap-2">
                <Link
                  href={`/administration/users/new?module=${mod.slug}`}
                  className="inline-flex items-center h-8 px-3 rounded-md bg-accent text-accent-foreground text-xs font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  Create User
                </Link>
                <Link
                  href={`/administration/users?tab=all-users&module=${mod.slug}`}
                  className="inline-flex items-center h-8 px-3 rounded-md border border-border bg-surface text-text-primary text-xs font-medium hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  Manage Users
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
