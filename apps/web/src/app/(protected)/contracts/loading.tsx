export default function Loading() {
  return (
    <div className="min-h-full p-8">
      <div className="max-w-6xl mx-auto">
        <div className="h-8 w-64 rounded bg-surface-secondary animate-pulse mb-6" />
        <div className="h-64 rounded-lg bg-surface-secondary animate-pulse" />
      </div>
    </div>
  );
}
