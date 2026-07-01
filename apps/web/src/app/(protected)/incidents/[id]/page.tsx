import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { IncidentStatusBadge } from '../_components/incident-status-badge';
import { IncidentSeverityBadge } from '../_components/incident-severity-badge';
import { ActivityTimeline } from '../_components/activity-timeline';
import { IncidentActionRow } from '../_components/incident-action-row';
import { IncidentTransitionsPanel } from '../_components/incident-transitions';
import { InvestigationPanel } from '../_components/investigation-panel';
import { AddCommentForm } from '../_components/add-comment-form';
import { AddActionItemForm } from '../_components/add-action-form';
import { incidentsApi } from '../../../../lib/incidents-api';
import type { IncidentStatus, IncidentSeverity } from '../../../../lib/incidents-api';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getJwtPayload(): Promise<{ sub?: string; permissions?: string[] }> {
  try {
    const store = await cookies();
    const token = store.get('recafco_access')?.value;
    if (!token) return {};
    const raw = token.split('.')[1];
    if (!raw) return {};
    return JSON.parse(Buffer.from(raw, 'base64url').toString()) as { sub?: string; permissions?: string[] };
  } catch {
    return {};
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const INVESTIGATION_STATUSES: IncidentStatus[] = ['INVESTIGATION', 'ACTION_REQUIRED', 'RESOLVED', 'CLOSED'];
const EDITABLE_INVESTIGATION_STATUSES: IncidentStatus[] = ['INVESTIGATION', 'ACTION_REQUIRED'];
const ACTION_STATUSES: IncidentStatus[] = ['INVESTIGATION', 'ACTION_REQUIRED', 'RESOLVED', 'CLOSED'];

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const incident = await incidentsApi.get(id);
    return { title: `${incident.referenceNumber} — RECAFCO FMP` };
  } catch {
    return { title: 'Incident — RECAFCO FMP' };
  }
}

