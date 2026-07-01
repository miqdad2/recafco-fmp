export default function Loading(): React.JSX.Element {
  return (
    <div className="flex items-center justify-center min-h-[60vh]" aria-label="Loading" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div
          className="size-8 rounded-full border-2 border-border border-t-accent animate-spin"
          aria-hidden="true"
        />
        <p className="text-sm text-text-muted">Loading…</p>
      </div>
    </div>
  );
}
