import type { ISODate } from "./api.types";

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
  unitPrice: number;
  lineTotal: number;
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
  fabricSource: FabricSource;
  measurementId?: string | null;
  designId?: string | null;
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
