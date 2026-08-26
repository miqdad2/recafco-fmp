import Link from 'next/link';
import type { OrgRef, ContractPerson } from '@/lib/contracts-api';

interface Props {
  team: string | undefined;
  departmentId: string | undefined;
  ownerUserId: string | undefined;
  status: string | undefined;
  priority: string | undefined;
  dueDateMissing: boolean;
  departments: OrgRef[];
  people: ContractPerson[];
  hasActiveFilters: boolean;
}

const CONTRACT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'CLOSED', label: 'Closed' },
];

const TEAM_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All teams' },
  { value: 'TECHNICAL', label: 'Technical Team' },
  { value: 'PRODUCTION', label: 'Production Team' },
  { value: 'ERECTION', label: 'Erection Team' },
  { value: 'QS_COMMERCIAL', label: 'QS / Commercial Team' },
];

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All priorities' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const labelCls = 'block text-xs font-medium text-text-secondary mb-1';

/** CM-40 — a hidden `mode=assignment` field keeps every filter submission on
 * the Assignment Queue view rather than falling back to All Workflows.
 * CM-40D — "Search" moved out to the live client-side AssignmentQueueContractPicker;
 * these remaining fields are exactly what's now labeled "Advanced filters". */
export function AssignmentQueueFilterBar({
  team,
  departmentId,
  ownerUserId,
  status,
  priority,
  dueDateMissing,
  departments,
  people,
  hasActiveFilters,
}: Props): React.JSX.Element {
  return (
    <form method="GET" action="/contracts/workflow" className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <input type="hidden" name="mode" value="assignment" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label htmlFor="team" className={labelCls}>Team</label>
          <select id="team" name="team" defaultValue={team ?? ''} className={inputCls}>
            {TEAM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="departmentId" className={labelCls}>Department</label>
          <select id="departmentId" name="departmentId" defaultValue={departmentId ?? ''} className={inputCls}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ownerUserId" className={labelCls}>Contract Manager</label>
          <select id="ownerUserId" name="ownerUserId" defaultValue={ownerUserId ?? ''} className={inputCls}>
            <option value="">All managers</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status" className={labelCls}>Contract Status</label>
          <select id="status" name="status" defaultValue={status ?? ''} className={inputCls}>
            {CONTRACT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="priority" className={labelCls}>Priority</label>
          <select id="priority" name="priority" defaultValue={priority ?? ''} className={inputCls}>
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-text-secondary pb-2">
            <input
              type="checkbox"
              name="dueDateMissing"
              value="true"
              defaultChecked={dueDateMissing}
              className="rounded border-border text-accent focus:ring-accent"
            />
            Due date missing only
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        {hasActiveFilters && (
          <Link
            href="/contracts/workflow?mode=assignment"
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Reset Filters
          </Link>
        )}
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Apply Filters
        </button>
      </div>
    </form>
  );
}
