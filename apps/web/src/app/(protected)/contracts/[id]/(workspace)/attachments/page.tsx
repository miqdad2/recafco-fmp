import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { computeAttachmentSourceCounts } from '../../../_lib/contract-attachment-helpers';
import { ContractAttachmentKpiStrip } from './_components/contract-attachment-kpi-strip';
import { ContractAttachmentPanel } from './_components/contract-attachment-panel';

export const metadata: Metadata = { title: 'Attachments / Document Library — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * CM-64 — Attachments / Document Library, simplified approved-design build.
 * A read-only central view/download/export library for every real file
 * already uploaded through Workflow & Team Tasks, Variations / Change
 * Orders, Documents & Obligations, or Closeout — no upload path of its own
 * (no general contract-level attachment model exists, so an "Upload File"
 * action here would either be fake or a duplicate upload path; real uploads
 * stay in each source tab). No Storage Summary, Document Status Overview,
 * Quick Links, or Supported Formats sidebar — none of those are backed by
 * real data (no storage-quota tracking, no attachment approval workflow
 * exists anywhere in this app) and the approved design's own instruction
 * was to remove them rather than fabricate the data behind them. KPI counts
 * are real per-source file counts only (Total/Workflow/Variation/Documents
 * & Obligations/Closeout) — no Pending Review/Approved/Expiring/Missing
 * Required, for the same reason.
 * CM-64B — KPI labels/subtexts reworded to a document-library-friendly
 * tone (Workflow Documents/Variation Documents/etc., not "...Files"); the
 * table gained real Category (derived — real Documents & Obligations
 * category when available, otherwise a safe source-derived label like
 * "Workflow Document") and Status ("Uploaded" always, never a fabricated
 * Approved/Pending Review) columns; "Related Item" renamed "Related To".
 * No Category filter added (kept optional per this unit's own instruction
 * — the filter row already has Search/Source/Uploaded By/Date Range and
 * adding a 5th would crowd it without a clear need, since Category is
 * already searchable via the main search box).
 * CM-64C — pure visual polish: Contract Summary card padding/gaps trimmed
 * for a more compact card; File Name link and the Variation source badge
 * recolored away from this theme's `accent` token (RECAFCO brand red,
 * reads as an error state) to real link/neutral colors. Same data,
 * filters, downloads, and export as CM-64B.
 * CM-64D — Contract Summary card removed entirely: the user is already
 * inside the contract workspace, and the layout's own header (contract
 * name/status/ID/dates) already provides that context — this tab now
 * fetches only what its own KPI strip/table need
 * (contractsApi.getContractAttachments()), not the full Contract entity,
 * and goes straight from the page title into the KPI strip.
 */
export default async function ContractAttachmentsTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [permissions, attachments] = await Promise.all([
    getUserPermissions(),
    contractsApi.getContractAttachments(id).catch(() => null),
  ]);
  if (!permissions.includes('contracts.read') || !attachments) notFound();

  const counts = computeAttachmentSourceCounts(attachments);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-text-primary">Attachments / Document Library</h1>
        <p className="text-xs text-text-secondary mt-0.5">
          Central repository for all contract-related documents and files.
        </p>
      </div>

      <ContractAttachmentKpiStrip counts={counts} />

      <ContractAttachmentPanel contractId={id} attachments={attachments} />
    </div>
  );
}
