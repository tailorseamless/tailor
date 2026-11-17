import { Brackets, In, type SelectQueryBuilder } from "typeorm";
import type { MemberRole } from "../../../config/permissions";
import type { Paginated } from "../../../shared/pagination/paginate";
import { BaseRepository, likePattern } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import type { ListTeamParams, TeamMemberDTO } from "../../team/dto/team.dto";
import type { MemberRecord, MemberStatus } from "../dto/business.dto";
import { BusinessMember } from "../entities/businessMember.entity";

function toRecord(row: BusinessMember): MemberRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    userId: row.userId,
    branchId: row.branchId ?? null,
    role: row.role,
    status: row.status ?? "active",
    createdAt: row.createdAt,
  };
}

export class MemberRepository extends BaseRepository<BusinessMember> {
  static Instance = new MemberRepository();

  private constructor() {
    super(BusinessMember);
  }

  async createMember(
    data: { businessId: string; userId: string; role: MemberRole; branchId?: string | null },
    tx?: Tx,
  ): Promise<MemberRecord> {
    return toRecord(await this.create({ ...data, status: "active" }, tx));
  }

  /** Index: UQ_business_members_live (business_id, user_id). */
  async findMembership(businessId: string, userId: string, tx?: Tx): Promise<MemberRecord | null> {
    const row = await this.repo(tx).findOne({ where: { businessId, userId } });
    return row ? toRecord(row) : null;
  }

  /** A membership with its person joined in (no N+1). Tenant scope in the query itself. */
  private withPeople(businessId: string, tx?: Tx): SelectQueryBuilder<BusinessMember> {
    return this.repo(tx)
      .createQueryBuilder("m")
      .innerJoin("users", "u", "u.id = m.user_id AND u.deleted_at IS NULL")
      .leftJoin("branches", "br", "br.id = m.branch_id")
      .select("u.id", "userId")
      .addSelect("u.full_name", "fullName")
      .addSelect("u.email", "email")
      .addSelect("u.phone", "phone")
      .addSelect("m.role", "role")
      .addSelect("m.status", "status")
      .addSelect("m.branchId", "branchId")
      .addSelect("br.name", "branchName")
      .addSelect("u.firebase_uid IS NOT NULL", "hasSignedIn")
      .addSelect("m.createdAt", "joinedAt")
      .where("m.businessId = :businessId", { businessId })
      .andWhere("m.deletedAt IS NULL");
  }

  async findMember(businessId: string, userId: string, tx?: Tx): Promise<TeamMemberDTO | null> {
    const row = await this.withPeople(businessId, tx)
      .andWhere("m.userId = :userId", { userId })
      .getRawOne<TeamMemberDTO>();
    return row ?? null;
  }

  /** Index: business_members(business_id, status). A team is a small, scoped set. */
  async listForBusiness(params: ListTeamParams): Promise<Paginated<TeamMemberDTO>> {
    const qb = this.withPeople(params.businessId);
    if (params.role) qb.andWhere("m.role = :role", { role: params.role });
    if (params.status) qb.andWhere("m.status = :status", { status: params.status });
    if (params.search) {
      qb.andWhere(new Brackets((or) => or.where("u.full_name ILIKE :term").orWhere("u.email ILIKE :term")), {
        term: likePattern(params.search),
      });
    }
    qb.orderBy("u.full_name", "ASC").addOrderBy("u.id", "ASC");
    return this.paginateRaw<TeamMemberDTO, BusinessMember>(qb, params.page, params.limit);
  }

  async updateMember(
    businessId: string,
    userId: string,
    data: { role?: MemberRole; status?: MemberStatus; branchId?: string | null },
    tx?: Tx,
  ): Promise<void> {
    await this.repo(tx).update({ businessId, userId }, { ...data, updatedAt: new Date() });
  }

  /** Active members with any of these roles (a business has a small team). */
  async activeUserIdsWithRoles(businessId: string, roles: MemberRole[], tx?: Tx): Promise<string[]> {
    const rows = await this.repo(tx).find({
      select: { userId: true },
      where: { businessId, status: "active", role: In(roles) },
      take: 100,
    });
    return rows.map((row) => row.userId);
  }

  async removeMember(businessId: string, userId: string, tx?: Tx): Promise<void> {
    await this.repo(tx).softDelete({ businessId, userId });
  }
}
