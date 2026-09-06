import { Paperclip, GitBranch, ClipboardList, FolderCheck, Archive } from 'lucide-react';
import { DashboardKpiCard } from '../../../../dashboard/_components/dashboard-kpi-card';
import type { AttachmentSourceCounts } from '../../../../_lib/contract-attachment-helpers';

interface Props {
  counts: AttachmentSourceCounts;
}

/**
 * CM-64 — five KPI cards for the Attachments / Document Library tab: real
 * per-source file counts only (see computeAttachmentSourceCounts()). No
 * Pending Review/Approved/Expiring/Missing Required cards — there is no
 * real global attachment approval/review workflow behind a generic
 * uploaded file, and inventing one would be fake data (the earlier stub's
 * "File Status" section was already removed for this same reason in
 * CM-60C — this unit keeps that decision).
 * CM-64B — labels reworded to a document-library-friendly tone (Workflow
 * Documents/Variation Documents/Documents & Obligations/Closeout Documents,
 * not "...Files") and subtexts matched to the approved copy exactly. Each
 * card's value text is also color-coded via `valueClassName` (same accent
 * family as its icon) for a stronger, more "executive" look — the same
 * polish already applied to every other contract-detail KPI strip, without
 * touching DashboardKpiCard's shared icon/value sizing (that's used by many
 * other pages, out of scope here). Same real counts, same removed cards —
 * wording/styling only.
 */
export function ContractAttachmentKpiStrip({ counts }: Props): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <DashboardKpiCard label="Total Files" value={counts.totalFiles} icon={Paperclip} accent="info" valueClassName="text-info" subtext="All contract files" status="ok" />
      <DashboardKpiCard label="Workflow Documents" value={counts.workflowFiles} icon={ClipboardList} accent="accent" valueClassName="text-accent" subtext="Workflow & Team Tasks" status="ok" />
      <DashboardKpiCard label="Variation Documents" value={counts.variationFiles} icon={GitBranch} accent="warning" valueClassName="text-warning" subtext="Variations / Change Orders" status="ok" />
      <DashboardKpiCard label="Documents & Obligations" value={counts.documentObligationFiles} icon={FolderCheck} accent="teal" valueClassName="text-teal" subtext="Required documents" status="ok" />
      <DashboardKpiCard label="Closeout Documents" value={counts.closeoutFiles} icon={Archive} accent="success" valueClassName="text-success" subtext="Closeout" status="ok" />
    </div>
  );
}
