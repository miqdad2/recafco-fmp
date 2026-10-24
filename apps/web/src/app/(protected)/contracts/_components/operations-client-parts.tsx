'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import type { OperationsActionResult } from '@/lib/operations-api';
import {
  confirmOperationsLinkAction,
  deleteFactoryMappingAction,
  linkOperationsProjectByIdAction,
  registerOperationsProjectAction,
  removeOperationsLinkAction,
  requestOperationsRefreshAction,
  setFactoryMappingAction,
} from '../operations-actions';

// FMP-OPS-01 — small client controls for the Operations screens. They only call FMP's own server actions.

const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-accent text-sm font-medium text-white hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60';
const BTN_SECONDARY =
  'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md border border-border bg-surface text-sm font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60';
const INPUT =
  'h-9 rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus';

function Feedback({ result }: { result: OperationsActionResult | null }): React.JSX.Element | null {
  if (!result) return null;
  return result.error ? (
    <p role="alert" className="text-sm text-error">{result.error}</p>
  ) : (
    <p role="status" className="text-sm text-success">{result.message}</p>
  );
}

/**
 * Re-reads the page (accepted local data only) on an interval, so an open screen keeps up with the background
 * updates. It never contacts the external system. Paused while the browser tab is hidden.
 */
export function OperationsAutoRefresh({ everySeconds }: { everySeconds: number }): null {
  const router = useRouter();
  useEffect(() => {
    const ms = Math.max(30, everySeconds) * 1000;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, ms);
    return () => clearInterval(id);
  }, [router, everySeconds]);
  return null;
}

export function OperationsRefreshButton({ contractId }: { contractId: string }): React.JSX.Element {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<OperationsActionResult | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className={BTN_SECONDARY}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setResult(await requestOperationsRefreshAction(contractId));
            router.refresh();
          })
        }
      >
        <RefreshCw className={`size-4 shrink-0 ${pending ? 'animate-spin' : ''}`} aria-hidden="true" />
        Request refresh
      </button>
      <div className="max-w-xs text-right text-xs"><Feedback result={result} /></div>
    </div>
  );
}

export function LinkByIdForm({ contractId }: { contractId: string }): React.JSX.Element {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();
  const [result, setResult] = useState<OperationsActionResult | null>(null);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await linkOperationsProjectByIdAction(contractId, value, reason);
          setResult(r);
          if (!r.error) {
            setValue('');
            setReason('');
            router.refresh();
          }
        });
      }}
    >
      <label htmlFor="ops-project-id" className="block text-sm font-medium text-text-primary">
        Operations project id
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="ops-project-id"
          className={`${INPUT} w-72 max-w-full`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. shapoorji-2025-92"
          autoComplete="off"
          required
        />
        <button type="submit" className={BTN_PRIMARY} disabled={pending || value.trim() === ''}>
          Link project
        </button>
      </div>
      <label htmlFor="ops-link-reason" className="block pt-1 text-sm font-medium text-text-primary">Reason</label>
      <input
        id="ops-link-reason"
        className={`${INPUT} w-full max-w-xl`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        placeholder="Needed when the factory cannot be matched automatically (for example no plant is set)"
      />
      <p className="text-xs text-text-muted">Use the project id shown in the Operations system. Linking does not create or change anything there, and it does not set the contract&apos;s plant.</p>
      <Feedback result={result} />
    </form>
  );
}

export function RemoveLinkForm({ projectId, contractId }: { projectId: string; contractId: string | null }): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();
  const [result, setResult] = useState<OperationsActionResult | null>(null);
  if (!open) {
    return (
      <button type="button" className={BTN_SECONDARY} onClick={() => setOpen(true)}>
        Remove link…
      </button>
    );
  }
  return (
    <form
      className="space-y-2 rounded-md border border-border bg-surface-secondary p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await removeOperationsLinkAction(projectId, contractId, reason);
          setResult(r);
          if (!r.error) router.refresh();
        });
      }}
    >
      <label htmlFor={`unlink-${projectId}`} className="block text-sm font-medium text-text-primary">Reason for removing the link (required)</label>
      <input id={`unlink-${projectId}`} className={`${INPUT} w-full`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
      <div className="flex gap-2">
        <button type="submit" className={BTN_PRIMARY} disabled={pending || reason.trim() === ''}>Remove link</button>
        <button type="button" className={BTN_SECONDARY} onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <Feedback result={result} />
    </form>
  );
}

export function ConfirmLinkButton({ projectId, contractId, label, requireReason = false }: { projectId: string; contractId: string; label: string; requireReason?: boolean }): React.JSX.Element {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();
  const [result, setResult] = useState<OperationsActionResult | null>(null);
  return (
    <div className="space-y-1">
      {requireReason && (
        <input
          aria-label="Reason for linking"
          className={`${INPUT} w-64 max-w-full`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="Reason (required — no automatic match)"
        />
      )}
      <button
        type="button"
        className={BTN_PRIMARY}
        disabled={pending || (requireReason && reason.trim() === '')}
        onClick={() =>
          start(async () => {
            const r = await confirmOperationsLinkAction(projectId, contractId, reason);
            setResult(r);
            if (!r.error) router.refresh();
          })
        }
      >
        {label}
      </button>
      <Feedback result={result} />
    </div>
  );
}

export function RegisterProjectForm(): React.JSX.Element {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [pending, start] = useTransition();
  const [result, setResult] = useState<OperationsActionResult | null>(null);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await registerOperationsProjectAction(value);
          setResult(r);
          if (!r.error) {
            setValue('');
            router.refresh();
          }
        });
      }}
    >
      <label htmlFor="ops-register-id" className="block text-sm font-medium text-text-primary">Operations project id</label>
      <div className="flex flex-wrap items-center gap-2">
        <input id="ops-register-id" className={`${INPUT} w-72 max-w-full`} value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. shapoorji-2025-92" autoComplete="off" required />
        <button type="submit" className={BTN_PRIMARY} disabled={pending || value.trim() === ''}>Add project</button>
      </div>
      <Feedback result={result} />
    </form>
  );
}

export function FactoryMappingForm({ plants }: { plants: { id: string; code: string; name: string }[] }): React.JSX.Element {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [plantId, setPlantId] = useState('');
  const [pending, start] = useTransition();
  const [result, setResult] = useState<OperationsActionResult | null>(null);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setFactoryMappingAction(code, plantId);
          setResult(r);
          if (!r.error) {
            setCode('');
            router.refresh();
          }
        });
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="ops-factory-code" className="block text-sm font-medium text-text-primary">Source factory code</label>
          <input id="ops-factory-code" className={`${INPUT} w-28`} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="PC" maxLength={20} required />
        </div>
        <div>
          <label htmlFor="ops-factory-plant" className="block text-sm font-medium text-text-primary">FMP plant</label>
          <select id="ops-factory-plant" className={`${INPUT} w-64 max-w-full`} value={plantId} onChange={(e) => setPlantId(e.target.value)} required>
            <option value="">Choose a plant…</option>
            {plants.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>
        </div>
        <button type="submit" className={BTN_PRIMARY} disabled={pending || code.trim() === '' || plantId === ''}>Save mapping</button>
      </div>
      <Feedback result={result} />
    </form>
  );
}

export function DeleteMappingButton({ id }: { id: string }): React.JSX.Element {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="text-sm text-error underline-offset-2 hover:underline disabled:opacity-60"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await deleteFactoryMappingAction(id);
          router.refresh();
        })
      }
    >
      Remove
    </button>
  );
}
