import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { DashboardController } from "../controllers/dashboard.controller";
import { dashboardSchema } from "../validators/dashboard.schema";

// No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
const router = Router();

router.get("/reports/dashboard", authorise("dashboard.read"), validate(dashboardSchema), DashboardController.overview);

export const dashboardRoutes = router;
