import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { dashboardSchema as periodSchema } from "../../dashboard/validators/dashboard.schema";
import { exportRateLimiter } from "../../../shared/middleware/rateLimiter.middleware";
import { ReportController as R } from "../controllers/report.controller";
import { exportSchema } from "../validators/export.schema";

// No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
// Both take the same optional `from` / `to` days as the dashboard.
const router = Router();
const read = authorise("report.read");

router.get("/reports/income-expenses", read, validate(periodSchema), R.incomeAndExpenses);
router.get("/reports/garment-sales", read, validate(periodSchema), R.garmentSales);
// ?format=xlsx|csv&from&to&branchId — income-expenses, garment-sales, orders, payments, expenses.
router.get("/reports/:key/export", read, exportRateLimiter, validate(exportSchema), R.export);

export const reportRoutes = router;
