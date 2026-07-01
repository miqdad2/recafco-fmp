import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { TaskStatusBadge } from '../_components/task-status-badge';
import { TaskPriorityBadge } from '../_components/task-priority-badge';
import { TaskActivityTimeline } from '../_components/task-activity-timeline';
import { TaskTransitionsPanel } from '../_components/task-transitions';
import { AddProgressForm } from '../_components/add-progress-form';
import { AddTaskCommentForm } from '../_components/add-comment-form';
import { tasksApi } from '../../../../lib/factory-tasks-api';
import type { TaskStatus, TaskPriority } from '../../../../lib/factory-tasks-api';

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

function isOverdue(dueAt: string | null, status: TaskStatus): boolean {
  if (!dueAt) return false;
  if (!(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED'] as TaskStatus[]).includes(status)) return false;
  return new Date(dueAt) < new Date();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const task = await tasksApi.get(id);
    return { title: `${task.referenceNumber} — RECAFCO FMP` };
  } catch {
    return { title: 'Task — RECAFCO FMP' };
  }
}

export default async function TaskDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [jwt, taskRes, progressRes, commentsRes, activitiesRes, peopleRes] = await Promise.allSettled([
    getJwtPayload(),
    tasksApi.get(id),
    tasksApi.listProgress(id),
    tasksApi.listComments(id),
    tasksApi.listActivities(id),
    tasksApi.people(),
  ]);

  if (taskRes.status === 'rejected') notFound();

  const task = (taskRes as PromiseFulfilledResult<Awaited<ReturnType<typeof tasksApi.get>>>).value;
  const progressItems = progressRes.status === 'fulfilled' ? progressRes.value : [];
  const comments = commentsRes.status === 'fulfilled' ? commentsRes.value : [];
  const activities = activitiesRes.status === 'fulfilled' ? activitiesRes.value : [];
  const people = peopleRes.status === 'fulfilled' ? peopleRes.value : [];

  const payload = jwt.status === 'fulfilled' ? jwt.value : {};
  const currentUserId = payload.sub ?? '';
  const permissions = payload.permissions ?? [];

  const has = (perm: string): boolean => permissions.includes(perm);
  const status = task.status as TaskStatus;
  const canAddProgress = (status === 'IN_PROGRESS' || status === 'BLOCKED') &&
    (task.assignedToUserId === currentUserId || has('tasks.manage'));
  const canComment = has('tasks.comment');
  const overdue = isOverdue(task.dueAt, status);

  return (
    <div className="min-h-full p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Factory Tasks', href: '/factory-tasks' },
          { label: task.referenceNumber },
        ]} />

        {/* Title + badges */}
        <div className="mb-6 flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-text-muted">{task.referenceNumber}</span>
              <TaskPriorityBadge priority={task.priority as TaskPriority} />
              <TaskStatusBadge status={status} />
              {overdue && (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-danger-light text-danger">
                  Overdue
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-text-primary break-words">{task.title}</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ── Main content ── */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            {task.description && (
              <section>
                <h2 className="text-base font-semibold text-text-primary mb-3">Description</h2>
                <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{task.description}</p>
              </section>
            )}

            {/* Blocked reason */}
            {task.blockedReason && (
              <section>
                <h2 className="text-base font-semibold text-danger mb-2">Blocked</h2>
                <div className="rounded-lg border border-danger bg-danger-light p-4">
                  <p className="text-sm text-text-primary whitespace-pre-wrap break-words">{task.blockedReason}</p>
                  {task.blockedAt && (
                    <p className="mt-2 text-xs text-text-muted">
                      Blocked on {formatDateTime(task.blockedAt)}
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Completion summary */}
            {task.completionSummary && (status === 'COMPLETED' || status === 'CLOSED') && (
              <section>
                <h2 className="text-base font-semibold text-text-primary mb-3">Completion summary</h2>
                <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{task.completionSummary}</p>
                {task.completedAt && (
                  <p className="mt-2 text-xs text-text-muted">
                    Completed on {formatDateTime(task.completedAt)}
                    {task.completedByUserId && ` by ${task.assignedToUser?.displayName ?? 'unknown'}`}
                  </p>
                )}
              </section>
            )}

            {/* Progress notes */}
            {progressItems.length > 0 && (
              <section id="progress">
                <h2 className="text-base font-semibold text-text-primary mb-3">
                  Progress notes{' '}
                  <span className="text-sm font-normal text-text-muted">({progressItems.length})</span>
                </h2>
                <div className="space-y-3">
                  {progressItems.map((p) => (
                    <div key={p.id} className="rounded-lg border border-border bg-surface p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary">
                            {p.authorUser?.displayName ?? 'Unknown'}
                          </span>
                          {p.progressPercent !== null && p.progressPercent !== undefined && (
                            <span className="rounded-full bg-accent-light text-accent px-2 py-0.5 text-xs font-medium">
                              {p.progressPercent}%
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-text-muted shrink-0">{formatDateTime(p.createdAt)}</span>
                      </div>
                      <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{p.note}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Add progress */}
            {canAddProgress && (
              <section>
                <h2 className="text-base font-semibold text-text-primary mb-3">Add progress note</h2>
                <AddProgressForm taskId={id} />
              </section>
            )}

            {/* Comments & activity */}
            <section id="comments">
              <h2 className="text-base font-semibold text-text-primary mb-4">
                Comments &amp; activity
              </h2>
              {canComment && (
                <div className="mb-6">
                  <AddTaskCommentForm taskId={id} />
                </div>
              )}
              <TaskActivityTimeline activities={activities} comments={comments} />
            </section>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-6">
            {/* Transitions */}
            <div className="rounded-lg border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-text-primary mb-3">Actions</h2>
              <TaskTransitionsPanel
                task={task}
                currentUserId={currentUserId}
                permissions={permissions}
                people={people}
              />
            </div>

            {/* Details */}
            <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
              <h2 className="text-sm font-semibold text-text-primary">Details</h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-text-muted">Created</dt>
                  <dd className="text-text-secondary">{formatDate(task.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Created by</dt>
                  <dd className="text-text-secondary">{task.createdByUser.displayName}</dd>
                </div>
                {task.requestedByUserId !== task.createdByUserId && (
                  <div>
                    <dt className="text-xs text-text-muted">Requested by</dt>
                    <dd className="text-text-secondary">{task.requestedByUser.displayName}</dd>
                  </div>
                )}
                {task.assignedToUser && (
                  <div>
                    <dt className="text-xs text-text-muted">Assigned to</dt>
                    <dd className="text-text-secondary font-medium">{task.assignedToUser.displayName}</dd>
                  </div>
                )}
                {task.dueAt && (
                  <div>
                    <dt className="text-xs text-text-muted">Due</dt>
                    <dd className={overdue ? 'text-danger font-medium' : 'text-text-secondary'}>
                      {formatDateTime(task.dueAt)}
                    </dd>
                  </div>
                )}
                {task.responsibleDepartment && (
                  <div>
                    <dt className="text-xs text-text-muted">Responsible dept.</dt>
                    <dd className="text-text-secondary">{task.responsibleDepartment.name}</dd>
                  </div>
                )}
                {task.requestingDepartment && (
                  <div>
                    <dt className="text-xs text-text-muted">Requesting dept.</dt>
                    <dd className="text-text-secondary">{task.requestingDepartment.name}</dd>
                  </div>
                )}
                {task.plant && (
                  <div>
                    <dt className="text-xs text-text-muted">Plant</dt>
                    <dd className="text-text-secondary">{task.plant.name}</dd>
                  </div>
                )}
                {task.location && (
                  <div>
                    <dt className="text-xs text-text-muted">Location</dt>
                    <dd className="text-text-secondary">{task.location.name}</dd>
                  </div>
                )}
                {task.incident && (
                  <div>
                    <dt className="text-xs text-text-muted">Linked incident</dt>
                    <dd className="text-text-secondary font-mono text-xs">{task.incident.referenceNumber}</dd>
                  </div>
                )}
                {task.completedAt && (
                  <div>
                    <dt className="text-xs text-text-muted">Completed</dt>
                    <dd className="text-text-secondary">{formatDate(task.completedAt)}</dd>
                  </div>
                )}
                {task.closedAt && (
                  <div>
                    <dt className="text-xs text-text-muted">Closed</dt>
                    <dd className="text-text-secondary">{formatDate(task.closedAt)}</dd>
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
