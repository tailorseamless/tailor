import { MEMBER_ROLES, type MemberRole } from "../../../config/permissions";
import type { MemberStatus } from "../../businesses/dto/business.dto";

/** Roles that can be handed out. There is exactly one owner: whoever registered the business. */
export const ASSIGNABLE_ROLES = MEMBER_ROLES.filter((role) => role !== "owner") as [
  Exclude<MemberRole, "owner">,
  ...Exclude<MemberRole, "owner">[],
];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export interface TeamMemberDTO {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: MemberRole;
  status: MemberStatus;
  /** Their home branch. */
  branchId: string | null;
  branchName: string | null;
  /** False until the person first signs in with this email. */
  hasSignedIn: boolean;
  joinedAt: Date;
}

export interface ListTeamParams {
  businessId: string;
  page: number;
  limit: number;
  role?: MemberRole;
  status?: MemberStatus;
  search?: string;
}
