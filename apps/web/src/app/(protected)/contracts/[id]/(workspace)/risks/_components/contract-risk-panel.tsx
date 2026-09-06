'use client';

import { useMemo, useState } from 'react';
import { Download, PencilLine, FileSearch } from 'lucide-react';
import type { ContractRisk, ContractPerson } from '@/lib/contracts-api';
import { ContractRiskLevelBadge } from './contract-risk-level-badge';
import { ContractRiskResponseBadge } from './contract-risk-response-badge';
import { ContractRiskStatusBadge } from './contract-risk-status-badge';
import { ContractRiskFormModal } from './contract-risk-form-modal';
import {
  RISK_LEVEL_FILTER_OPTIONS,
  RISK_RESPONSE_FILTER_OPTIONS,
  RISK_STATUS_FILTER_OPTIONS,
  formatDaysToDeadline,
} from '../../../../_lib/contract-risk-helpers';

interface Props {
  contractId: string;
  risks: ContractRisk[];
  people: ContractPerson[];
  canUpdate: boolean;
}

type ModalState = { mode: 'add' } | { mode: 'edit'; risk: ContractRisk } | null;

/** Same "not yet mitigated/closed/cancelled" definition as the Open Risks KPI card — see contract-risks.service.ts computeRiskSummary. */
const RESOLVED_STATUSES = ['MITIGATED', 'CLOSED', 'CANCELLED'];

const inputCls =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const filterLabelCls = 'text-[11px] font-medium text-text-muted uppercase tracking-wide';

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TABLE_COLUMNS = [
  'Risk ID', 'Risk Clause / Description', 'Risk Evaluation', 'Risk Response', 'Risk Response Description',
  'Residual Risk', 'Status', 'Responsible Person', 'Action Due Date', 'Last Update', 'Action',
];

// CM-62B — Risk ID (first) and Action (last) columns pinned while the other
// 9 columns scroll horizontally underneath, reusing Claims' own established
// sticky-column pattern (contract-claim-panel.tsx, itself reused from
// Contract List's contract-list-table.tsx). Opaque backgrounds required on
// both (header matches this table's own light bg-surface-secondary header,
// body uses bg-surface) — same known tradeoff as Claims: a sticky body cell
// does not pick up the row's own hover tint.
const STICKY_LEFT_HEADER_CLS = 'sticky left-0 z-10 bg-surface-secondary border-r border-border';
const STICKY_RIGHT_HEADER_CLS = 'sticky right-0 z-10 bg-surface-secondary border-l border-border';
const STICKY_LEFT_CLS = 'sticky left-0 z-10 bg-surface border-r border-border';
const STICKY_RIGHT_CLS = 'sticky right-0 z-10 bg-surface border-l border-border';

/**
 * CM-62 — Risk Assessment search/filter row + table + Add/Edit modal
 * trigger, all in one client component. Same bounded, contract-scoped,
 * client-side-filtered pattern established for Production Status/Variations/
 * Claims (documented in ui-registry.md) — a contract's risk list is small
 * and fetched in full server-side, so search/evaluation/response/residual/
 * status/open-only filtering happens instantly with no round trip and no
 * pagination. Risk Response Description shows the free-text plan verbatim
 * (e.g. "Cover through insurance and subcontractor responsibility clause.")
 * — Subcontracting/Insurance live only here, never as a Risk Response
 * dropdown value. Action Due Date is colored from the real signed
 * daysToDeadline: red when overdue, amber when due within 30 days (not yet
 * resolved), green-neutral otherwise — "—" when a risk has no due date at
 * all, never a fabricated color or number.
 * CM-62B — pure UI polish, no filter/export/add logic changed: filter
 * selects widened slightly (min-w-28 → min-w-32) to match Claims' own
 * filter-row proportions; empty state reworded to the approved two-line
 * copy; Risk ID/Action columns pinned via sticky positioning (see constants
 * above) so both stay reachable while scrolling the remaining 9 columns.
 */
