import type { ContractAttachmentSource } from '@/lib/contracts-api';
import { ATTACHMENT_SOURCE_BADGE_CLASSES } from '../../../../_lib/contract-attachment-helpers';

/** CM-64 — source badge for the Attachments / Document Library table, one distinct color per real upload source. */
export function ContractAttachmentSourceBadge({ source, label }: { source: ContractAttachmentSource; label: string }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${ATTACHMENT_SOURCE_BADGE_CLASSES[source]}`}>
      {label}
    </span>
  );
}
