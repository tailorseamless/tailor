import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { CustomerController as C } from "../controllers/customer.controller";
import * as s from "../validators/customer.schema";

// No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
// Order is fixed: authorise → validate → controller (§4.3).
const router = Router();

router.get("/customers", authorise("customer.read"), validate(s.listCustomersSchema), C.list);
router.post("/customers", authorise("customer.create"), validate(s.createCustomerSchema), C.create);
router.get("/customers/:id", authorise("customer.read"), validate(s.customerIdSchema), C.detail);
router.patch("/customers/:id", authorise("customer.update"), validate(s.updateCustomerSchema), C.update);
router.delete("/customers/:id", authorise("customer.delete"), validate(s.customerIdSchema), C.remove);
router.post(
  "/customers/:id/portal-link",
  authorise("customer.update"),
  validate(s.customerIdSchema),
  C.createPortalLink,
);
router.delete(
  "/customers/:id/portal-link",
  authorise("customer.update"),
  validate(s.customerIdSchema),
  C.revokePortalLink,
);

export const customerRoutes = router;
