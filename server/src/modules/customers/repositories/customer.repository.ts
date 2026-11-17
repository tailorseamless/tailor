import { Brackets, Not, type FindOptionsWhere } from "typeorm";
import type { Paginated } from "../../../shared/pagination/paginate";
import { BaseRepository, likePattern } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import type { CustomerRecord, ListCustomersParams } from "../dto/customer.dto";
import { Customer } from "../entities/customer.entity";

type CustomerInput = Partial<Pick<CustomerRecord, "fullName" | "phone" | "email" | "address" | "gender" | "notes">>;

function toRecord(row: Customer): CustomerRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email ?? null,
    address: row.address ?? null,
    gender: row.gender ?? null,
    notes: row.notes ?? null,
    createdBy: row.createdBy ?? null,
    portalLinkCreatedAt: row.portalLinkCreatedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class CustomerRepository extends BaseRepository<Customer> {
  static Instance = new CustomerRepository();

  private constructor() {
    super(Customer);
  }

  /** Tenant scope in the query itself (Backend Guide §13.4). */
  async findInBusiness(id: string, businessId: string, tx?: Tx): Promise<CustomerRecord | null> {
    const row = await this.repo(tx).findOne({ where: { id, businessId } });
    return row ? toRecord(row) : null;
  }

  /**
   * As `findInBusiness`, but a since-deleted customer is still returned:
   * their orders and payments must keep showing whose they were (PRD BR-014).
   */
  async findInBusinessWithDeleted(id: string, businessId: string, tx?: Tx): Promise<CustomerRecord | null> {
    const row = await this.repo(tx).findOne({ where: { id, businessId }, withDeleted: true });
    return row ? toRecord(row) : null;
  }

  /** Another live customer of this business with the same number. Index: customers(business_id, phone). */
  async findByPhone(businessId: string, phone: string, exceptId?: string, tx?: Tx): Promise<CustomerRecord | null> {
    const where: FindOptionsWhere<Customer> = { businessId, phone };
    if (exceptId) where.id = Not(exceptId);
    const row = await this.repo(tx).findOne({ where, order: { createdAt: "ASC" } });
    return row ? toRecord(row) : null;
  }

  /**
   * Indexes: customers(business_id, created_at) / customers(business_id, full_name).
   * Search is ILIKE over one business's customers — a small, scoped set (§10.2).
   */
  async listForBusiness(params: ListCustomersParams): Promise<Paginated<CustomerRecord>> {
    const qb = this.repo()
      .createQueryBuilder("c")
      .where("c.businessId = :businessId", { businessId: params.businessId });

    if (params.search) {
      qb.andWhere(
        new Brackets((or) =>
          or.where("c.fullName ILIKE :term").orWhere("c.phone ILIKE :term").orWhere("c.email ILIKE :term"),
        ),
        { term: likePattern(params.search) },
      );
    }

    if (params.sort === "name") qb.orderBy("c.fullName", "ASC").addOrderBy("c.id", "ASC");
    else qb.orderBy("c.createdAt", "DESC").addOrderBy("c.id", "DESC");

    const page = await this.paginate(qb, params.page, params.limit);
    return { data: page.data.map(toRecord), meta: page.meta };
  }

  /** The live customer a portal link opens. Index: UQ_customers_portal_token. */
  async findByPortalHash(hash: string): Promise<CustomerRecord | null> {
    const row = await this.repo().createQueryBuilder("c").where("c.portalTokenHash = :hash", { hash }).getOne();
    return row ? toRecord(row) : null;
  }

  /** Replaces (or, with null, removes) the customer's portal link. */
  async setPortalToken(id: string, businessId: string, hash: string | null, tx?: Tx): Promise<void> {
    await this.repo(tx).update(
      { id, businessId },
      { portalTokenHash: hash, portalLinkCreatedAt: hash ? new Date() : null, updatedAt: new Date() },
    );
  }

  async createCustomer(
    data: CustomerInput & Pick<CustomerRecord, "businessId" | "fullName" | "phone" | "createdBy">,
    tx?: Tx,
  ): Promise<CustomerRecord> {
    return toRecord(await this.create(data, tx));
  }

  async updateInBusiness(id: string, businessId: string, data: CustomerInput, tx?: Tx): Promise<CustomerRecord | null> {
    await this.repo(tx).update({ id, businessId }, data);
    return this.findInBusiness(id, businessId, tx);
  }

  async removeInBusiness(id: string, businessId: string, tx?: Tx): Promise<void> {
    await this.repo(tx).softDelete({ id, businessId });
  }
}
