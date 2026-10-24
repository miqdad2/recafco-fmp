import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { operationsApi, type ProjectListItem, type ProjectMatchItem, type ProjectsOverview } from '@/lib/operations-api';
import { plants } from '@/lib/organizations-api';
import { getUserPermissions } from '../_lib/get-user-permissions';
import { isContractStaffOnlyAccess } from '../../_lib/module-visibility';
import { formatAge, formatKuwaitDateTime, outcomeLabel } from '../_lib/operations-progress-helpers';
import {
  ConfirmLinkButton,
  DeleteMappingButton,
  FactoryMappingForm,
  RegisterProjectForm,
} from '../_components/operations-client-parts';

const EXCLUSION_TEXT: Record<string, string> = {
  TRAINING: 'Training project',
  CONFIGURED_EXCLUSION: 'Test project (configured exclusion)',
  TRAINING_STATUS_UNKNOWN: 'Source did not say whether this is a training project',
  NO_FACTORY: 'No factory reported',
};

export const metadata: Metadata = { title: 'Operations project links — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="space-y-2" aria-label={title}>
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {hint && <p className="text-sm text-text-secondary">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="rounded-md border border-dashed border-border bg-surface px-4 py-3 text-sm text-text-muted">{children}</p>;
}

function ProjectName({ p }: { p: ProjectListItem }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-text-primary">{p.name ?? 'Name not read yet'}</p>
      <p className="truncate text-xs text-text-muted">
        {p.sourceProjectId} · job order {p.jobOrder ?? '—'} · factory {p.factory ?? '—'}
      </p>
    </div>
  );
}

function Freshness({ p }: { p: ProjectListItem }): React.JSX.Element {
  if (!p.hasData) return <span className="text-text-muted">{p.lastOutcome ? outcomeLabel(p.lastOutcome) : 'No update yet'}</span>;
  return (
    <span className={p.stale ? 'text-warning' : 'text-text-secondary'}>
      {formatKuwaitDateTime(p.lastSuccessfulRetrievalAt)} ({formatAge(p.lastSuccessfulRetrievalAt)}){p.stale ? ' · not up to date' : ''}
    </span>
  );
}

