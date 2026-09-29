import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { TaskStatusBadge } from '../_components/task-status-badge';
import { TaskPriorityBadge } from '../_components/task-priority-badge';
import { TaskActivityTimeline } from '../_components/task-activity-timeline';
import { TaskTransitionsPanel } from '../_components/task-transitions';
import { TaskModuleNav } from '../_components/task-module-nav';
import { AddProgressForm } from '../_components/add-progress-form';
import { AddTaskCommentForm } from '../_components/add-comment-form';
import { computeTaskNextActionText, computeTaskNextStepGuidance } from '../_lib/task-control-center-helpers';
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

/**
 * FMP-UI-20E — polished per direct feedback that this page "felt too empty"
 * and that the Actions panel showing only "Cancel task" for some viewers
 * made the task lifecycle unclear. Same data/route/permissions as before —
 * only the presentation changed:
 *   - A new "Task Summary" card leads the left column: reference number,
 *     title, then a labeled Status:/Priority:/Assigned to:/Responsible
 *     department:/Due: grid (badges kept for Status/Priority — this is the
 *     SAME real data the old floating badge row already showed, just
 *     organized as a proper summary instead of loose chips next to the
 *     title).
 *   - The old single "Details" sidebar panel is split into "Assignment
 *     Details" (who/where: Assigned To, Created By, Requested By,
 *     Responsible/Requesting Department, Plant / Location) and "Dates"
 *     (when: Created, Due, Blocked, Completed, Closed, plus the linked
 *     incident reference, which didn't fit cleanly into either) — same
 *     fields as before, just grouped so each panel answers one question.
 *   - "Actions" → "Available Actions", and `TaskTransitionsPanel` no
 *     longer renders as silently empty when no transition applies to the
 *     current viewer (see that component's own doc comment) — the heading
 *     stays, with an honest one-line explanation instead of nothing.
 *   - Activity wording fixed in `TaskActivityTimeline` itself (see that
 *     component) — "Task created by manager" instead of "manager Task
 *     created."
 *
 * FMP-UI-20F — added the navigation this page never had (per direct
 * feedback: "users may feel stuck after opening a task"). A new
 * `TaskDetailNav` row (Back to Platform Dashboard / Back to Task
 * Management / Previous: Maintenance Management / Switch module) sits
 * above the breadcrumb, same order `ExecutiveModuleNav` already uses
 * elsewhere. The breadcrumb itself is now 3 levels — "Platform Dashboard >
 * Task Management > {reference}" (was "Factory Tasks Management >
 * {reference}", 2 levels, linking to the OLD `/factory-tasks` list) — and
 * "Task Management" is the label used consistently everywhere on this page
 * now (the internal route/permission names — `/factory-tasks`,
 * `tasks.read`, etc. — are unchanged; only user-facing wording changed).
 * The Task Summary card gained a small "Task Detail" eyebrow label above
 * the reference number, per this unit's own requested header copy.
 *
 * FMP-UI-20G — per direct feedback that the page still didn't explain the
 * next step: the Task Summary card gained a "Next Action:" row
 * (`computeTaskNextActionText()`, the SAME function/text the Task Control
 * Center's list already uses — one source of truth for "what's next," not
 * a second copy) and a "Next Step" guidance callout beneath the grid
 * (`computeTaskNextStepGuidance()`, a plain sentence keyed on real
 * status/assignment, never fabricated). "Due:" now shows date AND time
 * (was date-only) to match this unit's own header example. Description and
 * Comments & Activity are now inside the same card style every other
 * section on this page already uses, with an honest "No description
 * provided." empty state (was: hidden entirely when blank) instead of
 * silently disappearing. Nav order swapped in `TaskDetailNav` itself (see
 * that component). Button wording ("Open task" → "Open for Work", "Cancel
 * task"/"Edit draft" → Title Case) changed in `task-transitions.tsx` — same
 * `openTaskAction`/`cancelTaskAction` calls, same permissions, label only.
 *
 * FMP-UI-20H — the nav row (breadcrumb + `TaskDetailNav`) read as visually
 * attached to the Task Summary card below it, per direct feedback ("feels
 * cramped and visually unfinished"). The gap between them is now an
 * explicit `mt-8` (32px, was `mt-6`/24px) on the content grid — deliberately
 * ABOVE the top of this unit's own suggested 16–24px range, so the
 * separation reads as clearly intentional rather than borderline. The
 * breadcrumb's own default `mb-4` (which depended on CSS margin-collapsing
 * with the `space-y-2` wrapper's top-margin for its gap to `TaskDetailNav`
 * — technically correct, but an indirect way to get there) is now
 * overridden to `mb-0`, with that gap set directly and deterministically
 * by the wrapper's own `space-y-3` instead.
 *
 * FMP-UI-20I — `TaskDetailNav` renamed to `TaskModuleNav` (see that
 * component's own file) since it's now reused verbatim by
 * `factory-tasks/page.tsx` (the Task List page) too — no behavior change
 * on this page, only the import/usage name.
 */
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
  const plantLocationText = [task.plant?.name, task.location?.name].filter(Boolean).join(' — ') || '—';
  const nextActionText = computeTaskNextActionText(task, currentUserId, permissions);
  const nextStepGuidance = computeTaskNextStepGuidance(status, Boolean(task.assignedToUserId));

  return (
    <div className="min-h-full p-8">
      <div className="max-w-6xl mx-auto">
        <div className="space-y-3">
          <Breadcrumbs items={[
            { label: 'Platform Dashboard', href: '/dashboard' },
            { label: 'Task Management', href: '/factory-tasks/executive' },
            { label: task.referenceNumber },
          ]} className="mb-0" />
          <TaskModuleNav permissions={permissions} />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ── Left column ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Task Summary */}
            <section className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Task Detail</p>
                <p className="mt-1 font-mono text-xs text-text-muted">{task.referenceNumber}</p>
                <h1 className="mt-0.5 text-2xl font-semibold text-text-primary break-words">{task.title}</h1>
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <dt className="text-text-secondary">Status:</dt>
                  <dd><TaskStatusBadge status={status} /></dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="text-text-secondary">Priority:</dt>
                  <dd><TaskPriorityBadge priority={task.priority as TaskPriority} /></dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="text-text-secondary">Assigned to:</dt>
                  <dd className="font-medium text-text-primary">{task.assignedToUser?.displayName ?? 'Not assigned'}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="text-text-secondary">Responsible department:</dt>
                  <dd className="text-text-primary">{task.responsibleDepartment?.name ?? '—'}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="text-text-secondary">Due:</dt>
                  <dd className={overdue ? 'font-medium text-danger' : 'text-text-primary'}>
                    {task.dueAt ? formatDateTime(task.dueAt) : '—'}
                    {overdue && <span className="ml-1 text-xs">(Overdue)</span>}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="text-text-secondary">Next Action:</dt>
                  <dd className="font-medium text-text-primary">{nextActionText}</dd>
                </div>
              </dl>

              {/* Next Step guidance */}
              {nextStepGuidance && (
                <div className="rounded-lg border border-accent/20 bg-accent-light px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">Next Step</p>
                  <p className="mt-1 text-sm text-text-primary">{nextStepGuidance}</p>
                </div>
              )}
            </section>

            {/* Description */}
            <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="text-base font-semibold text-text-primary mb-3">Description</h2>
              {task.description ? (
                <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{task.description}</p>
              ) : (
                <p className="text-sm text-text-muted">No description provided.</p>
              )}
            </section>

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
            <section id="comments" className="rounded-xl border border-border bg-surface p-5 shadow-sm">
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

          {/* ── Right column ── */}
          <div className="space-y-6">
            {/* Available Actions */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-text-primary mb-3">Available Actions</h2>
              <TaskTransitionsPanel
                task={task}
                currentUserId={currentUserId}
                permissions={permissions}
                people={people}
              />
            </div>

            {/* Assignment Details */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-text-primary">Assignment Details</h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-text-muted">Assigned To</dt>
                  <dd className="font-medium text-text-secondary">{task.assignedToUser?.displayName ?? 'Not assigned'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Created By</dt>
                  <dd className="text-text-secondary">{task.createdByUser.displayName}</dd>
                </div>
                {task.requestedByUserId !== task.createdByUserId && (
                  <div>
                    <dt className="text-xs text-text-muted">Requested By</dt>
                    <dd className="text-text-secondary">{task.requestedByUser.displayName}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-text-muted">Responsible Department</dt>
                  <dd className="text-text-secondary">{task.responsibleDepartment?.name ?? '—'}</dd>
                </div>
                {task.requestingDepartment && (
                  <div>
                    <dt className="text-xs text-text-muted">Requesting Department</dt>
                    <dd className="text-text-secondary">{task.requestingDepartment.name}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-text-muted">Plant / Location</dt>
                  <dd className="text-text-secondary">{plantLocationText}</dd>
                </div>
              </dl>
            </div>

            {/* Dates */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-text-primary">Dates</h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-text-muted">Created</dt>
                  <dd className="text-text-secondary">{formatDate(task.createdAt)}</dd>
                </div>
                {task.dueAt && (
                  <div>
                    <dt className="text-xs text-text-muted">Due</dt>
                    <dd className={overdue ? 'font-medium text-danger' : 'text-text-secondary'}>
                      {formatDateTime(task.dueAt)}
                    </dd>
                  </div>
                )}
                {task.blockedAt && (
                  <div>
                    <dt className="text-xs text-text-muted">Blocked</dt>
                    <dd className="text-text-secondary">{formatDate(task.blockedAt)}</dd>
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
                {task.incident && (
                  <div>
                    <dt className="text-xs text-text-muted">Linked Incident</dt>
                    <dd className="font-mono text-xs text-text-secondary">{task.incident.referenceNumber}</dd>
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
