'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addTaskCommentAction } from '../actions';

interface Props {
  taskId: string;
}

export function AddTaskCommentForm({ taskId }: Props): React.JSX.Element {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setPending(true);
    void (async () => {
      const res = await addTaskCommentAction(taskId, { error: null }, fd);
      const problem = res.error ?? res.fieldErrors?.['body']?.[0] ?? null;
      setMessage(problem);
      if (!problem) {
        form.reset();
        router.refresh();
      }
    })().finally(() => setPending(false));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {message && <p role="alert" className="text-sm text-error">{message}</p>}
      <label htmlFor="task-comment" className="sr-only">Add a comment</label>
      <textarea
        id="task-comment"
        name="body"
        rows={3}
        maxLength={5000}
        placeholder="Write a comment..."
        className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-base text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent/25"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center rounded-md bg-accent px-5 py-2.5 text-base font-semibold text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Posting...' : 'Post comment'}
      </button>
    </form>
  );
}
