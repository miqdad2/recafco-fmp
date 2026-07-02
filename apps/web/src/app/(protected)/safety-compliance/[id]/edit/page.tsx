import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../../_components/breadcrumbs';
import { departments, plants } from '../../../../../lib/organizations-api';
import { safetyApi } from '../../../../../lib/safety-api';
import { updateInspectionDraftAction } from '../../actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getCurrentUserId(): Promise<string | undefined> {
  try {
    const store = await cookies();
    const token = store.get('recafco_access')?.value;
    if (!token) return undefined;
    const raw = token.split('.')[1];
    if (!raw) return undefined;
    const payload = JSON.parse(Buffer.from(raw, 'base64url').toString()) as { sub?: string; permissions?: string[] };
    return payload.sub;
  } catch {
    return undefined;
  }
}

async function getUserPermissions(): Promise<string[]> {
  try {
    const store = await cookies();
    const token = store.get('recafco_access')?.value;
    if (!token) return [];
    const raw = token.split('.')[1];
    if (!raw) return [];
    const payload = JSON.parse(Buffer.from(raw, 'base64url').toString()) as { sub?: string; permissions?: string[] };
    return Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [];
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const insp = await safetyApi.get(id);
    return { title: `Edit ${insp.referenceNumber} — RECAFCO FMP` };
  } catch {
    return { title: 'Edit Inspection — RECAFCO FMP' };
  }
}

export default async function EditSafetyInspectionPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [inspRes, currentUserId, permissions, deptsRes, plantsRes] = await Promise.all([
    safetyApi.get(id).catch(() => null),
    getCurrentUserId(),
    getUserPermissions(),
    departments.list({ isActive: true, pageSize: 200 }),
    plants.list({ isActive: true, pageSize: 100 }),
  ]);

  if (!inspRes || inspRes.status !== 'DRAFT') notFound();

  const canManage = permissions.includes('safety.manage');
  const isCreator = inspRes.createdByUserId === currentUserId;
  if (!isCreator && !canManage) notFound();

  const depts = deptsRes.items;
  const plantsData = plantsRes.items;
  const boundAction = updateInspectionDraftAction.bind(null, id);

  return (
    <div className="min-h-full p-8">
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Safety & Compliance', href: '/safety-compliance' },
          { label: inspRes.referenceNumber, href: `/safety-compliance/${id}` },
          { label: 'Edit' },
        ]} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Edit Inspection</h1>
          <p className="mt-1 text-sm text-text-muted font-mono">{inspRes.referenceNumber}</p>
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
              defaultValue={inspRes.title}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label htmlFor="summary" className="block text-sm font-medium text-text-primary mb-1">Summary</label>
            <textarea
              id="summary"
              name="summary"
              rows={4}
              maxLength={10000}
              defaultValue={inspRes.summary ?? ''}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="departmentId" className="block text-sm font-medium text-text-primary mb-1">Department</label>
              <select
                id="departmentId"
                name="departmentId"
                defaultValue={inspRes.departmentId ?? ''}
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
                defaultValue={inspRes.plantId ?? ''}
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
              href={`/safety-compliance/${id}`}
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
