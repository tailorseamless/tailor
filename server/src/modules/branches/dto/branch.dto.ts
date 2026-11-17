export const BRANCH_STATUSES = ["active", "archived"] as const;
export type BranchStatus = (typeof BRANCH_STATUSES)[number];

/**
 * A shop location of one business (PRD Phase 4). Branches organise and filter
 * the work; they are not an access boundary — everyone in the business sees
 * every branch.
 */
export interface BranchRecord {
  id: string;
  businessId: string;
  name: string;
  address: string | null;
  phone: string | null;
  status: BranchStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListBranchesParams {
  businessId: string;
  page: number;
  limit: number;
  status?: BranchStatus;
}
