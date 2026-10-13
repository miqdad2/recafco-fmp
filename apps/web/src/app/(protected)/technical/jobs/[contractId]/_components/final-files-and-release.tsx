'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { DrawingGroup, DrawingGroupItem, ElementCoverageData, ElementCoverageRow } from '@/lib/technical-api';
import { DrawingGroupFilesModal } from './drawing-group-files-modal';
import { ElementDrawingModal } from './element-drawing-modal';
import { canChangeGroupFiles } from '../../../_lib/drawing-group-helpers';
import { isNoGroupingGroup } from '../../../_lib/element-status-helpers';
import { activeGroups } from '../../../_lib/technical-workflow-helpers';
import { technicalStepHref } from '../../../_lib/technical-step-ui';
import { BTN_SECONDARY } from '../../../_lib/button-styles';
import { DrawingFileActionButton } from '../../../_components/drawing-file-action-button';
import { REPLACE_DRAWING_HINT, drawingFileButtons, drawingRowStatus } from '../../../_lib/drawing-file-ui';
import { DrawingReadinessBanner } from '../../../_components/coverage-summary-cards';

// ---------------------------------------------------------------------------
// FMP-TECH-27 — "Final Drawing Files" and "Release to Production".
//
// Every element is its own record and must have final drawing coverage before
// release: its Drawing Group has final files (Group Drawings), or the element
// has its own final files (Individual Element Drawings). Release always releases
// individual elements — every element in a ready group, or the individually
// covered elements the user picks; Production never receives a combined BOQ
// item. Update buttons need `canWrite`; the API enforces the same rules.
// ---------------------------------------------------------------------------

interface Props {
  contractId: string;
  items: DrawingGroupItem[] | null;
  coverage: ElementCoverageData | null;
  canWrite: boolean;
}

const smallBtnCls = BTN_SECONDARY;

function setLabel(g: DrawingGroup, itemName: string): string {
  if (isNoGroupingGroup(g)) return `All elements — ${itemName}`;
  const name = g.groupTitle ? `${g.groupTitle} · ` : '';
  return g.calculationRef ? `${name}${g.drawingNo} · Calc: ${g.calculationRef}` : `${name}${g.drawingNo}`;
}

/** Final-drawing wording for one drawing group. */
function groupStatus(g: DrawingGroup): { label: string; classes: string } {
  return drawingRowStatus(g.fileCount, g.status === 'RELEASED_TO_PRODUCTION');
}

function elementCoverageBadge(e: ElementCoverageRow): { label: string; classes: string } {
  return drawingRowStatus(e.individualFileCount, e.releaseState === 'RELEASED');
}

function Stat({ label, value, warn = false }: { label: string; value: number; warn?: boolean }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-md bg-surface-secondary/60 px-3 py-2">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className={`text-lg font-bold tabular-nums ${warn ? 'text-warning' : 'text-text-primary'}`}>{value}</dd>
    </div>
  );
}

