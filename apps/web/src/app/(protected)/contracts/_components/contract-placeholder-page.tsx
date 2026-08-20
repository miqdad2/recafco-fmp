import { Breadcrumbs } from '../../_components/breadcrumbs';

interface Props {
  breadcrumbLabel: string;
  title: string;
  subtitle: string;
  body: string;
}

/** Shared shell for module-level Contract Management pages that have no backend yet (Schedule, Payments, Issue Log, Claim Log) — never renders fake data, always says plainly that the backend isn't built. */
export function ContractPlaceholderPage({ breadcrumbLabel, title, subtitle, body }: Props): React.JSX.Element {
  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1920px] mx-auto space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Contract Management', href: '/contracts/dashboard' },
          { label: breadcrumbLabel },
        ]}
      />

      <div>
        <h1 className="text-3xl font-semibold text-text-primary tracking-tight">{title}</h1>
        <p className="mt-1.5 text-sm text-text-secondary max-w-2xl">{subtitle}</p>
      </div>

      <section className="rounded-lg border border-border bg-surface p-10 text-center">
        <span className="inline-flex items-center rounded-full bg-surface-secondary px-3 py-1 text-xs font-medium text-text-muted mb-4">
          Not started
        </span>
        <p className="text-sm text-text-secondary max-w-xl mx-auto">{body}</p>
      </section>
    </div>
  );
}
