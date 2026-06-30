export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta: {
    requestId?: string;
    [key: string]: unknown;
  };
  error: null;
}

export interface ApiErrorResponse {
  data: null;
  meta: {
    requestId: string;
    [key: string]: unknown;
  };
  error: ApiError;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
