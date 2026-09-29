import Link from 'next/link';
import { ArrowLeft, ChevronDown, LayoutGrid, ClipboardList } from 'lucide-react';
import { getModuleNeighbors, getVisibleModules } from '../../_lib/executive-modules';
import { ACCENT_PALETTE } from '../../_lib/module-accent';

interface Props {
  permissions: string[];
}

const NAV_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-sm font-semibold text-text-primary transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2';

/**
 * FMP-UI-20F — the Task Detail page (`factory-tasks/[id]/page.tsx`) had no
 * way back except the browser's own back button, per direct feedback
 * ("users may feel stuck after opening a task"). Every other detail-style
 * page in this app that sits one level below an Executive Module Landing
 * Page gets this exact same navigation shape; this is that shape, adapted
 * for the `factory-tasks` module rather than reusing `ExecutiveModuleNav`
 * wholesale — that component bakes in its OWN 2-level breadcrumb
 * ("Platform Dashboard > {module}"), which would either fight or duplicate
 * a page's own 3-level breadcrumb (e.g. "Platform Dashboard > Task
 * Management > TASK-2026-000002" or "... > Task List", each rendered
 * separately via the existing `Breadcrumbs` component). This component
 * reuses the SAME underlying data (`getModuleNeighbors`/`getVisibleModules`
 * from `_lib/executive-modules.ts` — the identical pure functions
 * `ExecutiveModuleNav` itself calls) and the SAME button styling, just
 * without a second, conflicting breadcrumb.
 *
 * "Back to Task Management" is this component's own addition, not
 * something `ExecutiveModuleNav` has — that component never needs a "back
 * to this module's own landing page" button because it only ever renders
 * ON that landing page. Here, on a page ONE level below it, that link is
 * exactly what's missing. Task Management is last in `EXECUTIVE_MODULES`,
 * so it only ever has a `prev` neighbor (Maintenance Management), never a
 * `next` — this component simply renders nothing for "next" rather than a
 * dead conditional that would never fire.
 *
 * FMP-UI-20G — "Back to Task Management" comes FIRST, before "Back to
 * Platform Dashboard" — a viewer leaving a single task is far more likely
 * headed back to the task list than all the way out to the platform
 * dashboard, per direct feedback.
 *
 * FMP-UI-20I — renamed from `TaskDetailNav` (it only ever served the task
 * detail page before this unit) to `TaskModuleNav`, since it's now reused
 * verbatim by `factory-tasks/page.tsx` (the full Task List page) too — this
 * component was already fully generic (keyed only on `permissions`, never
 * a task ID), so the rename is the only change; no logic moved.
 */
export function TaskModuleNav({ permissions }: Props): React.JSX.Element {
  const { prev } = getModuleNeighbors('FACTORY_TASKS', permissions);
  const visibleModules = getVisibleModules(permissions);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/factory-tasks/executive" className={NAV_BUTTON_CLASS}>
        <ClipboardList className="size-4 shrink-0" aria-hidden="true" />
        Back to Task Management
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

      {visibleModules.length > 1 && (
        <details className="group">
          <summary className={`${NAV_BUTTON_CLASS} cursor-pointer list-none text-text-secondary [&::-webkit-details-marker]:hidden`}>
            Switch module
            <ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="mt-2 flex flex-wrap gap-2" role="navigation" aria-label="Switch module">
            {visibleModules.map((m) => {
              const active = m.code === 'FACTORY_TASKS';
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
