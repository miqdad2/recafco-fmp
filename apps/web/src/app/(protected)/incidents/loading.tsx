export default function IncidentsLoading(): React.JSX.Element {
  return (
    <div className="min-h-full p-8" aria-live="polite" aria-label="Loading">
      <div className="max-w-6xl mx-auto">
        <div className="h-5 w-32 rounded bg-surface-secondary animate-pulse mb-6" />
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-8 w-48 rounded bg-surface-secondary animate-pulse mb-2" />
            <div className="h-4 w-80 rounded bg-surface-secondary animate-pulse" />
          </div>
          <div className="h-9 w-36 rounded bg-surface-secondary animate-pulse" />
        </div>
        <div className="flex gap-3 mb-6 flex-wrap">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-32 rounded bg-surface-secondary animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-surface-secondary animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
