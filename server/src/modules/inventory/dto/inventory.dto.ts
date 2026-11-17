export const MATERIAL_CATEGORIES = [
  "fabric",
  "thread",
  "button",
  "zipper",
  "lining",
  "interfacing",
  "embellishment",
  "other",
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

/**
 * `purchase` adds stock, `usage` takes it out, `adjustment` sets the quantity
 * to what a stock count found.
 */
export const STOCK_KINDS = ["purchase", "usage", "adjustment"] as const;
export type StockKind = (typeof STOCK_KINDS)[number];

export const INVENTORY_LIMITS = { maxQuantity: 9_999_999, maxUnitCost: 999_999_999 } as const;

/** A material the BUSINESS owns. Fabric a customer brings is never stock (PRD BR-013). */
export interface MaterialRecord {
  id: string;
  businessId: string;
  /** Where the stock is kept. NULL = not tied to a branch. */
  branchId: string | null;
  name: string;
  category: MaterialCategory;
  /** What it is counted in: yards, metres, pieces, rolls… */
  unit: string;
  /** On hand. Changes only through stock movements. */
  quantity: number;
  /** Latest cost per unit. */
  unitCost: number | null;
  /** At or below this, it is low on stock. NULL = not watched. */
  minQuantity: number | null;
  supplier: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaterialDTO extends MaterialRecord {
  isLowStock: boolean;
}

export interface StockMovementRecord {
  id: string;
  materialId: string;
  kind: StockKind;
  /** Signed: positive in, negative out. */
  change: number;
  balanceAfter: number;
  unitCost: number | null;
  /** The order the material was used on, if any. */
  orderId: string | null;
  note: string | null;
  recordedBy: string | null;
  createdAt: Date;
}

export interface StockMovementDTO extends StockMovementRecord {
  orderNumber: string | null;
}

export interface ListMaterialsParams {
  businessId: string;
  page: number;
  limit: number;
  category?: MaterialCategory;
  branchId?: string;
  search?: string;
  lowStock?: boolean;
}

export interface ListMovementsParams {
  businessId: string;
  materialId: string;
  page: number;
  limit: number;
  kind?: StockKind;
}
