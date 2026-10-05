interface Props {
  /** id for the heading (used by aria-labelledby). */
  id: string;
  title: string;
  /** Small right-aligned content in the header row (count, link). */
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

// FMP-MAINT-05 — the one card shell every section of the one-screen
// Maintenance Control Center uses: a slim header row and a body that fills
// the remaining height, so two cards in a column can share it evenly.
export function MmsCard({ id, title, aside, className = '', children }: Props): React.JSX.Element {
  return (
    <section aria-labelledby={id} className={`flex min-h-0 flex-col rounded-xl border border-border bg-surface shadow-sm ${className}`}>
      <header className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-1.5">
        <h2 id={id} className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          {title}
        </h2>
        {aside}
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}

/** One compact muted line for a section with nothing to show — never a large box. */
export function MmsCardNote({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="flex flex-1 items-center justify-center px-3.5 py-4 text-center text-xs text-text-muted">{children}</p>;
}
