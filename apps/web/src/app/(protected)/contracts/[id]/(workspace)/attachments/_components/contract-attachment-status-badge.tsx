/** CM-64B — every listed file is, by definition, a real uploaded file: "Uploaded" is the only honest status until a real global attachment approval workflow exists (it doesn't). Never Approved/Pending Review. */
export function ContractAttachmentStatusBadge({ status }: { status: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-center rounded-full bg-success-light px-2.5 py-0.5 text-xs font-semibold text-success whitespace-nowrap">
      {status}
    </span>
  );
}
