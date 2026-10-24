import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { getUserPermissions } from '../contracts/_lib/get-user-permissions';
import { canAccessPreviousWorkflow } from '../_lib/access-mode';

export const metadata: Metadata = { title: 'Previous Internal Workflow — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface Entry {
  title: string;
  description: string;
  href: string;
  /** Existing gate of that screen; the destination also enforces it on the server. */
  permission: string;
}

const ENTRIES: Entry[] = [
  { title: 'Technical', description: 'Drawing, approval and final-drawing workflow recorded inside FMP.', href: '/technical', permission: 'technical.read' },
  { title: 'Production & Planning', description: 'Production orders, lines and element production recorded inside FMP.', href: '/production/dashboard', permission: 'production.read' },
  { title: 'Storage Yard & Delivery', description: 'Storage yard and element delivery records kept inside FMP.', href: '/storage-delivery/pieces', permission: 'storage_delivery.read' },
  { title: 'Erection', description: 'Erection workflow dashboard and checklists kept inside FMP.', href: '/contracts/erection-dashboard', permission: 'contracts.read' },
  { title: 'Piece Erection', description: 'Element-by-element erection records kept inside FMP.', href: '/erection/pieces', permission: 'erection.read' },
];

/**
 * FMP-OPS-02 — the Previous Internal Workflow area. The old operational screens, routes, tables, permissions and
 * records are all preserved; they are simply no longer part of contract monitoring. Current operational progress
 * comes from the Operations system and is shown inside each contract. Visible only to administrators and existing
 * workflow users (see canAccessPreviousWorkflow); each destination still enforces its own permission.
 */
export default async function PreviousWorkflowPage(): Promise<React.JSX.Element> {
  const permissions = await getUserPermissions();
  if (!canAccessPreviousWorkflow(permissions)) notFound();
  const entries = ENTRIES.filter((e) => permissions.includes(e.permission));

  return (
    <div className="mx-auto max-w-[1000px] space-y-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Previous Internal Workflow</h1>
        <p className="mt-2 text-base text-text-secondary">
          These are FMP&apos;s earlier operational screens. They are kept for history and for the people who still use them. They are not the current
          operational process.
        </p>
      </div>

      <div className="rounded-md border border-info bg-info-light px-4 py-3 text-sm text-info">
        Current Technical, Production, Delivery and Erection progress comes from the Operations system and is shown inside each contract. Figures here are
        FMP&apos;s own earlier records and are not combined with it.
      </div>

      {entries.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-surface px-4 py-6 text-sm text-text-muted">
          You do not have access to any of the earlier workflow screens.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {entries.map((e) => (
            <li key={e.href}>
              <Link
                href={e.href}
                className="flex h-full items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-focus"
              >
                <span>
                  <span className="block text-lg font-semibold text-text-primary">{e.title}</span>
                  <span className="mt-1 block text-sm text-text-secondary">{e.description}</span>
                </span>
                <ArrowRight className="mt-1 size-5 shrink-0 text-text-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
