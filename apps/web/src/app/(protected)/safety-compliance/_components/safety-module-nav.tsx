import Link from 'next/link';
import { ArrowLeft, ArrowRight, ChevronDown, LayoutGrid, ShieldCheck } from 'lucide-react';
import { getModuleNeighbors, getVisibleModules } from '../../_lib/executive-modules';
import { ACCENT_PALETTE } from '../../_lib/module-accent';

interface Props {
  permissions: string[];
}

const NAV_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-sm font-semibold text-text-primary transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2';

/**
 * FMP-UI-21 — the Safety Records list page (`safety-compliance/page.tsx`)
 * had no way back to the Safety Dashboard or the Platform Dashboard except
 * the browser's own back button, per this unit's own brief. Modeled
 * directly on `factory-tasks/_components/task-module-nav.tsx` (FMP-UI-20I),
 * which solved the identical problem for the Task List page: deliberately
 * does NOT reuse `ExecutiveModuleNav` wholesale, since that component bakes
 * in its own 2-level breadcrumb ("Platform Dashboard > Safety & Compliance")
 * which would duplicate/conflict with this page's own 3-level breadcrumb
 * ("Platform Dashboard > Safety & Compliance > Safety Records"). Instead
 * reuses the same underlying pure data functions `ExecutiveModuleNav`
 * itself calls (`getModuleNeighbors`/`getVisibleModules`).
 *
 * Unlike Task Management (last in `EXECUTIVE_MODULES`, so `TaskModuleNav`
 * never needed a "Next" link), Safety & Compliance sits in the MIDDLE of
 * the array — it can have both a `prev` and a `next` neighbor — so this
 * component renders both, matching `ExecutiveModuleNav`'s own behavior.
 */
export function SafetyModuleNav({ permissions }: Props): React.JSX.Element {
  const { prev, next } = getModuleNeighbors('SAFETY_COMPLIANCE', permissions);
  const visibleModules = getVisibleModules(permissions);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/safety-compliance/executive" className={NAV_BUTTON_CLASS}>
        <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
        Back to Safety Dashboard
      </Link>
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
              const active = m.code === 'SAFETY_COMPLIANCE';
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
  );
}
