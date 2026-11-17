import type { Paginated } from "../../../shared/pagination/paginate";
import { BaseRepository, escapeLike } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import type { BranchRecord, ListBranchesParams } from "../dto/branch.dto";
import { Branch } from "../entities/branch.entity";

type BranchInput = Pick<BranchRecord, "name" | "address" | "phone" | "status">;

function toRecord(row: Branch): BranchRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    address: row.address ?? null,
    phone: row.phone ?? null,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class BranchRepository extends BaseRepository<Branch> {
  static Instance = new BranchRepository();

  private constructor() {
    super(Branch);
  }

  /** Tenant scope in the query itself (Backend Guide §13.4). */
  async findInBusiness(id: string, businessId: string, tx?: Tx): Promise<BranchRecord | null> {
    const row = await this.repo(tx).findOne({ where: { id, businessId } });
    return row ? toRecord(row) : null;
  }

  /** Same name ignoring case. Index: UQ_branches_name_live (business_id, name). */
  async findByName(businessId: string, name: string, exceptId?: string, tx?: Tx): Promise<BranchRecord | null> {
    const qb = this.repo(tx)
      .createQueryBuilder("b")
      .where("b.businessId = :businessId", { businessId })
      .andWhere("b.name ILIKE :name", { name: escapeLike(name) });
    if (exceptId) qb.andWhere("b.id <> :exceptId", { exceptId });
    const row = await qb.getOne();
    return row ? toRecord(row) : null;
  }

  async listForBusiness(params: ListBranchesParams): Promise<Paginated<BranchRecord>> {
    const qb = this.repo()
      .createQueryBuilder("b")
      .where("b.businessId = :businessId", { businessId: params.businessId });
    if (params.status) qb.andWhere("b.status = :status", { status: params.status });
    qb.orderBy("b.name", "ASC").addOrderBy("b.id", "ASC");
    const page = await this.paginate(qb, params.page, params.limit);
    return { data: page.data.map(toRecord), meta: page.meta };
  }

  async createBranch(data: BranchInput & { businessId: string }, tx: Tx): Promise<BranchRecord> {
    return toRecord(await this.create(data, tx));
  }

  async updateBranch(id: string, businessId: string, data: Partial<BranchInput>, tx: Tx): Promise<void> {
    await this.repo(tx).update({ id, businessId }, { ...data, updatedAt: new Date() });
  }
}
