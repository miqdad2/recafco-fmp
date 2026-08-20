interface Option {
  key: string;
  label: string;
}

interface Props {
  title: string;
  options: Option[];
  selected?: Record<string, boolean | string> | undefined;
  /** Option key whose badge should append a free-text detail (e.g. 'other' + scopeOfWork.otherDescription). */
  descriptionKey?: string;
}

export function ContractBadgeGroupCard({ title, options, selected, descriptionKey }: Props): React.JSX.Element {
  const selectedOptions = options.filter((o) => selected?.[o.key] === true);

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-4">{title}</h2>
      {selectedOptions.length === 0 ? (
        <p className="text-sm text-text-muted">Not selected</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map((o) => {
            const detail =
              descriptionKey && o.key === descriptionKey ? selected?.[`${o.key}Description`] : undefined;
            return (
              <span
                key={o.key}
                className="inline-flex items-center rounded-full bg-accent/10 text-accent px-2.5 py-1 text-xs font-medium"
              >
                {typeof detail === 'string' && detail.trim() ? `${o.label}: ${detail}` : o.label}
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}
