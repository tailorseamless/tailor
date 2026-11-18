import type { ImageRecord } from "../../media/dto/media.dto";
import type { DiscountType } from "../domain/orderMoney";

export type { DiscountType };

/** The production stages of PRD §3.4, plus `cancelled`. Order matters: it is the usual path. */
export const ORDER_STATUSES = [
  "confirmed",
  "awaiting_materials",
  "cutting",
  "sewing",
  "fitting",
  "alterations",
  "finishing",
  "ready",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Who supplies the fabric. Customer-provided fabric never touches business stock (PRD BR-013). */
export const FABRIC_SOURCES = ["customer", "business"] as const;
export type FabricSource = (typeof FABRIC_SOURCES)[number];

export const ORDER_SORTS = ["recent", "due"] as const;
export type OrderSort = (typeof ORDER_SORTS)[number];

export const ORDER_LIMITS = { maxItems: 50, maxQuantity: 1000, maxUnitPrice: 999_999_999, historyShown: 200 } as const;

export interface OrderRecord {
  id: string;
  businessId: string;
  customerId: string;
  branchId: string | null;
  /** Unique within the business, e.g. TF-2026-000125 (PRD BR-005). */
  orderNumber: string;
  status: OrderStatus;
  /** Expected delivery date, `YYYY-MM-DD`. */
  dueDate: string | null;
  /** Sum of the items, in `currency`. What was PAID lives in payments, never here. */
  totalAmount: number;
  /** The most the order could come to while an item has only an estimate; null once every price is agreed. */
  estimatedMaxTotal: number | null;
  currency: string;
  /** The customer's instructions. */
  notes: string | null;
  createdBy: string | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItemInput {
  garmentName: string;
  description?: string | null;
  quantity: number;
  /** The agreed price of one piece. 0 while the item has only an estimate. */
  unitPrice: number;
  /** A quote for one piece, before the price is agreed. Both or neither. */
  estimateMin?: number | null;
  estimateMax?: number | null;
  /** Off the whole line: a fixed amount, or a percentage of it. */
  discountType?: DiscountType | null;
  discountValue?: number | null;
  fabricSource: FabricSource;
  /** The customer's measurement record this garment is cut from (PRD BR-007). */
  measurementId?: string | null;
  /** A design from the business's catalogue. */
  designId?: string | null;
}

export interface OrderItemRecord {
  id: string;
  garmentName: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  estimateMin: number | null;
  estimateMax: number | null;
  discountType: DiscountType | null;
  discountValue: number | null;
  /** What the discount comes to in money at the agreed price. */
  discountAmount: number;
  /** After the discount. */
  lineTotal: number;
  /** Has an estimate and no agreed price yet. */
  pricePending: boolean;
  fabricSource: FabricSource;
  measurementId: string | null;
  designId: string | null;
  position: number;
}

export interface OrderStatusEventRecord {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  changedBy: string | null;
  createdAt: Date;
}

export interface OrderCustomerSummary {
  id: string;
  fullName: string;
  phone: string;
}

/** A row in the orders list, before the service adds `isOverdue`. */
export interface OrderListRow extends OrderRecord {
  customerName: string;
  customerPhone: string;
  /** Net amount received, derived from the payment entries. */
  amountPaid: number;
}

export interface OrderListItemDTO extends OrderListRow {
  isOverdue: boolean;
  /** What the customer still owes (PRD BR-009). */
  balance: number;
}

export interface OrderDetailDTO extends OrderRecord {
  isOverdue: boolean;
  amountPaid: number;
  balance: number;
  /** At least one item has only an estimate, so the total is not final. */
  pricePending: boolean;
  /** The range the order could come to while the price is pending; null once final. */
  estimateMinTotal: number | null;
  estimateMaxTotal: number | null;
  /** All the discounts on the order added up. */
  discountTotal: number;
  customer: OrderCustomerSummary | null;
  items: OrderItemRecord[];
  /** Reference pictures (PRD US-021). */
  images: ImageRecord[];
  history: OrderStatusEventRecord[];
}

export interface ListOrdersParams {
  businessId: string;
  page: number;
  limit: number;
  sort: OrderSort;
  status?: OrderStatus;
  customerId?: string;
  branchId?: string;
  search?: string;
  /** Taken between these instants (inclusive start, exclusive end). */
  from?: Date;
  to?: Date;
  dueFrom?: string;
  dueTo?: string;
  /** Only orders past their due date and still in production. */
  overdue?: boolean;
  /** Only orders whose work is not finished yet (confirmed through finishing). */
  unfinished?: boolean;
  /** Only orders that still have a balance to pay (cancelled ones excluded). */
  unpaid?: boolean;
  /** "Today" where the caller is, `YYYY-MM-DD`. */
  today: string;
}