function MatchCard({ item, canLink, tone }: { item: ProjectMatchItem; canLink: boolean; tone: 'normal' | 'conflict' }): React.JSX.Element {
  return (
    <li className={`rounded-lg border bg-surface p-4 shadow-sm ${tone === 'conflict' ? 'border-warning' : 'border-border'}`}>
      <ProjectName p={item.project} />
      <p className="mt-1 text-sm text-text-secondary">{item.summary}</p>
      <ul className="mt-3 space-y-3">
        {item.candidates.map((c) => (
          <li key={c.contractId} className="rounded-md border border-border bg-surface-secondary p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/contracts/${c.contractId}`} className="font-medium text-info hover:underline">
                  {c.referenceNumber} — {c.title}
                </Link>
                <ul className="mt-1 list-disc pl-5 text-sm text-text-secondary">
                  {c.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {c.blockers.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-sm text-warning">
                    {c.blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
              {canLink && !c.blockers.some((b) => b.includes('already linked')) && (
                <ConfirmLinkButton projectId={item.project.id} contractId={c.contractId} label="Confirm this link" requireReason={c.blockers.length > 0} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </li>
  );
}

export default async function OperationsLinksPage(): Promise<React.JSX.Element> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) notFound();
  // Task-only Contract Staff accounts work from My Tasks and never see the manager monitoring screens.
  if (isContractStaffOnlyAccess(permissions)) redirect('/contracts/workflow?mode=my-tasks');
  const canLink = permissions.includes('contracts.operations_link');

  let overview: ProjectsOverview | null = null;
  try {
    overview = await operationsApi.projects();
  } catch {
    overview = null;
  }
  if (overview === null) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-5">
        <div role="alert" className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Operations project links could not be loaded. Contract information is not affected. Please refresh the page.
        </div>
      </div>
    );
  }

  let plantOptions: { id: string; code: string; name: string }[] = [];
  if (canLink) {
    try {
      plantOptions = (await plants.list({ isActive: true, pageSize: 100 })).items.map((p) => ({ id: p.id, code: p.code, name: p.name }));
    } catch {
      plantOptions = [];
    }
  }

  const c = overview.connection;

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-5 lg:px-6">
      <div>
        <Link href="/contracts" className="text-sm text-info hover:underline">← Contract List</Link>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-text-primary">Operations project links</h1>
        <p className="mt-1.5 text-sm text-text-secondary">
          Connects FMP contracts to projects in the Operations system. FMP only reads from Operations; nothing here creates or changes a project there.
        </p>
      </div>

      <div
        role="status"
        className={`rounded-md border px-4 py-3 text-sm ${c.liveSyncActive && c.state === 'OK' ? 'border-success bg-success-light text-success' : 'border-warning bg-warning-light text-warning'}`}
      >
        <p className="font-medium">{c.liveSyncActive ? 'Automatic updates are active' : 'Live synchronization is not active'}</p>
        <p>{c.message}</p>
      </div>

      {c.authMode === 'demo' && (
        <p role="status" className="rounded-md border border-warning bg-warning-light px-4 py-3 text-sm text-warning">
          <span className="font-semibold">Demo sign-in.</span> FMP is signed in through the source&apos;s demo sign-in, not a dedicated integration account. It works
          only while the source keeps its demo access available.
        </p>
      )}

      <p className="rounded-md border border-info bg-info-light px-4 py-3 text-sm text-info">
        {overview.discovery.reason}
        {c.discovery.lastAt ? <span className="block text-xs">Last discovery run {formatKuwaitDateTime(c.discovery.lastAt)} ({formatAge(c.discovery.lastAt)}): {outcomeLabel(c.discovery.outcome)}.</span> : null}
      </p>

      <Section title={`Linked projects (${overview.linked.length})`}>
        {overview.linked.length === 0 ? (
          <Empty>No contract is linked to an Operations project yet.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-secondary text-xs text-text-secondary">
                <tr>
                  <th className="px-3 py-2 font-medium">Contract</th>
                  <th className="px-3 py-2 font-medium">Operations project</th>
                  <th className="px-3 py-2 font-medium">Linked</th>
                  <th className="px-3 py-2 font-medium">Last successful update</th>
                </tr>
              </thead>
              <tbody>
                {overview.linked.map((p) => (
                  <tr key={p.id} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      {p.contract ? (
                        <Link href={`/contracts/${p.contract.id}/operations`} className="font-medium text-info hover:underline">
                          {p.contract.referenceNumber} — {p.contract.title}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2"><ProjectName p={p} /></td>
                    <td className="px-3 py-2 text-text-secondary">
                      {p.linkMethod === 'AUTOMATIC' ? 'Automatically' : 'By a user'}
                      {p.linkedAt ? <span className="block text-xs text-text-muted">{formatKuwaitDateTime(p.linkedAt)}{p.linkedByName ? ` · ${p.linkedByName}` : ''}</span> : null}
                    </td>
                    <td className="px-3 py-2"><Freshness p={p} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={`Suggested matches (${overview.suggested.length})`} hint="Possible contracts for projects that are not linked yet. Please confirm before they are linked.">
        {overview.suggested.length === 0 ? (
          <Empty>No suggestions at the moment.</Empty>
        ) : (
          <ul className="space-y-3">
            {overview.suggested.map((m) => (
              <MatchCard key={m.project.id} item={m} canLink={canLink} tone="normal" />
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Conflicts needing review (${overview.conflicts.length})`} hint="More than one possible match, or a contract that is already linked elsewhere. A person must decide.">
        {overview.conflicts.length === 0 ? (
          <Empty>No conflicts.</Empty>
        ) : (
          <ul className="space-y-3">
            {overview.conflicts.map((m) => (
              <MatchCard key={m.project.id} item={m} canLink={canLink} tone="conflict" />
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Projects awaiting a contract link (${overview.awaiting.length})`}>
        {overview.awaiting.length === 0 ? (
          <Empty>No projects are waiting.</Empty>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface shadow-sm">
            {overview.awaiting.map((m) => (
              <li key={m.project.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <ProjectName p={m.project} />
                <span className="text-sm text-text-secondary">{m.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {overview.excluded.length > 0 && (
        <details className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-text-primary">Excluded from linking ({overview.excluded.length})</summary>
          <p className="mt-2 text-xs text-text-muted">
            Training and test projects found in the source. They are never suggested, linked or reported on, and no progress is fetched for them.
          </p>
          <ul className="mt-2 divide-y divide-border text-sm">
            {overview.excluded.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <ProjectName p={p} />
                <span className="text-xs text-text-secondary">{EXCLUSION_TEXT[p.excludedReason ?? ''] ?? 'Excluded'}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {canLink ? (
        <>
          <Section title="Add a known Operations project" hint="Enter the project id from the Operations system. FMP then reads its job order and factory and suggests or makes the link.">
            <div className="rounded-lg border border-border bg-surface p-4 shadow-sm"><RegisterProjectForm /></div>
          </Section>

          <Section
            title="Factory codes"
            hint="Automatic linking compares the source factory (for example PC or HC) with the contract's plant. Map each factory code to the plant it belongs to."
          >
            <div className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
              {overview.unmappedFactories.length > 0 && (
                <p className="text-sm text-warning">Not mapped yet: {overview.unmappedFactories.join(', ')}. Without a mapping these projects are only suggested, never linked automatically.</p>
              )}
              {overview.factoryMappings.length > 0 && (
                <ul className="divide-y divide-border text-sm">
                  {overview.factoryMappings.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                      <span><span className="font-medium text-text-primary">{m.factoryCode}</span> → {m.plant.name} ({m.plant.code})</span>
                      <DeleteMappingButton id={m.id} />
                    </li>
                  ))}
                </ul>
              )}
              <FactoryMappingForm plants={plantOptions} />
            </div>
          </Section>
        </>
      ) : (
        <p className="text-sm text-text-muted">Confirming or changing links needs the “Manage Operations project links” permission.</p>
      )}
    </div>
  );
}
