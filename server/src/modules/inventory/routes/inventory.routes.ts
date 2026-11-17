import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { idempotent } from "../../../shared/middleware/idempotency.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { InventoryController as I } from "../controllers/inventory.controller";
import * as s from "../validators/inventory.schema";

// No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
const router = Router();
const read = authorise("inventory.read");
const manage = authorise("inventory.manage");
const base = "/inventory/materials";

router.get(base, read, validate(s.listMaterialsSchema), I.list);
router.post(base, manage, validate(s.createMaterialSchema), I.create);
router.get(`${base}/:id`, read, validate(s.materialIdSchema), I.detail);
router.patch(`${base}/:id`, manage, validate(s.updateMaterialSchema), I.update);
router.delete(`${base}/:id`, manage, validate(s.materialIdSchema), I.remove);

router.get(`${base}/:id/movements`, read, validate(s.listMovementsSchema), I.movements);
router.post(
  `${base}/:id/movements`,
  authorise("inventory.stock"),
  idempotent,
  validate(s.recordMovementSchema),
  I.recordMovement,
);

export const inventoryRoutes = router;
