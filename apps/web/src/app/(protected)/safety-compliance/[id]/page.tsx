import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { InspectionStatusBadge } from '../_components/inspection-status-badge';
import { FindingStatusBadge } from '../_components/finding-status-badge';
import { FindingSeverityBadge } from '../_components/finding-severity-badge';
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

export default async function SafetyDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [jwt, inspRes, findingsRes, commentsRes, activitiesRes] = await Promise.allSettled([
    getJwtPayload(),
    safetyApi.get(id),
    safetyApi.listFindings(id),
    safetyApi.listComments(id),
    safetyApi.listActivities(id),
  ]);

  if (inspRes.status === 'rejected') notFound();

  const insp = (inspRes as PromiseFulfilledResult<Awaited<ReturnType<typeof safetyApi.get>>>).value;
  const findings = findingsRes.status === 'fulfilled' ? findingsRes.value : [];
  const comments = commentsRes.status === 'fulfilled' ? commentsRes.value : [];
  const activities = activitiesRes.status === 'fulfilled' ? activitiesRes.value : [];

  const payload = jwt.status === 'fulfilled' ? jwt.value : {};
  const currentUserId = payload.sub;
  const permissions = Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [];

  const status = insp.status as InspectionStatus;
  const isCreator = insp.createdByUserId === currentUserId;
  const isInspector = insp.inspectorUserId === currentUserId;
  const canManage = permissions.includes('safety.manage');
  const canSchedule = permissions.includes('safety.schedule');
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

  const hasAnyTransition = canDoSchedule || canDoStart || canDoComplete || canDoClose || canDoReopen || canDoCancel;

  return (
    <div className="min-h-full p-8">
      <div className="max-w-5xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Safety & Compliance', href: '/safety-compliance' },
          { label: insp.referenceNumber },
        ]} />

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-semibold text-text-primary">{insp.title}</h1>
              <InspectionStatusBadge status={status} />
            </div>
            <p className="text-sm text-text-muted font-mono">{insp.referenceNumber}</p>
          </div>
          {canEdit && (
            <Link
              href={`/safety-compliance/${insp.id}/edit`}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Edit
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary */}
            {insp.summary && (
              <section className="rounded-lg border border-border bg-surface p-5">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Summary</h2>
                <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{insp.summary}</p>
              </section>
            )}

            {/* Checklist summary */}
            {insp.checklistSummary && (
              <section className="rounded-lg border border-border bg-surface p-5">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Checklist Summary</h2>
                <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{insp.checklistSummary}</p>
              </section>
            )}

            {/* Conclusion */}
            {insp.conclusion && (
              <section className="rounded-lg border border-success bg-success-light p-5">
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
              <section className="rounded-lg border border-border bg-surface-secondary p-5">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">Cancellation Reason</h2>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{insp.cancellationReason}</p>
              </section>
            )}

            {/* Transitions */}
            {hasAnyTransition && (
              <section className="rounded-lg border border-border bg-surface p-5">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">Actions</h2>
                <div className="flex flex-wrap gap-2">
                  {canDoStart && (
                    <form action={`/safety-compliance/${insp.id}/start`} method="POST">
                      <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus">
                        Start Inspection
                      </button>
                    </form>
                  )}
                  {canDoClose && (
                    <form action={`/safety-compliance/${insp.id}/close`} method="POST">
                      <button type="submit" className="rounded-md bg-success px-4 py-2 text-sm font-medium text-white hover:bg-success/90 focus:outline-none focus:ring-2 focus:ring-focus">
                        Close Inspection
                      </button>
                    </form>
                  )}
                  {(canDoSchedule || canDoComplete || canDoReopen || canDoCancel) && (
                    <p className="text-xs text-text-muted w-full mt-1">
                      Schedule, complete, reopen, and cancel actions require additional input — use the API or this page will be extended with forms.
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Findings */}
            <section className="rounded-lg border border-border bg-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                  Findings ({findings.length})
                </h2>
                {canDoCreateFinding && (
                  <span className="text-xs text-text-muted">Use API to add findings</span>
                )}
              </div>
              {findings.length === 0 ? (
                <p className="text-sm text-text-muted">No findings recorded.</p>
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
                            {f.assignedToUser ? f.assignedToUser.displayName : <span className="text-text-muted">—</span>}
                          </td>
                          <td className="px-3 py-2 text-sm text-text-secondary hidden md:table-cell">
                            {f.dueAt ? formatDate(f.dueAt) : <span className="text-text-muted">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Comments */}
            <section className="rounded-lg border border-border bg-surface p-5">
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
              {canComment && (
                <form
                  action={`/safety-compliance/${insp.id}/comments`}
                  method="POST"
                  className="mt-4 border-t border-border pt-4"
                >
                  <label htmlFor="comment-body" className="block text-xs font-medium text-text-secondary mb-1">Add comment</label>
                  <textarea
                    id="comment-body"
                    name="body"
                    rows={3}
                    maxLength={5000}
                    required
                    placeholder="Write a comment…"
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
                  />
                  <button
                    type="submit"
                    className="mt-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
                  >
                    Post comment
                  </button>
                </form>
              )}
            </section>

            {/* Activity */}
            {activities.length > 0 && (
              <section className="rounded-lg border border-border bg-surface p-5">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">Activity</h2>
                <div className="space-y-3">
                  {activities.map((a) => (
                    <div key={a.id} className="flex gap-3">
                      <div className="shrink-0 mt-1 size-2 rounded-full bg-border-strong" />
                      <div>
                        <p className="text-sm text-text-primary">
                          <span className="font-medium">{a.actorName ?? 'System'}</span>
                          {' — '}
                          <span className="text-text-secondary">{a.event.replace(/_/g, ' ')}</span>
                          {a.newStatus && (
                            <span className="ml-1 text-text-muted">→ {a.newStatus}</span>
                          )}
                        </p>
                        <p className="text-xs text-text-muted">{formatDateTime(a.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <section className="rounded-lg border border-border bg-surface p-4">
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
                    {insp.scheduledAt ? formatDate(insp.scheduledAt) : <span className="text-text-muted">Not scheduled</span>}
                  </dd>
                </div>
                {insp.department && (
                  <div>
                    <dt className="text-text-muted">Department</dt>
                    <dd className="font-medium text-text-primary">{insp.department.name}</dd>
                  </div>
                )}
                {insp.plant && (
                  <div>
                    <dt className="text-text-muted">Plant</dt>
                    <dd className="font-medium text-text-primary">{insp.plant.name}</dd>
                  </div>
                )}
                {insp.location && (
                  <div>
                    <dt className="text-text-muted">Location</dt>
                    <dd className="font-medium text-text-primary">{insp.location.name}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-text-muted">Created by</dt>
                  <dd className="font-medium text-text-primary">{insp.createdByUser.displayName}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Created</dt>
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
              <section className="rounded-lg border border-border bg-surface p-4">
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
