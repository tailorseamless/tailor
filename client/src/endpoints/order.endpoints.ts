import { cleanParams, downloadFile, http, wrapCall, wrapPage, wrapUpload } from "../transport/http";
import type { ListParams } from "../types/api.types";
import type {
  OrderDetail,
  OrderFilters,
  OrderImage,
  OrderInput,
  OrderListItem,
  OrderStatus,
} from "../types/order.types";
import type { Payment, PaymentInput, PaymentSummary } from "../types/payment.types";

export const orderEndpoints = {
  list: (params?: OrderFilters & ListParams) =>
    wrapPage<OrderListItem>(() => http.get("/orders", { params: cleanParams(params) })),
  get: (id: string) => wrapCall<OrderDetail>(() => http.get(`/orders/${id}`)),
  create: (input: OrderInput, idempotencyKey: string) =>
    wrapCall<OrderDetail>(() => http.post("/orders", input, { headers: { "Idempotency-Key": idempotencyKey } })),
  update: (id: string, input: Partial<Pick<OrderInput, "dueDate" | "notes" | "items">>) =>
    wrapCall<OrderDetail>(() => http.patch(`/orders/${id}`, input)),
  changeStatus: (id: string, status: OrderStatus, note?: string) =>
    wrapCall<OrderDetail>(() => http.post(`/orders/${id}/status`, { status, note: note || undefined })),
  uploadImages: (id: string, files: File[]) => wrapUpload<OrderImage[]>(`/orders/${id}/images`, "images", files),
  removeImage: (id: string, imageId: string) => wrapCall<null>(() => http.delete(`/orders/${id}/images/${imageId}`)),
};

export const paymentEndpoints = {
  forOrder: (orderId: string) =>
    wrapPage<Payment>(() => http.get(`/orders/${orderId}/payments`, { params: { limit: 100 } })),
  record: (orderId: string, input: PaymentInput, idempotencyKey: string) =>
    wrapCall<{ payment: Payment; summary: PaymentSummary }>(() =>
      http.post(`/orders/${orderId}/payments`, input, { headers: { "Idempotency-Key": idempotencyKey } }),
    ),
  refund: (orderId: string, input: PaymentInput, idempotencyKey: string) =>
    wrapCall<{ payment: Payment; summary: PaymentSummary }>(() =>
      http.post(`/orders/${orderId}/refunds`, input, { headers: { "Idempotency-Key": idempotencyKey } }),
    ),
  void: (id: string, reason: string) =>
    wrapCall<{ payment: Payment; summary: PaymentSummary }>(() => http.post(`/payments/${id}/void`, { reason })),
  receiptPdf: (id: string) => downloadFile(`/payments/${id}/receipt/pdf`, "receipt.pdf"),
  emailReceipt: (id: string, to?: string) =>
    wrapCall<unknown>(() => http.post(`/payments/${id}/receipt/email`, to ? { to } : {})),
};
