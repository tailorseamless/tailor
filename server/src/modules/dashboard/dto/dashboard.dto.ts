import type { AppointmentDTO } from "../../appointments/dto/appointment.dto";
import type { OrderListItemDTO, OrderStatus } from "../../orders/dto/order.dto";
import type { PaymentListItemDTO } from "../../payments/dto/payment.dto";

export const DASHBOARD = { listSize: 5, todayListSize: 20, dueSoonDays: 7, maxPeriodDays: 366 } as const;

/** One row per order status, as the database counts them. */
export interface OrderStatusRow {
  status: OrderStatus;
  count: number;
  /** Of `count`, how many have a due date before today. */
  pastDue: number;
  createdInPeriod: number;
  deliveredInPeriod: number;
  valueInPeriod: number;
}

export interface OrderCounts {
  /** Taken, production not started: confirmed or awaiting materials. */
  pending: number;
  /** Being made: cutting through finishing. */
  inProgress: number;
  /** Finished, waiting for the customer. */
  ready: number;
  delivered: number;
  cancelled: number;
  /** Past the due date and not yet finished. */
  overdue: number;
  createdInPeriod: number;
  deliveredInPeriod: number;
  byStatus: Record<OrderStatus, number>;
}

/**
 * Three different things, never added together (PRD §3.9):
 * the VALUE of orders taken, the CASH actually received, and what is still OWED.
 */
export interface MoneyFigures {
  /** Total of the (non-cancelled) orders taken in the period. */
  orderValueInPeriod: number;
  /** Payments received in the period, by payment date. */
  receivedInPeriod: number;
  refundedInPeriod: number;
  /** received − refunded. */
  netReceivedInPeriod: number;
  /** What customers owe across every open order, regardless of period. */
  outstandingBalance: number;
  ordersOwing: number;
}

export interface DashboardDTO {
  /** Inclusive days, in the business's time zone. */
  period: { from: string; to: string; timeZone: string };
  currency: string;
  customers: { total: number; newInPeriod: number };
  orders: OrderCounts;
  money: MoneyFigures;
  recentOrders: OrderListItemDTO[];
  /** Unfinished orders due within the next week, soonest first. */
  dueSoon: OrderListItemDTO[];
  recentPayments: PaymentListItemDTO[];
  appointments: {
    /** How many appointments fall on today, whatever their status. */
    todayCount: number;
    /** Today's diary, earliest first (the first `todayListSize`). */
    today: AppointmentDTO[];
    /** The next booked appointments from now on. */
    upcoming: AppointmentDTO[];
  };
}

export interface PeriodParams {
  businessId: string;
  /** Only this branch's orders and payments. NULL = the whole business. */
  branchId: string | null;
  from: string;
  to: string;
  timeZone: string;
}
