'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { DependencyCheck } from '@/lib/organizations-api';

type LifecycleActionResult = { error?: string };

interface OrgLifecycleActionsProps {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  isArchived: boolean;
  editHref: string;
  activateAction: (id: string) => Promise<LifecycleActionResult>;
  deactivateAction: (id: string) => Promise<LifecycleActionResult>;
  archiveAction: (id: string) => Promise<LifecycleActionResult>;
  getDependenciesAction: (id: string) => Promise<DependencyCheck | { error: string }>;
  deleteAction: (id: string) => Promise<LifecycleActionResult>;
}

type DialogState =
  | { type: 'none' }
  | { type: 'archive'; confirmInput: string }
  | { type: 'delete_checking' }
  | { type: 'delete_blocked'; dependencies: Record<string, number> }
  | { type: 'delete_confirm'; confirmInput: string }
  | { type: 'error'; message: string };

export function OrgLifecycleActions({
  id,
  code,
  name,
  isActive,
  isArchived,
  editHref,
  activateAction,
  deactivateAction,
  archiveAction,
  getDependenciesAction,
  deleteAction,
}: OrgLifecycleActionsProps): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const menuRef = useRef<HTMLDivElement>(null);

  const closeAll = () => {
    setMenuOpen(false);
    setDialog({ type: 'none' });
  };

  const run = (fn: () => Promise<LifecycleActionResult>) => {
    startTransition(async () => {
      const res = await fn();
      if (res.error) {
        setDialog({ type: 'error', message: res.error });
      } else {
        closeAll();
        router.refresh();
      }
    });
  };

  const handleActivate = () => {
    setMenuOpen(false);
    run(() => activateAction(id));
  };

  const handleDeactivate = () => {
    setMenuOpen(false);
    run(() => deactivateAction(id));
  };

  const handleArchiveOpen = () => {
    setMenuOpen(false);
    setDialog({ type: 'archive', confirmInput: '' });
  };

  const handleArchiveConfirm = () => {
    const d = dialog as { type: 'archive'; confirmInput: string };
    if (d.confirmInput !== code) return;
    run(() => archiveAction(id));
  };

  const handleDeleteOpen = () => {
    setMenuOpen(false);
    setDialog({ type: 'delete_checking' });
    startTransition(async () => {
      const result = await getDependenciesAction(id);
      if ('error' in result) {
        setDialog({ type: 'error', message: result.error });
        return;
      }
      if (!result.canDelete) {
        setDialog({ type: 'delete_blocked', dependencies: result.dependencies });
      } else {
        setDialog({ type: 'delete_confirm', confirmInput: '' });
      }
    });
  };

  const handleDeleteConfirm = () => {
    const d = dialog as { type: 'delete_confirm'; confirmInput: string };
    if (d.confirmInput !== code) return;
    run(() => deleteAction(id));
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <a
        href={editHref}
        className="text-xs font-medium text-accent hover:text-accent-hover focus:outline-none focus:underline mr-3"
      >
        Edit
      </a>
      <button
        onClick={() => setMenuOpen((o) => !o)}
        disabled={isPending}
        className="text-xs font-medium text-text-secondary hover:text-text-primary focus:outline-none disabled:opacity-50"
        aria-label="More actions"
      >
        ···
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-md shadow-md bg-surface border border-border py-1 text-sm">
            {!isArchived && isActive && (
              <button
                onClick={handleDeactivate}
                disabled={isPending}
                className="w-full text-left px-4 py-2 hover:bg-surface-hover disabled:opacity-50"
              >
                Deactivate
              </button>
            )}
            {!isArchived && !isActive && (
              <button
                onClick={handleActivate}
                disabled={isPending}
                className="w-full text-left px-4 py-2 hover:bg-surface-hover disabled:opacity-50"
              >
                Activate
              </button>
            )}
            {!isArchived && (
              <button
                onClick={handleArchiveOpen}
                disabled={isPending}
                className="w-full text-left px-4 py-2 hover:bg-surface-hover text-warning disabled:opacity-50"
              >
                Archive
              </button>
            )}
            <button
              onClick={handleDeleteOpen}
              disabled={isPending}
              className="w-full text-left px-4 py-2 hover:bg-surface-hover text-destructive disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </>
      )}

      {dialog.type !== 'none' && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-surface rounded-lg shadow-lg border border-border w-full max-w-sm mx-4 p-6">
            {dialog.type === 'archive' && (
              <>
                <h2 className="text-base font-semibold text-text-primary mb-2">Archive {name}</h2>
                <p className="text-sm text-text-secondary mb-4">
                  This will deactivate and archive <strong>{name}</strong>. Type the code{' '}
                  <strong className="font-mono">{code}</strong> to confirm.
                </p>
                <input
                  type="text"
                  value={dialog.confirmInput}
                  onChange={(e) =>
                    setDialog({ type: 'archive', confirmInput: e.target.value })
                  }
                  placeholder={code}
                  className="w-full px-3 py-2 rounded border border-border bg-surface text-text-primary text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-focus font-mono"
                  autoFocus
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={closeAll}
                    className="px-4 py-2 text-sm rounded border border-border hover:bg-surface-hover"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleArchiveConfirm}
                    disabled={dialog.confirmInput !== code || isPending}
                    className="px-4 py-2 text-sm rounded bg-warning text-white hover:opacity-90 disabled:opacity-40"
                  >
                    Archive
                  </button>
                </div>
              </>
            )}

            {dialog.type === 'delete_checking' && (
              <p className="text-sm text-text-secondary">Checking dependencies…</p>
            )}

            {dialog.type === 'delete_blocked' && (
              <>
                <h2 className="text-base font-semibold text-text-primary mb-2">Cannot Delete {name}</h2>
                <p className="text-sm text-text-secondary mb-3">
                  This record is referenced by the following:
                </p>
                <ul className="text-sm text-text-secondary mb-4 list-disc pl-5 space-y-1">
                  {Object.entries(dialog.dependencies).map(([k, v]) => (
                    <li key={k}>
                      {v} {k}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-text-muted mb-4">
                  Deactivate or archive it instead to preserve history.
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={closeAll}
                    className="px-4 py-2 text-sm rounded border border-border hover:bg-surface-hover"
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {dialog.type === 'delete_confirm' && (
              <>
                <h2 className="text-base font-semibold text-destructive mb-2">
                  Permanently Delete {name}
                </h2>
                <p className="text-sm text-text-secondary mb-4">
                  This action is <strong>irreversible</strong>. Type the code{' '}
                  <strong className="font-mono">{code}</strong> to confirm permanent deletion.
                </p>
                <input
                  type="text"
                  value={dialog.confirmInput}
                  onChange={(e) =>
                    setDialog({ type: 'delete_confirm', confirmInput: e.target.value })
                  }
                  placeholder={code}
                  className="w-full px-3 py-2 rounded border border-border bg-surface text-text-primary text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-focus font-mono"
                  autoFocus
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={closeAll}
                    className="px-4 py-2 text-sm rounded border border-border hover:bg-surface-hover"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={dialog.confirmInput !== code || isPending}
                    className="px-4 py-2 text-sm rounded bg-destructive text-white hover:opacity-90 disabled:opacity-40"
                  >
                    Delete permanently
                  </button>
                </div>
              </>
            )}

            {dialog.type === 'error' && (
              <>
                <h2 className="text-base font-semibold text-destructive mb-2">Action failed</h2>
                <p className="text-sm text-text-secondary mb-4">{dialog.message}</p>
                <div className="flex justify-end">
                  <button
                    onClick={closeAll}
                    className="px-4 py-2 text-sm rounded border border-border hover:bg-surface-hover"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
