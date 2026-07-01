import type { Metadata } from 'next';
import { FileText, Bell, Users, GitBranch, CheckCircle2, Circle, Search } from 'lucide-react';

export const metadata: Metadata = { title: 'Contracts — RECAFCO FMP' };

const CAPABILITIES = [
  { icon: FileText, label: 'Contract register', detail: 'Maintain a structured register of all vendor, service, and supplier contracts with key terms.' },
  { icon: Bell, label: 'Renewal alerts', detail: 'Automated notifications before contract expiry dates to ensure timely renewal decisions.' },
  { icon: GitBranch, label: 'Approval workflow', detail: 'Route new contracts and amendments through a configurable approval chain before activation.' },
  { icon: Users, label: 'Vendor management', detail: 'Link contracts to vendors; track performance notes and escalation history.' },
  { icon: Search, label: 'Contract search', detail: 'Find contracts by vendor, type, status, or expiry period with full-text search.' },
  { icon: FileText, label: 'Document storage', detail: 'Attach signed contract documents and amendments; versioned file storage.' },
];

const PHASES = [
  { label: 'Workflow confirmation', items: ['Confirm contract categories and approval chains with stakeholders', 'Agree on contract lifecycle statuses', 'Confirm regulatory or compliance storage requirements'], done: false },
  { label: 'Contract register', items: ['Contract entity with vendor, type, dates, value, status', 'Document attachment (depends on file attachment service)', 'Search and filter'], done: false },
  { label: 'Approval workflow', items: ['Configurable approval chain per contract type', 'Notification on approval request and decision', 'Audit trail of approvals'], done: false },
  { label: 'Renewals and reporting', items: ['Renewal alert scheduler', 'Contract expiry dashboard', 'Export for procurement records'], done: false },
];

export default function ContractsPage(): React.JSX.Element {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-start gap-4">
        <span className="shrink-0 p-3 bg-surface-secondary rounded-lg">
          <FileText className="size-6 text-text-secondary" aria-hidden="true" />
        </span>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-text-primary">Contracts</h1>
            <span className="text-xs font-medium bg-secondary-accent-light text-secondary-accent px-2 py-0.5 rounded-full uppercase tracking-wide">
              Phase 8 — Planned
            </span>
          </div>
          <p className="mt-1 text-text-secondary">
            Vendor and service contract register with lifecycle tracking and approval workflow.
          </p>
        </div>
      </div>

      <section className="bg-surface rounded-lg border border-border p-5">
        <h2 className="text-base font-semibold text-text-primary mb-2">Purpose</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          The Contracts module maintains a structured register of all external agreements — vendor
          contracts, service agreements, and supplier terms. It ensures contracts are tracked from
          initiation through renewal or termination, that approvals are documented, and that expiring
          contracts are flagged in advance so no agreement lapses without a decision.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          Planned Capabilities
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CAPABILITIES.map((cap) => (
            <div key={cap.label} className="bg-surface rounded-lg border border-border p-4 flex items-start gap-3">
              <cap.icon className="size-4 text-text-secondary shrink-0 mt-0.5" aria-hidden="true" />
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
          Contracts is planned for Phase 8, after the Safety & Compliance module. The specific approval
          workflow and contract categories will be confirmed with stakeholders before build begins —
          this module will not be implemented based on assumed workflows. No contract records exist
          in FMP yet.
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
