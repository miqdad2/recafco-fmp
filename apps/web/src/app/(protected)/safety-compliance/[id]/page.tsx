import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { InspectionStatusBadge } from '../_components/inspection-status-badge';
import { FindingStatusBadge } from '../_components/finding-status-badge';
import { FindingSeverityBadge } from '../_components/finding-severity-badge';
import { SafetyDetailNav } from '../_components/safety-detail-nav';
import { SafetyInspectionTransitions } from '../_components/safety-inspection-transitions';
import { SafetyFindingForm } from '../_components/safety-finding-form';
import { SafetyCommentForm } from '../_components/safety-comment-form';
import { SafetyActivityTimeline } from '../_components/safety-activity-timeline';
import { computeInspectionNextStep, computeInspectionNextStepLabel, toTitleCase } from '../_lib/safety-detail-helpers';
import { cookies } from 'next/headers';
import { safetyApi } from '../../../../lib/safety-api';
import type { InspectionStatus } from '../../../../lib/safety-api';

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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const insp = await safetyApi.get(id);
    return { title: `${insp.referenceNumber} — RECAFCO FMP` };
  } catch {
    return { title: 'Safety Inspection — RECAFCO FMP' };
  }
}

/**
 * FMP-UI-21D — polished per direct feedback that this page "feels
 * unfinished": added `SafetyDetailNav` (Back to Safety Dashboard / Back to
 * Safety Records / Back to Platform Dashboard) + a 3-level breadcrumb;
 * replaced the plain title row with an Inspection Summary card (reference
 * number, title, status badge, a Status/Department/Inspector/Scheduled/
 * Created By grid, and a "Next Step:" row); added a full-sentence Next
 * Step callout box (`computeInspectionNextStep()`); replaced the old
 * "Actions" section's broken raw-HTML-form transitions and unfinished
 * "…use the API…" text with `SafetyInspectionTransitions` — a real panel
 * wired to `actions.ts`'s already-existing Schedule/Start/Complete/Close/
 * Reopen/Cancel server actions (previously dead code no page ever called,
 * and — for Start/Close — literally broken: the old raw
 * `<form action="/safety-compliance/{id}/start">` posted to the WEB APP's
 * own origin, not the API); moved "Edit" into that same panel (was a
 * floating header button); the Summary card now always renders ("No
 * summary provided." when empty, was hidden entirely); Findings/Comments
 * got real "+ Record Finding"/"Add Comment" forms (same dead-code-to-real
 * fix as the transitions, plus a real bug fix in `createFindingAction`
 * itself — see that action's own doc comment); Activity now renders
 * through `SafetyActivityTimeline` (human-readable, no raw event keys);
 * the Details panel always shows Department/Plant now ("Not specified"
 * instead of the row disappearing when empty).
 */
