/**
 * CM-64B — neutral badge for the table's derived Category column (see
 * deriveAttachmentCategory()), visually distinct from the colored Source
 * badge. CM-64C — text lightened to `text-text-muted` (was
 * `text-text-secondary`) so it reads as a quiet, secondary label next to
 * the more prominent Source badge, not a second "selected" chip competing
 * for attention.
 */
export function ContractAttachmentCategoryBadge({ category }: { category: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium text-text-muted whitespace-nowrap">
      {category}
    </span>
  );
}
