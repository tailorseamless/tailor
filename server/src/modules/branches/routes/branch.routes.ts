import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { BranchController as B } from "../controllers/branch.controller";
import * as s from "../validators/branch.schema";

// No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
const router = Router();

router.get("/branches", authorise("branch.read"), validate(s.listBranchesSchema), B.list);
router.post("/branches", authorise("branch.manage"), validate(s.createBranchSchema), B.create);
router.get("/branches/:id", authorise("branch.read"), validate(s.branchIdSchema), B.detail);
router.patch("/branches/:id", authorise("branch.manage"), validate(s.updateBranchSchema), B.update);

export const branchRoutes = router;
