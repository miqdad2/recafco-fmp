'use client';

import { useRouter } from 'next/navigation';
import { NewTaskForm } from './new-task-form';

/** FMP-TASK-05 - client wrapper so the /factory-tasks/new page can navigate after create / cancel. */
export function NewTaskPageForm({ canAssign }: { canAssign: boolean }): React.JSX.Element {
  const router = useRouter();
  return (
    <NewTaskForm
      canAssign={canAssign}
      onCancel={() => router.push('/factory-tasks/executive')}
      onCreated={(result) => router.push(result.taskId ? `/factory-tasks/${result.taskId}` : '/factory-tasks/executive')}
    />
  );
}
