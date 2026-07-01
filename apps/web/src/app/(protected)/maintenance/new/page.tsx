import type { Metadata } from 'next';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { departments, plants } from '../../../../lib/organizations-api';
import { createMrAction } from '../actions';

export const metadata: Metadata = { title: 'New Maintenance Request — RECAFCO FMP' };

export default async function NewMaintenancePage(): Promise<React.JSX.Element> {
  const [deptsRes, plantsRes] = await Promise.allSettled([
    departments.list({ isActive: true, pageSize: 200 }),
    plants.list({ isActive: true, pageSize: 100 }),
  ]);

  const depts = deptsRes.status === 'fulfilled' ? deptsRes.value.items : [];
  const plantsData = plantsRes.status === 'fulfilled' ? plantsRes.value.items : [];

  return (
    <div className="min-h-full p-8">
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Maintenance Requests', href: '/maintenance' },
          { label: 'New Request' },
        ]} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Submit Maintenance Request</h1>
          <p className="mt-1 text-sm text-text-secondary">
            New requests are saved as drafts. Submit the request once ready for review.
          </p>
        </div>

        <MrForm
          action={createMrAction}
          submitLabel="Create request"
          departments={depts}
          plants={plantsData}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline form component (server-compatible — uses native form submission)
// ---------------------------------------------------------------------------

interface OrgItem {
  id: string;
  code: string;
  name: string;
}

interface MrFormProps {
  action: (prev: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>;
  submitLabel: string;
  departments: OrgItem[];
  plants: OrgItem[];
  defaultValues?: {
    title?: string;
    problemDescription?: string;
    priority?: string;
    affectedDepartmentId?: string;
    plantId?: string;
    equipmentDescription?: string;
    requestedCompletionAt?: string;
  };
}

function MrForm({ action, submitLabel, departments: depts, plants: plantsData, defaultValues }: MrFormProps): React.JSX.Element {
  return (
    <form
      action={action as unknown as string}
      className="space-y-6 rounded-lg border border-border bg-surface p-6"
    >
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-text-primary mb-1">
          Title <span className="text-danger">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={300}
          defaultValue={defaultValues?.title}
          placeholder="Brief description of the issue"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div>
        <label htmlFor="problemDescription" className="block text-sm font-medium text-text-primary mb-1">
          Problem description <span className="text-danger">*</span>
        </label>
        <textarea
          id="problemDescription"
          name="problemDescription"
          required
          rows={5}
          maxLength={10000}
          defaultValue={defaultValues?.problemDescription}
          placeholder="Describe the problem in detail: what happened, when it started, symptoms observed…"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-text-primary mb-1">Priority</label>
          <select
            id="priority"
            name="priority"
            defaultValue={defaultValues?.priority ?? 'MEDIUM'}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>

        <div>
          <label htmlFor="requestedCompletionAt" className="block text-sm font-medium text-text-primary mb-1">Requested completion</label>
          <input
            id="requestedCompletionAt"
            name="requestedCompletionAt"
            type="date"
            defaultValue={defaultValues?.requestedCompletionAt}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      <div>
        <label htmlFor="equipmentDescription" className="block text-sm font-medium text-text-primary mb-1">Equipment / asset</label>
        <input
          id="equipmentDescription"
          name="equipmentDescription"
          type="text"
          maxLength={1000}
          defaultValue={defaultValues?.equipmentDescription}
          placeholder="Name or tag of the affected equipment (optional)"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="affectedDepartmentId" className="block text-sm font-medium text-text-primary mb-1">Affected department</label>
          <select
            id="affectedDepartmentId"
            name="affectedDepartmentId"
            defaultValue={defaultValues?.affectedDepartmentId ?? ''}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">— None —</option>
            {depts.map((d) => (
              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="plantId" className="block text-sm font-medium text-text-primary mb-1">Plant</label>
          <select
            id="plantId"
            name="plantId"
            defaultValue={defaultValues?.plantId ?? ''}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">— None —</option>
            {plantsData.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <a
          href="/maintenance"
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Cancel
        </a>
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
