import type { ComponentType } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import { AppShell, HomeRedirect } from "./components/layout/AppShell";
import { Gate, RequireAuth } from "./components/layout/Guards";
import { RouteError } from "./pages/RouteError";
import type { Permission } from "./types/auth.types";

/** Each page loads on first visit, so the first screen stays small. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default });

/** Routes only some roles may open; others see a "no access" message instead of failed requests. */
const gated = (permission: Permission, children: RouteObject[]): RouteObject => ({
  element: <Gate permission={permission} />,
  children,
});

export const router = createBrowserRouter([
  { path: "/sign-in", lazy: page(() => import("./pages/auth/SignInPage")), errorElement: <RouteError /> },
  { path: "/portal/:token", lazy: page(() => import("./pages/public/PortalPage")), errorElement: <RouteError /> },
  // A business's public page. `/book/<address>` is where these pages used to live; those links keep working.
  { path: "/book/:slug", lazy: page(() => import("./pages/public/ShopPage")), errorElement: <RouteError /> },
  { path: "/:slug", lazy: page(() => import("./pages/public/ShopPage")), errorElement: <RouteError /> },
  {
    path: "/",
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AppShell />,
        errorElement: <RouteError />,
        children: [
          { index: true, element: <HomeRedirect /> },
          gated("dashboard.read", [{ path: "dashboard", lazy: page(() => import("./pages/dashboard/DashboardPage")) }]),
          { path: "customers", lazy: page(() => import("./pages/customers/CustomersPage")) },
          { path: "customers/:id", lazy: page(() => import("./pages/customers/CustomerDetailPage")) },
          { path: "orders", lazy: page(() => import("./pages/orders/OrdersPage")) },
          gated("order.create", [{ path: "orders/new", lazy: page(() => import("./pages/orders/NewOrderPage")) }]),
          { path: "orders/:id", lazy: page(() => import("./pages/orders/OrderDetailPage")) },
          { path: "appointments", lazy: page(() => import("./pages/appointments/AppointmentsPage")) },
          { path: "appointments/:id", lazy: page(() => import("./pages/appointments/AppointmentsPage")) },
          // Notifications about new requests used to link here; they now open the diary's Requests tab.
          { path: "appointment-requests/:id", element: <Navigate to="/appointments?tab=requests" replace /> },
          { path: "tasks", lazy: page(() => import("./pages/tasks/TasksPage")) },
          { path: "tasks/:id", lazy: page(() => import("./pages/tasks/TasksPage")) },
          { path: "designs", lazy: page(() => import("./pages/designs/DesignsPage")) },
          { path: "inventory", lazy: page(() => import("./pages/inventory/InventoryPage")) },
          gated("expense.read", [{ path: "expenses", lazy: page(() => import("./pages/expenses/ExpensesPage")) }]),
          gated("report.read", [{ path: "reports", lazy: page(() => import("./pages/reports/ReportsPage")) }]),
          { path: "team", lazy: page(() => import("./pages/team/TeamPage")) },
          gated("admin.platform", [{ path: "admin", lazy: page(() => import("./pages/admin/AdminPage")) }]),
          { path: "notifications", lazy: page(() => import("./pages/NotificationsPage")) },
          { path: "settings", lazy: page(() => import("./pages/settings/SettingsPage")) },
          { path: "settings/measurements", lazy: page(() => import("./pages/settings/MeasurementTemplatesPage")) },
          gated("email.read", [{ path: "settings/emails", lazy: page(() => import("./pages/settings/EmailLogPage")) }]),
          { path: "*", lazy: page(() => import("./pages/NotFoundPage")) },
        ],
      },
    ],
  },
]);
