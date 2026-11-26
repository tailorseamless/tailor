import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { MeasurementController as M } from "../controllers/measurement.controller";
import { MeasurementTemplateController as T } from "../controllers/template.controller";
import * as s from "../validators/measurement.schema";

// No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
const router = Router();

// Templates: what to measure for a kind of garment.
router.get("/measurement-templates", authorise("measurement.read"), validate(s.listTemplatesSchema), T.list);
router.post(
  "/measurement-templates",
  authorise("measurement.template.manage"),
  validate(s.createTemplateSchema),
  T.create,
);
router.get("/measurement-templates/:id", authorise("measurement.read"), validate(s.templateIdSchema), T.detail);
router.patch(
  "/measurement-templates/:id",
  authorise("measurement.template.manage"),
  validate(s.updateTemplateSchema),
  T.update,
);
router.delete(
  "/measurement-templates/:id",
  authorise("measurement.template.manage"),
  validate(s.templateIdSchema),
  T.remove,
);

router.get("/measurements/status", authorise("measurement.read"), validate(s.measurementStatusSchema), M.status);

// A customer's measurements: a history of immutable records.
const base = "/customers/:customerId/measurements";
router.get(base, authorise("measurement.read"), validate(s.listMeasurementsSchema), M.list);
router.post(base, authorise("measurement.record"), validate(s.createMeasurementSchema), M.record);
router.get(`${base}/:id`, authorise("measurement.read"), validate(s.measurementIdSchema), M.detail);
router.delete(`${base}/:id`, authorise("measurement.delete"), validate(s.measurementIdSchema), M.remove);

export const measurementRoutes = router;
