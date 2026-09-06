import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';

// ---------------------------------------------------------------------------
// CM-60C — read-only aggregation across the attachment tables that already
// exist for a contract (workflow task attachments, closeout attachments,
// variation attachments; CM-63 added a 4th — Documents & Obligations) — no
// new table, no new upload path here. Each source keeps its own real upload
// flow (Workflow tab, Closeout tab, Variations tab, Documents & Obligations
// tab); this service only lists what already exists, tagged with where it
// came from, and a real download path into that source's own already-scoped
// download endpoint (department access is re-checked there on every
// request, same as everywhere else in this app — this list endpoint itself
// also enforces it below, so nothing here weakens either check).
// ---------------------------------------------------------------------------

export type AttachmentSource = 'WORKFLOW_TASK' | 'CLOSEOUT' | 'VARIATION' | 'DOCUMENT_OBLIGATION';

export const ATTACHMENT_SOURCE_LABELS: Record<AttachmentSource, string> = {
  WORKFLOW_TASK: 'Workflow Task',
  CLOSEOUT: 'Closeout',
  VARIATION: 'Variation / Change Order',
  DOCUMENT_OBLIGATION: 'Documents & Obligations',
};

export interface AggregatedAttachment {
  id: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
  uploadedByUser: { id: string; displayName: string } | null;
  source: AttachmentSource;
  sourceLabel: string;
  /** The real title/name of the record this file was uploaded against (task name, variation description, document/obligation title, "Closeout Request <no>") — never fabricated. */
  relatedItemTitle: string;
  /** The real ContractDocumentObligation category (e.g. "PERFORMANCE_BOND") — only ever populated for source === 'DOCUMENT_OBLIGATION'; null for the other 3 sources, which have no such field. The frontend derives a safe generic category label from `source` itself when this is null. */
  documentObligationCategory: string | null;
  downloadPath: string;
}

const UPLOADER_SELECT = { select: { id: true, displayName: true } } as const;

@Injectable()
export class ContractAttachmentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  async listAllForContract(contractId: string, actor: AuthUser): Promise<AggregatedAttachment[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const contract = await this.db.getClient().contract.findUnique({
      where: { id: contractId },
      select: { id: true, departmentId: true },
    });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);

    const [workflowAttachments, closeoutAttachments, variationAttachments, documentObligationAttachments] = await Promise.all([
      this.db.getClient().contractWorkflowTaskAttachment.findMany({
        where: { task: { contractId } },
        select: {
          id: true,
          taskId: true,
          originalFileName: true,
          mimeType: true,
          fileSize: true,
          createdAt: true,
          uploadedByUser: UPLOADER_SELECT,
          task: { select: { taskName: true } },
        },
      }),
      this.db.getClient().contractCloseoutAttachment.findMany({
        where: { closeoutRequest: { contractId } },
        select: {
          id: true,
          closeoutRequestId: true,
          originalFileName: true,
          mimeType: true,
          fileSize: true,
          createdAt: true,
          uploadedByUser: UPLOADER_SELECT,
          closeoutRequest: { select: { requestNo: true } },
        },
      }),
      this.db.getClient().contractVariationAttachment.findMany({
        where: { variation: { contractId } },
        select: {
          id: true,
          variationId: true,
          originalFileName: true,
          mimeType: true,
          fileSize: true,
          createdAt: true,
          uploadedByUser: UPLOADER_SELECT,
          variation: { select: { description: true } },
        },
      }),
      this.db.getClient().contractDocumentObligationAttachment.findMany({
        where: { documentObligation: { contractId } },
        select: {
          id: true,
          documentObligationId: true,
          originalFileName: true,
          mimeType: true,
          fileSize: true,
          createdAt: true,
          uploadedByUser: UPLOADER_SELECT,
          documentObligation: { select: { title: true, category: true } },
        },
      }),
    ]);

    const merged: AggregatedAttachment[] = [
      ...workflowAttachments.map((a) => ({
        id: a.id,
        originalFileName: a.originalFileName,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
        createdAt: a.createdAt,
        uploadedByUser: a.uploadedByUser,
        source: 'WORKFLOW_TASK' as const,
        sourceLabel: ATTACHMENT_SOURCE_LABELS.WORKFLOW_TASK,
        relatedItemTitle: a.task.taskName,
        documentObligationCategory: null,
        downloadPath: `/contracts/workflow/tasks/${a.taskId}/attachments/${a.id}/download`,
      })),
      ...closeoutAttachments.map((a) => ({
        id: a.id,
        originalFileName: a.originalFileName,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
        createdAt: a.createdAt,
        uploadedByUser: a.uploadedByUser,
        source: 'CLOSEOUT' as const,
        sourceLabel: ATTACHMENT_SOURCE_LABELS.CLOSEOUT,
        relatedItemTitle: `Closeout Request ${a.closeoutRequest.requestNo}`,
        documentObligationCategory: null,
        downloadPath: `/contracts/closeout/${a.closeoutRequestId}/attachments/${a.id}/download`,
      })),
      ...variationAttachments.map((a) => ({
        id: a.id,
        originalFileName: a.originalFileName,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
        createdAt: a.createdAt,
        uploadedByUser: a.uploadedByUser,
        source: 'VARIATION' as const,
        sourceLabel: ATTACHMENT_SOURCE_LABELS.VARIATION,
        relatedItemTitle: a.variation.description,
        documentObligationCategory: null,
        downloadPath: `/contracts/${contractId}/variations/${a.variationId}/attachments/${a.id}/download`,
      })),
      ...documentObligationAttachments.map((a) => ({
        id: a.id,
        originalFileName: a.originalFileName,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
        createdAt: a.createdAt,
        uploadedByUser: a.uploadedByUser,
        source: 'DOCUMENT_OBLIGATION' as const,
        sourceLabel: ATTACHMENT_SOURCE_LABELS.DOCUMENT_OBLIGATION,
        relatedItemTitle: a.documentObligation.title,
        documentObligationCategory: a.documentObligation.category,
        downloadPath: `/contracts/${contractId}/document-obligations/${a.documentObligationId}/attachments/${a.id}/download`,
      })),
    ];

    merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return merged;
  }
}
