import { API_URL, cleanParams, http, wrapCall, wrapEnvelope, wrapPage } from "../transport/http";
import type { ApiResponse } from "../types/api.types";
import type {
  AppNotification,
  Dashboard,
  NotificationPreference,
  NotificationPreferences,
  OutboxEmail,
} from "../types/dashboard.types";
import type { BookingPage, BookingRequestInput, Portal } from "../types/portal.types";

export const dashboardEndpoints = {
  get: (params?: { from?: string; to?: string; branchId?: string }) =>
    wrapCall<Dashboard>(() => http.get("/reports/dashboard", { params: cleanParams(params) })),
};

export const notificationEndpoints = {
  list: (unreadOnly = false) =>
    wrapPage<AppNotification>(() => http.get("/notifications", { params: cleanParams({ unreadOnly, limit: 50 }) })),
  unreadCount: () => wrapCall<{ unread: number }>(() => http.get("/notifications/unread-count")),
  markRead: (id: string) => wrapCall<null>(() => http.post(`/notifications/${id}/read`)),
  markAllRead: () => wrapCall<{ marked: number }>(() => http.post("/notifications/read-all")),
  preferences: () => wrapCall<NotificationPreferences>(() => http.get("/notifications/preferences")),
  registerDevice: (token: string) => wrapCall<unknown>(() => http.post("/notifications/devices", { token })),
  removeDevice: (token: string) => wrapCall<unknown>(() => http.delete("/notifications/devices", { data: { token } })),
  outbox: (params: { status?: string; page?: number }) =>
    wrapEnvelope<ApiResponse<OutboxEmail[]> & { emailEnabled: boolean }>(() =>
      http.get("/email-outbox", { params: cleanParams({ limit: 30, ...params }) }),
    ),
  savePreferences: (preferences: Omit<NotificationPreference, "label">[]) =>
    wrapCall<NotificationPreferences>(() => http.put("/notifications/preferences", { preferences })),
};

/** Public pages: no sign-in, a customer's link or the business's booking slug is the key. */
export const publicEndpoints = {
  portal: (token: string) => wrapCall<Portal>(() => http.get(`/portal/${encodeURIComponent(token)}`)),
  portalReceiptUrl: (token: string, paymentId: string) =>
    `${API_URL}/portal/${encodeURIComponent(token)}/receipts/${paymentId}/pdf`,
  confirmAppointment: (token: string, appointmentId: string) =>
    wrapCall<unknown>(() => http.post(`/portal/${encodeURIComponent(token)}/appointments/${appointmentId}/confirm`)),
  portalRequest: (token: string, input: Pick<BookingRequestInput, "type" | "preferredStartsAt" | "note">) =>
    wrapCall<unknown>(() => http.post(`/portal/${encodeURIComponent(token)}/appointment-requests`, input)),
  bookingPage: (slug: string) =>
    wrapCall<BookingPage>(() => http.get(`/public/businesses/${encodeURIComponent(slug)}`)),
  book: (slug: string, input: BookingRequestInput) =>
    wrapCall<unknown>(() => http.post(`/public/businesses/${encodeURIComponent(slug)}/appointment-requests`, input)),
};
