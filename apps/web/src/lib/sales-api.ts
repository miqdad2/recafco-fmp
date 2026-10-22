import { cookies } from 'next/headers';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// FMP-SALES-01 — Sales & Enquiries API client (server side only). Types mirror
// apps/api/src/sales/sales.service.ts. Dates are Kuwait calendar dates
// (YYYY-MM-DD); money is a decimal string in KWD (null = not known).
// ---------------------------------------------------------------------------

export type SalesStatus = 'NEW_ENQUIRY' | 'CONTACTED' | 'MEETING_DONE' | 'QUOTATION_SENT' | 'FOLLOW_UP' | 'WON' | 'LOST';
export type SalesActivityType =
  | 'OFFICE_MEETING' | 'PHONE_CALL' | 'EMAIL' | 'CLIENT_VISIT' | 'FOLLOW_UP' | 'QUOTATION_UPDATE' | 'STATUS_CHANGE' | 'NOTE' | 'ENQUIRY_UPDATED';
export type FollowUpBucket = 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';

export interface UserRef { id: string; displayName: string }

export interface SalesEnquiry {
  id: string;
  enquiryNumber: string;
  companyName: string;
  contactPerson: string | null;
  contactNumber: string | null;
  email: string | null;
  enquiryDate: string;
  source: string | null;
  projectName: string | null;
  projectLocation: string | null;
  scopeOfWork: string;
  typeOfWork: string | null;
  estimatedValue: string | null;
  estimatedValueSource: string | null;
  currency: string;
  status: SalesStatus;
  assignedTo: UserRef | null;
  nextFollowUpDate: string | null;
  remarks: string | null;
  additionalNotes: string | null;
  expectedStartDate: string | null;
  expectedAwardDate: string | null;
  lostReason: string | null;
  awardedValue: string | null;
  wonDate: string | null;
  lostDate: string | null;
  createdBy: UserRef;
  createdAt: string;
  updatedAt: string;
}

export interface SalesActivity {
  id: string;
  type: SalesActivityType;
  activityDate: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  recordedBy: UserRef;
  createdAt: string;
}

export interface SalesFollowUp {
  id: string;
  enquiryId: string;
  followUpDate: string;
  notes: string | null;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  bucket: FollowUpBucket;
  responsibleUser: UserRef | null;
  completedAt: string | null;
  completedBy: UserRef | null;
  completionNotes: string | null;
  rescheduledFromId: string | null;
}

export interface SalesFollowUpListItem extends SalesFollowUp {
  enquiry: { id: string; enquiryNumber: string; companyName: string; contactPerson: string | null; contactNumber: string | null; status: SalesStatus };
}

export interface SalesDashboard {
  today: string;
  month: string;
  enquiriesThisMonth: number;
  followUpsOverdue: number;
  followUpsDueToday: number;
  followUpsDue: number;
  openEnquiries: number;
  potentialValue: string | null;
  openWithoutEstimate: number;
  projectsWon: number;
  awardedValueWon: string | null;
  conversion: { rate: number | null; created: number; won: number } | null;
  statusCounts: Record<string, number>;
  followUpsNeedingAttention: SalesFollowUpListItem[];
  recentEnquiries: SalesEnquiry[];
  monthlyTrend: { month: string; count: number }[];
}

export interface SalesEnquiryList {
  items: SalesEnquiry[];
  today: string;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface SalesEnquiryDetail {
  enquiry: SalesEnquiry;
  activities: SalesActivity[];
  followUps: SalesFollowUp[];
  today: string;
}

export interface SalesFollowUpList {
  today: string;
  counts: Record<'OVERDUE' | 'TODAY' | 'UPCOMING' | 'COMPLETED', number>;
  items: SalesFollowUpListItem[];
}

export interface SalesApiError {
  code: string;
  message: string;
  status: number;
  fields?: Record<string, string[]>;
}

type Envelope<T> = { data: T; error: null } | { data: null; error: { code?: string; message?: string; details?: { fields?: Record<string, string[]> } } };

/** Calls the Sales API with the signed-in user's session. Never throws: returns { data } or { error }. */
export async function salesFetch<T>(path: string, init?: RequestInit): Promise<{ data: T; error: null } | { data: null; error: SalesApiError }> {
  let token: string | undefined;
  try {
    token = (await cookies()).get('recafco_access')?.value;
  } catch {
    // not in a request context
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
      cache: 'no-store',
    });
    const body = (await res.json()) as Envelope<T>;
    if (!res.ok || body.error !== null) {
      const err = (body as { error?: { code?: string; message?: string; details?: { fields?: Record<string, string[]> } } }).error;
      return {
        data: null,
        error: {
          code: err?.code ?? 'API_ERROR',
          message: err?.message ?? `API error ${res.status}`,
          status: res.status,
          ...(err?.details?.fields ? { fields: err.details.fields } : {}),
        },
      };
    }
    return { data: (body as { data: T }).data, error: null };
  } catch (e) {
    return { data: null, error: { code: 'NETWORK_ERROR', message: e instanceof Error ? e.message : 'Network error', status: 0 } };
  }
}

export const salesApi = {
  dashboard: () => salesFetch<SalesDashboard>('/sales/dashboard'),
  enquiries: (qs: URLSearchParams) => salesFetch<SalesEnquiryList>(`/sales/enquiries?${qs.toString()}`),
  enquiry: (id: string) => salesFetch<SalesEnquiryDetail>(`/sales/enquiries/${id}`),
  followUps: (bucket?: string) => salesFetch<SalesFollowUpList>(`/sales/follow-ups${bucket ? `?bucket=${bucket}` : ''}`),
};
