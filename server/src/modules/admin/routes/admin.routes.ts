import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { AdminController as A } from "../controllers/admin.controller";
import * as s from "../validators/admin.schema";

// Platform admin only. No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
const router = Router();
const admin = authorise("admin.platform");

router.get("/admin/overview", admin, validate(s.noInputSchema), A.overview);
router.get("/admin/businesses", admin, validate(s.listBusinessesSchema), A.businesses);
router.get("/admin/businesses/:id", admin, validate(s.adminBusinessIdSchema), A.business);
router.patch("/admin/businesses/:id", admin, validate(s.updateBusinessProfileSchema), A.updateBusinessProfile);
router.post("/admin/businesses/:id/status", admin, validate(s.setBusinessStatusSchema), A.setBusinessStatus);
router.get("/admin/users", admin, validate(s.listUsersSchema), A.users);
router.post("/admin/users/:id/status", admin, validate(s.setUserStatusSchema), A.setUserStatus);

export const adminRoutes = router;
