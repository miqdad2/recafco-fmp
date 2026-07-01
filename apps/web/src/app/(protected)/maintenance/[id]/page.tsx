import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { MrStatusBadge } from '../_components/mr-status-badge';
import { MrPriorityBadge } from '../_components/mr-priority-badge';
import { maintenanceApi } from '../../../../lib/maintenance-api';
import type { MaintenanceStatus } from '../../../../lib/maintenance-api';

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

const ACTIVE_STATUSES: MaintenanceStatus[] = [
  'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_PARTS',
];

function isOverdue(completionAt: string | null, status: MaintenanceStatus): boolean {
  if (!completionAt) return false;
  if (!ACTIVE_STATUSES.includes(status)) return false;
  return new Date(completionAt) < new Date();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const mr = await maintenanceApi.get(id);
    return { title: `${mr.referenceNumber} — RECAFCO FMP` };
  } catch {
    return { title: 'Maintenance Request — RECAFCO FMP' };
  }
}

export default async function MrDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [jwt, mrRes, commentsRes, activitiesRes] = await Promise.allSettled([
    getJwtPayload(),
    maintenanceApi.get(id),
    maintenanceApi.listComments(id),
    maintenanceApi.listActivities(id),
  ]);

  if (mrRes.status === 'rejected') notFound();

  const mr = (mrRes as PromiseFulfilledResult<Awaited<ReturnType<typeof maintenanceApi.get>>>).value;
  const comments = commentsRes.status === 'fulfilled' ? commentsRes.value : [];
  const activities = activitiesRes.status === 'fulfilled' ? activitiesRes.value : [];

  const payload = jwt.status === 'fulfilled' ? jwt.value : {};
  const currentUserId = payload.sub;
  const permissions = Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [];

  const isCreator = mr.createdByUserId === currentUserId;
  const isAssignee = mr.assignedToUserId === currentUserId;
  const canManage = permissions.includes('maintenance.manage');
  const canCreate = permissions.includes('maintenance.create');
  const canReview = permissions.includes('maintenance.review');
  const canApprove = permissions.includes('maintenance.approve');
  const canReject = permissions.includes('maintenance.reject');
  const canAssign = permissions.includes('maintenance.assign');
  const canStart = permissions.includes('maintenance.start');
  const canComplete = permissions.includes('maintenance.complete');
  const canClose = permissions.includes('maintenance.close');
  const canComment = permissions.includes('maintenance.comment');

  const status = mr.status as MaintenanceStatus;
  const overdue = isOverdue(mr.requestedCompletionAt, status);

  const canEdit = status === 'DRAFT' && (isCreator || canManage);
  const canSubmit = status === 'DRAFT' && (isCreator || canManage) && canCreate;
  const canDoReview = status === 'SUBMITTED' && canReview;
  const canDoApprove = status === 'UNDER_REVIEW' && canApprove;
  const canDoReject = (status === 'SUBMITTED' || status === 'UNDER_REVIEW') && canReject;
  const canDoAssign = (status === 'APPROVED' || status === 'ASSIGNED') && canAssign;
  const canDoUnassign = status === 'ASSIGNED' && canAssign;
  const canDoStart = status === 'ASSIGNED' && (isAssignee || canManage) && canStart;
  const canDoWaitForParts = status === 'IN_PROGRESS' && (isAssignee || canManage) && canStart;
  const canDoResume = status === 'WAITING_FOR_PARTS' && (isAssignee || canManage) && canStart;
  const canDoComplete = (status === 'IN_PROGRESS' || status === 'WAITING_FOR_PARTS') && (isAssignee || canManage) && canComplete;
  const canDoClose = status === 'COMPLETED' && canClose;
  const canDoCancel = !['COMPLETED', 'CLOSED', 'REJECTED', 'CANCELLED'].includes(status) && (isCreator || canManage);
  const canDoReopen = ['COMPLETED', 'CLOSED', 'REJECTED'].includes(status) && canManage;

  const hasAnyTransition = canSubmit || canDoReview || canDoApprove || canDoReject || canDoAssign ||
    canDoUnassign || canDoStart || canDoWaitForParts || canDoResume || canDoComplete ||
    canDoClose || canDoCancel || canDoReopen;

  return (
    <div className="min-h-full p-8">
      <div className="max-w-5xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Maintenance Requests', href: '/maintenance' },
          { label: mr.referenceNumber },
        ]} />

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-semibold text-text-primary">{mr.title}</h1>
              <MrStatusBadge status={status} />
              <MrPriorityBadge priority={mr.priority} />
            </div>
            <p className="text-sm text-text-muted font-mono">{mr.referenceNumber}</p>
          </div>
          {canEdit && (
            <Link
              href={`/maintenance/${mr.id}/edit`}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Edit
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Problem description */}
            <section className="rounded-lg border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Problem Description</h2>
              <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{mr.problemDescription}</p>
            </section>

            {/* Transitions panel */}
            {hasAnyTransition && (
              <section className="rounded-lg border border-border bg-surface p-5">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">Actions</h2>
                <div className="space-y-3">
                  {canSubmit && (
                    <form action={`/maintenance/${mr.id}/submit`} method="POST" className="inline">
                      <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus mr-2">
                        Submit for Review
                      </button>
                    </form>
                  )}
                  {canDoReview && (
                    <form action={`/maintenance/${mr.id}/review`} method="POST" className="inline">
                      <button type="submit" className="rounded-md bg-info px-4 py-2 text-sm font-medium text-white hover:bg-info/90 focus:outline-none focus:ring-2 focus:ring-focus mr-2">
                        Take Under Review
                      </button>
                    </form>
                  )}
                  {canDoApprove && (
                    <form action={`/maintenance/${mr.id}/approve`} method="POST" className="inline">
                      <button type="submit" className="rounded-md bg-success px-4 py-2 text-sm font-medium text-white hover:bg-success/90 focus:outline-none focus:ring-2 focus:ring-focus mr-2">
                        Approve
                      </button>
                    </form>
                  )}
                  {canDoStart && (
                    <form action={`/maintenance/${mr.id}/start`} method="POST" className="inline">
                      <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus mr-2">
                        Start Work
                      </button>
                    </form>
                  )}
                  {canDoResume && (
                    <form action={`/maintenance/${mr.id}/resume`} method="POST" className="inline">
                      <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus mr-2">
                        Resume Work
                      </button>
                    </form>
                  )}
                  {canDoClose && (
                    <form action={`/maintenance/${mr.id}/close`} method="POST" className="inline">
                      <button type="submit" className="rounded-md bg-success px-4 py-2 text-sm font-medium text-white hover:bg-success/90 focus:outline-none focus:ring-2 focus:ring-focus mr-2">
                        Close Request
                      </button>
                    </form>
                  )}
                  <p className="text-xs text-text-muted mt-1">
                    Some actions (reject, assign, complete, cancel, reopen) require additional input. Use the API or extend this page to add those forms.
                  </p>
                </div>
              </section>
            )}

            {/* Completion / Rejection / Cancellation info */}
            {mr.completionSummary && (
              <section className="rounded-lg border border-success bg-success-light p-5">
                <h2 className="text-sm font-semibold text-success uppercase tracking-wide mb-2">Completion Summary</h2>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{mr.completionSummary}</p>
                {mr.completedAt && <p className="mt-2 text-xs text-text-muted">Completed {formatDateTime(mr.completedAt)}</p>}
              </section>
            )}
            {mr.rejectionReason && (
              <section className="rounded-lg border border-danger bg-danger-light p-5">
                <h2 className="text-sm font-semibold text-danger uppercase tracking-wide mb-2">Rejection Reason</h2>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{mr.rejectionReason}</p>
                {mr.rejectedAt && <p className="mt-2 text-xs text-text-muted">Rejected {formatDateTime(mr.rejectedAt)}</p>}
              </section>
            )}
            {mr.cancellationReason && (
              <section className="rounded-lg border border-border bg-surface-secondary p-5">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">Cancellation Reason</h2>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{mr.cancellationReason}</p>
              </section>
            )}
            {mr.waitingForPartsReason && status === 'WAITING_FOR_PARTS' && (
              <section className="rounded-lg border border-danger bg-danger-light p-5">
                <h2 className="text-sm font-semibold text-danger uppercase tracking-wide mb-2">Waiting for Parts</h2>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{mr.waitingForPartsReason}</p>
                {mr.waitingForPartsAt && <p className="mt-2 text-xs text-text-muted">Since {formatDateTime(mr.waitingForPartsAt)}</p>}
              </section>
            )}

            {/* Comments */}
            <section className="rounded-lg border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
                Comments ({comments.length})
              </h2>
              {comments.length === 0 && (
                <p className="text-sm text-text-muted">No comments yet.</p>
              )}
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
                  action={`/maintenance/${mr.id}/comments`}
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
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Details */}
            <section className="rounded-lg border border-border bg-surface p-4">
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Details</h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-text-muted">Created by</dt>
                  <dd className="text-text-primary">{mr.createdByUser.displayName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Requested by</dt>
                  <dd className="text-text-primary">{mr.requestedByUser.displayName}</dd>
                </div>
                {mr.assignedToUser && (
                  <div>
                    <dt className="text-xs text-text-muted">Assigned to</dt>
                    <dd className="text-text-primary">{mr.assignedToUser.displayName}</dd>
                  </div>
                )}
                {mr.affectedDepartment && (
                  <div>
                    <dt className="text-xs text-text-muted">Department</dt>
                    <dd className="text-text-primary">{mr.affectedDepartment.name}</dd>
                  </div>
                )}
                {mr.plant && (
                  <div>
                    <dt className="text-xs text-text-muted">Plant</dt>
                    <dd className="text-text-primary">{mr.plant.name}</dd>
                  </div>
                )}
                {mr.location && (
                  <div>
                    <dt className="text-xs text-text-muted">Location</dt>
                    <dd className="text-text-primary">{mr.location.name}</dd>
                  </div>
                )}
                {mr.equipmentDescription && (
                  <div>
                    <dt className="text-xs text-text-muted">Equipment</dt>
                    <dd className="text-text-primary">{mr.equipmentDescription}</dd>
                  </div>
                )}
                {mr.requestedCompletionAt && (
                  <div>
                    <dt className="text-xs text-text-muted">Completion requested</dt>
                    <dd className={overdue ? 'text-danger font-medium' : 'text-text-primary'}>
                      {formatDate(mr.requestedCompletionAt)}
                      {overdue && ' (overdue)'}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-text-muted">Submitted</dt>
                  <dd className="text-text-primary">{formatDateTime(mr.createdAt)}</dd>
                </div>
              </dl>
            </section>

            {/* Activity log */}
            {activities.length > 0 && (
              <section className="rounded-lg border border-border bg-surface p-4">
                <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">
                  Activity ({activities.length})
                </h2>
                <ol className="space-y-2">
                  {activities.map((a) => (
                    <li key={a.id} className="text-xs">
                      <span className="text-text-muted">{formatDateTime(a.createdAt)}</span>
                      <span className="mx-1 text-text-muted">·</span>
                      <span className="text-text-secondary font-medium">{a.actorName ?? 'System'}</span>
                      <span className="mx-1 text-text-muted">·</span>
                      <span className="text-text-muted">{a.event.replace(/_/g, ' ')}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
