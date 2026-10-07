import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { authApi } from '@/lib/auth-api';
import { NewTaskPageForm } from '../_components/new-task-page-form';

export const metadata: Metadata = { title: 'Create Task — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-TASK-05 - the direct /factory-tasks/new route (kept so existing links
 * keep working) now shows the same simple Create Task form as the popup, in
 * a centered card. No department / plant / location / incident fields.
 */
export default async function NewTaskPage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const me = await authApi.me(store.get('recafco_access')?.value ?? '').catch(() => null);
  const permissions: string[] = me?.ok ? me.data.permissions : [];
  if (!permissions.includes('tasks.create')) notFound();

  return (
    <div className="min-h-full px-4 py-8">
      <div className="mx-auto flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="px-6 pb-3 pt-5">
          <h1 className="text-xl font-semibold text-text-primary">Create Task</h1>
          <p className="mt-1 text-base text-text-secondary">Add a task and assign it to someone.</p>
        </div>
        <NewTaskPageForm canAssign={permissions.includes('tasks.assign')} />
      </div>
    </div>
  );
}
