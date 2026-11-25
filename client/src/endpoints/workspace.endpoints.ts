import { cleanParams, downloadFile, http, wrapCall, wrapPage, wrapUpload } from "../transport/http";
import type { OrderImage } from "../types/order.types";
import type {
  AdminBusiness,
  AdminBusinessInput,
  AdminUser,
  AuditEntry,
  AuditFilters,
  Branch,
  BranchInput,
  Design,
  DesignFilters,
  DesignInput,
  Expense,
  ExpenseFilters,
  ExpenseInput,
  ExportKey,
  GarmentSalesReport,
  IncomeExpensesReport,
  Material,
  MaterialInput,
  MovementInput,
  Period,
  PlatformAdmin,
  PlatformOverview,
  StockMovement,
  Task,
  TaskFilters,
  TaskInput,
  TaskStatus,
  TeamMember,
  TeamMemberInput,
  TeamMemberUpdate,
} from "../types/workspace.types";

export const teamEndpoints = {
  list: (params?: { search?: string; page?: number; limit?: number }) =>
    wrapPage<TeamMember>(() => http.get("/team", { params: cleanParams(params) })),
  add: (input: TeamMemberInput) => wrapCall<TeamMember>(() => http.post("/team", input)),
  update: (userId: string, input: TeamMemberUpdate) => wrapCall<TeamMember>(() => http.patch(`/team/${userId}`, input)),
  remove: (userId: string) => wrapCall<null>(() => http.delete(`/team/${userId}`)),
  resendInvitation: (userId: string) => wrapCall<unknown>(() => http.post(`/team/${userId}/invitation`)),
};

export const branchEndpoints = {
  list: () => wrapPage<Branch>(() => http.get("/branches", { params: { limit: 100 } })),
  create: (input: BranchInput) => wrapCall<Branch>(() => http.post("/branches", input)),
  update: (id: string, input: BranchInput) => wrapCall<Branch>(() => http.patch(`/branches/${id}`, input)),
};

export const designEndpoints = {
  list: (params?: DesignFilters) => wrapPage<Design>(() => http.get("/designs", { params: cleanParams(params) })),
  categories: () => wrapCall<string[]>(() => http.get("/designs/categories")),
  get: (id: string) => wrapCall<Design>(() => http.get(`/designs/${id}`)),
  create: (input: DesignInput) => wrapCall<Design>(() => http.post("/designs", input)),
  update: (id: string, input: DesignInput) => wrapCall<Design>(() => http.patch(`/designs/${id}`, input)),
  remove: (id: string) => wrapCall<null>(() => http.delete(`/designs/${id}`)),
  addImages: (id: string, files: File[]) => wrapUpload<OrderImage[]>(`/designs/${id}/images`, "images", files),
  removeImage: (id: string, imageId: string) => wrapCall<null>(() => http.delete(`/designs/${id}/images/${imageId}`)),
};

export const taskEndpoints = {
  list: (params?: TaskFilters) => wrapPage<Task>(() => http.get("/tasks", { params: cleanParams(params) })),
  get: (id: string) => wrapCall<Task>(() => http.get(`/tasks/${id}`)),
  create: (input: TaskInput) => wrapCall<Task>(() => http.post("/tasks", input)),
  update: (id: string, input: Partial<Omit<TaskInput, "orderId">>) =>
    wrapCall<Task>(() => http.patch(`/tasks/${id}`, input)),
  setStatus: (id: string, status: TaskStatus) => wrapCall<Task>(() => http.post(`/tasks/${id}/status`, { status })),
};

const materials = "/inventory/materials";
export const inventoryEndpoints = {
  list: (params?: {
    search?: string;
    lowStock?: boolean;
    branchId?: string;
    category?: string;
    page?: number;
    limit?: number;
  }) => wrapPage<Material>(() => http.get(materials, { params: cleanParams(params) })),
  create: (input: MaterialInput) => wrapCall<Material>(() => http.post(materials, input)),
  update: (id: string, input: Partial<Omit<MaterialInput, "openingQuantity">>) =>
    wrapCall<Material>(() => http.patch(`${materials}/${id}`, input)),
  remove: (id: string) => wrapCall<null>(() => http.delete(`${materials}/${id}`)),
  movements: (id: string) =>
    wrapPage<StockMovement>(() => http.get(`${materials}/${id}/movements`, { params: { limit: 50 } })),
  recordMovement: (id: string, input: MovementInput, idempotencyKey: string) =>
    wrapCall<unknown>(() =>
      http.post(`${materials}/${id}/movements`, input, { headers: { "Idempotency-Key": idempotencyKey } }),
    ),
};

export const expenseEndpoints = {
  list: (params?: ExpenseFilters) => wrapPage<Expense>(() => http.get("/expenses", { params: cleanParams(params) })),
  create: (input: ExpenseInput, idempotencyKey: string) =>
    wrapCall<Expense>(() => http.post("/expenses", input, { headers: { "Idempotency-Key": idempotencyKey } })),
  update: (id: string, input: Partial<ExpenseInput>) => wrapCall<Expense>(() => http.patch(`/expenses/${id}`, input)),
  remove: (id: string) => wrapCall<null>(() => http.delete(`/expenses/${id}`)),
};

export const reportEndpoints = {
  incomeExpenses: (period: Period) =>
    wrapCall<IncomeExpensesReport>(() => http.get("/reports/income-expenses", { params: cleanParams(period) })),
  garmentSales: (period: Period) =>
    wrapCall<GarmentSalesReport>(() => http.get("/reports/garment-sales", { params: cleanParams(period) })),
  export: (key: ExportKey, period: Period, format: "xlsx" | "csv") =>
    downloadFile(`/reports/${key}/export`, `${key}.${format}`, {
      params: cleanParams({ ...period, format }),
      timeout: 120_000,
    }),
};

export const adminEndpoints = {
  overview: () => wrapCall<PlatformOverview>(() => http.get("/admin/overview")),
  businesses: (params?: { search?: string; status?: string; page?: number }) =>
    wrapPage<AdminBusiness>(() => http.get("/admin/businesses", { params: cleanParams({ limit: 20, ...params }) })),
  setBusinessStatus: (id: string, status: AdminBusiness["status"], reason?: string) =>
    wrapCall<unknown>(() => http.post(`/admin/businesses/${id}/status`, { status, reason: reason || undefined })),
  updateBusiness: (id: string, input: AdminBusinessInput) =>
    wrapCall<AdminBusiness>(() => http.patch(`/admin/businesses/${id}`, input)),
  users: (params?: { search?: string; status?: string; page?: number }) =>
    wrapPage<AdminUser>(() => http.get("/admin/users", { params: cleanParams({ limit: 20, ...params }) })),
  setUserStatus: (id: string, status: AdminUser["status"], reason?: string) =>
    wrapCall<unknown>(() => http.post(`/admin/users/${id}/status`, { status, reason: reason || undefined })),
  admins: () => wrapCall<PlatformAdmin[]>(() => http.get("/admin/admins")),
  /** Keyset-paged: `meta.nextCursor` opens the next (older) page. */
  auditLogs: (params: AuditFilters) =>
    wrapPage<AuditEntry>(() => http.get("/admin/audit-logs", { params: cleanParams({ limit: 50, ...params }) })),
};
