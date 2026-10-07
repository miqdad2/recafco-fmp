'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NewTaskForm } from './new-task-form';
import type { CreateTaskResult } from '../actions';

/**
 * FMP-TASK-05 - the "+ New Task" button. Opens the simple Create Task popup;
 * on success it closes the popup, refreshes the page data and shows a short
 * "Task created successfully." message.
 */
export function NewTaskButton({ canAssign }: { canAssign: boolean }): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; warning: boolean } | null>(null);

  // Stop the page behind the popup from scrolling while it is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.warning ? 12000 : 5000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleCreated(result: CreateTaskResult): void {
    setOpen(false);
    setToast(result.warning ? { text: result.warning, warning: true } : { text: 'Task created successfully.', warning: false });
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-md bg-accent px-5 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
      >
        + New Task
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="create-task-title" className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
            <div className="px-6 pb-3 pt-5">
              <h2 id="create-task-title" className="text-xl font-semibold text-text-primary">Create Task</h2>
              <p className="mt-1 text-base text-text-secondary">Add a task and assign it to someone.</p>
            </div>
            <NewTaskForm canAssign={canAssign} onCancel={() => setOpen(false)} onCreated={handleCreated} />
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 max-w-md rounded-lg border px-4 py-3 text-base shadow-lg ${toast.warning ? 'border-warning bg-warning-light text-warning' : 'border-success bg-success-light text-success'}`}
        >
          {toast.text}
        </div>
      )}
    </>
  );
}
