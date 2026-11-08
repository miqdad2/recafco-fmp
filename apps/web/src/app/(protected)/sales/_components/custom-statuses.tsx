'use client';

import { createContext, useContext } from 'react';
import type { SalesCustomStatus } from '@/lib/sales-api';

/**
 * FMP-SALES-18 — the custom (in-progress) statuses, read once by the Sales layout on the server and shared with every
 * Change Status menu and filter on the page. After "+ Add New Status" the page is refreshed (router.refresh), which
 * re-reads the layout, so the new status appears in the other menus straight away.
 */
const CustomStatusesContext = createContext<SalesCustomStatus[]>([]);

export function CustomStatusesProvider({ statuses, children }: { statuses: SalesCustomStatus[]; children: React.ReactNode }): React.JSX.Element {
  return <CustomStatusesContext.Provider value={statuses}>{children}</CustomStatusesContext.Provider>;
}

export function useCustomStatuses(): SalesCustomStatus[] {
  return useContext(CustomStatusesContext);
}
