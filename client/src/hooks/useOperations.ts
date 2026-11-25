import {
  adminEndpoints,
  expenseEndpoints,
  inventoryEndpoints,
  reportEndpoints,
  taskEndpoints,
} from "../endpoints/workspace.endpoints";
import { newIdempotencyKey } from "../transport/http";
import type {
  AdminBusiness,
  AdminBusinessInput,
  AdminReportKind,
  AdminUser,
  AnnouncementInput,
  AlertFilters,
  AuditFilters,
  ExpenseFilters,
  ExpenseInput,
  ExportKey,
  MaterialInput,
  MovementInput,
  Period,
  TaskFilters,
  TaskInput,
  TaskStatus,
} from "../types/workspace.types";
import { saveFile } from "../utils/saveFile";
import { useApiMutation, useApiQuery, usePaginatedQuery } from "./useApi";

export const newRequestKey = newIdempotencyKey;

const tasks = ["tasks"] as const;
const materials = ["materials"] as const;
const expenses = ["expenses"] as const;
const admin = ["admin"] as const;

/* Tasks */
export function useTasks(params: TaskFilters, enabled = true) {
  return usePaginatedQuery([...tasks, params], () => taskEndpoints.list(params), { enabled });
}

export function useTask(id: string | undefined) {
  return useApiQuery([...tasks, "detail", id], () => taskEndpoints.get(id as string), { enabled: Boolean(id) });
}

export function useTaskActions() {
  const create = useApiMutation((input: TaskInput) => taskEndpoints.create(input), {
    invalidate: [tasks],
    success: "Task added",
    toastError: false,
  });
  const update = useApiMutation(
    (vars: { id: string; input: Partial<Omit<TaskInput, "orderId">> }) => taskEndpoints.update(vars.id, vars.input),
    { invalidate: [tasks], success: "Task saved", toastError: false },
  );
  const setStatus = useApiMutation(
    (vars: { id: string; status: TaskStatus }) => taskEndpoints.setStatus(vars.id, vars.status),
    {
      invalidate: [tasks],
    },
  );
  return { create, update, setStatus };
}

/* Inventory */
export function useMaterials(params: {
  search?: string;
  lowStock?: boolean;
  branchId?: string;
  page?: number;
  limit?: number;
}) {
  return usePaginatedQuery([...materials, params], () => inventoryEndpoints.list(params));
}

export function useMovements(id: string | null) {
  return useApiQuery([...materials, "movements", id], () => inventoryEndpoints.movements(id as string), {
    enabled: Boolean(id),
  });
}

export function useMaterialActions() {
  const create = useApiMutation((input: MaterialInput) => inventoryEndpoints.create(input), {
    invalidate: [materials],
    success: "Material added",
    toastError: false,
  });
  const update = useApiMutation(
    (vars: { id: string; input: Partial<Omit<MaterialInput, "openingQuantity">> }) =>
      inventoryEndpoints.update(vars.id, vars.input),
    { invalidate: [materials], success: "Material saved", toastError: false },
  );
  const remove = useApiMutation((id: string) => inventoryEndpoints.remove(id), {
    invalidate: [materials],
    success: "Material removed",
  });
  const move = useApiMutation(
    (vars: { id: string; input: MovementInput; key: string }) =>
      inventoryEndpoints.recordMovement(vars.id, vars.input, vars.key),
    { invalidate: [materials], success: "Stock updated", toastError: false },
  );
  return { create, update, remove, move };
}

/* Expenses */
export function useExpenses(params: ExpenseFilters) {
  return usePaginatedQuery([...expenses, params], () => expenseEndpoints.list(params));
}

export function useExpenseActions() {
  const after = [expenses, ["reports"], ["dashboard"]];
  const create = useApiMutation(
    (vars: { input: ExpenseInput; key: string }) => expenseEndpoints.create(vars.input, vars.key),
    { invalidate: after, success: "Expense recorded", toastError: false },
  );
  const update = useApiMutation(
    (vars: { id: string; input: Partial<ExpenseInput> }) => expenseEndpoints.update(vars.id, vars.input),
    { invalidate: after, success: "Expense saved", toastError: false },
  );
  const remove = useApiMutation((id: string) => expenseEndpoints.remove(id), {
    invalidate: after,
    success: "Expense deleted",
  });
  return { create, update, remove };
}

/* Reports */
export function useIncomeExpenses(period: Period) {
  return useApiQuery(["reports", "income-expenses", period], () => reportEndpoints.incomeExpenses(period));
}

export function useGarmentSales(period: Period) {
  return useApiQuery(["reports", "garment-sales", period], () => reportEndpoints.garmentSales(period));
}

export function useExport() {
  return useApiMutation(async (vars: { key: ExportKey; period: Period; format: "xlsx" | "csv" }) => {
    const file = await reportEndpoints.export(vars.key, vars.period, vars.format);
    saveFile(file.blob, file.filename);
  });
}

/* Platform admin */
export function useAdminOverview() {
  return useApiQuery([...admin, "overview"], () => adminEndpoints.overview());
}

