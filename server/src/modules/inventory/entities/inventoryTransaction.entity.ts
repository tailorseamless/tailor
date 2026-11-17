import { Check, Column, Entity, Index } from "typeorm";
import { AppendOnlyEntity, ForeignKey, numericTransformer } from "../../../shared/entities/baseEntity";
import type { StockKind } from "../dto/inventory.dto";

/** The stock ledger: every movement, never edited (PRD §3.7). */
@Entity("inventory_transactions")
@Index(["materialId", "createdAt"]) // a material's history
@Index(["orderId"]) // what an order used
@Check(`"kind" IN ('purchase','usage','adjustment')`)
export class InventoryTransaction extends AppendOnlyEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Column({ name: "material_id", type: "uuid" })
  materialId: string;

  @ForeignKey("Material", "material_id", "RESTRICT")
  material?: unknown;

  @Column({ type: "varchar", length: 20 })
  kind: StockKind;

  @Column({ type: "numeric", precision: 14, scale: 3, transformer: numericTransformer })
  change: number;

  @Column({ name: "balance_after", type: "numeric", precision: 14, scale: 3, transformer: numericTransformer })
  balanceAfter: number;

  @Column({
    name: "unit_cost",
    type: "numeric",
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  unitCost: number | null;

  @Column({ name: "order_id", type: "uuid", nullable: true })
  orderId: string | null;

  @ForeignKey("Order", "order_id", "RESTRICT")
  order?: unknown;

  @Column({ type: "text", nullable: true })
  note: string | null;

  @Column({ name: "recorded_by", type: "uuid", nullable: true })
  recordedBy: string | null;

  @ForeignKey("User", "recorded_by", "SET NULL")
  recorder?: unknown;
}
