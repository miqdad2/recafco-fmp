import Link from 'next/link';
import { ArrowLeft, ArrowRight, ChevronDown, LayoutGrid } from 'lucide-react';
import type { PlatformModuleCode } from '@/lib/platform-api';
import { Breadcrumbs } from './breadcrumbs';
import { getVisibleModules, getModuleNeighbors } from '../_lib/executive-modules';
import { ACCENT_PALETTE } from '../_lib/module-accent';

interface Props {
  code: PlatformModuleCode;
  /** The current viewer's real permissions — filters the module-switcher chips and Previous/Next to only what they can actually open (never a new permission, the same ones PlatformDashboardService already gates each card on). */
  permissions: string[];
}

// FMP-UI-16 — h-11→h-9: this row is now purely "get me somewhere else,"
// not a primary content area, so it doesn't need the same touch-target
// height as an actual form/action button; still comfortably tappable.
const NAV_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-sm font-semibold text-text-primary transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2';

/**
 * FMP-UI-07 — shared header navigation for every Executive Module Landing
 * Page: breadcrumb ("Platform Dashboard > [Module Name]"), large
 * text-labeled Back/Previous/Next buttons (never icon-only, per this unit's
 * own senior-friendly requirement), and a module-switcher chip row so any
 * module is one click away without going back through the dashboard. Order
 * and metadata come from the single EXECUTIVE_MODULES list so every page
 * agrees on Previous/Next.
 *
 * FMP-UI-07B — chips and Previous/Next are now filtered to `permissions`:
 * only modules the current viewer actually holds the read permission for
 * are offered, so a single-module viewer never sees a chip that would 404.
 * "Back to Platform Dashboard" is never filtered — always safe to show.
 *
 * FMP-UI-07D — chips restyled to read as clearly SECONDARY: every inactive
 * chip is now a uniform neutral grey — only the current page's own chip
 * keeps its module color, as a highlight, not a palette.
 *
 * FMP-UI-16 — the "Other modules" row used to always render below the
 * Back/Previous/Next row (a caption + a full chip row, taking real
 * vertical space on EVERY one of the 10 Executive Module Landing Pages
 * this component is shared by), which a "the page scrolls too much,
 * actions are too far down" report specifically called out. The sidebar
 * (always visible, lists every module already) plus Back/Previous/Next
 * already cover "get to any other module" — the chip row was a second,
 * redundant way to do the exact same thing, permanently taking up space
 * whether or not anyone used it. Collapsed it behind a native
 * `<details>`/`<summary>` "Switch module" disclosure, closed by default:
 * zero height cost on every page unless a manager actually wants the
 * chips, at which point they render inline, same styling as before.
 * `<details>` needs no client JS/state — keyboard/screen-reader operable
 * for free, and behaves correctly with no hydration concerns since this
 * whole component tree has no interactivity of its own otherwise.
 */
export function ExecutiveModuleNav({ code, permissions }: Props): React.JSX.Element {
  const { current, prev, next } = getModuleNeighbors(code, permissions);
  const visibleModules = getVisibleModules(permissions);

  return (
    <div className="space-y-2">
      <Breadcrumbs items={[{ label: 'Platform Dashboard', href: '/dashboard' }, { label: current.title }]} className="mb-0" />

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/dashboard" className={NAV_BUTTON_CLASS}>
          <LayoutGrid className="size-4 shrink-0" aria-hidden="true" />
          Back to Platform Dashboard
        </Link>
        {prev && (
          <Link href={prev.landingHref} className={NAV_BUTTON_CLASS}>
            <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
            Previous: {prev.title}
          </Link>
        )}
        {next && (
          <Link href={next.landingHref} className={NAV_BUTTON_CLASS}>
            Next: {next.title}
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        )}

        {visibleModules.length > 1 && (
          <details className="group">
            <summary className={`${NAV_BUTTON_CLASS} cursor-pointer list-none text-text-secondary [&::-webkit-details-marker]:hidden`}>
              Switch module
              <ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="mt-2 flex flex-wrap gap-2" role="navigation" aria-label="Switch module">
              {visibleModules.map((m) => {
                const active = m.code === code;
                const palette = ACCENT_PALETTE[m.accent];
                return (
                  <Link
                    key={m.code}
                    href={m.landingHref}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition'
                        : 'inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-medium text-text-secondary transition hover:bg-surface-secondary'
                    }
                    style={active ? { backgroundColor: palette.base, borderColor: palette.base, color: '#ffffff' } : undefined}
                  >
                    {m.title}
                  </Link>
                );
              })}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
