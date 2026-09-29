import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { TaskForm } from '../_components/task-form';
import { createTaskAction } from '../actions';
import { tasksApi } from '../../../../lib/factory-tasks-api';

export const metadata: Metadata = { title: 'Create New Task — RECAFCO FMP' };

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

/**
 * FMP-UI-20B — redesigned per direct feedback that this page felt too
 * basic: unclear title, no visible assignment step, one long unsectioned
 * form. Real "Assign To User" support: `canAssign` is true only when the
 * viewer holds `tasks.assign` (the same permission `task-transitions.tsx`'s
 * own Assign panel already requires) — only then is the real people list
 * (`tasksApi.people()`, already used elsewhere for the exact same picker)
 * fetched and passed to the form. A viewer without that permission never
 * sees the field at all.
 *
 * FMP-UI-20C — "Save as Draft"/"Create Draft" exposed internal lifecycle
 * wording normal users don't need, per direct feedback. Subtitle updated;
 * `submitLabel` is now always the single "Create Task" (task-form.tsx
 * collapsed its own footer to one button) — whether the task ends up
 * assigned is decided by whether "Assign To User" was filled in, not by
 * which button was clicked.
 *
 * FMP-UI-20D — fixed the Responsible Department dropdown rendering with
 * zero options for normal users. Root cause: this page called the
 * ADMIN-gated `organizations-api.ts` (`departments.list()`/`plants.list()`,
 * `GET /organizations/departments` — requires `org.departments.read`, a
 * permission a `tasks.create`-only user doesn't hold); the 403 was silently
 * swallowed by `Promise.allSettled`, so `depts`/`plantsData` were always `[]`
 * with no error shown. Switched to `tasksApi.departments()`/`.plants()`
 * (new `GET /factory-tasks/departments`/`/plants`, gated by `tasks.read` —
 * the same permission already required to reach this page at all — see
 * factory-tasks.service.ts's own doc comment). `deptsFailed`/`plantsFailed`
 * are now tracked and passed through so the form can show a real error
 * state instead of a silently empty dropdown.
 */
export default async function NewTaskPage(): Promise<React.JSX.Element> {
  const permissions = await getUserPermissions();
  const canLinkIncident = permissions.includes('incidents.read');
  const canAssign = permissions.includes('tasks.assign');

  const [deptsRes, plantsRes, peopleRes] = await Promise.allSettled([
    tasksApi.departments(),
    tasksApi.plants(),
    canAssign ? tasksApi.people() : Promise.resolve([]),
  ]);

  const depts = deptsRes.status === 'fulfilled' ? deptsRes.value : [];
  const deptsFailed = deptsRes.status === 'rejected';
  const plantsData = plantsRes.status === 'fulfilled' ? plantsRes.value : [];
  const plantsFailed = plantsRes.status === 'rejected';
  const people = peopleRes.status === 'fulfilled' ? peopleRes.value : [];

  return (
    <div className="min-h-full p-8">
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Factory Tasks Management', href: '/factory-tasks' },
          { label: 'Create New Task' },
        ]} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Create New Task</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Create a task, define responsibility, set priority and due date.
          </p>
        </div>

        <TaskForm
          action={createTaskAction}
          submitLabel="Create Task"
          departments={depts}
          deptsFailed={deptsFailed}
          plants={plantsData}
          plantsFailed={plantsFailed}
          people={canAssign ? people : undefined}
          canAssign={canAssign}
          canLinkIncident={canLinkIncident}
        />
      </div>
    </div>
  );
}
