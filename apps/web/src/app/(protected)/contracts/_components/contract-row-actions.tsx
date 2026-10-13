import Link from 'next/link';
import { FolderOpen, ListChecks } from 'lucide-react';

interface Props {
  contractId: string;
  /** Used only for the buttons' accessible names, e.g. "Open Hospital Precast". */
  title?: string | undefined;
}

const BASE =
  'inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-xs font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-1';
export const OPEN_BUTTON_CLS = `${BASE} border-accent bg-accent/10 text-accent hover:bg-accent hover:text-accent-foreground`;
export const BOQ_BUTTON_CLS = `${BASE} border-border-strong bg-surface text-text-primary hover:bg-surface-secondary`;

/**
 * FMP-UI-42 — the only two actions in a Contract List row, as real buttons:
 * Open (the contract page) and BOQ (its BOQ Progress tab), both existing routes.
 * "More" is gone; Payments, Issues, Edit, Activate and the other actions are reached
 * from the contract page itself.
 */
export function ContractRowActions({ contractId, title }: Props): React.JSX.Element {
  const name = title ? ` ${title}` : '';
  return (
    <div className="inline-flex flex-wrap items-center justify-end gap-2">
      <Link href={`/contracts/${contractId}`} className={OPEN_BUTTON_CLS} aria-label={`Open${name}`}>
        <FolderOpen className="size-3.5 shrink-0" aria-hidden="true" />
        Open
      </Link>
      <Link href={`/contracts/${contractId}/boq-progress`} className={BOQ_BUTTON_CLS} aria-label={`BOQ${name ? ` for${name}` : ''}`}>
        <ListChecks className="size-3.5 shrink-0" aria-hidden="true" />
        BOQ
      </Link>
    </div>
  );
}
