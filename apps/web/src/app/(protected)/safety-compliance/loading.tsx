export default function SafetyComplianceLoading(): React.JSX.Element {
  return (
    <div className="min-h-full p-8">
      <div className="max-w-6xl mx-auto animate-pulse">
        <div className="h-4 w-48 bg-surface-secondary rounded mb-6" />
        <div className="h-8 w-72 bg-surface-secondary rounded mb-2" />
        <div className="h-4 w-96 bg-surface-secondary rounded mb-8" />
        <div className="h-10 w-full bg-surface-secondary rounded mb-6" />
        <div className="rounded-lg border border-border overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3 border-b border-border last:border-b-0">
              <div className="h-4 w-28 bg-surface-secondary rounded" />
              <div className="h-4 flex-1 bg-surface-secondary rounded" />
              <div className="h-4 w-20 bg-surface-secondary rounded" />
              <div className="h-4 w-24 bg-surface-secondary rounded" />
              <div className="h-4 w-24 bg-surface-secondary rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
