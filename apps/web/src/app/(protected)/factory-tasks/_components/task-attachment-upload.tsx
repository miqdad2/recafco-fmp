'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud } from 'lucide-react';
import { uploadTaskFilesAction } from '../actions';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'webp', 'txt', 'csv'];

/** FMP-TASK-10 - "Add file" on the task page, so a file that failed to upload at creation can be added later. */
export function TaskAttachmentUpload({ taskId }: { taskId: string }): React.JSX.Element {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onPick(list: FileList | null): void {
    if (!list || list.length === 0) return;
    const fd = new FormData();
    const problems: string[] = [];
    for (const f of Array.from(list)) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ALLOWED_EXTENSIONS.includes(ext)) problems.push(`${f.name}: This file type is not allowed.`);
      else if (f.size > MAX_FILE_BYTES) problems.push(`${f.name}: File is too large. Maximum size is 25 MB.`);
      else fd.append('files', f, f.name);
    }
    if (inputRef.current) inputRef.current.value = '';
    setError(problems.length > 0 ? problems.join(' ') : null);
    if (!fd.has('files')) return;
    startTransition(async () => {
      const res = await uploadTaskFilesAction(taskId, fd);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="mt-3">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-base font-medium text-text-primary hover:bg-surface-secondary focus-within:ring-2 focus-within:ring-focus">
        <UploadCloud className="size-4 text-text-muted" aria-hidden="true" />
        {isPending ? 'Uploading...' : 'Add file'}
        <input
          ref={inputRef}
          type="file"
          multiple
          disabled={isPending}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt,.csv"
          onChange={(e) => onPick(e.target.files)}
          className="sr-only"
        />
      </label>
      {error && <p role="alert" className="mt-2 text-sm text-error">{error}</p>}
    </div>
  );
}
