import { cookies } from 'next/headers';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// FMP-SALES-01 — Sales & Enquiries API client (server side only). Types mirror
// apps/api/src/sales/sales.service.ts. Dates are Kuwait calendar dates
// (YYYY-MM-DD); money is a decimal string in KWD (null = not known).
// ---------------------------------------------------------------------------

export type SalesStatus =
  | 'NEW_ENQUIRY' | 'CONTACTED' | 'MEETING_DONE' | 'QUOTATION_SENT' | 'FOLLOW_UP' | 'WON' | 'LOST'
  | 'WAITING_FOR_DRAWINGS' | 'WAITING_FOR_CLIENT';
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
  confirmedBy: UserRef | null;
  confirmedAt: string | null;
  hasContract: boolean;
  createdAt: string;
  updatedAt: string;
  /** Newest hand-written activity (list and dashboard only). */
  latestActivity?: { id: string; activityDate: string; notes: string | null; recordedBy: string } | null;
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
  enquiry: { id: string; enquiryNumber: string; companyName: string; contactPerson: string | null; contactNumber: string | null; status: SalesStatus; scopeOfWork?: string };
}

/** One received-date group for the Enquiry Conversion card ('all' or YYYY-MM). `rate` is null when nothing was received. */
export interface SalesConversionGroup {
  period: string;
  received: number;
  confirmed: number;
  rate: number | null;
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
  /** Enquiries Confirmed this month (by confirmation date) and the sum of their recorded estimates. */
  confirmedMonth: { count: number; estimatedValue: string | null; withEstimate: number; withoutEstimate: number };
  /** Contracts created through an enquiry this month; null when the viewer cannot read contracts. */
  contractsCreated: number | null;
  /** FMP-SALES-15 — Enquiry Conversion card: currently Confirmed / all enquiries received, All Time and per received month. */
  enquiryConversion: { allTime: SalesConversionGroup; months: SalesConversionGroup[] };
  awardedValueWon: string | null;
  conversion: { rate: number | null; created: number; won: number } | null;
  statusCounts: Record<string, number>;
  followUpsNeedingAttention: SalesFollowUpListItem[];
  upcomingFollowUps: SalesFollowUpListItem[];
  upcomingFollowUpCount: number;
  activeWithoutFollowUp: number;
  recentEnquiries: SalesEnquiry[];
  monthlyTrend: { month: string; count: number }[];
}

export interface SalesEnquiryList {
  items: SalesEnquiry[];
  today: string;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface SalesEnquiryContract { id: string | null; referenceNumber: string; title: string | null; linkedAt: string | null; linkedBy: string | null }

export interface SalesEnquiryDetail {
  contract: SalesEnquiryContract | null;
  enquiry: SalesEnquiry;
  activities: SalesActivity[];
  followUps: SalesFollowUp[];
  today: string;
}

export type FollowUpFilter = 'PENDING' | 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'COMPLETED';

export interface SalesFollowUpList {
  today: string;
  bucket: FollowUpFilter;
  counts: Record<FollowUpFilter, number>;
  items: SalesFollowUpListItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
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
  followUps: (qs?: URLSearchParams) => salesFetch<SalesFollowUpList>(`/sales/follow-ups${qs && qs.toString() ? `?${qs.toString()}` : ''}`),
};
