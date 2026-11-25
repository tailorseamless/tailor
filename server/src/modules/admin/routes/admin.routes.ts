import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { AdminController as A } from "../controllers/admin.controller";
import * as s from "../validators/admin.schema";

// Platform admins only. No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
// Support looks (admin.read); super admins also act (admin.manage) and read the raw trail (admin.audit).
const router = Router();
const read = authorise("admin.read");
const manage = authorise("admin.manage");

router.get("/admin/overview", read, validate(s.noInputSchema), A.overview);
router.get("/admin/businesses", read, validate(s.listBusinessesSchema), A.businesses);
router.get("/admin/businesses/:id", read, validate(s.adminBusinessIdSchema), A.business);
router.patch("/admin/businesses/:id", manage, validate(s.updateBusinessProfileSchema), A.updateBusinessProfile);
router.post("/admin/businesses/:id/status", manage, validate(s.setBusinessStatusSchema), A.setBusinessStatus);
router.get("/admin/users", read, validate(s.listUsersSchema), A.users);
router.post("/admin/users/:id/status", manage, validate(s.setUserStatusSchema), A.setUserStatus);
router.get("/admin/admins", read, validate(s.noInputSchema), A.admins);
router.get("/admin/audit-logs", authorise("admin.audit"), validate(s.listAuditLogsSchema), A.auditLogs);

export const adminRoutes = router;
