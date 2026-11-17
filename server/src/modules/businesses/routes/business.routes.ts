import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { BusinessController as B } from "../controllers/business.controller";
import * as s from "../validators/business.schema";

// No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
const router = Router();

router.get("/businesses/me", authorise("business.read"), validate(s.getBusinessSchema), B.mine);
router.patch("/businesses/me", authorise("business.update"), validate(s.updateBusinessSchema), B.update);

export const businessRoutes = router;
