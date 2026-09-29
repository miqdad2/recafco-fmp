import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { IncidentStatusBadge } from '../_components/incident-status-badge';
import { IncidentSeverityBadge } from '../_components/incident-severity-badge';
import { IncidentDetailNav } from '../_components/incident-detail-nav';
import { ActivityTimeline } from '../_components/activity-timeline';
import { IncidentActionRow } from '../_components/incident-action-row';
import { IncidentTransitionsPanel } from '../_components/incident-transitions';
import { InvestigationPanel } from '../_components/investigation-panel';
import { AddCommentForm } from '../_components/add-comment-form';
import { AddActionItemForm } from '../_components/add-action-form';
import { IncidentEvidenceAttachments } from '../_components/incident-evidence-attachments';
import { computeIncidentNextStep, computeIncidentNextStepLabel } from '../_lib/incident-detail-helpers';
import { incidentsApi } from '../../../../lib/incidents-api';
import type { IncidentStatus, IncidentSeverity } from '../../../../lib/incidents-api';

interface PageProps {
  params: Promise<{ id: string }>;
  /** FMP-INC-01C — `evidenceIssue` carries a one-time, non-fatal warning when 1+ staged evidence files failed to upload during creation; the incident itself was still created successfully. */
  searchParams: Promise<{ evidenceIssue?: string }>;
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

/**
 * FMP-UI-22 — added `IncidentDetailNav` (Back to Incident Dashboard / Back
 * to All Incidents / Back to Platform Dashboard) + a 3-level breadcrumb
 * ("Platform Dashboard > Incident Report > {reference}", was 1 level).
 *
 * FMP-INC-01B — moved the Evidence Attachments section from after the
 * conditionally-rendered Immediate Action block to directly after
 * Description.
 *
 * FMP-INC-01E — full visual polish pass, per direct feedback that the
 * page "feels too plain" and "Evidence Attachments upload controls are
 * not visible" (that second complaint was about VISUAL prominence — the
 * real upload controls, Take Photo/Record Video/Upload Files, already
 * existed and worked as of FMP-INC-01/FMP-INC-01C; this unit makes them
 * unmistakably visible, it doesn't add new upload capability). Replaced
 * the plain title row with an Inspection-Summary-style header card
 * (reference, title, status/severity badges, a Status/Severity/Occurred/
 * Reported By/Next Step grid, plus a separate full-sentence Next Step
 * callout — `computeIncidentNextStep()`/`computeIncidentNextStepLabel()`,
 * mirroring the exact pattern already established for Factory Tasks
 * (FMP-UI-20G) and Safety & Compliance (FMP-UI-21D)). Description,
 * Evidence Attachments, Immediate Action, Investigation, Resolution,
 * Corrective Actions, Comments, and Activity are all now uniform
 * `rounded-xl border shadow-sm` cards (previously bare `<section>`s with
 * no border). Comments and Activity are now 2 SEPARATE cards (previously
 * one merged, interleaved "Comments & activity" section — see
 * `ActivityTimeline`'s own doc comment). Available Actions and Incident
 * Details renamed/polished in the sidebar; Incident Details now always
 * shows Department/Plant/Location with "Not specified" instead of hiding
 * the row when empty.
 */
export default async function IncidentDetailPage({ params, searchParams }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const { evidenceIssue } = await searchParams;

  const [jwt, incidentRes, commentsRes, activitiesRes, actionsRes, peopleRes, attachmentsRes] = await Promise.allSettled([
    getJwtPayload(),
    incidentsApi.get(id),
    incidentsApi.listComments(id),
    incidentsApi.listActivities(id),
    incidentsApi.listActions(id),
    incidentsApi.people(),
    incidentsApi.listAttachments(id),
  ]);

  if (incidentRes.status === 'rejected') notFound();

  const incident = (incidentRes as PromiseFulfilledResult<Awaited<ReturnType<typeof incidentsApi.get>>>).value;
  const comments = commentsRes.status === 'fulfilled' ? commentsRes.value : [];
  const activities = activitiesRes.status === 'fulfilled' ? activitiesRes.value : [];
  const actions = actionsRes.status === 'fulfilled' ? actionsRes.value : [];
  const people = peopleRes.status === 'fulfilled' ? peopleRes.value : [];
  const attachments = attachmentsRes.status === 'fulfilled' ? attachmentsRes.value : [];

  const payload = jwt.status === 'fulfilled' ? jwt.value : {};
  const currentUserId = payload.sub ?? '';
  const permissions = payload.permissions ?? [];

  const has = (perm: string): boolean => permissions.includes(perm);
  const canUploadEvidence = has('incidents.create');
  const canManageEvidence = has('incidents.manage');
  const status = incident.status as IncidentStatus;
  const showInvestigation = INVESTIGATION_STATUSES.includes(status);
  const canEditInvestigation = EDITABLE_INVESTIGATION_STATUSES.includes(status) && has('incidents.investigate');
  const showActions = ACTION_STATUSES.includes(status);
  const canAddAction = EDITABLE_INVESTIGATION_STATUSES.includes(status) && has('incidents.investigate');
  const canAdvanceAction = has('incidents.investigate');

  const cardClass = 'rounded-xl border border-border bg-surface p-5 shadow-sm';

  return (
    <div className="min-h-full p-8">
      <div className="max-w-6xl mx-auto">
        <div className="space-y-3">
          <Breadcrumbs items={[
            { label: 'Platform Dashboard', href: '/dashboard' },
            { label: 'Incident Management', href: '/incidents/executive' },
            { label: incident.referenceNumber },
          ]} className="mb-0" />
          <IncidentDetailNav />
        </div>

        {/* Incident Summary */}
        <div className="mt-8 rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Incident Management</p>
          <p className="mt-1 font-mono text-sm text-text-muted">{incident.referenceNumber}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-text-primary break-words">{incident.title}</h1>
            <IncidentStatusBadge status={status} />
            <IncidentSeverityBadge severity={incident.severity as IncidentSeverity} />
          </div>
          {incident.reportedForUser && (
            <p className="mt-1 text-sm text-text-secondary">
              Reported on behalf of{' '}
              <span className="font-medium text-text-primary">{incident.reportedForUser.displayName}</span>
            </p>
          )}

          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-text-muted">Status</dt>
              <dd className="font-medium text-text-primary">{incident.status}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Severity</dt>
              <dd className="font-medium text-text-primary">{incident.severity}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Occurred</dt>
              <dd className="font-medium text-text-primary">{formatDateTime(incident.occurredAt)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Reported By</dt>
              <dd className="font-medium text-text-primary">{incident.reportedByUser.displayName}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Next Step</dt>
              <dd className="font-medium text-text-primary">{computeIncidentNextStepLabel(status)}</dd>
            </div>
          </dl>

          <div className="mt-4 rounded-lg border border-accent/30 bg-accent-light px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Next Step</p>
            <p className="mt-1 text-sm text-text-primary">{computeIncidentNextStep(status)}</p>
          </div>
        </div>

        {/* FMP-INC-01C — the incident was created successfully; this only
            ever appears when 1+ evidence files staged during creation
            failed to upload (e.g. a transient network error) — the
            incident itself is never lost or rolled back for this. */}
        {evidenceIssue && (
          <div role="alert" className="mt-6 rounded-lg border border-warning bg-warning-light px-4 py-3 text-sm text-warning">
            Incident created successfully, but some evidence could not be uploaded: {evidenceIssue}. You can try attaching it again below.
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ── Main content ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <section className={cardClass}>
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Description</h2>
              <p className="text-sm text-text-primary whitespace-pre-wrap break-words">
                {incident.description || <span className="text-text-muted">No description provided.</span>}
              </p>
            </section>

            {/* Evidence attachments — FMP-INC-01B: kept directly after
                Description so it's ALWAYS the 2nd section on the page,
                never pushed down by whether immediateAction happens to be
                set. FMP-INC-01E: real card styling + heading make the 3
                real upload controls (already built in FMP-INC-01/01C)
                unmistakably visible, not buried in a bare section. */}
            <section className={cardClass}>
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
                Evidence Attachments{attachments.length > 0 && (
                  <span className="ml-1.5 text-xs font-normal normal-case text-text-muted">({attachments.length})</span>
                )}
              </h2>
              <IncidentEvidenceAttachments
                incidentId={id}
                attachments={attachments}
                currentUserId={currentUserId}
                canUpload={canUploadEvidence}
                canManage={canManageEvidence}
              />
            </section>

            {/* Immediate action */}
            {incident.immediateAction && (
              <section className={cardClass}>
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Immediate Action Taken</h2>
                <p className="text-sm text-text-primary whitespace-pre-wrap break-words">{incident.immediateAction}</p>
              </section>
            )}

            {/* Investigation */}
            {showInvestigation && (
              <section className={cardClass}>
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Investigation</h2>

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
              <section className="rounded-xl border border-success bg-success-light p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-success uppercase tracking-wide mb-2">Resolution</h2>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{incident.resolutionSummary}</p>
                {incident.resolvedByUserId && incident.resolvedAt && (
                  <p className="mt-2 text-xs text-text-muted">
                    Resolved by {incident.assignedToUser?.displayName ?? incident.reportedByUser.displayName} on {formatDateTime(incident.resolvedAt)}
                  </p>
                )}
              </section>
            )}

            {/* Corrective actions */}
            {showActions && (
              <section id="actions" className={cardClass}>
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
                  Corrective Actions{' '}
                  {actions.length > 0 && (
                    <span className="text-xs font-normal normal-case text-text-muted">({actions.length})</span>
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

            {/* Comments — FMP-INC-01E: split out of the old merged
                "Comments & activity" section into its own card, per direct
                feedback that the 2 felt mixed together. */}
            <section className={cardClass}>
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
                Comments{comments.length > 0 && (
                  <span className="ml-1.5 text-xs font-normal normal-case text-text-muted">({comments.length})</span>
                )}
              </h2>
              {comments.length === 0 ? (
                <p className="text-sm text-text-muted mb-4">No comments yet.</p>
              ) : (
                <div className="space-y-4 mb-4">
                  {comments.map((c) => (
                    <div key={c.id} className="border-l-2 border-border pl-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-text-primary">{c.authorUser.displayName}</span>
                        <span className="text-xs text-text-muted">{formatDateTime(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{c.body}</p>
                    </div>
                  ))}
                </div>
              )}
              <AddCommentForm incidentId={id} />
            </section>

            {/* Activity — FMP-INC-01E: its own card, activity only (no
                comments merged in), human-readable "{label} by {actor}"
                lines via ActivityTimeline's own doc comment. */}
            <section id="activity" className={cardClass}>
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">Activity</h2>
              <ActivityTimeline activities={activities} />
            </section>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-4">
            {/* Available Actions */}
            <div className={cardClass}>
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Available Actions</h2>
              <IncidentTransitionsPanel
                incident={incident}
                currentUserId={currentUserId}
                permissions={permissions}
                people={people}
              />
            </div>

            {/* Incident Details */}
            <div className={cardClass}>
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Incident Details</h2>

              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-text-muted">Status</dt>
                  <dd className="font-medium text-text-primary">{incident.status}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Severity</dt>
                  <dd className="font-medium text-text-primary">{incident.severity}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Occurred</dt>
                  <dd className="font-medium text-text-primary">{formatDateTime(incident.occurredAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Reported</dt>
                  <dd className="text-text-secondary">{formatDate(incident.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Reported By</dt>
                  <dd className="text-text-secondary">{incident.reportedByUser.displayName}</dd>
                </div>
                {incident.reportedForUser && (
                  <div>
                    <dt className="text-xs text-text-muted">Reported For</dt>
                    <dd className="text-text-secondary">{incident.reportedForUser.displayName}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-text-muted">Assigned To</dt>
                  <dd className="text-text-secondary">
                    {incident.assignedToUser ? incident.assignedToUser.displayName : <span className="text-text-muted">Not assigned</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Department</dt>
                  <dd className="text-text-secondary">
                    {incident.affectedDept ? incident.affectedDept.name : <span className="text-text-muted">Not specified</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Plant</dt>
                  <dd className="text-text-secondary">
                    {incident.affectedPlant ? incident.affectedPlant.name : <span className="text-text-muted">Not specified</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Location / Area</dt>
                  <dd className="text-text-secondary">
                    {incident.affectedLocation ? incident.affectedLocation.name : <span className="text-text-muted">Not specified</span>}
                  </dd>
                </div>
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
