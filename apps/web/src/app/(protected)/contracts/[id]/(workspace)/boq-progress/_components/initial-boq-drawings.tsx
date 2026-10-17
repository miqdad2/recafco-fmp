'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { BoqItemAttachment } from '@/lib/technical-api';
import { BoqItemFilesCard } from '../../../../../technical/_components/boq-item-files-card';
import type { BoqFileItem } from '../../../../../technical/_components/boq-item-files-card';
import { BTN_SECONDARY } from '../../../../../technical/_lib/button-styles';

/** Fired by "Open Initial BOQ Drawings" in the item drawings window; the section then opens and scrolls into view. */
export const OPEN_INITIAL_DRAWINGS_EVENT = 'open-initial-boq-drawings';

interface Props {
  contractId: string;
  items: BoqFileItem[];
  /** null = the file list could not be loaded. */
  attachments: BoqItemAttachment[] | null;
  currentUserId: string;
  canUpload: boolean;
  canManage: boolean;
}

/**
 * FMP-BOQ-18 — the client's initial drawings per BOQ item, collapsed by default so the long file
 * list no longer pushes the progress down the page. Opening it shows the existing per-item list
 * (View Drawing in the full-screen viewer, Download, Add more files and Remove under the same
 * permissions as before). Nothing is moved, deleted or re-uploaded by collapsing it.
 */
export function InitialBoqDrawings({ contractId, items, attachments, currentUserId, canUpload, canManage }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    function onOpen(): void {
      setOpen(true);
      setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
    window.addEventListener(OPEN_INITIAL_DRAWINGS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_INITIAL_DRAWINGS_EVENT, onOpen);
  }, []);

  const count = attachments?.length ?? null;
  const countText = count === null ? '' : ` — ${count} ${count === 1 ? 'file' : 'files'}`;
  const Icon = open ? ChevronDown : ChevronRight;

  return (
    <section ref={ref} id="initial-boq-drawings" aria-labelledby="initial-boq-drawings-heading" className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="initial-boq-drawings-heading" className="text-base font-semibold text-text-primary">
          Initial BOQ Drawings{countText}
        </h3>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="initial-boq-drawings-body" className={BTN_SECONDARY}>
          <Icon className="size-3.5" aria-hidden="true" />
          {open ? 'Hide Drawings' : 'Show Drawings'}
        </button>
      </div>
      {open && (
        <div id="initial-boq-drawings-body" className="mt-3">
          <BoqItemFilesCard
            contractId={contractId}
            items={items}
            attachments={attachments}
            currentUserId={currentUserId}
            canUpload={canUpload}
            canManage={canManage}
            viewLabel="View Drawing"
          />
        </div>
      )}
    </section>
  );
}
