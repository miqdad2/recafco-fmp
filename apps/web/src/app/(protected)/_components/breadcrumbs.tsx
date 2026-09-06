import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  /** CM-66D — defaults to the original bottom margin so all existing page-body callers are unchanged; the header-level contract workspace breadcrumb passes "mb-0" since it sits inline with Manager / Sign out, not stacked above page content. */
  className?: string;
}

export function Breadcrumbs({ items, className = 'mb-4' }: BreadcrumbsProps): React.JSX.Element {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center flex-wrap gap-1 text-sm text-text-muted ${className}`}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />}
          {item.href ? (
            <Link href={item.href} className="hover:text-text-primary transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-text-primary" aria-current="page">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
