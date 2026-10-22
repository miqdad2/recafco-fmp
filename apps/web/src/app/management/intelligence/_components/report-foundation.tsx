import { AlertCircle, Clock, Inbox, Link2Off, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * FMP-MIC-01 — presentation building blocks for the Management Intelligence pages. None of them
 * fetches or invents data: a page passes in whatever the Factory Management integration
 * eventually returns. Until then pages render only <ConnectionPending />.
 */

export function ConnectionPending({ title, text }: { title: string; text: string }): React.JSX.Element {
  return (
    <section
      role="status"
      aria-label={title}
      className="flex items-start gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-warning-light text-warning">
        <Link2Off className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-text-primary sm:text-lg">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-text-secondary sm:text-base">{text}</p>
      </div>
    </section>
  );
}

interface PanelProps {
  title: string;
  text?: string;
}

function StatePanel({ icon: Icon, tone, title, text, role }: PanelProps & { icon: LucideIcon; tone: string; role: 'status' | 'alert' }): React.JSX.Element {
  return (
    <div role={role} className="flex flex-col items-center rounded-xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
      <Icon className={`size-8 ${tone}`} aria-hidden="true" />
      <p className="mt-3 text-base font-semibold text-text-primary">{title}</p>
      {text && <p className="mt-1 max-w-md text-sm text-text-secondary">{text}</p>}
    </div>
  );
}

export function EmptyState(props: PanelProps): React.JSX.Element {
  return <StatePanel {...props} icon={Inbox} tone="text-text-muted" role="status" />;
}

export function ErrorState(props: PanelProps): React.JSX.Element {
  return <StatePanel {...props} icon={AlertCircle} tone="text-error" role="alert" />;
}

export function LoadingState({ title = 'Loading…' }: { title?: string }): React.JSX.Element {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 rounded-xl border border-border bg-surface px-6 py-10 text-sm text-text-secondary">
      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      {title}
    </div>
  );
}

export function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <p className="text-sm font-medium text-text-secondary">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-text-primary">{value}</p>
      {hint && <p className="mt-1 text-sm text-text-muted">{hint}</p>}
    </div>
  );
}

export function ChartContainer({ title, description, children }: { title: string; description?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-text-secondary">{description}</p>}
      <div className="mt-4 min-h-48">{children}</div>
    </section>
  );
}

/** Shows when the figures on screen were last refreshed from the source; renders nothing until a real timestamp exists. */
export function DataFreshness({ updatedAt }: { updatedAt: Date | null }): React.JSX.Element | null {
  if (!updatedAt) return null;
  return (
    <p className="inline-flex items-center gap-1.5 text-sm text-text-muted">
      <Clock className="size-4" aria-hidden="true" />
      Updated <time dateTime={updatedAt.toISOString()}>{updatedAt.toLocaleString()}</time>
    </p>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  id: string;
  label: string;
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
}

function FilterSelect({ id, label, options, value, onChange }: FilterSelectProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text-secondary">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 min-w-48 rounded-lg border border-border-strong bg-surface px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Controlled selectors for later use; no page mounts them until the integration supplies real options. */
export function ProjectSelector(props: Omit<FilterSelectProps, 'label'>): React.JSX.Element {
  return <FilterSelect {...props} label="Project" />;
}

export function PeriodFilter(props: Omit<FilterSelectProps, 'label'>): React.JSX.Element {
  return <FilterSelect {...props} label="Period" />;
}
