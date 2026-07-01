import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../../_components/breadcrumbs';
import { TaskForm } from '../../_components/task-form';
import { tasksApi } from '../../../../../lib/factory-tasks-api';
import { departments, plants } from '../../../../../lib/organizations-api';
import { updateDraftTaskAction } from '../../actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getUserInfo(): Promise<{ sub: string; permissions: string[] }> {
  try {
    const store = await cookies();
    const token = store.get('recafco_access')?.value;
    if (!token) return { sub: '', permissions: [] };
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
    return {
      sub: typeof payload.sub === 'string' ? payload.sub : '',
      permissions: Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [],
    };
  } catch {
    return { sub: '', permissions: [] };
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const task = await tasksApi.get(id);
    return { title: `Edit ${task.referenceNumber} — RECAFCO FMP` };
  } catch {
    return { title: 'Edit Task — RECAFCO FMP' };
  }
}

export default async function EditTaskPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [taskRes, deptsRes, plantsRes, userInfo] = await Promise.allSettled([
    tasksApi.get(id),
    departments.list({ isActive: true, pageSize: 200 }),
    plants.list({ isActive: true, pageSize: 100 }),
    getUserInfo(),
  ]);

  if (taskRes.status === 'rejected') notFound();

  const task = (taskRes as PromiseFulfilledResult<Awaited<ReturnType<typeof tasksApi.get>>>).value;

  // Only DRAFT tasks can be edited
  if (task.status !== 'DRAFT') notFound();

  const info = userInfo.status === 'fulfilled' ? userInfo.value : { sub: '', permissions: [] };
  const isCreator = task.createdByUserId === info.sub;
  const canManage = info.permissions.includes('tasks.manage');

  // Only creator or tasks.manage may edit
  if (!isCreator && !canManage) notFound();

  const depts = deptsRes.status === 'fulfilled' ? deptsRes.value.items : [];
  const plantsData = plantsRes.status === 'fulfilled' ? plantsRes.value.items : [];
  const canLinkIncident = info.permissions.includes('incidents.read');

  const boundAction = updateDraftTaskAction.bind(null, id);

  return (
    <div className="min-h-full p-8">
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Factory Tasks', href: '/factory-tasks' },
          { label: task.referenceNumber, href: `/factory-tasks/${id}` },
          { label: 'Edit' },
        ]} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Edit Draft Task</h1>
          <p className="mt-1 text-sm font-mono text-text-muted">{task.referenceNumber}</p>
        </div>

        <TaskForm
          action={boundAction}
          submitLabel="Save changes"
          departments={depts}
          plants={plantsData}
          canLinkIncident={canLinkIncident}
          defaultValues={task}
        />
      </div>
    </div>
  );
}
