import type { AppointmentStatus, AppointmentType } from "../types/appointment.types";
import type { OrderStatus } from "../types/order.types";
import type { PaymentMethod } from "../types/payment.types";

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  confirmed: { label: "Confirmed", tone: "neutral" },
  awaiting_materials: { label: "Awaiting materials", tone: "warning" },
  cutting: { label: "Cutting", tone: "info" },
  sewing: { label: "Sewing", tone: "info" },
  fitting: { label: "Fitting", tone: "info" },
  alterations: { label: "Alterations", tone: "info" },
  finishing: { label: "Finishing", tone: "info" },
  ready: { label: "Ready for collection", tone: "success" },
  delivered: { label: "Delivered", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

/** The usual path through production (Backend: canTransitionOrder). */
export const ORDER_FLOW: OrderStatus[] = [
  "confirmed",
  "awaiting_materials",
  "cutting",
  "sewing",
  "fitting",
  "alterations",
  "finishing",
  "ready",
  "delivered",
];

/** Mirrors the server rule: closed orders never move; delivered only from ready; anything else may. */
export function nextStatuses(from: OrderStatus): OrderStatus[] {
  if (from === "delivered" || from === "cancelled") return [];
  return [...ORDER_FLOW, "cancelled" as const].filter((to) => to !== from && (to !== "delivered" || from === "ready"));
}

export const APPOINTMENT_TYPE: Record<AppointmentType, string> = {
  measurement: "Measurement",
  consultation: "Design consultation",
  fitting: "Fitting",
  alteration: "Alteration",
  collection: "Collection",
};

export const APPOINTMENT_STATUS: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "Booked", tone: "brand" },
  completed: { label: "Done", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  no_show: { label: "Missed", tone: "warning" },
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  pos: "POS",
  other: "Other",
};
