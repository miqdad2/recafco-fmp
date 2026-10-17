'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ElementCoverageRow } from '@/lib/technical-api';
import type { withTechnicalRelease } from '../../../../_lib/boq-progress-helpers';
import { ELEMENT_TEXT, summarizeContract } from '../../../../_lib/boq-element-progress-helpers';
import type { ElementFilterKey } from '../../../../_lib/boq-element-progress-helpers';
import { BoqItemCard } from './boq-item-card';
import { BoqElementsModal } from './boq-elements-modal';
import { BoqItemDrawingsModal } from './boq-item-drawings-modal';
import { OPEN_INITIAL_DRAWINGS_EVENT } from './initial-boq-drawings';

type ProgressItem = ReturnType<typeof withTechnicalRelease>[number];

interface Props {
  contractId: string;
  items: ProgressItem[];
  /** One row per element (release and final-drawing state); null = could not be loaded. */
  coverage: ElementCoverageRow[] | null;
}

/**
 * FMP-BOQ-18 — BOQ Progress: one compact summary of the whole contract, then one card per BOQ item.
 * Read-only: View Elements and View Drawings only open lists; nothing here changes a BOQ item or an element.
 */
export function BoqProgressView({ contractId, items, coverage }: Props): React.JSX.Element {
  const [elements, setElements] = useState<{ item: ProgressItem; filter: ElementFilterKey } | null>(null);
  const [drawings, setDrawings] = useState<ProgressItem | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface px-6 py-12 text-center">
        <p className="text-sm text-text-muted">{ELEMENT_TEXT.noItems}</p>
      </div>
    );
  }

  const summary = summarizeContract(items, coverage);
  const rowsFor = (itemId: string): ElementCoverageRow[] | null => (coverage ? coverage.filter((r) => r.boqItemId === itemId) : null);

  const cards: { label: string; value: number | null }[] = [
    { label: 'BOQ Items', value: summary.boqItems },
    { label: 'Confirmed Elements', value: summary.confirmed },
    { label: 'Released to Production', value: summary.released },
    { label: 'In Production', value: summary.inProduction },
    { label: 'Produced', value: summary.produced },
    { label: 'Delivered', value: summary.delivered },
    { label: 'Erected', value: summary.erected },
    { label: 'Completed', value: summary.completed },
  ];

  return (
    <div className="space-y-4">
      <section aria-label="Contract summary">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {cards.map((card) => (
            <div key={card.label} className="rounded-lg border border-border bg-surface px-4 py-3 shadow-sm">
              <p className="text-xs font-medium text-text-secondary">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary" title={card.value === null ? ELEMENT_TEXT.releaseUnavailable : undefined}>
                {card.value ?? '—'}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-text-muted">{ELEMENT_TEXT.summaryNote}</p>
      </section>

      {summary.itemsNeedingAttention > 0 && (
        <div role="status" className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning-light px-4 py-2.5 text-sm text-text-primary">
          <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />
          {summary.itemsNeedingAttention} of {summary.boqItems} BOQ {summary.itemsNeedingAttention === 1 ? 'item needs' : 'items need'} attention. The reasons are listed on each item below.
        </div>
      )}

      <div>
        <p className="mb-2 text-sm text-text-secondary">{ELEMENT_TEXT.itemNote}</p>
        <ul className="space-y-3">
          {items.map((item) => (
            <BoqItemCard
              key={item.boqItemId}
              item={item}
              rows={rowsFor(item.boqItemId)}
              onViewElements={(filter) => setElements({ item, filter })}
              onViewDrawings={() => setDrawings(item)}
            />
          ))}
        </ul>
      </div>

      {elements && (
        <BoqElementsModal
          contractId={contractId}
          item={elements.item}
          rows={rowsFor(elements.item.boqItemId)}
          initialFilter={elements.filter}
          onClose={() => setElements(null)}
        />
      )}

      {drawings && (
        <BoqItemDrawingsModal
          contractId={contractId}
          item={drawings}
          rows={rowsFor(drawings.boqItemId)}
          onClose={() => setDrawings(null)}
          onOpenInitial={() => window.dispatchEvent(new Event(OPEN_INITIAL_DRAWINGS_EVENT))}
        />
      )}
    </div>
  );
}
