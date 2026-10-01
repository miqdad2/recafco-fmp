// FMP-PERF-02 — shared route-level loading fallback for a create/edit form
// page (e.g. New Incident). Without this, a form route falls back to
// whichever LIST-shaped loading.tsx its nearest ancestor segment defines
// (e.g. incidents/loading.tsx's row skeleton), which reads as visibly wrong
// for a page whose real content is a form, not rows. Field-bar placeholders
// only — no attempt to mirror the real form's exact field count/labels.
interface Props {
  /** Number of field-bar placeholders in the body — a rough visual stand-in, not a literal field count match. */
  fieldCount?: number;
}

export function FormLoadingSkeleton({ fieldCount = 6 }: Props): React.JSX.Element {
  return (
    <div className="min-h-full p-8" aria-live="polite" aria-label="Loading">
      <div className="mx-auto max-w-3xl animate-pulse">
        <div className="mb-2 h-4 w-40 rounded bg-surface-secondary" />
        <div className="mb-8 h-8 w-64 rounded bg-surface-secondary" />

        <div className="space-y-5 rounded-lg border border-border bg-surface p-6">
          {Array.from({ length: fieldCount }).map((_, i) => (
            <div key={i}>
              <div className="mb-2 h-3.5 w-28 rounded bg-surface-secondary" />
              <div className="h-10 w-full rounded bg-surface-secondary" />
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <div className="h-10 w-24 rounded bg-surface-secondary" />
            <div className="h-10 w-32 rounded bg-surface-secondary" />
          </div>
        </div>
      </div>
    </div>
  );
}
