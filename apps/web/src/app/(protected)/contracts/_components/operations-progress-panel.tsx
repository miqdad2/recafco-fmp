import Link from 'next/link';
import { AlertTriangle, Info, OctagonAlert } from 'lucide-react';
import type { HistoryEntry, ProgressView, ProgressWarning } from '@/lib/operations-api';
import {
  NOT_SUPPLIED,
  PENDING_INPUTS_LABEL,
  REQUIREMENT_LABEL,
  STAGES,
  cadenceText,
  describeChange,
  formatAge,
  formatCount,
  formatKuwaitDateTime,
  sortWarnings,
  stageShare,
} from '../_lib/operations-progress-helpers';
import { LinkByIdForm, OperationsRefreshButton, RemoveLinkForm } from './operations-client-parts';
import { OperationsLiveRefresh } from './operations-live-refresh';

const WARNING_STYLE: Record<ProgressWarning['severity'], string> = {
  critical: 'border-error bg-error-light text-error',
  warning: 'border-warning bg-warning-light text-warning',
  info: 'border-info bg-info-light text-info',
};

function WarningIcon({ severity }: { severity: ProgressWarning['severity'] }): React.JSX.Element {
  const cls = 'mt-0.5 size-4 shrink-0';
  if (severity === 'critical') return <OctagonAlert className={cls} aria-hidden="true" />;
  if (severity === 'warning') return <AlertTriangle className={cls} aria-hidden="true" />;
  return <Info className={cls} aria-hidden="true" />;
}

