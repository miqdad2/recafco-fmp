'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, Download, Plus } from 'lucide-react';
import type { ContractPerson } from '@/lib/contracts-api';
import { IssueFormModal } from './issue-form-modal';

interface ContractOption {
  id: string;
  referenceNumber: string;
  title: string;
}

interface Props {
  /** Existing issue-create permission (contracts.update) — Add Issue is hidden without it. */
  canCreate: boolean;
  contracts: ContractOption[];
  people: ContractPerson[];
}

const secondaryBtn =
  'inline-flex items-center gap-1.5 h-10 px-4 rounded-md border border-border bg-surface text-text-primary text-sm font-medium hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus';

export function IssueActionsBar({ canCreate, contracts, people }: Props): React.JSX.Element {
  const searchParams = useSearchParams();
  const [adding, setAdding] = useState(false);
  const qs = searchParams.toString();
  const exportHref = `/contracts/issues/export${qs ? `?${qs}` : ''}`;

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {canCreate && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          Add Issue
        </button>
      )}
      <button
        type="button"
        onClick={() => window.print()}
        className={secondaryBtn}
        title="Print the current filtered register (use your browser's Save as PDF option for a PDF copy)"
      >
        <Printer className="size-4 shrink-0" aria-hidden="true" />
        Print
      </button>
      <a href={exportHref} className={secondaryBtn} title="Export the current filtered register as CSV (opens in Excel)">
        <Download className="size-4 shrink-0" aria-hidden="true" />
        Export CSV
      </a>
      {adding && <IssueFormModal mode="add" contracts={contracts} people={people} onClose={() => setAdding(false)} />}
    </div>
  );
}