export function useAdminBusinesses(params: { search?: string; page?: number }) {
  return usePaginatedQuery([...admin, "businesses", params], () => adminEndpoints.businesses(params));
}

export function useAdminUsers(params: { search?: string; page?: number }) {
  return usePaginatedQuery([...admin, "users", params], () => adminEndpoints.users(params));
}

export function useAdminAdmins() {
  return useApiQuery([...admin, "admins"], () => adminEndpoints.admins());
}

export function useAdminAuditLogs(params: AuditFilters, enabled = true) {
  return usePaginatedQuery([...admin, "audit", params], () => adminEndpoints.auditLogs(params), { enabled });
}

export function useAdminBusinessDetail(id: string | undefined) {
  return useApiQuery([...admin, "business", id], () => adminEndpoints.businessDetail(id as string), {
    enabled: Boolean(id),
  });
}

export function useAdminUserDetail(id: string | undefined) {
  return useApiQuery([...admin, "user", id], () => adminEndpoints.userDetail(id as string), { enabled: Boolean(id) });
}

export function useAdminActivity(params: { cursor?: string; businessId?: string; limit?: number }) {
  return usePaginatedQuery([...admin, "activity", params], () => adminEndpoints.activity(params));
}

export function useAdminSystemHealth() {
  return useApiQuery([...admin, "health"], () => adminEndpoints.systemHealth(), { refetchInterval: 60_000 });
}

export function useAdminAlerts(params: AlertFilters) {
  return usePaginatedQuery([...admin, "alerts", params], () => adminEndpoints.alerts(params));
}

export function useAdminDailyStats(days: number) {
  return useApiQuery([...admin, "stats", days], () => adminEndpoints.dailyStats(days));
}

export function useAdminAdoption(days: number) {
  return useApiQuery([...admin, "adoption", days], () => adminEndpoints.adoption(days));
}

export function useAdminCohorts(weeks: number) {
  return useApiQuery([...admin, "cohorts", weeks], () => adminEndpoints.cohorts(weeks));
}

export function useAdminChurnRisk(minScore: number) {
  return useApiQuery([...admin, "churn", minScore], () => adminEndpoints.churnRisk(minScore));
}

export function useAdminAnnouncements() {
  // Refreshes while one is being delivered, so its progress shows.
  return useApiQuery([...admin, "announcements"], () => adminEndpoints.announcements(), {
    refetchInterval: (query) =>
      query.state.data?.some((a) => a.status === "queued" || a.status === "sending") ? 15_000 : false,
  });
}

export function useAdminAnnouncementActions() {
  const create = useApiMutation((input: AnnouncementInput) => adminEndpoints.createAnnouncement(input), {
    invalidate: [[...admin, "announcements"]],
    success: "Announcement queued",
    toastError: false,
  });
  const cancel = useApiMutation((id: string) => adminEndpoints.cancelAnnouncement(id), {
    invalidate: [[...admin, "announcements"]],
    success: "Announcement cancelled",
  });
  return { create, cancel };
}

export function useAdminNotes(businessId: string) {
  return useApiQuery([...admin, "notes", businessId], () => adminEndpoints.notes(businessId));
}

export function useAddAdminNote(businessId: string) {
  return useApiMutation((body: string) => adminEndpoints.addNote(businessId, body), {
    invalidate: [[...admin, "notes", businessId]],
    success: "Note added",
  });
}

export function useAdminExport() {
  return useApiMutation(async (vars: { kind: AdminReportKind; format: "csv" | "xlsx"; days: number }) => {
    const file = await adminEndpoints.exportReport(vars.kind, vars.format, vars.days);
    saveFile(file.blob, file.filename);
  });
}

export function useAdminAlertActions() {
  const acknowledge = useApiMutation((id: string) => adminEndpoints.acknowledgeAlert(id), {
    invalidate: [admin],
    success: "Alert acknowledged",
  });
  const resolve = useApiMutation(
    (vars: { id: string; note?: string }) => adminEndpoints.resolveAlert(vars.id, vars.note),
    { invalidate: [admin], success: "Alert resolved" },
  );
  return { acknowledge, resolve };
}

export function useAdminActions() {
  const businessStatus = useApiMutation(
    (vars: { id: string; status: AdminBusiness["status"]; reason?: string }) =>
      adminEndpoints.setBusinessStatus(vars.id, vars.status, vars.reason),
    {
      invalidate: [admin],
      success: (_r, v) => (v.status === "suspended" ? "Business suspended" : "Business reactivated"),
    },
  );
  const userStatus = useApiMutation(
    (vars: { id: string; status: AdminUser["status"]; reason?: string }) =>
      adminEndpoints.setUserStatus(vars.id, vars.status, vars.reason),
    { invalidate: [admin], success: (_r, v) => (v.status === "disabled" ? "Account disabled" : "Account enabled") },
  );
  // The form shows the server's field errors itself.
  const updateBusiness = useApiMutation(
    (vars: { id: string; input: AdminBusinessInput }) => adminEndpoints.updateBusiness(vars.id, vars.input),
    { invalidate: [admin], success: "Business updated", toastError: false },
  );
  return { businessStatus, userStatus, updateBusiness };
}
