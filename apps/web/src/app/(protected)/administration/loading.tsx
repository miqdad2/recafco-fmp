export default function AdministrationLoading(): React.JSX.Element {
  return (
    <div className="min-h-full p-8" aria-live="polite" aria-label="Loading">
      <div className="max-w-4xl mx-auto">
        <div className="h-5 w-48 rounded bg-surface-secondary animate-pulse mb-8" />
        <div className="h-8 w-64 rounded bg-surface-secondary animate-pulse mb-2" />
        <div className="h-4 w-96 rounded bg-surface-secondary animate-pulse mb-8" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 rounded-lg bg-surface-secondary animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
