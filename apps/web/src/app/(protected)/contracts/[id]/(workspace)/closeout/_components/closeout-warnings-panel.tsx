import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
  warnings: string[];
}

export function CloseoutWarningsPanel({ warnings }: Props): React.JSX.Element {
  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success-light px-4 py-3 text-sm text-success">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
        No outstanding items — this contract is ready for closeout review.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-warning/30 bg-warning-light px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-warning mb-2">
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        Closeout Warnings
      </div>
      <ul className="space-y-1 text-sm text-warning">
        {warnings.map((w) => (
          <li key={w} className="flex items-start gap-1.5">
            <span aria-hidden="true">•</span>
            <span>{w}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
