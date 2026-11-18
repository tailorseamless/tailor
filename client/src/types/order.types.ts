import type { ISODate } from "./api.types";
import type { DiscountType } from "../utils/orderMoney";

export type { DiscountType };

export type OrderStatus =
  | "confirmed"
  | "awaiting_materials"
  | "cutting"
  | "sewing"
  | "fitting"
  | "alterations"
  | "finishing"
  | "ready"
  | "delivered"
  | "cancelled";

export type FabricSource = "customer" | "business";

export interface OrderListItem {
  id: string;
  customerId: string;
  branchId: string | null;
  orderNumber: string;
  status: OrderStatus;
  dueDate: string | null;
  totalAmount: number;
  /** The most the order could come to while a price is still an estimate; null once final. */
  estimatedMaxTotal: number | null;
  amountPaid: number;
  balance: number;
  currency: string;
  isOverdue: boolean;
  customerName: string;
  customerPhone: string;
  createdAt: ISODate;
}

export interface OrderItem {
  id: string;
  garmentName: string;
  description: string | null;
  quantity: number;
  /** The agreed price of one piece. 0 while there is only an estimate. */
  unitPrice: number;
  /** A quote for one piece, given before the price was agreed. */
  estimateMin: number | null;
  estimateMax: number | null;
  discountType: DiscountType | null;
  discountValue: number | null;
  /** What the discount comes to in money. */
  discountAmount: number;
  /** After the discount. */
  lineTotal: number;
  /** Has an estimate and no agreed price yet. */
  pricePending: boolean;
  fabricSource: FabricSource;
  measurementId: string | null;
  designId: string | null;
}

export interface OrderImage {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  originalName: string;
}

export interface OrderStatusEvent {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  createdAt: ISODate;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  dueDate: string | null;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  /** At least one item has only an estimate, so the total is not final. */
  pricePending: boolean;
  /** The range the order could come to while a price is pending; null once final. */
  estimateMinTotal: number | null;
  estimateMaxTotal: number | null;
  discountTotal: number;
  currency: string;
  notes: string | null;
  isOverdue: boolean;
  deliveredAt: ISODate | null;
  createdAt: ISODate;
  customer: { id: string; fullName: string; phone: string } | null;
  items: OrderItem[];
  images: OrderImage[];
  history: OrderStatusEvent[];
}

export interface OrderItemInput {
  garmentName: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  estimateMin?: number | null;
  estimateMax?: number | null;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  fabricSource: FabricSource;
  measurementId?: string | null;
  designId?: string | null;
}

/** The agreed price and discount of one item already on an order. */
export interface PriceChange {
  id: string;
  unitPrice: number;
  discountType: DiscountType | null;
  discountValue: number | null;
}

export interface OrderInput {
  customerId: string;
  branchId?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  items: OrderItemInput[];
}

export interface OrderFilters {
  status?: OrderStatus;
  branchId?: string;
  customerId?: string;
  search?: string;
  overdue?: boolean;
  unfinished?: boolean;
  unpaid?: boolean;
  sort?: "recent" | "due";
  limit?: number;
}
