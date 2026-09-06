import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CalendarPlus } from 'lucide-react';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { ContractScheduleKpiStrip } from './_components/contract-schedule-kpi-strip';
import { ContractScheduleTimelinePanel } from './_components/contract-schedule-timeline-panel';
import { ContractScheduleEditButton } from './_components/contract-schedule-edit-drawer';

export const metadata: Metadata = { title: 'Schedule — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * CM-68A — Contract Detail Schedule, rebuilt as a real Planned vs Actual
 * timeline (replacing the old CM-34 due-date aggregation for this ONE
 * per-contract tab — the module-level register at /contracts/schedule is
 * untouched, a separate CM-68B unit's concern per this unit's own scope
 * boundary). Planned entries are a manager's own real input (additive
 * ContractScheduleItem table, CM-68A); actual values are always derived
 * live from real workflow/payment/production/closeout records server-side
 * (contract-schedule-plan.service.ts) — never stored, never faked.
 */
export default async function ContractScheduleTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [permissions, detail] = await Promise.all([
    getUserPermissions(),
    contractsApi.getContractSchedule(id).catch(() => null),
  ]);
  if (!permissions.includes('contracts.read') || !detail) notFound();

  const canUpdate = permissions.includes('contracts.update');
  const { stages, summary, hasPlannedSchedule } = detail;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Schedule</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Compare planned contract milestones with actual progress from workflow, payments, production, and closeout.
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">Planned = entered by manager. Actual = generated from system activity.</p>
        </div>
        {canUpdate && <ContractScheduleEditButton contractId={id} stages={stages} hasPlannedSchedule={hasPlannedSchedule} />}
      </div>

      <ContractScheduleKpiStrip summary={summary} hasPlannedSchedule={hasPlannedSchedule} />

      {hasPlannedSchedule ? (
        <ContractScheduleTimelinePanel contractId={id} stages={stages} />
      ) : (
        <section className="rounded-lg border border-dashed border-border bg-surface-secondary/40 p-8 flex flex-col items-center justify-center text-center gap-2">
          <CalendarPlus className="size-6 text-text-muted shrink-0" aria-hidden="true" />
          <p className="text-sm font-semibold text-text-primary">No planned schedule has been added yet</p>
          <p className="text-xs text-text-secondary max-w-md">
            Create this contract&rsquo;s planned timeline for Contract Sign, Advance Payment, Drawing Approval, Estimation Sheet, Casting / Production, Delivery, Erection, and Final Closeout.
          </p>
          <p className="text-xs text-text-muted max-w-md">
            Actual dates will be filled from real system updates such as workflow tasks, payments, production status, and closeout.
          </p>
          {canUpdate && (
            <div className="mt-1">
              <ContractScheduleEditButton contractId={id} stages={stages} hasPlannedSchedule={false} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
