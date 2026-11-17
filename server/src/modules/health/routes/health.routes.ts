import { Router } from "express";
import { HealthController } from "../controllers/health.controller";

/** Public. Mounted before the global auth pair in app.ts. */
const router = Router();

router.get("/health", HealthController.check);

export const healthRoutes = router;
