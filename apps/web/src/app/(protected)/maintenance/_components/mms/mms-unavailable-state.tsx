import { CloudOff } from 'lucide-react';

interface Props {
  message: string;
}

// FMP-MAINT-03 — calm, intentional placeholder for a section with no live
// data (MMS not configured / not deployed / offline / restricted), so the
// page reads as "waiting for MMS", not "broken".
export function MmsUnavailableState({ message }: Props): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface px-6 py-8 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-surface-secondary text-text-muted">
        <CloudOff className="size-5" aria-hidden="true" />
      </span>
      <p className="max-w-md text-sm text-text-secondary">{message}</p>
    </div>
  );
}
