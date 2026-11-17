import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { TeamController as T } from "../controllers/team.controller";
import * as s from "../validators/team.schema";

// No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
const router = Router();
const manage = authorise("team.manage");

router.get("/team", authorise("team.read"), validate(s.listTeamSchema), T.list);
router.post("/team", manage, validate(s.addMemberSchema), T.add);
router.get("/team/:userId", authorise("team.read"), validate(s.memberIdSchema), T.detail);
router.patch("/team/:userId", manage, validate(s.updateMemberSchema), T.update);
router.delete("/team/:userId", manage, validate(s.memberIdSchema), T.remove);
router.post("/team/:userId/invitation", manage, validate(s.memberIdSchema), T.resendInvitation);

export const teamRoutes = router;
