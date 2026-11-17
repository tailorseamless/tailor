import type { Repository } from "typeorm";
import { AppDataSource } from "../../../infrastructure/database/dataSource";
import type { Paginated } from "../../../shared/pagination/paginate";
import { BaseRepository, escapeLike, likePattern } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import type {
  ListMaterialsParams,
  ListMovementsParams,
  MaterialRecord,
  StockMovementDTO,
  StockMovementRecord,
} from "../dto/inventory.dto";
import { InventoryTransaction } from "../entities/inventoryTransaction.entity";
import { Material } from "../entities/material.entity";

type MaterialInput = Pick<
  MaterialRecord,
  "branchId" | "name" | "category" | "unit" | "unitCost" | "minQuantity" | "supplier" | "notes"
>;

function toRecord(row: Material): MaterialRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    branchId: row.branchId ?? null,
    name: row.name,
    category: row.category,
    unit: row.unit,
    quantity: Number(row.quantity),
    unitCost: row.unitCost === null || row.unitCost === undefined ? null : Number(row.unitCost),
    minQuantity: row.minQuantity === null || row.minQuantity === undefined ? null : Number(row.minQuantity),
    supplier: row.supplier ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Raw movement row: pg hands `numeric` back as strings. */
type MovementRaw = Omit<StockMovementDTO, "change" | "balanceAfter" | "unitCost"> & {
  change: string;
  balanceAfter: string;
  unitCost: string | null;
};

/** Materials and their stock ledger: one aggregate, one repository. */
export class MaterialRepository extends BaseRepository<Material> {
  static Instance = new MaterialRepository();

  private constructor() {
    super(Material);
  }

  private movements(tx?: Tx): Repository<InventoryTransaction> {
    return (tx ?? AppDataSource.manager).getRepository(InventoryTransaction);
  }

  /** Tenant scope in the query itself (Backend Guide §13.4). */
  async findInBusiness(id: string, businessId: string, tx?: Tx): Promise<MaterialRecord | null> {
    const row = await this.repo(tx).findOne({ where: { id, businessId } });
    return row ? toRecord(row) : null;
  }

  /** Reads the material under a row lock: stock movements on it happen one at a time (Backend Guide §8.4). */
  async findForUpdate(id: string, businessId: string, tx: Tx): Promise<MaterialRecord | null> {
    const row = await this.repo(tx)
      .createQueryBuilder("m")
      .setLock("pessimistic_write")
      .where("m.id = :id AND m.businessId = :businessId", { id, businessId })
      .getOne();
    return row ? toRecord(row) : null;
  }

  /** Same name ignoring case, among one business's live materials. */
  async findByName(businessId: string, name: string, exceptId?: string, tx?: Tx): Promise<MaterialRecord | null> {
    const qb = this.repo(tx)
      .createQueryBuilder("m")
      .where("m.businessId = :businessId", { businessId })
      .andWhere("m.name ILIKE :name", { name: escapeLike(name) });
    if (exceptId) qb.andWhere("m.id <> :exceptId", { exceptId });
    const row = await qb.getOne();
    return row ? toRecord(row) : null;
  }

  /** Indexes: UQ_materials_name_live (business_id, name), materials(business_id, category). */
  async listForBusiness(params: ListMaterialsParams): Promise<Paginated<MaterialRecord>> {
    const qb = this.repo()
      .createQueryBuilder("m")
      .where("m.businessId = :businessId", { businessId: params.businessId });
    if (params.category) qb.andWhere("m.category = :category", { category: params.category });
    if (params.branchId) qb.andWhere("m.branchId = :branchId", { branchId: params.branchId });
    if (params.lowStock) qb.andWhere("m.minQuantity IS NOT NULL AND m.quantity <= m.minQuantity");
    if (params.search) {
      qb.andWhere("(m.name ILIKE :term OR m.supplier ILIKE :term)", { term: likePattern(params.search) });
    }
    qb.orderBy("m.name", "ASC").addOrderBy("m.id", "ASC");

    const page = await this.paginate(qb, params.page, params.limit);
    return { data: page.data.map(toRecord), meta: page.meta };
  }

  async createMaterial(data: MaterialInput & { businessId: string }, tx: Tx): Promise<MaterialRecord> {
    const created = await this.create({ ...data, quantity: 0 }, tx);
    return (await this.findInBusiness(created.id, data.businessId, tx))!;
  }

  async updateMaterial(
    id: string,
    businessId: string,
    data: Partial<MaterialInput & Pick<MaterialRecord, "quantity">>,
    tx: Tx,
  ): Promise<void> {
    await this.repo(tx).update({ id, businessId }, { ...data, updatedAt: new Date() });
  }

  async removeInBusiness(id: string, businessId: string, tx: Tx): Promise<void> {
    await this.repo(tx).softDelete({ id, businessId });
  }

  /** Appends one ledger row. There is deliberately no update or delete. */
  async appendMovement(
    data: Omit<StockMovementRecord, "id" | "createdAt"> & { businessId: string },
    tx: Tx,
  ): Promise<StockMovementRecord> {
    const repo = this.movements(tx);
    const row = await repo.save(repo.create(data));
    return {
      id: row.id,
      materialId: row.materialId,
      kind: row.kind,
      change: Number(row.change),
      balanceAfter: Number(row.balanceAfter),
      unitCost: row.unitCost === null || row.unitCost === undefined ? null : Number(row.unitCost),
      orderId: row.orderId ?? null,
      note: row.note ?? null,
      recordedBy: row.recordedBy ?? null,
      createdAt: row.createdAt,
    };
  }

  /** Newest first. Index: inventory_transactions(material_id, created_at). */
  async listMovements(params: ListMovementsParams): Promise<Paginated<StockMovementDTO>> {
    const qb = this.movements()
      .createQueryBuilder("x")
      // Joins keep soft-deleted customers, orders and staff: history must still show whose it was (PRD BR-014).
      .withDeleted()
      .leftJoin("orders", "o", "o.id = x.order_id")
      .select("x.id", "id")
      .addSelect("x.materialId", "materialId")
      .addSelect("x.kind", "kind")
      .addSelect("x.change", "change")
      .addSelect("x.balanceAfter", "balanceAfter")
      .addSelect("x.unitCost", "unitCost")
      .addSelect("x.orderId", "orderId")
      .addSelect("x.note", "note")
      .addSelect("x.recordedBy", "recordedBy")
      .addSelect("x.createdAt", "createdAt")
      .addSelect("o.order_number", "orderNumber")
      .where("x.businessId = :businessId AND x.materialId = :materialId", params);
    if (params.kind) qb.andWhere("x.kind = :kind", { kind: params.kind });
    qb.orderBy("x.createdAt", "DESC").addOrderBy("x.id", "DESC");

    const page = await this.paginateRaw<MovementRaw, InventoryTransaction>(qb, params.page, params.limit);
    return {
      data: page.data.map((row) => ({
        ...row,
        change: Number(row.change),
        balanceAfter: Number(row.balanceAfter),
        unitCost: row.unitCost === null ? null : Number(row.unitCost),
      })),
      meta: page.meta,
    };
  }
}
