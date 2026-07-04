import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { ContractLifecycleBadge } from '../_components/contract-lifecycle-badge';
import { contractsApi } from '../../../../lib/contracts-api';
import {
  activateContractAction,
  terminateContractAction,
  closeContractAction,
  addContractCommentAction,
} from '../actions';

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

export default async function ContractDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [jwtRes, contractRes, commentsRes, activitiesRes] = await Promise.allSettled([
    getJwtPayload(),
    contractsApi.get(id),
    contractsApi.listComments(id),
    contractsApi.listActivities(id),
  ]);

  if (contractRes.status === 'rejected') notFound();

  const contract = (contractRes as PromiseFulfilledResult<Awaited<ReturnType<typeof contractsApi.get>>>).value;
  const comments = commentsRes.status === 'fulfilled' ? commentsRes.value : [];
  const activities = activitiesRes.status === 'fulfilled' ? activitiesRes.value : [];

  const payload = jwtRes.status === 'fulfilled' ? jwtRes.value : {};
  const permissions = Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [];

  const canUpdate = permissions.includes('contracts.update');
  const canActivate = permissions.includes('contracts.activate');
  const canTerminate = permissions.includes('contracts.terminate');
  const canClose = permissions.includes('contracts.close');
  const canComment = permissions.includes('contracts.comment');

  const isDraft = contract.status === 'DRAFT';
  const isActive = contract.status === 'ACTIVE';
  const isTerminated = contract.status === 'TERMINATED';

  const canEdit = isDraft && canUpdate;
  const canDoActivate = isDraft && canActivate;
  const canDoTerminate = isActive && canTerminate;
  const canDoClose = (isActive || isTerminated) && canClose;

  async function handleActivate(): Promise<void> {
    'use server';
    await activateContractAction(id, contract.version);
  }
  async function handleClose(): Promise<void> {
    'use server';
    await closeContractAction(id, contract.version);
  }
  async function handleTerminate(formData: FormData): Promise<void> {
    'use server';
    await terminateContractAction(id, contract.version, { error: null }, formData);
  }
  async function handleComment(formData: FormData): Promise<void> {
    'use server';
    await addContractCommentAction(id, { error: null }, formData);
  }

  const hasTransitions = canDoActivate || canDoTerminate || canDoClose;

  return (
    <div className="min-h-full p-8">
      <div className="max-w-5xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Contracts Management', href: '/contracts' },
          { label: contract.referenceNumber },
        ]} />

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-semibold text-text-primary">{contract.title}</h1>
              <ContractLifecycleBadge status={contract.lifecycleStatus} />
            </div>
            <p className="text-sm text-text-muted font-mono">{contract.referenceNumber}</p>
          </div>
          {canEdit && (
            <Link
              href={`/contracts/${contract.id}/edit`}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Edit
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {contract.description && (
              <section className="rounded-lg border border-border bg-surface p-5">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Description</h2>
                <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{contract.description}</p>
              </section>
            )}

            {/* Counterparty */}
            <section className="rounded-lg border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Counterparty</h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-text-muted">Name</dt>
                  <dd className="font-medium text-text-primary">{contract.counterpartyName}</dd>
                </div>
                {contract.counterpartyContact && (
                  <div>
                    <dt className="text-text-muted">Contact</dt>
                    <dd className="text-text-primary">{contract.counterpartyContact}</dd>
                  </div>
                )}
              </dl>
            </section>

            {/* Financial */}
            {(contract.contractValue ?? contract.currency) && (
              <section className="rounded-lg border border-border bg-surface p-5">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Financial</h2>
                <dl className="space-y-2 text-sm">
                  {contract.contractValue && (
                    <div>
                      <dt className="text-text-muted">Value</dt>
                      <dd className="font-medium text-text-primary">
                        {contract.currency ? `${contract.contractValue} ${contract.currency}` : contract.contractValue}
                      </dd>
                    </div>
                  )}
                  {contract.currency && !contract.contractValue && (
                    <div>
                      <dt className="text-text-muted">Currency</dt>
                      <dd className="font-medium text-text-primary">{contract.currency}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {/* Dates */}
            {(contract.startDate ?? contract.endDate ?? contract.renewalNoticeDate) && (
              <section className="rounded-lg border border-border bg-surface p-5">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Dates</h2>
                <dl className="space-y-2 text-sm">
                  {contract.startDate && (
                    <div>
                      <dt className="text-text-muted">Start</dt>
                      <dd className="font-medium text-text-primary">{formatDate(contract.startDate)}</dd>
                    </div>
                  )}
                  {contract.endDate && (
                    <div>
                      <dt className="text-text-muted">End</dt>
                      <dd className="font-medium text-text-primary">{formatDate(contract.endDate)}</dd>
                    </div>
                  )}
                  {contract.renewalNoticeDate && (
                    <div>
                      <dt className="text-text-muted">Renewal Notice By</dt>
                      <dd className="font-medium text-text-primary">{formatDate(contract.renewalNoticeDate)}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {/* Notes */}
            {contract.notes && (
              <section className="rounded-lg border border-border bg-surface p-5">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Notes</h2>
                <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{contract.notes}</p>
              </section>
            )}

            {/* Termination reason */}
            {contract.terminationReason && (
              <section className="rounded-lg border border-border bg-surface-secondary p-5">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">Termination Reason</h2>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{contract.terminationReason}</p>
                {contract.terminatedAt && (
                  <p className="mt-2 text-xs text-text-muted">
                    Terminated {formatDateTime(contract.terminatedAt)}
                    {contract.terminatedByUser && ` by ${contract.terminatedByUser.displayName}`}
                  </p>
                )}
              </section>
            )}

            {/* Transitions */}
            {hasTransitions && (
              <section className="rounded-lg border border-border bg-surface p-5">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">Actions</h2>
                <div className="space-y-4">
                  {canDoActivate && (
                    <form action={handleActivate}>
                      <button
                        type="submit"
                        className="rounded-md bg-success px-4 py-2 text-sm font-medium text-white hover:bg-success/90 focus:outline-none focus:ring-2 focus:ring-focus"
                      >
                        Activate Contract
                      </button>
                    </form>
                  )}

                  {canDoClose && (
                    <form action={handleClose}>
                      <button
                        type="submit"
                        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
                      >
                        Close Contract
                      </button>
                    </form>
                  )}

                  {canDoTerminate && (
                    <form action={handleTerminate} className="space-y-2">
                      <div>
                        <label htmlFor="reason" className="block text-xs font-medium text-text-secondary mb-1">
                          Termination reason <span className="text-danger">*</span>
                        </label>
                        <textarea
                          id="reason"
                          name="reason"
                          rows={2}
                          required
                          maxLength={2000}
                          placeholder="State the reason for termination…"
                          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
                        />
                      </div>
                      <button
                        type="submit"
                        className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90 focus:outline-none focus:ring-2 focus:ring-focus"
                      >
                        Terminate Contract
                      </button>
                    </form>
                  )}
                </div>
              </section>
            )}

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
                          {c.authorUser.displayName}
                        </span>
                        <span className="text-xs text-text-muted">{formatDateTime(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-text-secondary whitespace-pre-wrap">{c.body}</p>
                    </div>
                  ))}
                </div>
              )}
              {canComment && (
                <form action={handleComment} className="mt-4 border-t border-border pt-4">
                  <label htmlFor="comment-body" className="block text-xs font-medium text-text-secondary mb-1">
                    Add comment
                  </label>
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
                  <dt className="text-text-muted">Owner</dt>
                  <dd className="font-medium text-text-primary">{contract.ownerUser.displayName}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Created by</dt>
                  <dd className="font-medium text-text-primary">{contract.createdByUser.displayName}</dd>
                </div>
                {contract.department && (
                  <div>
                    <dt className="text-text-muted">Department</dt>
                    <dd className="font-medium text-text-primary">{contract.department.name}</dd>
                  </div>
                )}
                {contract.plant && (
                  <div>
                    <dt className="text-text-muted">Plant</dt>
                    <dd className="font-medium text-text-primary">{contract.plant.name}</dd>
                  </div>
                )}
                {contract.location && (
                  <div>
                    <dt className="text-text-muted">Location</dt>
                    <dd className="font-medium text-text-primary">{contract.location.name}</dd>
                  </div>
                )}
                <div className="border-t border-border pt-2 mt-2">
                  <dt className="text-text-muted">Created</dt>
                  <dd className="text-text-secondary">{formatDateTime(contract.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Updated</dt>
                  <dd className="text-text-secondary">{formatDateTime(contract.updatedAt)}</dd>
                </div>
                {contract.activatedAt && (
                  <div>
                    <dt className="text-text-muted">Activated</dt>
                    <dd className="text-text-secondary">
                      {formatDateTime(contract.activatedAt)}
                      {contract.activatedByUser && ` by ${contract.activatedByUser.displayName}`}
                    </dd>
                  </div>
                )}
                {contract.terminatedAt && (
                  <div>
                    <dt className="text-text-muted">Terminated</dt>
                    <dd className="text-text-secondary">
                      {formatDateTime(contract.terminatedAt)}
                      {contract.terminatedByUser && ` by ${contract.terminatedByUser.displayName}`}
                    </dd>
                  </div>
                )}
                {contract.closedAt && (
                  <div>
                    <dt className="text-text-muted">Closed</dt>
                    <dd className="text-text-secondary">
                      {formatDateTime(contract.closedAt)}
                      {contract.closedByUser && ` by ${contract.closedByUser.displayName}`}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
