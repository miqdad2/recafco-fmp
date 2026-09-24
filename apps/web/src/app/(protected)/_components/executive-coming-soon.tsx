import { Construction } from 'lucide-react';

interface Props {
  message: string;
}

/**
 * FMP-UI-10 — the placeholder body for a module with no real backend yet
 * (QA/QC, Storage & Delivery). Deliberately just a message, never a fake
 * table/record/metric — "the module is coming, here is honestly all there
 * is to show today."
 */
export function ExecutiveComingSoon({ message }: Props): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-8 text-center">
      <Construction className="mx-auto size-8 text-text-muted" aria-hidden="true" />
      <p className="mt-3 text-base text-text-secondary">{message}</p>
    </div>
  );
}
