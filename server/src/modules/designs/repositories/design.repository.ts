import { Brackets, In } from "typeorm";
import type { Paginated } from "../../../shared/pagination/paginate";
import { BaseRepository, likePattern } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import type { DesignRecord, ListDesignsParams } from "../dto/design.dto";
import { Design } from "../entities/design.entity";

type DesignInput = Pick<
  DesignRecord,
  "name" | "description" | "category" | "priceMin" | "priceMax" | "visibility" | "isFavourite"
>;

function toRecord(row: Design): DesignRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    description: row.description ?? null,
    category: row.category ?? null,
    priceMin: row.priceMin ?? null,
    priceMax: row.priceMax ?? null,
    visibility: row.visibility,
    isFavourite: row.isFavourite,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DesignRepository extends BaseRepository<Design> {
  static Instance = new DesignRepository();

  private constructor() {
    super(Design);
  }

  /** Tenant scope in the query itself (Backend Guide §13.4). */
  async findInBusiness(id: string, businessId: string, tx?: Tx): Promise<DesignRecord | null> {
    const row = await this.repo(tx).findOne({ where: { id, businessId } });
    return row ? toRecord(row) : null;
  }

  /** How many of these ids are live designs of this business. */
  countInBusiness(ids: string[], businessId: string, tx?: Tx): Promise<number> {
    if (ids.length === 0) return Promise.resolve(0);
    return this.repo(tx).count({ where: { id: In(ids), businessId } });
  }

  /** Favourites first, then newest. Indexes: designs(business_id, created_at | category | visibility). */
  async listForBusiness(params: ListDesignsParams): Promise<Paginated<DesignRecord>> {
    const qb = this.repo()
      .createQueryBuilder("d")
      .where("d.businessId = :businessId", { businessId: params.businessId });
    if (params.category) qb.andWhere("LOWER(d.category) = LOWER(:category)", { category: params.category });
    if (params.visibility) qb.andWhere("d.visibility = :visibility", { visibility: params.visibility });
    if (params.favourite !== undefined) qb.andWhere("d.isFavourite = :favourite", { favourite: params.favourite });
    if (params.search) {
      qb.andWhere(
        new Brackets((or) =>
          or.where("d.name ILIKE :term").orWhere("d.category ILIKE :term").orWhere("d.description ILIKE :term"),
        ),
        { term: likePattern(params.search) },
      );
    }
    qb.orderBy("d.isFavourite", "DESC").addOrderBy("d.createdAt", "DESC").addOrderBy("d.id", "DESC");

    const page = await this.paginate(qb, params.page, params.limit);
    return { data: page.data.map(toRecord), meta: page.meta };
  }

  /** The categories in use, for a filter. A small, scoped set. */
  async categories(businessId: string): Promise<string[]> {
    const rows: { category: string }[] = await this.repo().query(
      `SELECT MIN(category) AS category
         FROM designs
        WHERE business_id = $1 AND deleted_at IS NULL AND category IS NOT NULL
        GROUP BY LOWER(category)
        ORDER BY LOWER(category)
        LIMIT 200`,
      [businessId],
    );
    return rows.map((row) => row.category);
  }

  async createDesign(data: DesignInput & { businessId: string; createdBy: string }, tx: Tx): Promise<DesignRecord> {
    return toRecord(await this.create(data, tx));
  }

  async updateDesign(id: string, businessId: string, data: Partial<DesignInput>, tx: Tx): Promise<void> {
    await this.repo(tx).update({ id, businessId }, { ...data, updatedAt: new Date() });
  }

  /** Soft delete: orders that used the design still point at it. */
  async removeInBusiness(id: string, businessId: string, tx: Tx): Promise<void> {
    await this.repo(tx).softDelete({ id, businessId });
  }
}
