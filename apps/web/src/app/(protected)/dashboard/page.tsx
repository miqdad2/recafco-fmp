import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { FileText, Ruler, HardHat, Warehouse, Factory, Gauge, Handshake, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { authApi } from '@/lib/auth-api';
import { platformApi } from '@/lib/platform-api';
import { salesApi } from '@/lib/sales-api';
import type { PlatformModuleCode } from '@/lib/platform-api';
import { getLandingPath } from '../_lib/access-mode';
import { ControlCenterCard } from './_components/control-center-card';
import { ACCENT_PALETTE } from '../_lib/module-accent';
import type { CardColor } from './_components/control-center-card';
import { selectControlCenterCards, CARD_CTA, FACTORY_PERFORMANCE_CARD, SALES_ENQUIRIES_CARD } from './_lib/control-center-cards';

export const metadata: Metadata = { title: 'Dashboard — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

const CARD_ICONS: Partial<Record<PlatformModuleCode, LucideIcon>> = {
  CONTRACTS_MANAGEMENT: FileText,
  TECHNICAL: Ruler,
  PRODUCTION_DASHBOARD: Factory,
  STORAGE_DELIVERY: Warehouse,
  ERECTION: HardHat,
};

// FMP-UI-37 — stable module colours (the shared accent palette; Factory Performance and Sales are not platform modules, so theirs are local).
const CARD_COLORS: Partial<Record<PlatformModuleCode, CardColor>> = {
  CONTRACTS_MANAGEMENT: ACCENT_PALETTE.contracts, // royal / deep blue
  TECHNICAL: ACCENT_PALETTE.technical, // indigo
  PRODUCTION_DASHBOARD: ACCENT_PALETTE.production, // violet
  STORAGE_DELIVERY: { base: '#46608f', light: '#edf1f8' }, // slate blue
  ERECTION: { base: '#c2410c', light: '#fff4ed' }, // burnt orange
};
const FACTORY_PERFORMANCE_COLOR: CardColor = { base: '#0b2545', light: '#eaf1fb' };
const SALES_COLOR: CardColor = { base: '#c62828', light: '#fdecec' }; // RECAFCO red

/**
 * FMP-UI-36 — the existing, working Factory Performance destination (a separate application, opened in a
 * new tab). Unchanged from the previous card; it is not a permission-gated platform module.
 */
const FACTORY_PERFORMANCE_URL = 'http://192.168.1.17:83';

export default async function ExecutiveDashboardPage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const meResult = await authApi.me(accessToken);
  const permissions: string[] = meResult.ok ? meResult.data.permissions : [];

  // FMP-ACCESS-01 — a Single Module user lands on their own module dashboard, not this
  // platform-wide Control Center. Full Platform, Multi-Module, Executive and Admin users
  // stay here (see access-mode.ts).
  const landing = getLandingPath(permissions, meResult.ok && meResult.data.fullPlatformAccess === true);
  if (landing !== '/dashboard') {
    redirect(landing);
  }

  let dashboard: Awaited<ReturnType<typeof platformApi.dashboard>> | null = null;
  let loadError = false;
  try {
    dashboard = await platformApi.dashboard();
  } catch {
    loadError = true;
  }

  // FMP-UI-36 — only the five retained modules, in the approved order. Which of them a user gets is still
  // decided by the API (existing per-module read permissions); nothing is granted by being shown here.
  const cards = selectControlCenterCards(dashboard?.cards ?? []);

  // FMP-SALES-01/01A — the Sales & Enquiries card is ALWAYS shown (so the Control Center keeps its seven
  // cards), but its figures are fetched and its button is active only for users who hold sales.read (the
  // Sales API checks it again). Without it the card is an "Access Restricted" notice: nothing is fetched,
  // no figures are shown and there is no link. If the figures cannot be loaded the tiles read "Not
  // available", never 0.
  const hasSales = permissions.includes('sales.read');
  const salesRes = hasSales ? await salesApi.dashboard() : null;
  const salesMetrics = [
    { label: 'Enquiries This Month', value: salesRes?.data ? salesRes.data.enquiriesThisMonth : null },
    { label: 'Follow-ups Due', value: salesRes?.data ? salesRes.data.followUpsDue : null },
    { label: 'Active Enquiries', value: salesRes?.data ? salesRes.data.openEnquiries : null },
    { label: 'Confirmed Projects', value: salesRes?.data ? salesRes.data.projectsWon : null },
  ];

  return (
    // FMP-UI-36 — uses the full content width (no narrow centered container). Columns: 1 (mobile),
    // 2 (md/tablet), 3 (xl, e.g. 1366px), 4 (2xl, e.g. 1920px: 4 + 3). No fixed widths, so no horizontal scroll.
    <div className="mx-auto w-full max-w-[1760px] px-5 py-6 lg:px-8 lg:py-8">
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight text-text-primary lg:text-4xl">Factory Operations Control Center</h1>

      {loadError && (
        <div role="alert" className="mt-6 rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline — please try again shortly.
        </div>
      )}

      {!loadError && cards.length === 0 && !hasSales && (
        <div className="mt-6 rounded-lg border border-border bg-surface p-6 text-base text-text-secondary">
          You do not have access to any platform modules yet. Contact your administrator to request access.
        </div>
      )}

      <div className="grid auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {cards.map((card) => (
          <ControlCenterCard
            key={card.code}
            title={card.displayTitle}
            description={card.displayDescription}
            href={card.route}
            icon={CARD_ICONS[card.code] ?? FileText}
            metrics={card.metrics}
            cta={CARD_CTA[card.code]}
            color={CARD_COLORS[card.code] ?? ACCENT_PALETTE.contracts}
          />
        ))}

        {/* Separate application, not a platform module: always shown (as before), opens in a new tab, no invented figures. */}
        <ControlCenterCard
          title={FACTORY_PERFORMANCE_CARD.title}
          description={FACTORY_PERFORMANCE_CARD.description}
          href={FACTORY_PERFORMANCE_URL}
          external
          icon={Gauge}
          badge="External"
          cta={CARD_CTA.FACTORY_PERFORMANCE}
          color={FACTORY_PERFORMANCE_COLOR}
          note={{ heading: 'Figures open separately', text: 'Factory performance figures are shown in the separate Factory Performance dashboard.' }}
        />

        {/* FMP-SALES-01A - always the seventh card: live for sales.read, otherwise a restricted notice (no data, no link). */}
        {hasSales ? (
          <ControlCenterCard
            title={SALES_ENQUIRIES_CARD.title}
            description={SALES_ENQUIRIES_CARD.description}
            href="/sales"
            icon={Handshake}
            metrics={salesMetrics}
            cta={CARD_CTA.SALES_ENQUIRIES}
            color={SALES_COLOR}
          />
        ) : (
          <ControlCenterCard
            title={SALES_ENQUIRIES_CARD.title}
            description={SALES_ENQUIRIES_CARD.description}
            icon={Handshake}
            noteIcon={Lock}
            badge="Access Restricted"
            note={{ heading: 'Access Restricted', text: 'Sales information is confidential. Ask your administrator if you need access.' }}
            footer="Access Restricted"
            color={SALES_COLOR}
          />
        )}
      </div>
    </div>
  );
}
