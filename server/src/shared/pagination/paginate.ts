import { z } from "zod";
import { PAGINATION } from "../../config/constants";
import type { PaginationMeta } from "../response/apiResponse";

/** Spread into a list schema's `query` (Backend Guide §11.1). */
export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(PAGINATION.defaultLimit),
};

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export function getOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * COUNT runs only on page 1; later pages pass `total = 0` and the client keeps
 * the page-1 total (Backend Guide §11.1).
 */
export function buildMeta(page: number, limit: number, total: number, resultCount: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: total > 0 ? Math.ceil(total / limit) : 0,
    hasNext: resultCount === limit,
    hasPrev: page > 1,
  };
}
