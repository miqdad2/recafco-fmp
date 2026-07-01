import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { TaskForm } from '../_components/task-form';
import { createTaskAction } from '../actions';
import { departments, plants } from '../../../../lib/organizations-api';

export const metadata: Metadata = { title: 'New Task — RECAFCO FMP' };

async function getUserPermissions(): Promise<string[]> {
  try {
    const store = await cookies();
    const token = store.get('recafco_access')?.value;
    if (!token) return [];
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
    return Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [];
  } catch {
    return [];
  }
}

export default async function NewTaskPage(): Promise<React.JSX.Element> {
  const [deptsRes, plantsRes, permissions] = await Promise.allSettled([
    departments.list({ isActive: true, pageSize: 200 }),
    plants.list({ isActive: true, pageSize: 100 }),
    getUserPermissions(),
  ]);

  const depts = deptsRes.status === 'fulfilled' ? deptsRes.value.items : [];
  const plantsData = plantsRes.status === 'fulfilled' ? plantsRes.value.items : [];
  const perms = permissions.status === 'fulfilled' ? permissions.value : [];
  const canLinkIncident = perms.includes('incidents.read');

  return (
    <div className="min-h-full p-8">
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Factory Tasks', href: '/factory-tasks' },
          { label: 'New Task' },
        ]} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Create Task</h1>
          <p className="mt-1 text-sm text-text-secondary">
            New tasks are saved as drafts. Open the task once it is ready to be assigned.
          </p>
        </div>

        <TaskForm
          action={createTaskAction}
          submitLabel="Create task"
          departments={depts}
          plants={plantsData}
          canLinkIncident={canLinkIncident}
        />
      </div>
    </div>
  );
}
