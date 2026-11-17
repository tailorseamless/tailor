import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { AccountDeletionController as A } from "../controllers/accountDeletion.controller";
import * as s from "../validators/accountDeletion.schema";

// No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
const router = Router();

router.post("/users/me/deletion", authorise("profile.update"), validate(s.noInputSchema), A.requestMine);
router.delete("/users/me/deletion", authorise("profile.update"), validate(s.noInputSchema), A.cancelMine);
router.post(
  "/businesses/me/deletion",
  authorise("business.delete"),
  validate(s.deleteBusinessSchema),
  A.requestBusiness,
);
router.delete("/businesses/me/deletion", authorise("business.delete"), validate(s.noInputSchema), A.cancelBusiness);

export const accountDeletionRoutes = router;
