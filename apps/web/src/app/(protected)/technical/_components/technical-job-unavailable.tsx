import Link from 'next/link';
import type { TechnicalJobUnavailable } from '../_lib/technical-job-data';

/** Shown instead of a bare 404 when a job's Technical pages cannot be loaded for a reason other than "job not found". */
export function TechnicalJobUnavailableView({ info }: { info: TechnicalJobUnavailable }): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-xl px-5 py-16 text-center">
      <h1 className="text-xl font-bold text-text-primary">{info.title}</h1>
      <p className="mt-2 text-sm text-text-secondary">{info.message}</p>
      <p className="mt-1 text-xs text-text-muted">Details: {info.detail}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {info.kind === 'session' && (
          <Link href="/login" className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
            Sign in
          </Link>
        )}
        <Link href="/technical" className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-primary hover:bg-surface-secondary">
          Back to Technical Dashboard
        </Link>
      </div>
    </div>
  );
}
