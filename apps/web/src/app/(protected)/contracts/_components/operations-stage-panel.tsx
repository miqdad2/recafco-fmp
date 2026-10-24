import Link from 'next/link';
import type { ProgressView } from '@/lib/operations-api';
import {
  DEMO_BANNER,
  HISTORICAL_DEFS,
  HISTORY_EXPLANATION,
  NOT_SUPPLIED,
  STAGE_HISTORY_KEYS,
  STAGE_MEASURES,
  PENDING_INPUTS_LABEL,
  REQUIREMENT_LABEL,
  STAGES,
  cadenceText,
  delayedMessage,
  formatAge,
  formatCount,
  formatKuwaitDateTime,
  formatMeasure,
  missingText,
  visibleBreakdownColumns,
  type StageDef,
} from '../_lib/operations-progress-helpers';
import { OperationsLiveRefresh } from './operations-live-refresh';
import { OperationsStatusBadge } from './operations-status-badge';
import { OperationsWarnings } from './operations-progress-panel';

interface Props {
  contractId: string;
  stageKey: StageDef['key'];
  view: ProgressView;
  /** Holds the integration permission: may be pointed to the setup screen. */
  canLink: boolean;
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string | undefined }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-text-secondary">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-text-primary">{value}</dd>
      {hint && <dd className="text-xs text-text-muted">{hint}</dd>}
    </div>
  );
}

/** The optional figures of this stage that the source supplied, each with its missing-measurement note. */
function MeasureGrid({ stageKey, measures }: { stageKey: StageDef['key']; measures: Record<string, number> }): React.JSX.Element | null {
  const defs = STAGE_MEASURES[stageKey].filter((d) => d.key in measures);
  if (defs.length === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-sm" aria-label="Supplied by the source">
      <h3 className="text-sm font-semibold text-text-primary">Also supplied by the source</h3>
      <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
        {defs.map((d) => {
          const gap = missingText(d, measures);
          return (
            <div key={d.key + d.label} className="min-w-0">
              <dt className="text-xs font-medium text-text-secondary">{d.label}</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums text-text-primary" data-measure={d.key}>
                {formatMeasure(d, measures[d.key] as number)}
              </dd>
              {d.hint && <dd className="text-xs text-text-muted">{d.hint}</dd>}
              {gap && <dd className="text-xs font-medium text-warning">{gap}</dd>}
            </div>
          );
        })}
      </dl>
    </section>
  );
}