export function FinalDrawingFilesSection({ contractId, items, coverage, canWrite }: Props): React.JSX.Element {
  const [tab, setTab] = useState<'groups' | 'individual'>('groups');
  const [filesFor, setFilesFor] = useState<DrawingGroup | null>(null);
  const [elementsFor, setElementsFor] = useState<ElementCoverageRow[] | null>(null);
  // Replace Drawing opens the same dialog with a short hint; nothing is deleted unless the user removes a file.
  const [intro, setIntro] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const groups = activeGroups(items);
  const itemName = (id: string): string => items?.find((i) => i.boqItemId === id)?.description ?? '';
  const groupFileTotal = groups.reduce((t, g) => t + g.fileCount, 0);
  const groupCovered = groups.filter((g) => g.fileCount > 0).reduce((t, g) => t + g.pieceCount, 0);
  const groupMissing = groups.filter((g) => g.fileCount === 0).reduce((t, g) => t + g.pieceCount, 0);

  const individual = (coverage?.elements ?? []).filter((e) => e.group === null);
  const individualFileTotal = individual.reduce((t, e) => t + e.individualFileCount, 0);
  const individualCovered = individual.filter((e) => e.coverage === 'INDIVIDUAL').length;
  const individualMissing = individual.filter((e) => e.coverage === 'NONE').length;
  const selectable = individual.filter((e) => e.releaseState !== 'RELEASED');

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const tabCls = (active: boolean): string =>
    `inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-focus ${active ? 'border-accent bg-accent-light text-accent' : 'border-border bg-surface text-text-secondary hover:bg-surface-secondary'}`;

  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-labelledby="final-files-title">
      <h2 id="final-files-title" className="text-base font-semibold text-text-primary">Final Drawing Files</h2>
      <p className="mt-0.5 text-sm text-text-secondary">
        Every element needs a final drawing before release to Production. Upload drawings for a group, or directly for an individual element.
      </p>
      {coverage && <div className="mt-3"><DrawingReadinessBanner summary={coverage.summary} /></div>}

      <div role="tablist" aria-label="Final drawing files" className="mt-3 flex flex-wrap gap-2">
        <button type="button" role="tab" aria-selected={tab === 'groups'} onClick={() => setTab('groups')} className={tabCls(tab === 'groups')}>Group Drawings</button>
        <button type="button" role="tab" aria-selected={tab === 'individual'} onClick={() => setTab('individual')} className={tabCls(tab === 'individual')}>Individual Element Drawings</button>
      </div>

      {items === null ? (
        <p className="mt-4 text-sm text-text-muted">Elements could not be loaded. Please refresh the page.</p>
      ) : tab === 'groups' ? (
        <div className="mt-4">
          <p className="mb-3 text-sm text-text-secondary">Use this when one drawing file covers several elements in a drawing group.</p>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Stat label="Drawing files" value={groupFileTotal} />
            <Stat label="Elements with group drawing" value={groupCovered} />
            <Stat label="Elements waiting final drawing" value={groupMissing} warn={groupMissing > 0} />
          </dl>
          {groups.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">
              No drawing groups. Groups are optional —{' '}
              <Link href={technicalStepHref(contractId, 'drawing-groups')} className="font-medium text-accent hover:underline">create one</Link> when several elements share the same drawing, or add drawings to individual elements.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {groups.map((g) => {
                const st = groupStatus(g);
                return (
                  <li key={g.id} className="rounded-md border border-border bg-surface-secondary/40 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="text-sm font-medium text-text-primary">{setLabel(g, itemName(g.boqItemId))}</p>
                        <p className="truncate text-xs text-text-secondary" title={itemName(g.boqItemId)}>
                          {itemName(g.boqItemId)} · {g.pieceCount} {g.pieceCount === 1 ? 'element' : 'elements'} · {g.fileCount === 0 ? 'No drawing uploaded yet' : `Drawing files: ${g.fileCount}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${st.classes}`}>{st.label}</span>
                        {drawingFileButtons(g.fileCount, canWrite, canChangeGroupFiles(g.status)).map((b) => (
                          <DrawingFileActionButton
                            key={b.action}
                            action={b.action}
                            label={b.label}
                            onClick={() => {
                              setIntro(b.action === 'replace' ? REPLACE_DRAWING_HINT : null);
                              setFilesFor(g);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-text-secondary">Use this when one element has its own drawing and does not need a group.</p>
          {coverage === null ? (
            <p className="mt-3 text-sm text-text-muted">Element drawings could not be loaded. Please refresh the page.</p>
          ) : (
            <>
              <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Stat label="Drawing files" value={individualFileTotal} />
                <Stat label="Elements with own drawing" value={individualCovered} />
                <Stat label="Elements waiting final drawing" value={individualMissing} warn={individualMissing > 0} />
              </dl>
              {individual.length === 0 ? (
                <p className="mt-3 text-sm text-text-muted">Every element is in a Drawing Group, or no elements exist yet.</p>
              ) : (
                <>
                  {canWrite && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={selected.size === 0}
                        onClick={() => setElementsFor(individual.filter((e) => selected.has(e.id)))}
                        className={smallBtnCls}
                      >
                        Add Drawing for selected ({selected.size})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelected(new Set(selectable.filter((e) => e.coverage === 'NONE').map((e) => e.id)))}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        Select all waiting
                      </button>
                      {selected.size > 0 && (
                        <button type="button" onClick={() => setSelected(new Set())} className="text-xs font-medium text-text-secondary hover:underline">Clear</button>
                      )}
                    </div>
                  )}
                  <ul className="mt-3 divide-y divide-border rounded-md border border-border">
                    {individual.map((e) => {
                      const badge = elementCoverageBadge(e);
                      const released = e.releaseState === 'RELEASED';
                      return (
                        <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
                          {canWrite && (
                            <input
                              type="checkbox"
                              checked={selected.has(e.id)}
                              disabled={released}
                              onChange={() => toggle(e.id)}
                              aria-label={`Select ${e.pieceCode}`}
                              className="size-4 shrink-0 rounded border-border accent-[var(--color-accent)]"
                            />
                          )}
                          <div className="min-w-0 flex-1 basis-48">
                            <p className="text-sm font-medium text-text-primary">{e.pieceCode}</p>
                            <p className="truncate text-xs text-text-secondary" title={e.boqItemDescription}>{e.boqItemSortOrder}. {e.boqItemDescription} · Files: {e.individualFileCount}</p>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.classes}`}>{badge.label}</span>
                            {drawingFileButtons(e.individualFileCount, canWrite, !released).map((b) => (
                              <DrawingFileActionButton
                                key={b.action}
                                action={b.action}
                                label={b.label}
                                onClick={() => {
                                  setIntro(b.action === 'replace' ? REPLACE_DRAWING_HINT : null);
                                  setElementsFor([e]);
                                }}
                              />
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}

      {filesFor && <DrawingGroupFilesModal contractId={contractId} group={filesFor} canWrite={canWrite} intro={intro} onClose={() => setFilesFor(null)} />}
      {elementsFor && (
        <ElementDrawingModal
          contractId={contractId}
          elements={elementsFor.map((e) => ({ id: e.id, pieceCode: e.pieceCode }))}
          canWrite={canWrite}
          intro={intro}
          readOnlyReason={elementsFor.some((e) => e.releaseState === 'RELEASED') ? 'Released elements cannot be changed.' : null}
          onClose={() => {
            setElementsFor(null);
            setSelected(new Set());
          }}
        />
      )}
    </section>
  );
}
