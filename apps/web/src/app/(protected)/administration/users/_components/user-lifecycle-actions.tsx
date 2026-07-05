'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type UserLifecycleActionResult = { error?: string };

interface UserLifecycleActionsProps {
  id: string;
  username: string;
  isActive: boolean;
  isArchived: boolean;
  isTestUser: boolean;
  activateAction: (id: string) => Promise<void>;
  deactivateAction: (id: string) => Promise<void>;
  archiveAction: (id: string) => Promise<UserLifecycleActionResult>;
  deleteTestUserAction: (id: string, confirmationText: string) => Promise<UserLifecycleActionResult>;
}

type DialogState =
  | { type: 'none' }
  | { type: 'archive'; confirmInput: string }
  | { type: 'delete'; confirmInput: string }
  | { type: 'error'; message: string };

export function UserLifecycleActions({
  id,
  username,
  isActive,
  isArchived,
  isTestUser,
  activateAction,
  deactivateAction,
  archiveAction,
  deleteTestUserAction,
}: UserLifecycleActionsProps): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });

  const closeAll = () => {
    setMenuOpen(false);
    setDialog({ type: 'none' });
  };

  const run = (fn: () => Promise<UserLifecycleActionResult | void>) => {
    startTransition(async () => {
      const res = (await fn()) as UserLifecycleActionResult | undefined;
      if (res?.error) {
        setDialog({ type: 'error', message: res.error });
      } else {
        closeAll();
        router.refresh();
      }
    });
  };

  return (
    <div className="relative inline-block text-left">
      <a
        href={`/administration/users/${id}/edit`}
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
                onClick={() => {
                  setMenuOpen(false);
                  run(() => deactivateAction(id));
                }}
                disabled={isPending}
                className="w-full text-left px-4 py-2 hover:bg-surface-hover disabled:opacity-50"
              >
                Deactivate
              </button>
            )}
            {!isArchived && !isActive && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  run(() => activateAction(id));
                }}
                disabled={isPending}
                className="w-full text-left px-4 py-2 hover:bg-surface-hover disabled:opacity-50"
              >
                Activate
              </button>
            )}
            {!isArchived && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setDialog({ type: 'archive', confirmInput: '' });
                }}
                disabled={isPending}
                className="w-full text-left px-4 py-2 hover:bg-surface-hover text-warning disabled:opacity-50"
              >
                Archive
              </button>
            )}
            {isTestUser && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setDialog({ type: 'delete', confirmInput: '' });
                }}
                disabled={isPending}
                className="w-full text-left px-4 py-2 hover:bg-surface-hover text-destructive disabled:opacity-50"
              >
                Delete (test)
              </button>
            )}
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
                <h2 className="text-base font-semibold text-text-primary mb-2">
                  Archive {username}
                </h2>
                <p className="text-sm text-text-secondary mb-4">
                  This will deactivate and archive <strong>{username}</strong>. Type the username to
                  confirm.
                </p>
                <input
                  type="text"
                  value={dialog.confirmInput}
                  onChange={(e) =>
                    setDialog({ type: 'archive', confirmInput: e.target.value })
                  }
                  placeholder={username}
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
                    onClick={() => {
                      if (dialog.confirmInput !== username) return;
                      run(() => archiveAction(id));
                    }}
                    disabled={dialog.confirmInput !== username || isPending}
                    className="px-4 py-2 text-sm rounded bg-warning text-white hover:opacity-90 disabled:opacity-40"
                  >
                    Archive
                  </button>
                </div>
              </>
            )}

            {dialog.type === 'delete' && (
              <>
                <h2 className="text-base font-semibold text-destructive mb-2">
                  Delete Test User {username}
                </h2>
                <p className="text-sm text-text-secondary mb-4">
                  Permanently deletes this test account. The account must have no history. Type{' '}
                  <strong className="font-mono">{username}</strong> to confirm.
                </p>
                <input
                  type="text"
                  value={dialog.confirmInput}
                  onChange={(e) =>
                    setDialog({ type: 'delete', confirmInput: e.target.value })
                  }
                  placeholder={username}
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
                    onClick={() => {
                      if (dialog.confirmInput !== username) return;
                      run(() => deleteTestUserAction(id, dialog.confirmInput));
                    }}
                    disabled={dialog.confirmInput !== username || isPending}
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
