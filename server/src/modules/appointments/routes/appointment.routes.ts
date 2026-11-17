import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { idempotent } from "../../../shared/middleware/idempotency.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { AppointmentController as A } from "../controllers/appointment.controller";
import * as s from "../validators/appointment.schema";

// No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
const router = Router();
const write = authorise("appointment.write");

router.get("/appointments", authorise("appointment.read"), validate(s.listAppointmentsSchema), A.list);
router.post("/appointments", write, idempotent, validate(s.createAppointmentSchema), A.create);
router.get("/appointments/:id", authorise("appointment.read"), validate(s.appointmentIdSchema), A.detail);
router.patch("/appointments/:id", write, validate(s.updateAppointmentSchema), A.update);
// Verbs, because they are actions with rules of their own (§14).
router.post("/appointments/:id/reschedule", write, validate(s.rescheduleAppointmentSchema), A.reschedule);
router.post("/appointments/:id/status", write, validate(s.closeAppointmentSchema), A.close);

export const appointmentRoutes = router;
