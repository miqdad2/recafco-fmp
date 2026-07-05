import Link from 'next/link';

export interface DashboardRecentItem {
  id: string;
  referenceNumber: string;
  title: string;
  status: string;
  updatedAt: string;
}

interface Props {
  items: DashboardRecentItem[];
  baseHref: string;
  hrefSuffix?: string;
  emptyMessage?: string;
}

export function DashboardRecentTable({
  items,
  baseHref,
  hrefSuffix = '',
  emptyMessage = 'No recent items.',
}: Props): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div className="bg-surface rounded-lg border border-border p-6 text-center text-sm text-text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-secondary">
            <th className="text-left px-4 py-2.5 font-medium text-text-secondary text-xs uppercase tracking-wide w-32">
              Ref
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-text-secondary text-xs uppercase tracking-wide">
              Title
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-text-secondary text-xs uppercase tracking-wide w-36">
              Status
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-text-secondary text-xs uppercase tracking-wide w-28 hidden sm:table-cell">
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr
              key={item.id}
              className={[
                i < items.length - 1 ? 'border-b border-border' : '',
                'hover:bg-surface-secondary transition-colors',
              ].join(' ')}
            >
              <td className="px-4 py-2.5 font-mono text-xs text-text-muted whitespace-nowrap">
                <Link
                  href={`${baseHref}/${item.id}${hrefSuffix}`}
                  className="hover:text-accent focus:outline-none focus:ring-1 focus:ring-focus rounded"
                >
                  {item.referenceNumber}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-text-primary max-w-xs">
                <Link
                  href={`${baseHref}/${item.id}${hrefSuffix}`}
                  className="hover:text-accent focus:outline-none focus:ring-1 focus:ring-focus rounded line-clamp-1 block"
                >
                  {item.title}
                </Link>
              </td>
              <td className="px-4 py-2.5">
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-surface-secondary text-text-secondary border border-border whitespace-nowrap">
                  {item.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="px-4 py-2.5 text-text-muted text-xs hidden sm:table-cell whitespace-nowrap">
                {item.updatedAt.slice(0, 10)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
