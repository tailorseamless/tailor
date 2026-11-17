import { orderEndpoints, paymentEndpoints } from "../endpoints/order.endpoints";
import type { ListParams } from "../types/api.types";
import type { OrderFilters, OrderInput, OrderStatus } from "../types/order.types";
import type { PaymentInput } from "../types/payment.types";
import { newIdempotencyKey } from "../transport/http";
import { saveFile } from "../utils/saveFile";
import { keys } from "./queryKeys";
import { useApiMutation, useApiQuery, usePaginatedQuery } from "./useApi";

/** A fresh Idempotency-Key for one order or payment being entered. */
export const newOrderKey = newIdempotencyKey;

export function useOrders(params: OrderFilters & ListParams, enabled = true) {
  return usePaginatedQuery(keys.orders.list(params), () => orderEndpoints.list(params), { enabled });
}

export function useOrder(id: string | undefined) {
  return useApiQuery(keys.orders.detail(id ?? ""), () => orderEndpoints.get(id as string), { enabled: Boolean(id) });
}

export function useCreateOrder() {
  return useApiMutation((vars: { input: OrderInput; key: string }) => orderEndpoints.create(vars.input, vars.key), {
    invalidate: [keys.orders.all, ["dashboard"]],
    success: (order) => `Order ${order.orderNumber} created`,
    toastError: false,
  });
}

export function useUpdateOrder(id: string) {
  return useApiMutation((input: Parameters<typeof orderEndpoints.update>[1]) => orderEndpoints.update(id, input), {
    invalidate: [keys.orders.all, ["dashboard"]],
    success: "Order saved",
  });
}

export function useChangeOrderStatus(id: string) {
  return useApiMutation(
    (vars: { status: OrderStatus; note?: string }) => orderEndpoints.changeStatus(id, vars.status, vars.note),
    { invalidate: [keys.orders.all, ["dashboard"]], success: "Status updated" },
  );
}

export function useOrderImages(id: string) {
  const upload = useApiMutation((files: File[]) => orderEndpoints.uploadImages(id, files), {
    invalidate: [keys.orders.detail(id)],
    success: (_r, files) => (files.length === 1 ? "Picture added" : `${files.length} pictures added`),
  });
  const remove = useApiMutation((imageId: string) => orderEndpoints.removeImage(id, imageId), {
    invalidate: [keys.orders.detail(id)],
    success: "Picture removed",
  });
  return { upload, remove };
}

export function useOrderPayments(orderId: string) {
  return useApiQuery(keys.payments.forOrder(orderId), () => paymentEndpoints.forOrder(orderId));
}

const afterMoney = (orderId: string) => [
  keys.payments.all,
  keys.orders.all,
  keys.orders.detail(orderId),
  ["dashboard"],
];

export function useRecordPayment(orderId: string) {
  return useApiMutation(
    (vars: { input: PaymentInput; key: string }) => paymentEndpoints.record(orderId, vars.input, vars.key),
    { invalidate: afterMoney(orderId), success: "Payment recorded", toastError: false },
  );
}

export function useRefund(orderId: string) {
  return useApiMutation(
    (vars: { input: PaymentInput; key: string }) => paymentEndpoints.refund(orderId, vars.input, vars.key),
    { invalidate: afterMoney(orderId), success: "Refund recorded", toastError: false },
  );
}

export function useVoidPayment(orderId: string) {
  return useApiMutation((vars: { id: string; reason: string }) => paymentEndpoints.void(vars.id, vars.reason), {
    invalidate: afterMoney(orderId),
    success: "Payment voided",
  });
}

export function useReceipt() {
  const download = useApiMutation(async (paymentId: string) => {
    const file = await paymentEndpoints.receiptPdf(paymentId);
    saveFile(file.blob, file.filename, true);
  });
  const email = useApiMutation((vars: { id: string; to?: string }) => paymentEndpoints.emailReceipt(vars.id, vars.to), {
    success: "Receipt is on its way",
  });
  return { download, email };
}
