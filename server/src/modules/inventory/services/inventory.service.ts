import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import { runInTransaction, type Tx } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import type { AuditAction } from "../../activity/dto/activity.dto";
import { ActivityService } from "../../activity/services/activity.service";
import { BranchService } from "../../branches/services/branch.service";
import { OrderRepository } from "../../orders/repositories/order.repository";
import { applyChange, isLowStock, stockChange } from "../domain/stockRules";
import type { MaterialDTO, MaterialRecord, StockMovementDTO, StockMovementRecord } from "../dto/inventory.dto";
import { MaterialRepository } from "../repositories/material.repository";
import type {
  CreateMaterialInput,
  ListMaterialsQuery,
  ListMovementsQuery,
  RecordMovementInput,
  UpdateMaterialInput,
} from "../validators/inventory.schema";

const present = (material: MaterialRecord): MaterialDTO => ({
  ...material,
  isLowStock: isLowStock(material.quantity, material.minQuantity),
});

/**
 * Business-owned materials (PRD §3.7). The quantity on hand changes only
 * through stock movements, each written to an append-only ledger in the same
 * transaction, under a lock on the material.
 */
export class InventoryService {
  static Instance = new InventoryService();

  private constructor(
    private readonly materials = MaterialRepository.Instance,
    private readonly branches = BranchService.Instance,
    private readonly orders = OrderRepository.Instance,
    private readonly activity = ActivityService.Instance,
  ) {}

  async list(actor: Actor, query: ListMaterialsQuery): Promise<Paginated<MaterialDTO>> {
    const page = await this.materials.listForBusiness({ ...query, businessId: actor.businessId }); // tenant scope, always
    return { data: page.data.map(present), meta: page.meta };
  }

  /** Another business's material is a 404: existence must not leak. */
  async detail(actor: Actor, id: string): Promise<MaterialDTO> {
    const material = await this.materials.findInBusiness(id, actor.businessId);
    if (!material) throw AppError.notFound("Material not found");
    return present(material);
  }

  async create(actor: Actor, input: CreateMaterialInput): Promise<MaterialDTO> {
    const { openingQuantity, ...fields } = input;
    return runInTransaction(async (tx) => {
      await this.assertNameIsFree(actor.businessId, fields.name, undefined, tx);
      let material = await this.materials.createMaterial(
        {
          businessId: actor.businessId,
          branchId: await this.branches.resolve(actor, fields.branchId, tx),
          name: fields.name,
          category: fields.category,
          unit: fields.unit,
          unitCost: fields.unitCost ?? null,
          minQuantity: fields.minQuantity ?? null,
          supplier: fields.supplier ?? null,
          notes: fields.notes ?? null,
        },
        tx,
      );
      await this.audit(actor, "material.created", material.id, {}, tx);
      if (openingQuantity) {
        await this.move(actor, material, { kind: "adjustment", quantity: openingQuantity, note: "Opening stock" }, tx);
        material = (await this.materials.findInBusiness(material.id, actor.businessId, tx))!;
      }
      return present(material);
    });
  }

  /** Details only. The quantity is changed by recording a stock movement. */
  async update(actor: Actor, id: string, input: UpdateMaterialInput): Promise<MaterialDTO> {
    return runInTransaction(async (tx) => {
      if (!(await this.materials.findInBusiness(id, actor.businessId, tx)))
        throw AppError.notFound("Material not found");
      if (input.name) await this.assertNameIsFree(actor.businessId, input.name, id, tx);
      await this.branches.assertActive(actor, input.branchId, tx);

      await this.materials.updateMaterial(id, actor.businessId, input, tx);
      await this.audit(actor, "material.updated", id, { fields: Object.keys(input) }, tx);
      return present((await this.materials.findInBusiness(id, actor.businessId, tx))!);
    });
  }

  /** A soft delete: the stock ledger keeps its history. */
  async remove(actor: Actor, id: string): Promise<void> {
    await runInTransaction(async (tx) => {
      if (!(await this.materials.findInBusiness(id, actor.businessId, tx)))
        throw AppError.notFound("Material not found");
      await this.materials.removeInBusiness(id, actor.businessId, tx);
      await this.audit(actor, "material.deleted", id, {}, tx);
    });
  }

  /** A purchase, a usage or a stock count (PRD US-044, US-045). */
  async recordMovement(
    actor: Actor,
    id: string,
    input: RecordMovementInput,
  ): Promise<{ material: MaterialDTO; movement: StockMovementRecord }> {
    return runInTransaction(async (tx) => {
      const material = await this.materials.findForUpdate(id, actor.businessId, tx);
      if (!material) throw AppError.notFound("Material not found");
      if (input.orderId && !(await this.orders.findInBusiness(input.orderId, actor.businessId, tx))) {
        throw AppError.unprocessable("Choose an order that exists", [{ field: "orderId", message: "Not found" }]);
      }

      const movement = await this.move(actor, material, input, tx);
      return { material: present((await this.materials.findInBusiness(id, actor.businessId, tx))!), movement };
    });
  }

  async movements(actor: Actor, id: string, query: ListMovementsQuery): Promise<Paginated<StockMovementDTO>> {
    if (!(await this.materials.findInBusiness(id, actor.businessId))) throw AppError.notFound("Material not found");
    return this.materials.listMovements({ ...query, materialId: id, businessId: actor.businessId });
  }

  /** Changes the quantity and appends the ledger row. The caller holds the transaction (and the lock). */
  private async move(
    actor: Actor,
    material: MaterialRecord,
    input: Pick<RecordMovementInput, "kind" | "quantity"> & Partial<RecordMovementInput>,
    tx: Tx,
  ): Promise<StockMovementRecord> {
    const change = stockChange(input.kind, input.quantity, material.quantity);
    const balanceAfter = applyChange(material.quantity, change);
    if (balanceAfter < 0) {
      throw AppError.unprocessable("There is not enough in stock", [
        { field: "quantity", message: `Only ${material.quantity} ${material.unit} on hand` },
      ]);
    }
    const unitCost = input.kind === "purchase" ? (input.unitCost ?? null) : null;

    await this.materials.updateMaterial(
      material.id,
      actor.businessId,
      { quantity: balanceAfter, ...(unitCost !== null ? { unitCost } : {}) }, // a purchase sets the latest cost
      tx,
    );
    const movement = await this.materials.appendMovement(
      {
        businessId: actor.businessId,
        materialId: material.id,
        kind: input.kind,
        change,
        balanceAfter,
        unitCost,
        orderId: input.orderId ?? null,
        note: input.note ?? null,
        recordedBy: actor.id,
      },
      tx,
    );
    await this.audit(actor, "material.stock_changed", material.id, { kind: input.kind, change, balanceAfter }, tx);
    return movement;
  }

  private async assertNameIsFree(businessId: string, name: string, exceptId: string | undefined, tx: Tx) {
    if (await this.materials.findByName(businessId, name, exceptId, tx)) {
      throw AppError.conflict("A material with this name already exists", [{ field: "name", message: "duplicate" }]);
    }
  }

  private audit(actor: Actor, action: AuditAction, id: string, payload: Record<string, unknown>, tx: Tx) {
    return this.activity.audit(
      { businessId: actor.businessId, actorId: actor.id, action, entityType: "material", entityId: id, payload },
      tx,
    );
  }
}
