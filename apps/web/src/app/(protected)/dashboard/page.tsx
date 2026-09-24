import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import {
  FileText,
  Ruler,
  HardHat,
  BadgeCheck,
  Warehouse,
  ShieldCheck,
  AlertTriangle,
  Factory,
  Wrench,
  ClipboardList,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { authApi } from '@/lib/auth-api';
import { platformApi } from '@/lib/platform-api';
import type { PlatformModuleCard, PlatformModuleCode } from '@/lib/platform-api';
import { isContractManagementOnlyAccess } from '../_lib/module-visibility';
import { ExecutiveModuleCard, type ModuleAccent } from './_components/executive-module-card';

// FMP-UI-15 — the executive summary strip reads a handful of already-
// fetched card metrics by (code, label) rather than requesting anything
// new from the API: `Total` on the Contract Management card and
// `Contracts` on the Erection card are the exact same numbers those cards'
// own metric tiles already show, and `Overdue` on the Task Management card
// is the same "Overdue" tile that card renders too. If a user can't see
// that module (its card is simply absent from `cards`) or the API hasn't
// been able to compute that value yet (`null`), the matching chip below
// just doesn't render — never a guessed or zeroed value.
function findMetricValue(cards: PlatformModuleCard[], code: PlatformModuleCode, label: string): number | null {
  const card = cards.find((c) => c.code === code);
  return card?.metrics.find((m) => m.label === label)?.value ?? null;
}

function SummaryChip({ value, label }: { value?: number; label: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-secondary px-3 py-1 text-xs font-semibold text-text-secondary">
      {value !== undefined && <span className="font-bold text-text-primary">{value}</span>}
      {label}
    </span>
  );
}

export const metadata: Metadata = { title: 'Dashboard — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

const CARD_ICONS: Record<PlatformModuleCode, LucideIcon> = {
  CONTRACTS_MANAGEMENT: FileText,
  TECHNICAL: Ruler,
  ERECTION: HardHat,
  QA_QC: BadgeCheck,
  STORAGE_DELIVERY: Warehouse,
  SAFETY_COMPLIANCE: ShieldCheck,
  INCIDENT_REPORT: AlertTriangle,
  PRODUCTION_DASHBOARD: Factory,
  MAINTENANCE_REQUESTS: Wrench,
  FACTORY_TASKS: ClipboardList,
};

// FMP-UI-03 — soft, module-specific accent per card (see executive-module-card.tsx's own ACCENT_CLASSES).
const CARD_ACCENTS: Record<PlatformModuleCode, ModuleAccent> = {
  CONTRACTS_MANAGEMENT: 'contracts',
  TECHNICAL: 'technical',
  ERECTION: 'erection',
  QA_QC: 'qaqc',
  STORAGE_DELIVERY: 'storage',
  SAFETY_COMPLIANCE: 'safety',
  INCIDENT_REPORT: 'incident',
  PRODUCTION_DASHBOARD: 'production',
  MAINTENANCE_REQUESTS: 'maintenance',
  FACTORY_TASKS: 'tasks',
};

export default async function ExecutiveDashboardPage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const meResult = await authApi.me(accessToken);
  const permissions: string[] = meResult.ok ? meResult.data.permissions : [];

  // A user who can only see Contract Management lands directly on its own
  // dashboard, not this platform-wide overview — same rule the previous root
  // dashboard applied (see module-visibility.ts).
  if (isContractManagementOnlyAccess(permissions)) {
    redirect('/contracts/dashboard');
  }

  let dashboard: Awaited<ReturnType<typeof platformApi.dashboard>> | null = null;
  let loadError = false;
  try {
    dashboard = await platformApi.dashboard();
  } catch {
    loadError = true;
  }

  const cards = dashboard?.cards ?? [];

  // FMP-UI-15 — real values only, sourced from metrics already present on
  // the fetched cards (see `findMetricValue`'s own doc comment above).
  const totalContracts = findMetricValue(cards, 'CONTRACTS_MANAGEMENT', 'Total');
  const erectionContracts = findMetricValue(cards, 'ERECTION', 'Contracts');
  const overdueTasks = findMetricValue(cards, 'FACTORY_TASKS', 'Overdue');

  return (
    // FMP-UI-04B — the large hero card (title/subtitle/welcome-and-meta strip)
    // was removed entirely and the title moved to TopHeader.
    // FMP-UI-14 — moved the title back OUT of TopHeader (which should only
    // carry user name/role + Sign out, per this unit's own brief) and into
    // a proper hero heading here instead, above the grid — a senior
    // manager's landing screen reads more "intentional platform," not
    // borrowed header chrome. Kept genuinely compact (no separate hero
    // card/border/background — just a heading + the same instruction line
    // this page already had, now living together) specifically so it
    // doesn't reopen the "too much empty space" problem FMP-UI-04B/09B
    // already solved: it's the first child of the same `flex-1
    // justify-center` block as the grid, so it's centered together WITH
    // the cards rather than adding a fixed block above the centered area.
    // FMP-UI-04C — top padding reduced (pt-3/pt-4, was p-5/p-6 on every side)
    // so the grid starts closer to the header now that there's no hero card
    // to separate from — side/bottom padding kept for breathing room.
    // FMP-UI-09B — padding trimmed slightly further (pt-3/pb-5 → pt-2/pb-3 at
    // base, lg:pt-4/lg:pb-6 → lg:pt-3/lg:pb-4) to give the grid a bit more of
    // the available height, and the whole thing is now `min-h-full` with the
    // grid centered inside a `flex-1 justify-center` wrapper — `<main>` in
    // AppShell is already the real scroll container, so this page's own root
    // can safely claim "at least all of it" without breaking mobile's normal
    // scrolling (min-h, not h, so content taller than one screen still grows
    // and scrolls exactly as before). Centering means any extra vertical
    // room on a tall 1080p desktop screen is split evenly above and below
    // the whole title+grid block instead of collecting as one large gap
    // underneath it. FMP-UI-14 trimmed the top padding by one more notch
    // (pt-2→pt-1, lg:pt-3→lg:pt-2) to reclaim a little of the room the new
    // heading needs.
    <div className="mx-auto flex min-h-full max-w-7xl flex-col px-5 pt-1 pb-3 lg:px-6 lg:pt-2 lg:pb-4">
      <div className="flex flex-1 flex-col justify-center space-y-3">
        {/* FMP-UI-14 — the main dashboard hero title, replacing the one that
            used to live in TopHeader. Always shown (even on an error/empty
            state, same as any page's own title would be); the helper line
            and summary strip below only make sense once there's actually a
            grid to describe, so both keep the original `cards.length > 0`
            gating.
            FMP-UI-15 — added a "Factory Operations Control Center" tagline
            between the title and the helper line (same small-caps treatment
            the login page already uses for its own tagline, for a
            consistent "official platform" voice across both screens), and
            an executive summary strip below the helper line — small,
            honest, real-data-only chips, never a second heading. */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary lg:text-4xl">
            RECAFCO Factory Management Platform
          </h1>
          <p className="mt-1.5 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Factory Operations Control Center
          </p>
          {!loadError && cards.length > 0 && (
            <>
              <p className="mt-2 text-sm text-text-secondary">
                Select a module to view status, pending actions, and operational details.
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <SummaryChip value={cards.length} label="Modules" />
                <SummaryChip label="Executive View" />
                <SummaryChip label="Updated Today" />
                {totalContracts !== null && <SummaryChip value={totalContracts} label="Total Contracts" />}
                {erectionContracts !== null && <SummaryChip value={erectionContracts} label="Erection Contracts" />}
                {overdueTasks !== null && <SummaryChip value={overdueTasks} label="Overdue Tasks" />}
              </div>
            </>
          )}
        </div>

        {loadError && (
          <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
            Dashboard data unavailable. The API may be offline — please try again shortly.
          </div>
        )}

        {!loadError && cards.length === 0 && (
          <div className="rounded-lg border border-border bg-surface p-10 text-center">
            <p className="text-base text-text-secondary">
              You do not have access to any platform modules yet. Contact your administrator to request access.
            </p>
          </div>
        )}

        {/* FMP-UI-04 — 2 rows regardless of column count; grid's default
            `align-items: stretch` makes every card in a row match the row's
            tallest card, so each ExecutiveModuleCard's own `mt-auto` button
            lands at the same height across the row regardless of
            description length.
            FMP-UI-10 — widened to 5 columns on large desktop (was 4) now
            that there are 10 cards (still exactly 2 rows), with an added
            3-column step for medium desktop between the existing 2-column
            tablet step and the 5-column large-desktop step: 1 (mobile) → 2
            (md, tablet) → 3 (lg, medium desktop) → 5 (xl, large desktop). */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {cards.map((card) => (
            <ExecutiveModuleCard
              key={card.code}
              title={card.title}
              description={card.description}
              href={card.route}
              icon={CARD_ICONS[card.code]}
              metrics={card.metrics}
              accent={CARD_ACCENTS[card.code]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
