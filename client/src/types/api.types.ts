/** Mirrors the server's ApiResponse envelope (Backend Guide §5). Change both together. */
export interface ApiResponse<T = null> {
  success: boolean;
  message: string;
  statusCode: number;
  data: T | null;
  errors: ValidationError[];
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextCursor?: string | null;
}

/** Field errors; some carry extra details (a duplicate's id, a clashing appointment). */
export interface ValidationError {
  field: string;
  message: string;
  [detail: string]: unknown;
}

export interface Page<T> {
  data: T[];
  meta: PaginationMeta | null;
}

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export type Id = string;
export type ISODate = string;
