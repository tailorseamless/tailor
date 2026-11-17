import compression from "compression";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { httpLogger } from "./infrastructure/logger/logger";
import { accountDeletionRoutes } from "./modules/accounts/routes/accountDeletion.routes";
import { adminRoutes } from "./modules/admin/routes/admin.routes";
import { appointmentRoutes } from "./modules/appointments/routes/appointment.routes";
import { branchRoutes } from "./modules/branches/routes/branch.routes";
import { businessRoutes } from "./modules/businesses/routes/business.routes";
import { customerRoutes } from "./modules/customers/routes/customer.routes";
import { dashboardRoutes } from "./modules/dashboard/routes/dashboard.routes";
import { designRoutes } from "./modules/designs/routes/design.routes";
import { expenseRoutes } from "./modules/expenses/routes/expense.routes";
import { healthRoutes } from "./modules/health/routes/health.routes";
import { inventoryRoutes } from "./modules/inventory/routes/inventory.routes";
import { measurementRoutes } from "./modules/measurements/routes/measurement.routes";
import { notificationRoutes } from "./modules/notifications/routes/notification.routes";
import { orderRoutes } from "./modules/orders/routes/order.routes";
import { publicPortalRoutes } from "./modules/portal/routes/portal.routes";
import { paymentRoutes } from "./modules/payments/routes/payment.routes";
import { requestRoutes } from "./modules/requests/routes/request.routes";
import { reportRoutes } from "./modules/reports/routes/report.routes";
import { taskRoutes } from "./modules/tasks/routes/task.routes";
import { teamRoutes } from "./modules/team/routes/team.routes";
import { authRoutes, userRoutes } from "./modules/users/routes/user.routes";
import { authMiddleware } from "./shared/middleware/auth.middleware";
import { globalErrorHandler, notFoundHandler } from "./shared/middleware/errorHandler.middleware";
import { apiRateLimiter } from "./shared/middleware/rateLimiter.middleware";
import { requestId } from "./shared/middleware/requestId.middleware";
import { tenantMiddleware } from "./shared/middleware/tenant.middleware";

/** The middleware order lives here (Backend Guide §2, §14). */
export function createApp(): Express {
  const app = express();
  app.set("trust proxy", 1); // per-IP limits behind a reverse proxy
  app.disable("x-powered-by");

  app.use(requestId);
  app.use(httpLogger);
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: false,
      exposedHeaders: ["X-Request-Id", "Idempotent-Replay", "Content-Disposition"],
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));

  app.use(env.apiPrefix, apiRateLimiter);

  // Public / mixed routers — BEFORE the auth pair.
  app.use(env.apiPrefix, healthRoutes); // public
  app.use(env.apiPrefix, authRoutes); // mixed (firebaseOnly inline)
  app.use(env.apiPrefix, publicPortalRoutes); // public: customer portal links and booking pages

  // The ONE place auth is applied (§14.1). Every router below must `authorise(...)` each route.
  app.use(env.apiPrefix, authMiddleware, tenantMiddleware);
  [
    userRoutes,
    accountDeletionRoutes,
    businessRoutes,
    branchRoutes,
    teamRoutes,
    customerRoutes,
    measurementRoutes,
    designRoutes,
    orderRoutes,
    paymentRoutes,
    appointmentRoutes,
    requestRoutes,
    taskRoutes,
    inventoryRoutes,
    expenseRoutes,
    reportRoutes,
    notificationRoutes,
    dashboardRoutes,
    adminRoutes,
  ].forEach((routes) => app.use(env.apiPrefix, routes));

  app.use(notFoundHandler);
  app.use(globalErrorHandler);
  return app;
}
