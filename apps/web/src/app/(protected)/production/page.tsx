import type { Metadata } from 'next';
import { Factory, Link2, BarChart3, RefreshCw, ShieldAlert, CheckCircle2, Circle, Database } from 'lucide-react';

export const metadata: Metadata = { title: 'Production — RECAFCO FMP' };

const CAPABILITIES = [
  { icon: Link2, label: 'SAP read integration', detail: 'Read-only connection to SAP Business One 9.3 via the SAP Service Layer. No writes to SAP.' },
  { icon: RefreshCw, label: 'Master data synchronisation', detail: 'Sync items, business partners, warehouses, and production resources from SAP on schedule.' },
  { icon: Factory, label: 'Production order monitoring', detail: 'View open and completed production orders with quantities, status, and routing.' },
  { icon: BarChart3, label: 'Performance dashboard', detail: 'Production KPIs (output, efficiency, downtime) derived from SAP transaction data.' },
  { icon: Database, label: 'SAP sync administration', detail: 'Monitor last sync time, error log, and trigger manual reconciliation.' },
  { icon: ShieldAlert, label: 'Read-only safeguards', detail: 'No FMP component writes to SAP HANA tables. All mutations remain in SAP itself.' },
];

const PHASES = [
  { label: 'SAP discovery', items: ['Assess SAP Business One 9.3 Service Layer availability and test company', 'Identify accessible production, inventory, and master data endpoints', 'Confirm read-only credential setup with IT'], done: false },
  { label: 'SAP connection and health', items: ['Service Layer client with health monitoring', 'Connection status page in Administration', 'No SAP write operations — enforced at code level'], done: false },
  { label: 'Master data sync', items: ['Item master, business partners, warehouses', 'Scheduled sync jobs (configurable interval)', 'Delta-sync and conflict detection'], done: false },
  { label: 'Production dashboard', items: ['Production order list and detail', 'KPI calculations from SAP data', 'Reconciliation and error reporting'], done: false },
];

export default function ProductionPage(): React.JSX.Element {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-start gap-4">
        <span className="shrink-0 p-3 bg-accent-light rounded-lg">
          <Factory className="size-6 text-accent" aria-hidden="true" />
        </span>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-text-primary">Production</h1>
            <span className="text-xs font-medium bg-secondary-accent-light text-secondary-accent px-2 py-0.5 rounded-full uppercase tracking-wide">
              Phase 9 — Planned
            </span>
          </div>
          <p className="mt-1 text-text-secondary">
            Production order monitoring and performance metrics via SAP Business One 9.3 read integration.
          </p>
        </div>
      </div>

      <section className="bg-surface rounded-lg border border-border p-5">
        <h2 className="text-base font-semibold text-text-primary mb-2">Purpose</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          The Production module connects FMP to SAP Business One 9.3 (for HANA) in a read-only capacity,
          surfacing production orders, shop-floor quantities, and key performance indicators without
          duplicating the ERP or risking data integrity. SAP remains the authoritative system of record
          for all production, inventory, purchasing, and financial data. FMP only reads and displays.
        </p>
        <div className="mt-3 p-3 bg-warning-light border border-warning/30 rounded-md">
          <p className="text-xs text-warning font-medium">
            No write operations to SAP HANA — FMP reads only. All production transactions remain in SAP.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          Planned Capabilities
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CAPABILITIES.map((cap) => (
            <div key={cap.label} className="bg-surface rounded-lg border border-border p-4 flex items-start gap-3">
              <cap.icon className="size-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-text-primary">{cap.label}</p>
                <p className="text-xs text-text-secondary mt-0.5">{cap.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface rounded-lg border border-border p-5">
        <h2 className="text-base font-semibold text-text-primary mb-2">Current Status</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Production is planned for Phase 9 — the final operational phase before operations hardening.
          Before any integration work begins, the SAP Service Layer must be discovered, tested, and
          confirmed accessible with a read-only credential. No SAP data is currently connected to FMP.
          No production records exist in the FMP database.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          Build Sequence
        </h2>
        <div className="space-y-3">
          {PHASES.map((phase) => (
            <div key={phase.label} className="bg-surface rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                {phase.done
                  ? <CheckCircle2 className="size-4 text-success shrink-0" />
                  : <Circle className="size-4 text-border-strong shrink-0" />}
                <p className="text-sm font-medium text-text-primary">{phase.label}</p>
              </div>
              <ul className="ml-6 space-y-1">
                {phase.items.map((item) => (
                  <li key={item} className="text-xs text-text-muted list-disc">{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
