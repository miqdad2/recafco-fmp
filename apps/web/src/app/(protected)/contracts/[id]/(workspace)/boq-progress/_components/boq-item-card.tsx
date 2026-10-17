'use client';

import { FileText, Layers } from 'lucide-react';
import type { ElementCoverageRow } from '@/lib/technical-api';
import type { withTechnicalRelease } from '../../../../_lib/boq-progress-helpers';
import { formatContractQtyUnit } from '../../../../../technical/_lib/boq-confirmation-helpers';
import { BTN_QUIET, BTN_SECONDARY, BADGE } from '../../../../../technical/_lib/button-styles';
import { ADD_BOQ_ITEM_TEXT, elementsNotConfirmed } from '../../../../_lib/add-boq-item-helpers';
import { ELEMENT_TEXT, completedText, itemStateMessage, reasonText, summarizeItem } from '../../../../_lib/boq-element-progress-helpers';
import type { ElementFilterKey } from '../../../../_lib/boq-element-progress-helpers';

export type ProgressItem = ReturnType<typeof withTechnicalRelease>[number];

interface Props {
  item: ProgressItem;
  /** This item's elements from the coverage list; null = release details could not be loaded. */
  rows: ElementCoverageRow[] | null;
  onViewElements: (filter: ElementFilterKey) => void;
  onViewDrawings: () => void;
}

/**
 * FMP-BOQ-18 — one BOQ item: its identity and Contract Qty, how many elements are confirmed /
 * generated / released, where the elements are right now, and what is holding things up.
 * Read-only: the two buttons only open lists; nothing here changes an element.
 */
export function BoqItemCard({ item, rows, onViewElements, onViewDrawings }: Props): React.JSX.Element {
  const summary = summarizeItem(item, rows);
  const progress = completedText(item);
  const stateMessage = itemStateMessage(item);
  const attention = summary.reasons.filter((r) => r.tone === 'attention');
  const next = summary.reasons.filter((r) => r.tone === 'waiting');

  return (
    <li className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-text-primary">
            {item.sortOrder}. {item.description}
          </p>
          <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-secondary">
            <div className="flex gap-1">
              <dt>Contract Qty:</dt>
              <dd className="font-medium text-text-primary">{formatContractQtyUnit(item.contractQty, item.contractUnit)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Confirmed Elements:</dt>
              <dd className="font-medium text-text-primary">{summary.confirmed ?? 'Not confirmed yet'}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Generated Elements:</dt>
              <dd className="font-medium text-text-primary">{summary.generated}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Released to Production:</dt>
              <dd className="font-medium text-text-primary">{summary.released ?? '—'}</dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {elementsNotConfirmed(item) && <span className={`${BADGE} bg-surface-secondary text-text-secondary`}>{ADD_BOQ_ITEM_TEXT.elementsNotConfirmed}</span>}
          {summary.needsAttention && <span className={`${BADGE} bg-warning-light text-warning`}>Needs Attention</span>}
          <button type="button" onClick={() => onViewElements('ALL')} className={BTN_SECONDARY}>
            <Layers className="size-3.5" aria-hidden="true" />
            View Elements
          </button>
          <button type="button" onClick={onViewDrawings} className={BTN_SECONDARY}>
            <FileText className="size-3.5" aria-hidden="true" />
            View Drawings
          </button>
        </div>
      </div>

      {stateMessage ? (
        <p className="mt-3 rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-muted">{stateMessage}</p>
      ) : (
        <>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-text-secondary">Where the elements are now</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
            {summary.tiles.map((tile) => (
              <div key={tile.key} className="rounded-md bg-surface-secondary px-3 py-2">
                <p className="text-[11px] leading-tight text-text-secondary">{tile.label}</p>
                <p className="text-lg font-semibold tabular-nums text-text-primary">{tile.count ?? '—'}</p>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.generated}
              aria-valuenow={progress.completed}
              aria-label={progress.text}
              className="h-2 w-full overflow-hidden rounded-full bg-surface-secondary"
            >
              <div className="h-full rounded-full bg-success" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="mt-1 text-xs text-text-secondary">{progress.text}</p>
          </div>
        </>
      )}

      {attention.length > 0 && (
        <div className="mt-3 rounded-md border border-warning/40 bg-warning-light px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-warning">Needs Attention</p>
          <ul className="mt-1 space-y-1.5">
            {attention.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-primary">
                <span>{reasonText(r)}</span>
                {r.filter && (
                  <button type="button" onClick={() => onViewElements(r.filter!)} className={BTN_QUIET}>
                    View Elements
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {next.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Next steps</p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {next.map((r) => (
              <li key={r.key}>
                {r.filter ? (
                  <button type="button" onClick={() => onViewElements(r.filter!)} className={`${BTN_QUIET} h-7`} title="Show these elements">
                    {reasonText(r)}
                  </button>
                ) : (
                  <span className="text-xs text-text-secondary">{reasonText(r)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows === null && summary.generated > 0 && <p className="mt-2 text-xs text-text-muted">{ELEMENT_TEXT.releaseUnavailable}</p>}
    </li>
  );
}
