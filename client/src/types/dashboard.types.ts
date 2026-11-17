import type { Appointment } from "./appointment.types";
import type { OrderListItem } from "./order.types";
import type { Payment } from "./payment.types";

export interface Dashboard {
  period: { from: string; to: string; timeZone: string };
  currency: string;
  customers: { total: number; newInPeriod: number };
  orders: {
    pending: number;
    inProgress: number;
    ready: number;
    delivered: number;
    cancelled: number;
    overdue: number;
    createdInPeriod: number;
    deliveredInPeriod: number;
  };
  money: {
    orderValueInPeriod: number;
    receivedInPeriod: number;
    refundedInPeriod: number;
    netReceivedInPeriod: number;
    outstandingBalance: number;
    ordersOwing: number;
  };
  recentOrders: OrderListItem[];
  dueSoon: OrderListItem[];
  recentPayments: Payment[];
  appointments: { todayCount: number; today: Appointment[]; upcoming: Appointment[] };
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkPath: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  type: string;
  label: string;
  inApp: boolean;
  email: boolean;
  push: boolean;
}

export interface NotificationPreferences {
  preferences: NotificationPreference[];
  pushAvailable: boolean;
  devices: number;
}

export interface OutboxEmail {
  id: string;
  kind:
    | "team.invitation"
    | "appointment.reminder"
    | "receipt"
    | "appointment.request_received"
    | "appointment.request_decided"
    | "notification"
    | "order.status";
  toAddress: string;
  status: "pending" | "sent" | "failed" | "cancelled";
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
}