/** Per-building rows. Shown as supplied; there is deliberately no total row and nothing here is added to the project figures. */
function BreakdownTable({ stageKey, breakdown }: { stageKey: StageDef['key']; breakdown: NonNullable<ProgressView['data']>['breakdown'] }): React.JSX.Element | null {
  if (breakdown === null || breakdown.rows.length === 0) return null;
  const cols = visibleBreakdownColumns(stageKey, breakdown.rows);
  if (cols.length === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-sm" aria-label="Breakdown by building">
      <h3 className="text-sm font-semibold text-text-primary">By building / area</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-secondary">
              <th className="py-2 pr-3 font-medium">Building / area</th>
              {cols.map((c) => (
                <th key={c.key} className="px-3 py-2 text-right font-medium">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {breakdown.rows.map((r) => (
              <tr key={r.label} className="border-b border-border/60">
                <td className="py-2 pr-3 font-medium text-text-primary">{r.label}</td>
                {cols.map((c) => (
                  <td key={c.key} className="px-3 py-2 text-right tabular-nums text-text-primary">
                    {typeof r.values[c.key] === 'number' ? formatCount(r.values[c.key] as number) : <span className="text-text-muted">{NOT_SUPPLIED}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-text-muted">
        Rows are a breakdown of the project figures above, not an addition to them.{breakdown.truncated ? ' Only the first rows are shown.' : ''}
      </p>
    </section>
  );
}

/** Whole-project history, kept visibly apart from the current figures. */
function HistorySection({ stageKey, historical, measures }: { stageKey: StageDef['key']; historical: Record<string, number> | null; measures: Record<string, number> }): React.JSX.Element | null {
  const keys = STAGE_HISTORY_KEYS[stageKey].filter((k) => historical !== null && k in historical);
  if (historical === null || keys.length === 0) return null;
  return (
    <section className="rounded-lg border border-dashed border-border-strong bg-surface-secondary p-5" aria-label="Whole-project history">
      <h3 className="text-sm font-semibold text-text-primary">Whole-project history (separate from the current figures)</h3>
      <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        {keys.map((k) => {
          const def = HISTORICAL_DEFS[k];
          if (!def) return null;
          const current = k === 'cast_volume' ? measures['cast_volume'] : undefined;
          return (
            <div key={k}>
              <dt className="text-xs font-medium text-text-secondary">{def.label}</dt>
              <dd className="text-lg font-semibold tabular-nums text-text-primary" data-history={k}>{formatMeasure(def, historical[k] as number)}</dd>
              {current !== undefined && current !== historical[k] && (
                <dd className="text-xs text-text-muted">Current figure: {formatMeasure({ ...def, label: 'Current cast volume' }, current)} — different, not reconciled.</dd>
              )}
            </div>
          );
        })}
      </dl>
      <p className="mt-3 text-xs text-text-muted">{HISTORY_EXPLANATION}</p>
    </section>
  );
}

/** Warnings that already have a dedicated place on the stage screen. */
const HANDLED_ELSEWHERE = new Set(['DETAIL_NOT_SUPPLIED', 'FIXTURE_DATA', 'STALE_DATA', 'SYNC_NOT_ACTIVE', 'NO_DATA_YET']);

/**
 * FMP-OPS-02 — one department tab (Technical, Production & Planning, Delivery, Erection) of a contract, fed by the
 * SAME resolved view as the Contract List and the Overview. It shows only what the source supplies: the stage's
 * cumulative count, the current approved requirement, and the outstanding input details — never a completion
 * percentage, never "Done"/"Not started", never figures from the old local workflow.
 */
export function OperationsStagePanel({ contractId, stageKey, view, canLink }: Props): React.JSX.Element {
  const stage = STAGES.find((s) => s.key === stageKey) as StageDef;
  const { data, source, monitoringState } = view;
  const now = new Date();
  const demo = monitoringState === 'DEMONSTRATION';
  const warnings = view.warnings.filter((w) => !HANDLED_ELSEWHERE.has(w.code));

  return (
    <div className="space-y-5" data-operations-stage={stageKey}>
      <OperationsLiveRefresh contractIds={[contractId]} everySeconds={demo ? 4 : 15} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-text-primary">{stage.title}</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Information from the Operations system, where this work is done. Read-only.
            {view.linked && !demo && view.connection.liveSyncActive ? ` ${cadenceText(view.connection.pollIntervalSeconds)}` : ''}
          </p>
        </div>
        <OperationsStatusBadge state={monitoringState} className="shrink-0 self-start" />
      </div>

      {demo && (
        <p role="status" className="rounded-md border border-error bg-error-light px-4 py-3 text-sm font-semibold text-error">
          {DEMO_BANNER}
        </p>
      )}

      {monitoringState === 'NOT_LINKED' && (
        <section className="rounded-lg border border-border bg-surface p-6 shadow-sm" aria-label="Not connected to Operations">
          <p className="text-xl font-semibold text-text-primary">Not connected to Operations</p>
          <p className="mt-2 text-sm text-text-secondary">
            This contract is not linked to a project in the Operations system, so no {stage.title.toLowerCase()} figures are shown. Nothing here is zero — there is simply no connection yet.
          </p>
          {canLink && (
            <Link href="/contracts/operations-links" className="mt-3 inline-block text-sm font-medium text-info hover:underline">
              Link this contract to its Operations project
            </Link>
          )}
        </section>
      )}

      {monitoringState === 'WAITING_FIRST_UPDATE' && (
        <section className="rounded-lg border border-info bg-info-light p-6" aria-label="Waiting for first update">
          <p className="text-xl font-semibold text-text-primary">Linked, waiting for the first update</p>
          <p className="mt-2 text-sm text-text-secondary">
            The contract is linked to {source?.name ?? 'an Operations project'}. No figures have been received yet; they appear here automatically.
          </p>
        </section>
      )}

      {data && view.stale.stale && (
        <p role="status" className="rounded-md border border-warning bg-warning-light px-4 py-3 text-sm text-warning">
          {delayedMessage(data.lastSuccessfulRetrievalAt, view.stale.reason)}
        </p>
      )}

      {data && (
        <>
          <section className="rounded-lg border border-border bg-surface p-6 shadow-sm" aria-label={stage.figureLabel}>
            <p className="text-sm font-medium text-text-secondary">{stage.figureLabel}</p>
            <p className="mt-1 text-5xl font-semibold tabular-nums text-text-primary" data-figure={stage.field}>
              {formatCount(data.totals[stage.field])}
              <span className="ml-2 text-lg font-medium text-text-secondary">pieces</span>
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              {REQUIREMENT_LABEL}: <span className="font-semibold tabular-nums">{formatCount(data.totals.total)}</span> pieces
            </p>
            <p className="mt-3 text-sm text-text-muted">{stage.meaning}</p>
          </section>

          {stage.key === 'technical' && (
            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-lg border border-border bg-surface p-5 shadow-sm" aria-label={REQUIREMENT_LABEL}>
                <p className="text-sm font-medium text-text-secondary">{REQUIREMENT_LABEL}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-text-primary">
                  {formatCount(data.totals.total)} <span className="text-base font-medium text-text-secondary">pieces</span>
                </p>
              </section>
              <section className="rounded-lg border border-warning bg-warning-light p-5" aria-label={PENDING_INPUTS_LABEL}>
                <p className="text-sm font-medium text-warning">{PENDING_INPUTS_LABEL}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-text-primary">
                  {formatCount(data.totals.pendingInputs)} <span className="text-base font-medium text-text-secondary">pieces</span>
                </p>
                <p className="mt-1 text-xs text-text-secondary">The issued figure includes confirmed “Done – pending input” issues.</p>
              </section>
            </div>
          )}

          <MeasureGrid stageKey={stage.key} measures={data.measures} />
          <BreakdownTable stageKey={stage.key} breakdown={data.breakdown} />
          <HistorySection stageKey={stage.key} historical={data.historical} measures={data.measures} />

          <section className="rounded-lg border border-border bg-surface p-5 shadow-sm" aria-label="Not supplied by the source">
            <h3 className="text-sm font-semibold text-text-primary">Not supplied by the source</h3>
            <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {[...stage.notSupplied, ...STAGE_MEASURES[stage.key].filter((d) => !(d.key in data.measures)).map((d) => d.label)].map((item) => (
                <li key={item} className="flex justify-between gap-3 border-b border-border/60 py-1">
                  <span className="text-text-secondary">{item}</span>
                  <span className="text-text-muted">{NOT_SUPPLIED}</span>
                </li>
              ))}
            </ul>
          </section>

          <OperationsWarnings warnings={warnings} />

          {data.sourceNotes.length > 0 && (
            <section className="rounded-lg border border-border bg-surface p-5 shadow-sm" aria-label="Notes from the source">
              <h3 className="text-sm font-semibold text-text-primary">Notes from the source</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
                {data.sourceNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {view.linked && source && source.identityCheck.status !== 'MATCHES' && (
        <p role="note" className="rounded-md border border-info bg-info-light px-4 py-3 text-sm text-info" data-automatic-matching="not-configured">
          Linked by a person{source.linkedByName ? ` (${source.linkedByName})` : ''}. Automatic job-order and factory matching is not configured for this contract. {source.identityCheck.message}
        </p>
      )}

      {view.linked && source && (
        <section className="rounded-lg border border-border bg-surface p-5 shadow-sm" aria-label="Source and freshness">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Operations project" value={source.name ?? NOT_SUPPLIED} hint={`Project id ${source.sourceProjectId}`} />
            <Fact label="Job order / factory" value={`${source.jobOrder ?? '—'} / ${source.factory ?? '—'}`} />
            <Fact
              label="Last successful update"
              value={formatKuwaitDateTime(data?.lastSuccessfulRetrievalAt)}
              hint={data?.lastSuccessfulRetrievalAt ? formatAge(data.lastSuccessfulRetrievalAt, now) : 'No update yet'}
            />
            <Fact label="Source response generated" value={formatKuwaitDateTime(data?.sourceGeneratedAt)} hint="When the source produced it — not when work happened" />
          </dl>
        </section>
      )}

      {view.linked && (
        <p className="text-xs text-text-muted">
          <Link href={`/contracts/${contractId}/operations`} className="text-info hover:underline">
            Source details and change history
          </Link>
        </p>
      )}
    </div>
  );
}
