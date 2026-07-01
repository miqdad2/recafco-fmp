import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../../_components/breadcrumbs';
import { maintenanceApi } from '../../../../../lib/maintenance-api';
import { departments, plants } from '../../../../../lib/organizations-api';
import { updateMrDraftAction } from '../../actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: 'Edit Maintenance Request — RECAFCO FMP' };

async function getJwtPayload(): Promise<{ sub?: string; permissions?: string[] }> {
  try {
    const store = await cookies();
    const token = store.get('recafco_access')?.value;
    if (!token) return {};
    const raw = token.split('.')[1];
    if (!raw) return {};
    return JSON.parse(Buffer.from(raw, 'base64url').toString()) as { sub?: string; permissions?: string[] };
  } catch {
    return {};
  }
}

export default async function EditMrPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [jwt, mrRes, deptsRes, plantsRes] = await Promise.allSettled([
    getJwtPayload(),
    maintenanceApi.get(id),
    departments.list({ isActive: true, pageSize: 200 }),
    plants.list({ isActive: true, pageSize: 100 }),
  ]);

  if (mrRes.status === 'rejected') notFound();

  const mr = (mrRes as PromiseFulfilledResult<Awaited<ReturnType<typeof maintenanceApi.get>>>).value;

  if (mr.status !== 'DRAFT') notFound();

  const payload = jwt.status === 'fulfilled' ? jwt.value : {};
  const currentUserId = payload.sub;
  const permissions = Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [];
  const canManage = permissions.includes('maintenance.manage');

  if (mr.createdByUserId !== currentUserId && !canManage) notFound();

  const depts = deptsRes.status === 'fulfilled' ? deptsRes.value.items : [];
  const plantsData = plantsRes.status === 'fulfilled' ? plantsRes.value.items : [];

  const boundAction = updateMrDraftAction.bind(null, mr.id);

  return (
    <div className="min-h-full p-8">
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Maintenance Requests', href: '/maintenance' },
          { label: mr.referenceNumber, href: `/maintenance/${mr.id}` },
          { label: 'Edit' },
        ]} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Edit Request</h1>
          <p className="mt-1 text-sm text-text-secondary font-mono">{mr.referenceNumber}</p>
        </div>

        <form
          action={boundAction as unknown as string}
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
              defaultValue={mr.title}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
              defaultValue={mr.problemDescription}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-text-primary mb-1">Priority</label>
              <select
                id="priority"
                name="priority"
                defaultValue={mr.priority}
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
                defaultValue={mr.requestedCompletionAt ? mr.requestedCompletionAt.substring(0, 10) : undefined}
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
              defaultValue={mr.equipmentDescription ?? ''}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="affectedDepartmentId" className="block text-sm font-medium text-text-primary mb-1">Affected department</label>
              <select
                id="affectedDepartmentId"
                name="affectedDepartmentId"
                defaultValue={mr.affectedDepartmentId ?? ''}
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
                defaultValue={mr.plantId ?? ''}
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
              href={`/maintenance/${mr.id}`}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Cancel
            </a>
            <button
              type="submit"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
