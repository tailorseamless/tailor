import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { NotificationController as N } from "../controllers/notification.controller";
import * as s from "../validators/notification.schema";

// No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
const router = Router();
const use = authorise("notification.read");

router.get("/notifications", use, validate(s.listNotificationsSchema), N.list);
router.get("/notifications/unread-count", use, validate(s.noInputSchema), N.unreadCount);
router.post("/notifications/read-all", use, validate(s.noInputSchema), N.markAllRead);
router.get("/notifications/preferences", use, validate(s.noInputSchema), N.preferences);
router.put("/notifications/preferences", use, validate(s.updatePreferencesSchema), N.updatePreferences);
router.post("/notifications/devices", use, validate(s.deviceSchema), N.registerDevice);
router.delete("/notifications/devices", use, validate(s.deviceSchema), N.removeDevice);
router.post("/notifications/:id/read", use, validate(s.notificationIdSchema), N.markRead);
// What emails went out, which failed and why.
router.get("/email-outbox", authorise("email.read"), validate(s.listOutboxSchema), N.outbox);

export const notificationRoutes = router;