export default async function SafetyDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const jwt = await getJwtPayload();
  const currentUserId = jwt.sub;
  const permissions = Array.isArray(jwt.permissions) ? jwt.permissions : [];
  const canSchedule = permissions.includes('safety.schedule');

  const [inspRes, findingsRes, commentsRes, activitiesRes, peopleRes] = await Promise.allSettled([
    safetyApi.get(id),
    safetyApi.listFindings(id),
    safetyApi.listComments(id),
    safetyApi.listActivities(id),
    canSchedule ? safetyApi.people() : Promise.resolve([]),
  ]);

  if (inspRes.status === 'rejected') notFound();

  const insp = (inspRes as PromiseFulfilledResult<Awaited<ReturnType<typeof safetyApi.get>>>).value;
  const findings = findingsRes.status === 'fulfilled' ? findingsRes.value : [];
  const comments = commentsRes.status === 'fulfilled' ? commentsRes.value : [];
  const activities = activitiesRes.status === 'fulfilled' ? activitiesRes.value : [];
  const people = peopleRes.status === 'fulfilled' ? peopleRes.value : [];

  const status = insp.status as InspectionStatus;
  const isCreator = insp.createdByUserId === currentUserId;
  const isInspector = insp.inspectorUserId === currentUserId;
  const canManage = permissions.includes('safety.manage');
  const canInspect = permissions.includes('safety.inspect');
  const canClose = permissions.includes('safety.close');
  const canComment = permissions.includes('safety.comment');
  const canFindingCreate = permissions.includes('safety.finding_create');

  const canEdit = status === 'DRAFT' && (isCreator || canManage);
  const canDoSchedule = status === 'DRAFT' && canSchedule;
  const canDoStart = status === 'SCHEDULED' && (isInspector || canManage) && canInspect;
  const canDoComplete = status === 'IN_PROGRESS' && (isInspector || canManage) && canInspect;
  const canDoClose = status === 'COMPLETED' && canClose;
  const canDoReopen = status === 'CLOSED' && canManage;
  const canDoCancel = ['DRAFT', 'SCHEDULED', 'IN_PROGRESS'].includes(status) &&
    (status === 'DRAFT' ? (isCreator || canManage) : canManage);
  const canDoCreateFinding = ['IN_PROGRESS', 'COMPLETED'].includes(status) && canFindingCreate;

  return (
    <div className="min-h-full p-8">
      <div className="max-w-5xl mx-auto">
        <div className="space-y-3">
          <Breadcrumbs items={[
            { label: 'Platform Dashboard', href: '/dashboard' },
            { label: 'Safety & Compliance', href: '/safety-compliance/executive' },
            { label: insp.referenceNumber },
          ]} className="mb-0" />
          <SafetyDetailNav />
        </div>

        {/* Inspection Summary */}
        <div className="mt-8 rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Safety Inspection</p>
          <p className="mt-1 font-mono text-sm text-text-muted">{insp.referenceNumber}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-text-primary">{insp.title}</h1>
            <InspectionStatusBadge status={status} />
          </div>

          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-text-muted">Status</dt>
              <dd className="font-medium text-text-primary">{toTitleCase(status)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Department</dt>
              <dd className="font-medium text-text-primary">{insp.department?.name ?? 'Not specified'}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Inspector</dt>
              <dd className="font-medium text-text-primary">{insp.inspector?.displayName ?? 'Not assigned'}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Scheduled</dt>
              <dd className="font-medium text-text-primary">{insp.scheduledAt ? formatDateTime(insp.scheduledAt) : 'Not scheduled'}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Created By</dt>
              <dd className="font-medium text-text-primary">{insp.createdByUser.displayName}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Next Step</dt>
              <dd className="font-medium text-text-primary">{computeInspectionNextStepLabel(status)}</dd>
            </div>
          </dl>

          <div className="mt-4 rounded-lg border border-accent/30 bg-accent-light px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Next Step</p>
            <p className="mt-1 text-sm text-text-primary">{computeInspectionNextStep(status)}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary */}
            <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Summary</h2>
              <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                {insp.summary || <span className="text-text-muted">No summary provided.</span>}
              </p>
            </section>

            {/* Checklist summary */}
            {insp.checklistSummary && (
              <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Checklist Summary</h2>
                <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{insp.checklistSummary}</p>
              </section>
            )}

            {/* Conclusion */}
            {insp.conclusion && (
              <section className="rounded-xl border border-success bg-success-light p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-success uppercase tracking-wide mb-2">Conclusion</h2>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{insp.conclusion}</p>
                {insp.completedAt && (
                  <p className="mt-2 text-xs text-text-muted">
                    Completed {formatDateTime(insp.completedAt)}
                    {insp.completedByUser && ` by ${insp.completedByUser.displayName}`}
                  </p>
                )}
              </section>
            )}

            {/* Cancellation */}
            {insp.cancellationReason && (
              <section className="rounded-xl border border-border bg-surface-secondary p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">Cancellation Reason</h2>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{insp.cancellationReason}</p>
              </section>
            )}

            {/* Findings */}
            <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                  Findings ({findings.length})
                </h2>
                {canDoCreateFinding && <SafetyFindingForm inspectionId={insp.id} />}
              </div>
              {findings.length === 0 ? (
                <p className="text-sm text-text-muted">No findings recorded for this inspection.</p>
              ) : (
                <div className="overflow-hidden rounded-md border border-border">
                  <table className="min-w-full divide-y divide-border">
                    <thead>
                      <tr className="bg-surface-secondary">
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Title</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Severity</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden sm:table-cell">Assigned To</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden md:table-cell">Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {findings.map((f) => (
                        <tr key={f.id}>
                          <td className="px-3 py-2 text-sm text-text-primary">{f.title}</td>
                          <td className="px-3 py-2"><FindingSeverityBadge severity={f.severity} /></td>
                          <td className="px-3 py-2"><FindingStatusBadge status={f.status} /></td>
                          <td className="px-3 py-2 text-sm text-text-secondary hidden sm:table-cell">
                            {f.assignedToUser ? f.assignedToUser.displayName : <span className="text-text-muted">Not assigned</span>}
                          </td>
                          <td className="px-3 py-2 text-sm text-text-secondary hidden md:table-cell">
                            {f.dueAt ? formatDate(f.dueAt) : <span className="text-text-muted">Not scheduled</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Comments */}
            <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
                Comments ({comments.length})
              </h2>
              {comments.length === 0 && <p className="text-sm text-text-muted">No comments yet.</p>}
              {comments.length > 0 && (
                <div className="space-y-4">
                  {comments.map((c) => (
                    <div key={c.id} className="border-l-2 border-border pl-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-text-primary">
                          {c.authorUser?.displayName ?? 'Unknown'}
                        </span>
                        <span className="text-xs text-text-muted">{formatDateTime(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-text-secondary whitespace-pre-wrap">{c.body}</p>
                    </div>
                  ))}
                </div>
              )}
              {canComment && <SafetyCommentForm inspectionId={insp.id} />}
            </section>

            {/* Activity */}
            <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">Activity</h2>
              <SafetyActivityTimeline activities={activities} />
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Available Actions</h2>
              <SafetyInspectionTransitions
                inspectionId={insp.id}
                canEdit={canEdit}
                canDoSchedule={canDoSchedule}
                canDoStart={canDoStart}
                canDoComplete={canDoComplete}
                canDoClose={canDoClose}
                canDoReopen={canDoReopen}
                canDoCancel={canDoCancel}
                people={people}
              />
            </section>

            <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Details</h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-text-muted">Inspector</dt>
                  <dd className="font-medium text-text-primary">
                    {insp.inspector ? insp.inspector.displayName : <span className="text-text-muted">Not assigned</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">Scheduled</dt>
                  <dd className="font-medium text-text-primary">
                    {insp.scheduledAt ? formatDateTime(insp.scheduledAt) : <span className="text-text-muted">Not scheduled</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">Department</dt>
                  <dd className="font-medium text-text-primary">
                    {insp.department ? insp.department.name : <span className="text-text-muted">Not specified</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">Plant</dt>
                  <dd className="font-medium text-text-primary">
                    {insp.plant ? insp.plant.name : <span className="text-text-muted">Not specified</span>}
                  </dd>
                </div>
                {insp.location && (
                  <div>
                    <dt className="text-text-muted">Location</dt>
                    <dd className="font-medium text-text-primary">{insp.location.name}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-text-muted">Created By</dt>
                  <dd className="font-medium text-text-primary">{insp.createdByUser.displayName}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Created Date</dt>
                  <dd className="text-text-secondary">{formatDateTime(insp.createdAt)}</dd>
                </div>
                {insp.closedAt && (
                  <div>
                    <dt className="text-text-muted">Closed</dt>
                    <dd className="text-text-secondary">
                      {formatDateTime(insp.closedAt)}
                      {insp.closedByUser && ` by ${insp.closedByUser.displayName}`}
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            {/* Finding stats */}
            {findings.length > 0 && (
              <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Findings Summary</h2>
                <dl className="space-y-1 text-sm">
                  {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => {
                    const count = findings.filter((f) => f.severity === sev).length;
                    if (!count) return null;
                    return (
                      <div key={sev} className="flex justify-between">
                        <dt className="text-text-muted">{sev}</dt>
                        <dd className="font-medium text-text-primary">{count}</dd>
                      </div>
                    );
                  })}
                  <div className="flex justify-between border-t border-border pt-1 mt-1">
                    <dt className="text-text-secondary font-medium">Total</dt>
                    <dd className="font-semibold text-text-primary">{findings.length}</dd>
                  </div>
                </dl>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
