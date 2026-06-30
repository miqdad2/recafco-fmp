interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="size-12 rounded-full bg-surface-secondary flex items-center justify-center mb-4">
        <svg
          className="size-6 text-text-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      )}
    </div>
  );
}
