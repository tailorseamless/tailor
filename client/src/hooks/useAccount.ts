import { authEndpoints, businessEndpoints } from "../endpoints/auth.endpoints";
import { dashboardEndpoints, notificationEndpoints, publicEndpoints } from "../endpoints/misc.endpoints";
import type { BusinessInput, OnboardingState, RegisterInput } from "../types/auth.types";
import type { NotificationPreference } from "../types/dashboard.types";
import type { BookingRequestInput, PortalRequestInput } from "../types/portal.types";
import { keys } from "./queryKeys";
import { useApiMutation, useApiQuery } from "./useApi";

export function useDashboard(range?: { from?: string; to?: string; branchId?: string }) {
  return useApiQuery(keys.dashboard(range), () => dashboardEndpoints.get(range), { refetchInterval: 5 * 60_000 });
}

export function useRegisterBusiness() {
  return useApiMutation((input: RegisterInput) => authEndpoints.register(input), { toastError: false });
}

export function useUpdateProfile() {
  return useApiMutation(
    (input: Parameters<typeof authEndpoints.updateProfile>[0]) => authEndpoints.updateProfile(input),
    {
      invalidate: [keys.me],
      success: "Profile saved",
    },
  );
}

/** Saves progress through the getting-started guide. Quiet: the guide already shows the change. */
export function useSaveOnboarding() {
  return useApiMutation((onboarding: OnboardingState) => authEndpoints.updateProfile({ onboarding }), {
    toastError: false,
  });
}

export function useUpdateBusiness() {
  return useApiMutation((input: BusinessInput) => businessEndpoints.update(input), {
    invalidate: [keys.me, keys.business],
    success: "Business details saved",
    toastError: false,
  });
}

export function useNotifications(unreadOnly = false) {
  return useApiQuery(keys.notifications.list(unreadOnly), () => notificationEndpoints.list(unreadOnly));
}

export function useUnreadCount(enabled: boolean) {
  return useApiQuery(keys.notifications.unread, () => notificationEndpoints.unreadCount(), {
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useMarkRead() {
  const read = useApiMutation((id: string) => notificationEndpoints.markRead(id), {
    invalidate: [keys.notifications.all],
  });
  const readAll = useApiMutation(() => notificationEndpoints.markAllRead(), {
    invalidate: [keys.notifications.all],
    success: "All caught up",
  });
  return { read, readAll };
}

export function useOutbox(params: { status?: string; page?: number }) {
  return useApiQuery(["email-outbox", params], () => notificationEndpoints.outbox(params), {
    placeholderData: (prev) => prev,
  });
}

export function useNotificationPreferences() {
  return useApiQuery(keys.notifications.preferences, () => notificationEndpoints.preferences());
}

export function useSavePreferences() {
  return useApiMutation(
    (prefs: NotificationPreference[]) =>
      notificationEndpoints.savePreferences(
        prefs.map(({ type, inApp, email, push }) => ({ type, inApp, email, push })),
      ),
    { invalidate: [keys.notifications.preferences], success: "Notification choices saved" },
  );
}

export function usePortal(token: string) {
  return useApiQuery(keys.portal(token), () => publicEndpoints.portal(token), { retry: false });
}

export function usePortalActions(token: string) {
  const confirm = useApiMutation((appointmentId: string) => publicEndpoints.confirmAppointment(token, appointmentId), {
    invalidate: [keys.portal(token)],
    success: "Thanks — we've let them know you're coming",
  });
  const request = useApiMutation((input: PortalRequestInput) => publicEndpoints.portalRequest(token, input), {
    invalidate: [keys.portal(token)],
    success: "Request sent",
    toastError: false,
  });
  return { confirm, request, receiptUrl: (paymentId: string) => publicEndpoints.portalReceiptUrl(token, paymentId) };
}

export function useShopPage(slug: string) {
  return useApiQuery(keys.shop(slug), () => publicEndpoints.shopPage(slug), { retry: false });
}

export function useBook(slug: string) {
  return useApiMutation((input: BookingRequestInput) => publicEndpoints.book(slug, input), { toastError: false });
}
