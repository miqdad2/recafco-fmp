import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { CalendarClock, CircleDot, Download, File, FileSpreadsheet, FileText, Flag, Image as ImageIcon, User } from 'lucide-react';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { TaskStatusBadge } from '../_components/task-status-badge';
import { TaskPriorityBadge } from '../_components/task-priority-badge';
import { authApi } from '@/lib/auth-api';
import { TaskAttachmentUpload } from '../_components/task-attachment-upload';
import { TaskActivityTimeline } from '../_components/task-activity-timeline';
import { TaskTransitionsPanel } from '../_components/task-transitions';
import { TaskModuleNav } from '../_components/task-module-nav';
import { AddProgressForm } from '../_components/add-progress-form';
import { AddTaskCommentForm } from '../_components/add-comment-form';
import { computeTaskNextStepGuidance } from '../_lib/task-control-center-helpers';
import { tasksApi } from '../../../../lib/factory-tasks-api';
import type { TaskStatus, TaskPriority, TaskAttachment } from '../../../../lib/factory-tasks-api';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * The login token carries only the user id (no permissions), so the real
 * permission list comes from /auth/me - same source the other task pages use.
 */
async function getJwtPayload(): Promise<{ sub?: string; permissions?: string[] }> {
  try {
    const store = await cookies();
    const token = store.get('recafco_access')?.value;
    if (!token) return {};
    const me = await authApi.me(token);
    return me.ok ? { sub: me.data.id, permissions: me.data.permissions } : {};
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

const CARD = 'rounded-xl border border-border bg-surface p-5 shadow-sm';
const SECTION_TITLE = 'text-lg font-semibold text-text-primary';

function FileIcon({ file }: { file: TaskAttachment }): React.JSX.Element {
  const cls = 'size-6 shrink-0 text-text-muted';
  if (file.mimeType.startsWith('image/')) return <ImageIcon className={cls} aria-hidden="true" />;
  if (/spreadsheet|ms-excel|csv/.test(file.mimeType)) return <FileSpreadsheet className={cls} aria-hidden="true" />;
  if (/pdf|word|text\/plain/.test(file.mimeType)) return <FileText className={cls} aria-hidden="true" />;
  return <File className={cls} aria-hidden="true" />;
}

function SummaryItem({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-border bg-surface-secondary px-4 py-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-text-muted" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-sm text-text-secondary">{label}</dt>
        <dd className="mt-0.5 text-base font-semibold text-text-primary break-words">{children}</dd>
      </div>
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-text-secondary">{label}</dt>
      <dd className="min-w-0 text-right text-base font-medium text-text-primary break-words">{children}</dd>
    </div>
  );
}

/**
 * FMP-TASK-11 - Task Detail redesigned as a simple two-column work page.
 * Left: header card (number, title, status / priority / assigned to / due),
 * What needs to be done, Files, Update progress, Comments & history.
 * Right: Actions, Task summary, Next step. Same data and the same real
 * actions as before - only layout and wording changed (status transitions,
 * attachments, progress notes and comments are untouched).
 */
export default async function TaskDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [jwt, taskRes, progressRes, commentsRes, activitiesRes, peopleRes, attachmentsRes] = await Promise.allSettled([
    getJwtPayload(),
    tasksApi.get(id),
    tasksApi.listProgress(id),
    tasksApi.listComments(id),
    tasksApi.listActivities(id),
    tasksApi.people(),
    tasksApi.listAttachments(id),
  ]);

  if (taskRes.status === 'rejected') notFound();

  const task = (taskRes as PromiseFulfilledResult<Awaited<ReturnType<typeof tasksApi.get>>>).value;
  const progressItems = progressRes.status === 'fulfilled' ? progressRes.value : [];
  const comments = commentsRes.status === 'fulfilled' ? commentsRes.value : [];
  const activities = activitiesRes.status === 'fulfilled' ? activitiesRes.value : [];
  const people = peopleRes.status === 'fulfilled' ? peopleRes.value : [];
  const attachments = attachmentsRes.status === 'fulfilled' ? attachmentsRes.value : [];

  const payload = jwt.status === 'fulfilled' ? jwt.value : {};
  const currentUserId = payload.sub ?? '';
  const permissions = payload.permissions ?? [];

  const has = (perm: string): boolean => permissions.includes(perm);
  const canUploadFiles = has('tasks.create') && (task.createdByUserId === currentUserId || has('tasks.manage'));
  const status = task.status as TaskStatus;
  const canAddProgress = (status === 'IN_PROGRESS' || status === 'BLOCKED') &&
    (task.assignedToUserId === currentUserId || has('tasks.manage'));
  const canComment = has('tasks.comment');
  const overdue = isOverdue(task.dueAt, status);
  const locationText = [task.plant?.name, task.location?.name].filter(Boolean).join(' — ') || 'Not set';
  const nextStepGuidance = computeTaskNextStepGuidance(status, Boolean(task.assignedToUserId));

  return (
    <div className="min-h-full px-4 py-6 lg:px-6">
      <div className="mx-auto w-full max-w-screen-2xl">
        <div className="space-y-3">
          <Breadcrumbs items={[
            { label: 'Platform Dashboard', href: '/dashboard' },
            { label: 'Task Management', href: '/factory-tasks/executive' },
            { label: task.referenceNumber },
          ]} className="mb-0" />
          <TaskModuleNav permissions={permissions} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* ── Main column ── */}
          <div className="min-w-0 space-y-6">
            {/* Header card */}
            <section className={`${CARD} space-y-4`}>
              <div>
                <p className="text-sm font-semibold text-text-secondary">Task Details</p>
                <p className="mt-1 font-mono text-sm text-accent">{task.referenceNumber}</p>
                <h1 className="mt-1 text-3xl font-semibold text-text-primary break-words">{task.title}</h1>
              </div>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryItem icon={CircleDot} label="Status"><TaskStatusBadge status={status} className="px-3! py-1! text-sm!" /></SummaryItem>
                <SummaryItem icon={Flag} label="Priority"><TaskPriorityBadge priority={task.priority as TaskPriority} className="px-3! py-1! text-sm!" /></SummaryItem>
                <SummaryItem icon={User} label="Assigned to">
                  {task.assignedToUser?.displayName ?? <span className="font-normal text-text-muted">Not assigned</span>}
                </SummaryItem>
                <SummaryItem icon={CalendarClock} label="Due date">
                  {task.dueAt ? (
                    <span className={overdue ? 'text-error' : ''}>
                      {formatDateTime(task.dueAt)}{overdue && <span className="ml-1 text-sm font-medium">(Overdue)</span>}
                    </span>
                  ) : (
                    <span className="font-normal text-text-muted">Not set</span>
                  )}
                </SummaryItem>
              </dl>
            </section>

            {/* What needs to be done */}
            <section className={CARD}>
              <h2 className={`${SECTION_TITLE} mb-3`}>What needs to be done</h2>
              {task.description ? (
                <p className="whitespace-pre-wrap break-words rounded-lg bg-surface-secondary px-4 py-3 text-base text-text-primary">{task.description}</p>
              ) : (
                <p className="text-base text-text-muted">No details were added.</p>
              )}
            </section>

            {/* Blocked reason */}
            {task.blockedReason && (
              <section className="rounded-xl border border-error bg-error-light p-5">
                <h2 className="mb-2 text-lg font-semibold text-error">This task is blocked</h2>
                <p className="whitespace-pre-wrap break-words text-base text-text-primary">{task.blockedReason}</p>
                {task.blockedAt && <p className="mt-2 text-sm text-text-secondary">Blocked on {formatDateTime(task.blockedAt)}</p>}
              </section>
            )}

            {/* Completion summary */}
            {task.completionSummary && (status === 'COMPLETED' || status === 'CLOSED') && (
              <section className={CARD}>
                <h2 className={`${SECTION_TITLE} mb-3`}>What was done</h2>
                <p className="whitespace-pre-wrap break-words text-base text-text-primary">{task.completionSummary}</p>
                {task.completedAt && (
                  <p className="mt-2 text-sm text-text-secondary">Completed on {formatDateTime(task.completedAt)}</p>
                )}
              </section>
            )}

            {/* Files */}
            {(attachments.length > 0 || canUploadFiles) && (
              <section id="attachments" className={CARD}>
                <h2 className={`${SECTION_TITLE} mb-3`}>
                  Files <span className="text-base font-normal text-text-muted">({attachments.length})</span>
                </h2>
                {attachments.length === 0 ? (
                  <p className="text-base text-text-muted">No files added yet.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {attachments.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-secondary/60">
                        <FileIcon file={a} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-medium text-text-primary" title={a.originalFileName}>{a.originalFileName}</p>
                          <p className="text-sm text-text-secondary">
                            Uploaded by {a.uploadedByUser?.displayName ?? 'Unknown'} · {formatDateTime(a.createdAt)}
                          </p>
                        </div>
                        <a
                          href={`/factory-tasks/${task.id}/attachments/${a.id}/download`}
                          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
                        >
                          <Download className="size-4" aria-hidden="true" /> Download
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {canUploadFiles && <TaskAttachmentUpload taskId={task.id} />}
              </section>
            )}

            {/* Update progress */}
            {(canAddProgress || progressItems.length > 0) && (
              <section id="progress" className={CARD}>
                <h2 className={`${SECTION_TITLE} mb-3`}>Update progress</h2>
                {canAddProgress && <AddProgressForm taskId={id} />}
                {progressItems.length > 0 && (
                  <div className={canAddProgress ? 'mt-5 border-t border-border pt-4' : ''}>
                    <h3 className="mb-2 text-base font-semibold text-text-primary">
                      Earlier updates <span className="text-sm font-normal text-text-muted">({progressItems.length})</span>
                    </h3>
                    <ul className="space-y-3">
                      {progressItems.map((p) => (
                        <li key={p.id} className="rounded-lg border border-border bg-surface-secondary p-3">
                          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-2 text-base font-medium text-text-primary">
                              {p.authorUser?.displayName ?? 'Unknown'}
                              {p.progressPercent !== null && p.progressPercent !== undefined && (
                                <span className="rounded-full bg-accent-light px-2 py-0.5 text-sm font-medium text-accent">{p.progressPercent}%</span>
                              )}
                            </span>
                            <span className="text-sm text-text-muted">{formatDateTime(p.createdAt)}</span>
                          </div>
                          <p className="whitespace-pre-wrap break-words text-base text-text-secondary">{p.note}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* Comments & history */}
            <section id="comments" className={CARD}>
              <h2 className={`${SECTION_TITLE} mb-4`}>Comments &amp; history</h2>
              {canComment && (
                <div className="mb-6">
                  <AddTaskCommentForm taskId={id} />
                </div>
              )}
              <TaskActivityTimeline activities={activities} comments={comments} />
            </section>
          </div>

          {/* ── Side column ── */}
          <div className="min-w-0 space-y-6">
            <div className={CARD}>
              <h2 className={`${SECTION_TITLE} mb-3`}>Actions</h2>
              <TaskTransitionsPanel
                task={task}
                currentUserId={currentUserId}
                permissions={permissions}
                people={people}
              />
            </div>

            <div className={CARD}>
              <h2 className={SECTION_TITLE}>Task summary</h2>
              <dl className="mt-2 divide-y divide-border">
                <SummaryRow label="Assigned to">{task.assignedToUser?.displayName ?? <span className="font-normal text-text-muted">Not assigned</span>}</SummaryRow>
                <SummaryRow label="Created by">{task.createdByUser?.displayName ?? <span className="font-normal text-text-muted">Unknown</span>}</SummaryRow>
                <SummaryRow label="Department">{task.responsibleDepartment?.name ?? <span className="font-normal text-text-muted">Not set</span>}</SummaryRow>
                <SummaryRow label="Location">{locationText === 'Not set' ? <span className="font-normal text-text-muted">Not set</span> : locationText}</SummaryRow>
                <SummaryRow label="Created">{formatDate(task.createdAt)}</SummaryRow>
                <SummaryRow label="Due date">
                  {task.dueAt ? <span className={overdue ? 'text-error' : ''}>{formatDateTime(task.dueAt)}</span> : <span className="font-normal text-text-muted">Not set</span>}
                </SummaryRow>
                {task.completedAt && <SummaryRow label="Completed">{formatDate(task.completedAt)}</SummaryRow>}
                {task.incident && <SummaryRow label="Linked incident"><span className="font-mono text-sm">{task.incident.referenceNumber}</span></SummaryRow>}
              </dl>
            </div>

            {nextStepGuidance && (
              <div className="rounded-xl border border-accent/20 bg-accent-light p-5">
                <h2 className={SECTION_TITLE}>Next step</h2>
                <p className="mt-1 text-base text-text-primary">{nextStepGuidance}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
