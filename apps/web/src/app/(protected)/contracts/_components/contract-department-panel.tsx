import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { DeptLink, DeptStat } from '../_lib/contract-department-helpers';

interface Props {
  title: string;
  subtitle: string;
  stats: DeptStat[];
  link: DeptLink | null;
  /** True when the underlying data could not be loaded at all. */
  loadError?: boolean;
}

/**
 * FMP-CONTRACT-DETAIL-01 — read-only, selected-contract summary used by the Technical, Production & Planning,
 * Delivery and Erection tabs. Cards only; every update stays on the existing department screen behind `link`.
 */
export function ContractDepartmentPanel({ title, subtitle, stats, link, loadError }: Props): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
          <p className="text-sm text-text-secondary">{subtitle}</p>
        </div>
        {link && (
          <Link
            href={link.href}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            {link.label}
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        )}
      </div>

      {loadError ? (
        <div role="alert" className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          This contract&apos;s {title.toLowerCase()} information could not be loaded. Please refresh the page.
        </div>
      ) : (
        <section aria-label={`${title} summary`}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-surface px-4 py-3 shadow-sm">
                <p className="text-xs font-medium text-text-secondary">{s.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary" title={s.value === null ? s.hint : undefined}>
                  {s.value ?? '—'}
                </p>
                {s.hint && <p className="mt-1 text-[11px] leading-snug text-text-muted">{s.hint}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
