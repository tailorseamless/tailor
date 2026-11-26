/** Every query key in one place, so writes know exactly what to refetch. */
export const keys = {
  me: ["me"] as const,
  business: ["business"] as const,
  dashboard: (range?: object) => ["dashboard", range ?? {}] as const,
  customers: {
    all: ["customers"] as const,
    list: (params: object) => ["customers", "list", params] as const,
    detail: (id: string) => ["customers", "detail", id] as const,
  },
  measurements: {
    templates: ["measurement-templates"] as const,
    status: ["measurements", "status"] as const,
    forCustomer: (customerId: string) => ["measurements", customerId] as const,
  },
  orders: {
    all: ["orders"] as const,
    list: (params: object) => ["orders", "list", params] as const,
    detail: (id: string) => ["orders", "detail", id] as const,
  },
  payments: {
    all: ["payments"] as const,
    forOrder: (orderId: string) => ["payments", "order", orderId] as const,
  },
  appointments: {
    all: ["appointments"] as const,
    list: (params: object) => ["appointments", "list", params] as const,
  },
  requests: {
    all: ["appointment-requests"] as const,
    list: (status?: string) => ["appointment-requests", status ?? "all"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (unreadOnly: boolean) => ["notifications", "list", unreadOnly] as const,
    unread: ["notifications", "unread"] as const,
    preferences: ["notifications", "preferences"] as const,
  },
  portal: (token: string) => ["portal", token] as const,
  shop: (slug: string) => ["shop", slug] as const,
};