export function OperationsWarnings({ warnings }: { warnings: ProgressWarning[] }): React.JSX.Element | null {
  if (warnings.length === 0) return null;
  return (
    <ul className="space-y-2" aria-label="Connection and data-quality warnings">
      {sortWarnings(warnings).map((w) => (
        <li key={w.code + w.message} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${WARNING_STYLE[w.severity]}`}>
          <WarningIcon severity={w.severity} />
          <span>{w.message}</span>
        </li>
      ))}
    </ul>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string | undefined }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-text-secondary">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-text-primary">{value}</dd>
      {hint && <dd className="text-xs text-text-muted">{hint}</dd>}
    </div>
  );
}

interface Props {
  contractId: string;
  view: ProgressView;
  history: HistoryEntry[];
  canLink: boolean;
}

/**
 * FMP-OPS-01 — Operations progress for one contract. Shows ACCEPTED LOCAL data only. Produced, delivered and
 * erected counts are cumulative and overlap, so they are shown side by side and never summed; nothing here is
 * turned into a completion percentage, BOQ progress, schedule delay or commercial status.
 */
export function OperationsProgressPanel({ contractId, view, history, canLink }: Props): React.JSX.Element {
  const { data, source, connection } = view;
  const now = new Date();

  return (
    <div className="space-y-4">
      {view.linked && <OperationsLiveRefresh contractIds={[contractId]} everySeconds={view.monitoringState === 'DEMONSTRATION' ? 4 : 15} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-text-primary">Operations progress</h2>
          <p className="text-sm text-text-secondary">
            Read-only figures from the Operations system, where Technical, Production, Delivery and Erection work is done.{' '}
            {view.linked ? cadenceText(connection.pollIntervalSeconds) : ''}
          </p>
        </div>
        {view.linked && source?.syncEnabled && (
          <div className="shrink-0">
            <OperationsRefreshButton contractId={contractId} />
          </div>
        )}
      </div>

      {!view.linked && (
        <section className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-sm" aria-label="Link to an Operations project">
          <p className="text-sm text-text-primary">This contract is not linked to an Operations project, so no progress is shown.</p>
          <p className="text-xs text-text-muted">
            New Operations projects are not discovered automatically yet: the source has not provided a project list or a project-created notice.
            Once a project is registered, FMP suggests or makes the link by job order and factory.
          </p>
          {canLink ? (
            <LinkByIdForm contractId={contractId} />
          ) : (
            <p className="text-sm text-text-secondary">Ask a user with permission to link Operations projects to connect this contract.</p>
          )}
          <Link href="/contracts/operations-links" className="inline-block text-sm font-medium text-info hover:underline">
            View linked projects and suggested matches
          </Link>
        </section>
      )}

      {view.linked && source && (
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm" aria-label="Source project">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
            <Fact label="Operations project" value={source.name ?? NOT_SUPPLIED} />
            <Fact label="Project id" value={source.sourceProjectId} />
            <Fact label="Job order / factory" value={`${source.jobOrder ?? '—'} / ${source.factory ?? '—'}`} hint={source.identityCheck.status === 'MATCHES' ? 'Matches this contract' : 'Automatic matching not configured'} />
            <Fact
              label="Linked"
              value={source.linkMethod === 'AUTOMATIC' ? 'Automatically (job order + factory)' : 'Confirmed by a user'}
              hint={source.linkedAt ? `${formatKuwaitDateTime(source.linkedAt)}${source.linkedByName ? ` · ${source.linkedByName}` : ''}` : undefined}
            />
          </dl>
        </section>
      )}

      {view.linked && (
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm" aria-label="Freshness of the figures">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary">How current are these figures?</h3>
            {data?.origin === 'FIXTURE' ? (
              <span className="rounded-full bg-error-light px-2 py-0.5 text-xs font-semibold text-error">Demonstration data — live source not connected</span>
            ) : view.stale.stale ? (
              <span className="rounded-full bg-warning-light px-2 py-0.5 text-xs font-semibold text-warning">Not up to date</span>
            ) : (
              <span className="rounded-full bg-success-light px-2 py-0.5 text-xs font-semibold text-success">Up to date</span>
            )}
          </div>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <Fact
              label="Last successful update"
              value={formatKuwaitDateTime(data?.lastSuccessfulRetrievalAt)}
              hint={data?.lastSuccessfulRetrievalAt ? formatAge(data.lastSuccessfulRetrievalAt, now) : 'No successful update yet'}
            />
            <Fact label="Source response generated" value={formatKuwaitDateTime(data?.sourceGeneratedAt)} hint="When the source produced the response, not when work happened" />
            <Fact label="Figures last changed" value={formatKuwaitDateTime(data?.figuresChangedAt)} />
            <Fact label="Source activity time" value={NOT_SUPPLIED} />
          </dl>
          {view.data && view.stale.stale && view.stale.reason && (
            <p className="mt-3 text-xs text-text-muted">Latest check: {view.stale.reason}</p>
          )}
        </section>
      )}

      {view.linked && <OperationsWarnings warnings={view.warnings} />}

      {view.linked && !data && (
        <p className="rounded-md border border-border bg-surface px-4 py-6 text-center text-sm text-text-secondary">
          No figures are available yet.
        </p>
      )}

      {data && (
        <>
          <section aria-label="Progress by stage" className="space-y-3">
            <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-medium text-text-secondary">{REQUIREMENT_LABEL}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-text-primary">
                {formatCount(data.totals.total)} <span className="text-base font-medium text-text-secondary">pieces</span>
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {STAGES.map((stage) => {
                const count = data.totals[stage.field];
                const share = stageShare(count, data.totals.total);
                return (
                  <div key={stage.key} className="rounded-lg border border-border bg-surface p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-text-primary">{stage.title}</h3>
                    <p className="mt-2 text-xs font-medium text-text-secondary">{stage.figureLabel}</p>
                    <p className="mt-0.5 text-3xl font-semibold tabular-nums text-text-primary">{formatCount(count)}</p>
                    <p className="text-xs text-text-muted">of {formatCount(data.totals.total)} current requirement pieces</p>
                    {share !== null && (
                      <div className="mt-2 h-1.5 w-full rounded-full bg-surface-secondary" role="img" aria-label={`${stage.figureLabel}: ${formatCount(count)} of ${formatCount(data.totals.total)} pieces`}>
                        <div className="h-1.5 rounded-full bg-accent" style={{ width: `${share}%` }} />
                      </div>
                    )}
                    <p className="mt-3 text-[11px] leading-snug text-text-muted">
                      {stage.notSupplied}: {NOT_SUPPLIED.toLowerCase()}.
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-text-muted">
              Produced, delivered and erected counts are cumulative and overlap (a delivered piece is also counted as produced). They are not added together and are not a completion percentage.
            </p>
          </section>

          <section aria-label="Outstanding input details" className="rounded-lg border border-warning bg-warning-light p-4">
            <p className="text-xs font-medium text-warning">{PENDING_INPUTS_LABEL}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">
              {formatCount(data.totals.pendingInputs)} <span className="text-sm font-medium text-text-secondary">pieces</span>
            </p>
            <p className="text-xs text-text-secondary">Pieces whose earlier-stage input details are still outstanding in the source.</p>
          </section>

          {data.sourceNotes.length > 0 && (
            <section aria-label="Notes from the source" className="rounded-lg border border-border bg-surface p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-text-primary">Notes from the source</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
                {data.sourceNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-xs text-text-muted">
            Scope: whole project (grouped by {data.filterScope.groupBy}); project-level totals are used once. Source project id {source?.sourceProjectId}.
          </p>
        </>
      )}

      {history.length > 0 && (
        <details className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-text-primary">Recent changes ({history.length})</summary>
          <ol className="mt-3 space-y-3">
            {history.map((h) => (
              <li key={h.id} className="border-l-2 border-border pl-3 text-sm">
                <p className="font-medium text-text-primary">
                  {formatKuwaitDateTime(h.sourceGeneratedAt)}
                  {h.origin === 'FIXTURE' && <span className="ml-2 rounded bg-error-light px-1.5 py-0.5 text-xs text-error">Demonstration</span>}
                </p>
                {h.changes.length === 0 ? (
                  <p className="text-text-secondary">First figures stored or a source label changed.</p>
                ) : (
                  <ul className="text-text-secondary">
                    {h.changes.map((c) => (
                      <li key={c.field}>{describeChange(c)}</li>
                    ))}
                  </ul>
                )}
                {h.flags.map((f) => (
                  <p key={f.code + f.message} className="text-xs text-text-muted">{f.message}</p>
                ))}
              </li>
            ))}
          </ol>
        </details>
      )}

      {view.linked && source && canLink && (
        <section className="space-y-2" aria-label="Manage link">
          <RemoveLinkForm projectId={source.projectId} contractId={contractId} />
        </section>
      )}
    </div>
  );
}
