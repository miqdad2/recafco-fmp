import type { Metadata } from 'next';
import { ShieldCheck, ClipboardList, Leaf, Calendar, Smartphone, CheckCircle2, Circle, BarChart3 } from 'lucide-react';

export const metadata: Metadata = { title: 'Safety & Compliance — RECAFCO FMP' };

const CAPABILITIES = [
  { icon: ClipboardList, label: 'Inspection checklists', detail: 'Build reusable checklist templates; assign to inspection types, frequencies, and locations.' },
  { icon: Smartphone, label: 'Shop-floor inspections', detail: 'Inspectors complete checklists on mobile; flag non-conformances with photos and notes.' },
  { icon: Leaf, label: 'Environmental monitoring', detail: 'Log and track environmental readings (air quality, waste, noise) against thresholds.' },
  { icon: Calendar, label: 'Compliance calendar', detail: 'Schedule required compliance activities with advance notifications and overdue tracking.' },
  { icon: BarChart3, label: 'Compliance reports', detail: 'Generate compliance status summaries by location, category, and period.' },
  { icon: ShieldCheck, label: 'Non-conformance management', detail: 'Track open non-conformances to resolution; link to corrective actions in Incidents.' },
];

const PHASES = [
  { label: 'Workflow confirmation', items: ['Confirm checklist categories, frequencies, and inspection types with stakeholders', 'Agree environmental parameters and thresholds', 'Confirm compliance calendar requirements'], done: false },
  { label: 'Checklist templates', items: ['Template builder with configurable question types', 'Assignment rules: location, frequency, responsible role', 'Version history for templates'], done: false },
  { label: 'Shop-floor inspections', items: ['Mobile inspection form with offline capability (future)', 'Non-conformance flagging with photo evidence', 'Supervisor review and sign-off'], done: false },
  { label: 'Environmental monitoring and calendar', items: ['Measurement log with threshold alerts', 'Compliance calendar with auto-scheduling', 'Summary report generation'], done: false },
];

export default function SafetyCompliancePage(): React.JSX.Element {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-start gap-4">
        <span className="shrink-0 p-3 bg-success-light rounded-lg">
          <ShieldCheck className="size-6 text-success" aria-hidden="true" />
        </span>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-text-primary">Safety & Compliance</h1>
            <span className="text-xs font-medium bg-secondary-accent-light text-secondary-accent px-2 py-0.5 rounded-full uppercase tracking-wide">
              Phase 7 — Planned
            </span>
          </div>
          <p className="mt-1 text-text-secondary">
            Shop-floor inspection checklists, environmental monitoring, and compliance calendar management.
          </p>
        </div>
      </div>

      <section className="bg-surface rounded-lg border border-border p-5">
        <h2 className="text-base font-semibold text-text-primary mb-2">Purpose</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          The Safety & Compliance module provides structured tools for conducting routine inspections,
          monitoring environmental conditions, and maintaining a compliance calendar. It ensures required
          checks are never missed, non-conformances are tracked to resolution, and compliance evidence is
          always available for internal and external audits.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          Planned Capabilities
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CAPABILITIES.map((cap) => (
            <div key={cap.label} className="bg-surface rounded-lg border border-border p-4 flex items-start gap-3">
              <cap.icon className="size-4 text-success shrink-0 mt-0.5" aria-hidden="true" />
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
          Safety & Compliance is planned for Phase 7. Specific workflow details, checklist categories,
          and compliance requirements will be confirmed with RECAFCO stakeholders before the build
          begins. No compliance records exist in FMP yet.
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
