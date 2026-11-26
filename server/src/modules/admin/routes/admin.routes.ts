import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { exportRateLimiter } from "../../../shared/middleware/rateLimiter.middleware";
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
router.post("/admin/businesses/:id/switch-on", manage, validate(s.switchOnSchema), A.switchOn);
router.get("/admin/users", read, validate(s.listUsersSchema), A.users);
router.post("/admin/users/:id/status", manage, validate(s.setUserStatusSchema), A.setUserStatus);
router.get("/admin/businesses/:id/detail", read, validate(s.adminBusinessIdSchema), A.businessDetail);
router.get("/admin/users/:id", read, validate(s.adminUserIdSchema), A.userDetail);
router.get("/admin/admins", read, validate(s.noInputSchema), A.admins);
router.get("/admin/activity", read, validate(s.activityFeedSchema), A.activity);
router.get("/admin/system-health", read, validate(s.noInputSchema), A.systemHealth);
router.get("/admin/businesses/:id/notes", read, validate(s.adminBusinessIdSchema), A.notes);
router.post("/admin/businesses/:id/notes", read, validate(s.addNoteSchema), A.addNote);
router.get("/admin/stats/daily", read, validate(s.dailyStatsSchema), A.dailyStats);
router.get("/admin/reports/adoption", read, validate(s.adoptionSchema), A.adoption);
router.get("/admin/reports/cohorts", read, validate(s.cohortsSchema), A.cohorts);
router.get("/admin/reports/churn-risk", read, validate(s.churnRiskSchema), A.churnRisk);
router.get("/admin/announcements", read, validate(s.noInputSchema), A.announcements);
router.post("/admin/announcements", manage, validate(s.createAnnouncementSchema), A.createAnnouncement);
router.post("/admin/announcements/:id/cancel", manage, validate(s.announcementIdSchema), A.cancelAnnouncement);
// admin-actions needs admin.audit as well; the service checks.
router.get("/admin/reports/:kind/export", read, exportRateLimiter, validate(s.adminExportSchema), A.export);
router.get("/admin/alerts", read, validate(s.listAlertsSchema), A.alerts);
router.post("/admin/alerts/:id/acknowledge", manage, validate(s.alertIdSchema), A.acknowledgeAlert);
router.post("/admin/alerts/:id/resolve", manage, validate(s.resolveAlertSchema), A.resolveAlert);
router.get("/admin/audit-logs", authorise("admin.audit"), validate(s.listAuditLogsSchema), A.auditLogs);

export const adminRoutes = router;