export function ContractRiskPanel({ contractId, risks, people, canUpdate }: Props): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [riskEvaluation, setRiskEvaluation] = useState('');
  const [riskResponse, setRiskResponse] = useState('');
  const [residualRisk, setResidualRisk] = useState('');
  const [status, setStatus] = useState('');
  const [openRisksOnly, setOpenRisksOnly] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const filteredRisks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return risks.filter((r) => {
      if (q && !r.description.toLowerCase().includes(q) && !(r.riskNo?.toLowerCase().includes(q) ?? false)) return false;
      if (riskEvaluation && r.riskEvaluation !== riskEvaluation) return false;
      if (riskResponse && r.riskResponse !== riskResponse) return false;
      if (residualRisk && r.residualRisk !== residualRisk) return false;
      if (status && r.status !== status) return false;
      if (openRisksOnly && RESOLVED_STATUSES.includes(r.status)) return false;
      return true;
    });
  }, [risks, search, riskEvaluation, riskResponse, residualRisk, status, openRisksOnly]);

  const exportUrl = `/contracts/${contractId}/risks/export`;

  return (
    <>
      <section className="rounded-lg border border-border bg-surface shadow-sm p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-48">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Risk ID or description…"
              aria-label="Search by Risk ID or description"
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Risk Evaluation</span>
            <select value={riskEvaluation} onChange={(e) => setRiskEvaluation(e.target.value)} aria-label="Risk Evaluation" className={`${inputCls} w-auto min-w-32`}>
              {RISK_LEVEL_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Risk Response</span>
            <select value={riskResponse} onChange={(e) => setRiskResponse(e.target.value)} aria-label="Risk Response" className={`${inputCls} w-auto min-w-32`}>
              {RISK_RESPONSE_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Residual Risk</span>
            <select value={residualRisk} onChange={(e) => setResidualRisk(e.target.value)} aria-label="Residual Risk" className={`${inputCls} w-auto min-w-32`}>
              {RISK_LEVEL_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className={`${inputCls} w-auto min-w-32`}>
              {RISK_STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2.5 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={openRisksOnly}
              onChange={(e) => setOpenRisksOnly(e.target.checked)}
              className="rounded border-border text-accent focus:ring-accent"
            />
            Open Risks Only
          </label>

          <div className="flex items-center gap-2 ml-auto">
            <a
              href={exportUrl}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
              title="Export this contract's risks as CSV (opens in Excel)"
            >
              <Download className="size-3.5 shrink-0" aria-hidden="true" />
              Export Excel
            </a>
            {canUpdate && (
              <button
                type="button"
                onClick={() => setModal({ mode: 'add' })}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
              >
                Add Risk
              </button>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Risk Register</h2>
        {risks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-secondary/40 py-12 text-center">
            <FileSearch className="size-6 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium text-text-secondary mt-1">No risks recorded yet.</p>
            <p className="text-xs text-text-muted">Add a risk when there is a delivery, cost, schedule, subcontractor, insurance, or contract execution concern.</p>
          </div>
        ) : filteredRisks.length === 0 ? (
          <div className="flex items-center justify-center gap-2.5 rounded-lg border border-dashed border-border bg-surface-secondary/40 py-6">
            <FileSearch className="size-4 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm text-text-secondary">No risks match the current search/filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
            <table className="w-full min-w-350 divide-y divide-border text-xs">
              <thead className="border-b-2 border-border-strong">
                <tr className="bg-surface-secondary">
                  {TABLE_COLUMNS.map((col, index) => {
                    const stickyCls = index === 0 ? STICKY_LEFT_HEADER_CLS : index === TABLE_COLUMNS.length - 1 ? STICKY_RIGHT_HEADER_CLS : '';
                    return (
                      <th key={col} className={`px-3 py-2.5 text-left font-bold uppercase tracking-wide text-text-primary whitespace-nowrap ${stickyCls}`}>
                        {col}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {filteredRisks.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-secondary/50 transition-colors">
                    <td className={`px-3 py-2 whitespace-nowrap font-medium text-text-primary ${STICKY_LEFT_CLS}`}>{r.riskNo || '—'}</td>
                    <td className="px-3 py-2 max-w-72 truncate" title={r.description}>{r.description}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><ContractRiskLevelBadge level={r.riskEvaluation} /></td>
                    <td className="px-3 py-2 whitespace-nowrap"><ContractRiskResponseBadge response={r.riskResponse} /></td>
                    <td className="px-3 py-2 max-w-64 truncate" title={r.riskResponseDescription}>{r.riskResponseDescription || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.residualRisk ? <ContractRiskLevelBadge level={r.residualRisk} /> : <span className="text-text-muted">—</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><ContractRiskStatusBadge status={r.status} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.responsibleUser?.displayName ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.actionDueDate ? (
                        <div className="flex items-center gap-1.5">
                          <span>{formatDate(r.actionDueDate)}</span>
                          {r.daysToDeadline !== undefined && (
                            <span
                              className={
                                r.daysToDeadline < 0
                                  ? 'text-error font-medium'
                                  : r.daysToDeadline <= 30
                                    ? 'text-warning font-medium'
                                    : 'text-success font-medium'
                              }
                            >
                              ({formatDaysToDeadline(r.daysToDeadline)}d)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.updatedAt)}</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${STICKY_RIGHT_CLS}`}>
                      {canUpdate ? (
                        <button
                          type="button"
                          onClick={() => setModal({ mode: 'edit', risk: r })}
                          aria-label={`Update risk ${r.riskNo || r.description}`}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-text-secondary hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus"
                        >
                          <PencilLine className="size-3.5 shrink-0" aria-hidden="true" />
                          Update
                        </button>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal?.mode === 'add' && (
        <ContractRiskFormModal contractId={contractId} mode="add" people={people} onClose={() => setModal(null)} />
      )}
      {modal?.mode === 'edit' && (
        <ContractRiskFormModal contractId={contractId} mode="edit" risk={modal.risk} people={people} onClose={() => setModal(null)} />
      )}
    </>
  );
}
