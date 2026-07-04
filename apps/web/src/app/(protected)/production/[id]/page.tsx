import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { productionApi } from '../../../../lib/production-api';
import {
  scheduleOrderAction,
  startOrderAction,
  resumeOrderAction,
  completeOrderAction,
  addProductionCommentAction,
  pauseOrderAction,
  cancelOrderAction,
} from '../actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getUserPermissions(): Promise<string[]> {
  try {
    const store = await cookies();
    const token = store.get('recafco_access')?.value;
    if (!token) return [];
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
    return Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [];
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const order = await productionApi.get(id);
    return { title: `${order.referenceNumber} — RECAFCO FMP` };
  } catch {
    return { title: 'Production Order — RECAFCO FMP' };
  }
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-surface border border-border text-text-secondary',
  SCHEDULED: 'bg-blue-50 text-blue-700 border border-blue-200',
  IN_PROGRESS: 'bg-success-light text-success border border-success/30',
  PAUSED: 'bg-warning-light text-warning border border-warning/30',
  COMPLETED: 'bg-surface text-text-muted border border-border',
  CANCELLED: 'bg-danger-light text-danger border border-danger/30',
};

function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const label = status.replace('_', ' ');
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? ''}`}>
      {label}
    </span>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default async function ProductionOrderDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [orderRes, metricsRes, commentsRes, activitiesRes, permissions] = await Promise.allSettled([
    productionApi.get(id),
    productionApi.getMetrics(id),
    productionApi.listComments(id),
    productionApi.listActivities(id),
    getUserPermissions(),
  ]);

  if (orderRes.status === 'rejected') notFound();

  const order = (orderRes as PromiseFulfilledResult<Awaited<ReturnType<typeof productionApi.get>>>).value;
  const metrics = metricsRes.status === 'fulfilled' ? metricsRes.value : null;
  const comments = commentsRes.status === 'fulfilled' ? commentsRes.value : [];
  const activities = activitiesRes.status === 'fulfilled' ? activitiesRes.value : [];
  const perms = permissions.status === 'fulfilled' ? permissions.value : [];

  const canUpdate = perms.includes('production.update') || perms.includes('production.manage');
  const canSchedule = perms.includes('production.schedule') || perms.includes('production.manage');
  const canStart = perms.includes('production.start') || perms.includes('production.manage');
  const canPause = perms.includes('production.pause') || perms.includes('production.manage');
  const canResume = perms.includes('production.resume') || perms.includes('production.manage');
  const canComplete = perms.includes('production.complete') || perms.includes('production.manage');
  const canCancel = perms.includes('production.cancel') || perms.includes('production.manage');
  const canComment = perms.includes('production.comment') || perms.includes('production.manage');
  const canAddEntry = perms.includes('production.entries.create') || perms.includes('production.manage');

  const { status, version } = order;
  const isDraft = status === 'DRAFT';
  const isScheduled = status === 'SCHEDULED';
  const isInProgress = status === 'IN_PROGRESS';
  const isPaused = status === 'PAUSED';
  const isActive = isInProgress || isPaused;

  async function handleSchedule(): Promise<void> {
    'use server';
    await scheduleOrderAction(id, version);
  }

  async function handleStart(): Promise<void> {
    'use server';
    await startOrderAction(id, version);
  }

  async function handleResume(): Promise<void> {
    'use server';
    await resumeOrderAction(id, version);
  }

  async function handleComplete(): Promise<void> {
    'use server';
    await completeOrderAction(id, version);
  }

  async function handlePause(formData: FormData): Promise<void> {
    'use server';
    await pauseOrderAction(id, version, { error: null }, formData);
  }

  async function handleCancel(formData: FormData): Promise<void> {
    'use server';
    await cancelOrderAction(id, version, { error: null }, formData);
  }

  async function handleComment(formData: FormData): Promise<void> {
    'use server';
    await addProductionCommentAction(id, { error: null }, formData);
  }

  return (
    <div className="min-h-full p-8">
      <div className="max-w-5xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Production Dashboard', href: '/production' },
          { label: order.referenceNumber },
        ]} />

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-text-primary">{order.title}</h1>
              <StatusBadge status={order.status} />
            </div>
            <p className="mt-1 text-sm text-text-muted font-mono">{order.referenceNumber}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isDraft && canUpdate && (
              <Link
                href={`/production/${id}/edit`}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary"
              >
                Edit
              </Link>
            )}
            {isDraft && canSchedule && (
              <form action={handleSchedule}>
                <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90">
                  Schedule
                </button>
              </form>
            )}
            {isScheduled && canStart && (
              <form action={handleStart}>
                <button type="submit" className="rounded-md bg-success px-3 py-1.5 text-sm font-medium text-white hover:bg-success/90">
                  Start
                </button>
              </form>
            )}
            {isInProgress && canPause && (
              <form action={handlePause}>
                <button type="submit" className="rounded-md bg-warning px-3 py-1.5 text-sm font-medium text-white hover:bg-warning/90">
                  Pause
                </button>
              </form>
            )}
            {isPaused && canResume && (
              <form action={handleResume}>
                <button type="submit" className="rounded-md bg-success px-3 py-1.5 text-sm font-medium text-white hover:bg-success/90">
                  Resume
                </button>
              </form>
            )}
            {isInProgress && canComplete && (
              <form action={handleComplete}>
                <button type="submit" className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary">
                  Complete
                </button>
              </form>
            )}
            {isActive && canAddEntry && (
              <Link
                href={`/production/${id}/entries/new`}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
              >
                Add Entry
              </Link>
            )}
            {(isDraft || isScheduled || isActive) && canCancel && (
              <form action={handleCancel}>
                <button type="submit" className="rounded-md border border-danger/30 bg-danger-light px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10">
                  Cancel
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Details */}
            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold text-text-primary mb-4">Order Details</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-text-muted">Product</dt>
                  <dd className="text-text-primary mt-0.5">{order.productName ?? order.productCode ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Production Line</dt>
                  <dd className="text-text-primary mt-0.5">{order.productionLine ? `${order.productionLine.name} (${order.productionLine.code})` : '—'}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Target Quantity</dt>
                  <dd className="text-text-primary mt-0.5 font-medium">{order.targetQuantity} {order.unit}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Department</dt>
                  <dd className="text-text-primary mt-0.5">{order.department?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Scheduled Start</dt>
                  <dd className="text-text-primary mt-0.5">{order.scheduledStartAt ? formatDateTime(order.scheduledStartAt) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Scheduled End</dt>
                  <dd className="text-text-primary mt-0.5">{order.scheduledEndAt ? formatDateTime(order.scheduledEndAt) : '—'}</dd>
                </div>
                {order.startedAt && (
                  <div>
                    <dt className="text-text-muted">Started At</dt>
                    <dd className="text-text-primary mt-0.5">{formatDateTime(order.startedAt)}</dd>
                  </div>
                )}
                {order.completedAt && (
                  <div>
                    <dt className="text-text-muted">Completed At</dt>
                    <dd className="text-text-primary mt-0.5">{formatDateTime(order.completedAt)}</dd>
                  </div>
                )}
              </dl>
              {order.description && (
                <div className="mt-4 pt-4 border-t border-border">
                  <dt className="text-xs text-text-muted mb-1">Description</dt>
                  <dd className="text-sm text-text-secondary whitespace-pre-wrap">{order.description}</dd>
                </div>
              )}
            </div>

            {/* Metrics */}
            {metrics && (
              <div className="rounded-lg border border-border bg-surface p-5">
                <h2 className="text-sm font-semibold text-text-primary mb-4">Production Metrics</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-text-muted">Completion</p>
                    <p className="text-2xl font-semibold text-text-primary mt-0.5">{metrics.completionPercentage}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Produced</p>
                    <p className="text-xl font-semibold text-success mt-0.5">{metrics.totalProduced}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Accepted</p>
                    <p className="text-xl font-semibold text-text-primary mt-0.5">{metrics.totalAccepted}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Rejected</p>
                    <p className="text-xl font-semibold text-danger mt-0.5">{metrics.totalRejected}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Rejection Rate</p>
                    <p className="text-xl font-semibold text-text-primary mt-0.5">{metrics.rejectionRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Remaining</p>
                    <p className="text-xl font-semibold text-text-primary mt-0.5">{metrics.remainingQuantity}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Downtime</p>
                    <p className="text-xl font-semibold text-warning mt-0.5">{metrics.totalDowntimeMinutes} min</p>
                  </div>
                  {metrics.adjustmentTotal !== 0 && (
                    <div>
                      <p className="text-xs text-text-muted">Adjustments</p>
                      <p className="text-xl font-semibold text-text-secondary mt-0.5">{metrics.adjustmentTotal > 0 ? '+' : ''}{metrics.adjustmentTotal}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Comments */}
            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold text-text-primary mb-4">Comments</h2>
              {comments.length === 0 ? (
                <p className="text-sm text-text-muted">No comments yet.</p>
              ) : (
                <div className="space-y-4 mb-4">
                  {comments.map((c) => (
                    <div key={c.id} className="border-l-2 border-border pl-3">
                      <p className="text-xs text-text-muted mb-1">
                        <span className="font-medium text-text-secondary">{c.authorUser.displayName}</span>
                        {' · '}{formatDateTime(c.createdAt)}
                      </p>
                      <p className="text-sm text-text-primary whitespace-pre-wrap">{c.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {canComment && (
                <form action={handleComment} className="mt-4 space-y-2">
                  <textarea
                    name="body"
                    rows={3}
                    required
                    placeholder="Add a comment…"
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
                  />
                  <div className="flex justify-end">
                    <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90">
                      Post comment
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">People</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-text-muted text-xs">Created by</p>
                  <p className="text-text-primary">{order.createdByUser.displayName}</p>
                </div>
                {order.supervisorUser && (
                  <div>
                    <p className="text-text-muted text-xs">Supervisor</p>
                    <p className="text-text-primary">{order.supervisorUser.displayName}</p>
                  </div>
                )}
                {order.startedByUser && (
                  <div>
                    <p className="text-text-muted text-xs">Started by</p>
                    <p className="text-text-primary">{order.startedByUser.displayName}</p>
                  </div>
                )}
                {order.completedByUser && (
                  <div>
                    <p className="text-text-muted text-xs">Completed by</p>
                    <p className="text-text-primary">{order.completedByUser.displayName}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Activity */}
            {activities.length > 0 && (
              <div className="rounded-lg border border-border bg-surface p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">Activity</h3>
                <div className="space-y-2">
                  {activities.slice().reverse().slice(0, 10).map((a) => (
                    <div key={a.id} className="text-xs text-text-secondary">
                      <span className="font-medium text-text-primary">{a.actorName ?? 'System'}</span>
                      {' '}{a.event}
                      {a.newStatus && <span className="ml-1 text-text-muted">→ {a.newStatus.replace('_', ' ')}</span>}
                      <p className="text-text-muted mt-0.5">{formatDateTime(a.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