export default async function IncidentDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [jwt, incidentRes, commentsRes, activitiesRes, actionsRes, peopleRes] = await Promise.allSettled([
    getJwtPayload(),
    incidentsApi.get(id),
    incidentsApi.listComments(id),
    incidentsApi.listActivities(id),
    incidentsApi.listActions(id),
    incidentsApi.people(),
  ]);

  if (incidentRes.status === 'rejected') notFound();

  const incident = (incidentRes as PromiseFulfilledResult<Awaited<ReturnType<typeof incidentsApi.get>>>).value;
  const comments = commentsRes.status === 'fulfilled' ? commentsRes.value : [];
  const activities = activitiesRes.status === 'fulfilled' ? activitiesRes.value : [];
  const actions = actionsRes.status === 'fulfilled' ? actionsRes.value : [];
  const people = peopleRes.status === 'fulfilled' ? peopleRes.value : [];

  const payload = jwt.status === 'fulfilled' ? jwt.value : {};
  const currentUserId = payload.sub ?? '';
  const permissions = payload.permissions ?? [];

  const has = (perm: string): boolean => permissions.includes(perm);
  const status = incident.status as IncidentStatus;
  const showInvestigation = INVESTIGATION_STATUSES.includes(status);
  const canEditInvestigation = EDITABLE_INVESTIGATION_STATUSES.includes(status) && has('incidents.investigate');
  const showActions = ACTION_STATUSES.includes(status);
  const canAddAction = EDITABLE_INVESTIGATION_STATUSES.includes(status) && has('incidents.investigate');
  const canAdvanceAction = has('incidents.investigate');

  return (
    <div className="min-h-full p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Incidents', href: '/incidents' },
          { label: incident.referenceNumber },
        ]} />

        {/* Title + badges */}
        <div className="mb-6 flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-text-muted">{incident.referenceNumber}</span>
              <IncidentSeverityBadge severity={incident.severity as IncidentSeverity} />
              <IncidentStatusBadge status={status} />
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-text-primary break-words">{incident.title}</h1>
            {incident.reportedForUser && (
              <p className="mt-1 text-sm text-text-secondary">
                Reported on behalf of{' '}
                <span className="font-medium text-text-primary">{incident.reportedForUser.displayName}</span>
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ── Main content ── */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <section>
              <h2 className="text-base font-semibold text-text-primary mb-3">Description</h2>
              <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{incident.description}</p>
            </section>

            {/* Immediate action */}
            {incident.immediateAction && (
              <section>
                <h2 className="text-base font-semibold text-text-primary mb-3">Immediate action taken</h2>
                <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{incident.immediateAction}</p>
              </section>
            )}

            {/* Investigation */}
            {showInvestigation && (
              <section>
                <h2 className="text-base font-semibold text-text-primary mb-3">Investigation</h2>

                {/* Display fields (non-editable view) */}
                {!canEditInvestigation && (
                  <div className="space-y-4">
                    {incident.rootCause ? (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-1">Root cause</p>
                        <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{incident.rootCause}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-text-muted">Root cause not yet recorded.</p>
                    )}
                    {incident.investigationSummary && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-1">Summary</p>
                        <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{incident.investigationSummary}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Editable form */}
                {canEditInvestigation && (
                  <InvestigationPanel
                    incidentId={id}
                    rootCause={incident.rootCause}
                    investigationSummary={incident.investigationSummary}
                  />
                )}
              </section>
            )}

            {/* Resolution */}
            {(status === 'RESOLVED' || status === 'CLOSED') && incident.resolutionSummary && (
              <section>
                <h2 className="text-base font-semibold text-text-primary mb-3">Resolution</h2>
                <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{incident.resolutionSummary}</p>
                {incident.resolvedByUserId && incident.resolvedAt && (
                  <p className="mt-2 text-xs text-text-muted">
                    Resolved by {incident.assignedToUser?.displayName ?? incident.reportedByUser.displayName} on {formatDateTime(incident.resolvedAt)}
                  </p>
                )}
              </section>
            )}

            {/* Corrective actions */}
            {showActions && (
              <section id="actions">
                <h2 className="text-base font-semibold text-text-primary mb-3">
                  Corrective actions{' '}
                  {actions.length > 0 && (
                    <span className="text-sm font-normal text-text-muted">({actions.length})</span>
                  )}
                </h2>

                {actions.length === 0 ? (
                  <p className="text-sm text-text-muted mb-3">No corrective actions yet.</p>
                ) : (
                  <div className="space-y-3 mb-4">
                    {actions.map((action) => (
                      <IncidentActionRow
                        key={action.id}
                        action={action}
                        incidentId={id}
                        canUpdate={canAdvanceAction}
                      />
                    ))}
                  </div>
                )}

                {canAddAction && (
                  <AddActionItemForm incidentId={id} people={people} />
                )}
              </section>
            )}

            {/* Comments & activity */}
            <section id="comments">
              <h2 className="text-base font-semibold text-text-primary mb-4">
                Comments &amp; activity
              </h2>
              <div className="mb-6">
                <AddCommentForm incidentId={id} />
              </div>
              <ActivityTimeline activities={activities} comments={comments} />
            </section>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-6">
            {/* Transitions */}
            <div className="rounded-lg border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-text-primary mb-3">Actions</h2>
              <IncidentTransitionsPanel
                incident={incident}
                currentUserId={currentUserId}
                permissions={permissions}
                people={people}
              />
            </div>

            {/* Metadata */}
            <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
              <h2 className="text-sm font-semibold text-text-primary">Details</h2>

              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-text-muted">Occurred</dt>
                  <dd className="text-text-secondary font-medium">{formatDateTime(incident.occurredAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Reported</dt>
                  <dd className="text-text-secondary">{formatDate(incident.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Reported by</dt>
                  <dd className="text-text-secondary">{incident.reportedByUser.displayName}</dd>
                </div>
                {incident.reportedForUser && (
                  <div>
                    <dt className="text-xs text-text-muted">Reported for</dt>
                    <dd className="text-text-secondary">{incident.reportedForUser.displayName}</dd>
                  </div>
                )}
                {incident.assignedToUser && (
                  <div>
                    <dt className="text-xs text-text-muted">Assigned to</dt>
                    <dd className="text-text-secondary">{incident.assignedToUser.displayName}</dd>
                  </div>
                )}
                {incident.affectedPlant && (
                  <div>
                    <dt className="text-xs text-text-muted">Plant</dt>
                    <dd className="text-text-secondary">{incident.affectedPlant.name}</dd>
                  </div>
                )}
                {incident.affectedLocation && (
                  <div>
                    <dt className="text-xs text-text-muted">Location</dt>
                    <dd className="text-text-secondary">{incident.affectedLocation.name}</dd>
                  </div>
                )}
                {incident.affectedDept && (
                  <div>
                    <dt className="text-xs text-text-muted">Department</dt>
                    <dd className="text-text-secondary">{incident.affectedDept.name}</dd>
                  </div>
                )}
                {incident.resolvedAt && (
                  <div>
                    <dt className="text-xs text-text-muted">Resolved</dt>
                    <dd className="text-text-secondary">{formatDate(incident.resolvedAt)}</dd>
                  </div>
                )}
                {incident.closedAt && (
                  <div>
                    <dt className="text-xs text-text-muted">Closed</dt>
                    <dd className="text-text-secondary">{formatDate(incident.closedAt)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
