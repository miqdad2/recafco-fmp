import { AddActivityButton } from './add-activity-button';

/**
 * FMP-SALES-09 — the two things a manager does on an enquiry page: Add Activity (red; a next follow-up is set inside it)
 * and the status control (passed in as `statusSlot`). FMP-SALES-19: the status control is the "Set Status" button area,
 * shown below Add Activity. Edit Enquiry stays a secondary action in the page header.
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
    <div className="space-y-5">
      <div><AddActivityButton enquiryId={enquiryId} companyName={companyName} today={today} /></div>
      {statusSlot && <div className="border-t border-border pt-4">{statusSlot}</div>}
    </div>
  );
}
