'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { FileText, Search, UploadCloud, X } from 'lucide-react';
import type { PersonRef } from '@/lib/factory-tasks-api';
import { createSimpleTaskAction, searchPeopleAction } from '../actions';
import type { CreateTaskResult } from '../actions';

interface Props {
  /** Only viewers with tasks.assign get the Assign To picker (and it is then required). */
  canAssign: boolean;
  onCancel: () => void;
  onCreated: (result: CreateTaskResult) => void;
}

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'webp', 'txt', 'csv'];
const MAX_TITLE = 300;
const MAX_DETAILS = 5000;

const LABEL = 'block text-sm font-medium text-text-primary';

/**
 * Brand red is the accent colour, so a focused field must NOT look like an
 * error. Normal focus = soft red ring on a neutral border; an actual error =
 * solid red border and ALWAYS a message under the field (see FieldError).
 */
function fieldClass(hasError: boolean): string {
  const base = 'mt-1 block w-full rounded-md border bg-surface px-3 py-2 text-base text-text-primary placeholder:text-text-muted transition-shadow focus:outline-none';
  return hasError
    ? `${base} border-error ring-1 ring-error/30 focus:ring-2 focus:ring-error/30`
    : `${base} border-border focus:border-border-strong focus:ring-2 focus:ring-accent/25`;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function FieldError({ id, message }: { id: string; message: string | undefined }): React.JSX.Element | null {
  return message ? <p id={id} role="alert" className="mt-1 text-sm text-error">{message}</p> : null;
}

/** Searchable "Assign To" picker: type a name, username, email or employee number, then click a result. */
function PersonPicker({ value, onChange, error }: { value: PersonRef | null; onChange: (p: PersonRef | null) => void; error: string | undefined }): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonRef[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      void searchPeopleAction(query).then((people) => {
        if (!cancelled) { setResults(people); setLoading(false); setActive(-1); }
      });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, open]);

  useEffect(() => {
    function onDown(e: MouseEvent): void {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function choose(p: PersonRef): void {
    onChange(p);
    setOpen(false);
  }

  if (value) {
    return (
      <div className="mt-1 flex items-center justify-between gap-3 rounded-md border border-border bg-surface-secondary px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-text-primary">{value.displayName}</p>
          <p className="truncate text-sm text-text-secondary">Department: {value.department?.name ?? 'Not set'}</p>
        </div>
        <button
          type="button"
          onClick={() => { onChange(null); setQuery(''); }}
          aria-label="Remove selected employee"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <X className="size-4" aria-hidden="true" /> Change
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 mt-0.5 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
        <input
          id="new-task-assignee"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="new-task-assignee-list"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'new-task-assignee-error' : undefined}
          autoComplete="off"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
            else if (e.key === 'Enter' && open && active >= 0 && results[active]) { e.preventDefault(); choose(results[active]); }
          }}
          placeholder="Search and select employee..."
          className={`${fieldClass(Boolean(error))} pl-9`}
        />
      </div>
      {open && (
        <ul id="new-task-assignee-list" role="listbox" className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
          {loading && results.length === 0 && <li className="px-3 py-2 text-sm text-text-muted">Searching…</li>}
          {!loading && results.length === 0 && <li className="px-3 py-2 text-sm text-text-muted">No employees found.</li>}
          {results.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onClick={() => choose(p)}
                className={`block w-full px-3 py-2 text-left hover:bg-surface-secondary focus:bg-surface-secondary focus:outline-none ${i === active ? 'bg-surface-secondary' : ''}`}
              >
                <span className="block text-base font-medium text-text-primary">{p.displayName}</span>
                <span className="block text-sm text-text-secondary">{p.department?.name ?? 'Department not set'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!error && <p className="mt-1 text-sm text-text-muted">Type a name, then click a result to select.</p>}
      <FieldError id="new-task-assignee-error" message={error} />
    </div>
  );
}

interface Errors {
  title?: string | undefined;
  details?: string | undefined;
  assignee?: string | undefined;
  dueDate?: string | undefined;
}

/**
 * FMP-TASK-05/06 - the simple Create Task form (Task Name, Task Details,
 * Assign To, Priority, Due Date, Attach Files). Used inside the New Task
 * popup and on the /factory-tasks/new page. The body scrolls; the footer
 * (Cancel / Create Task) stays visible.
 */
export function NewTaskForm({ canAssign, onCancel, onCreated }: Props): React.JSX.Element {
  const [person, setPerson] = useState<PersonRef | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<{ detail: string | null } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentsEndRef = useRef<HTMLDivElement>(null);

  // Keep the newly added files (or a file error) in view inside the scrolling body, above the footer.
  useEffect(() => {
    if (files.length === 0 && !fileError) return;
    attachmentsEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [files.length, fileError]);

  function clearError(key: keyof Errors): void {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  function addFiles(list: FileList | File[] | null): void {
    if (!list) return;
    const accepted: File[] = [];
    const problems: string[] = [];
    for (const f of Array.from(list)) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ALLOWED_EXTENSIONS.includes(ext)) problems.push(`${f.name}: This file type is not allowed.`);
      else if (f.size > MAX_FILE_BYTES) problems.push(`${f.name}: File is too large. Maximum size is 25 MB.`);
      else accepted.push(f);
    }
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...accepted.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
    setFileError(problems.length > 0 ? problems.join(' ') : null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const title = ((fd.get('title') as string | null) ?? '').trim();
    const details = ((fd.get('description') as string | null) ?? '').trim();

    const next: Errors = {};
    if (!title) next.title = 'Please enter a task name.';
    else if (title.length > MAX_TITLE) next.title = 'Task name is too long.';
    if (details.length > MAX_DETAILS) next.details = 'Task details are too long.';
    if (canAssign && !person) next.assignee = 'Please select who should do this task.';
    setErrors(next);
    setFailure(null);
    if (Object.keys(next).length > 0) {
      const firstId = next.title ? 'new-task-title' : next.details ? 'new-task-details' : 'new-task-assignee';
      document.getElementById(firstId)?.focus();
      return;
    }

    if (person) {
      fd.set('assignedToUserId', person.id);
      if (person.department) fd.set('assigneeDepartmentId', person.department.id);
    }
    for (const f of files) fd.append('files', f, f.name);
    startTransition(async () => {
      let res: CreateTaskResult;
      try {
        res = await createSimpleTaskAction(fd);
      } catch {
        setFailure({ detail: null });
        return;
      }
      if (res.taskId) { onCreated(res); return; }
      if (res.fieldErrors) {
        setErrors({ title: res.fieldErrors['title']?.[0], dueDate: res.fieldErrors['dueDate']?.[0] });
        return;
      }
      setFailure({ detail: res.error });
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 pb-6 pt-1">
        {failure && (
          <div role="alert" className="rounded-lg border border-error bg-error-light px-4 py-3 text-sm text-error">
            <p className="font-medium">Task could not be created. Please try again.</p>
            {failure.detail && <p className="mt-0.5">{failure.detail}</p>}
          </div>
        )}

        <div>
          <label htmlFor="new-task-title" className={LABEL}>Task Name <span aria-hidden="true" className="text-error">*</span></label>
          <input
            id="new-task-title"
            name="title"
            type="text"
            placeholder="Example: Check drawing status"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? 'new-task-title-error' : undefined}
            onChange={() => clearError('title')}
            className={fieldClass(Boolean(errors.title))}
          />
          <FieldError id="new-task-title-error" message={errors.title} />
        </div>

        <div>
          <label htmlFor="new-task-details" className={LABEL}>Task Details</label>
          <textarea
            id="new-task-details"
            name="description"
            rows={3}
            placeholder="Write what needs to be done."
            aria-invalid={errors.details ? true : undefined}
            aria-describedby={errors.details ? 'new-task-details-error' : undefined}
            onChange={() => clearError('details')}
            className={fieldClass(Boolean(errors.details))}
          />
          <FieldError id="new-task-details-error" message={errors.details} />
        </div>

        {canAssign && (
          <div>
            <label htmlFor="new-task-assignee" className={LABEL}>Assign To <span aria-hidden="true" className="text-error">*</span></label>
            <PersonPicker value={person} onChange={(p) => { setPerson(p); if (p) clearError('assignee'); }} error={errors.assignee} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="new-task-priority" className={LABEL}>Priority</label>
            <select id="new-task-priority" name="priority" defaultValue="NORMAL" className={fieldClass(false)}>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div>
            <label htmlFor="new-task-due" className={LABEL}>Due Date</label>
            <input
              id="new-task-due"
              name="dueDate"
              type="date"
              aria-invalid={errors.dueDate ? true : undefined}
              onChange={() => clearError('dueDate')}
              className={fieldClass(Boolean(errors.dueDate))}
            />
            {errors.dueDate ? <FieldError id="new-task-due-error" message={errors.dueDate} /> : <p className="mt-1 text-sm text-text-muted">When should this be completed?</p>}
          </div>
        </div>

        <div>
          <p className={LABEL}>Attach Files</p>
          <p className="text-sm text-text-muted">PDF, Word, Excel, and photos are allowed.</p>
          <label
            htmlFor="new-task-files"
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            className={`mt-2 flex cursor-pointer rounded-lg border-2 border-dashed text-center transition-colors focus-within:ring-2 focus-within:ring-accent/25 ${files.length > 0 ? 'flex-row items-center justify-center gap-2 px-3 py-2' : 'flex-col items-center gap-1 px-4 py-4'} ${dragging ? 'border-accent bg-accent-light' : 'border-border-strong bg-surface-secondary hover:bg-surface'}`}
          >
            <UploadCloud className={`shrink-0 text-text-muted ${files.length > 0 ? 'size-5' : 'size-7'}`} aria-hidden="true" />
            {files.length > 0 ? (
              <span className="text-sm font-medium text-text-primary">
                <span className="text-accent underline">Add more files</span> <span className="font-normal text-text-secondary">or drag and drop here</span>
              </span>
            ) : (
              <>
                <span className="text-base font-medium text-text-primary">
                  <span className="text-accent underline">Choose files</span> <span className="font-normal text-text-secondary">or drag and drop here</span>
                </span>
                <span className="text-sm text-text-muted">Maximum size 25 MB per file</span>
              </>
            )}
            <input
              ref={fileInputRef}
              id="new-task-files"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt,.csv"
              onChange={(e) => addFiles(e.target.files)}
              className="sr-only"
            />
          </label>
          {fileError && <p role="alert" className="mt-1 text-sm text-error">{fileError}</p>}
          {files.length > 0 && (
            <ul className="mt-2 space-y-2">
              {files.map((f, i) => (
                <li key={`${f.name}-${f.size}`} className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
                  <FileText className="size-6 shrink-0 text-text-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text-primary" title={f.name}>{f.name}</span>
                    <span className="block text-sm text-text-muted">{formatSize(f.size)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={`Remove ${f.name}`}
                    className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-error hover:bg-error-light focus:outline-none focus:ring-2 focus:ring-focus"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div ref={attachmentsEndRef} aria-hidden="true" className="scroll-mb-6" />
        </div>
      </div>

      <div className="relative z-10 flex shrink-0 items-center justify-end gap-3 border-t border-border bg-surface px-6 py-4 shadow-[0_-6px_8px_-6px_rgba(0,0,0,0.18)]">
        <button type="button" onClick={onCancel} disabled={isPending} className="rounded-md border border-border bg-surface px-5 py-2 text-base font-medium text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50">
          Cancel
        </button>
        <button type="submit" disabled={isPending} className="rounded-md bg-accent px-5 py-2 text-base font-semibold text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60">
          {isPending ? 'Creating...' : 'Create Task'}
        </button>
      </div>
    </form>
  );
}
