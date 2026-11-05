import { AddActivityButton } from './add-activity-button';

/**
 * FMP-SALES-09 — the two things a manager does on an enquiry page: Add Activity (red; a next follow-up is set inside it)
 * and Change Status (amber, passed in as `statusSlot`). Edit Enquiry stays a secondary action in the page header.
 * Rendered only for users with sales.update (the API enforces it again).
 */
interface Props {
  enquiryId: string;
  companyName: string;
  today: string;
  statusSlot?: React.ReactNode;
}

export function EnquiryActions({ enquiryId, companyName, today, statusSlot }: Props): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <AddActivityButton enquiryId={enquiryId} companyName={companyName} today={today} />
      {statusSlot}
    </div>
  );
}
