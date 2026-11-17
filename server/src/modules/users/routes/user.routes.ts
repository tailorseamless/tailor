import { Router } from "express";
import { firebaseOnly } from "../../../shared/middleware/auth.middleware";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { registrationRateLimiter } from "../../../shared/middleware/rateLimiter.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { AuthController as A } from "../controllers/auth.controller";
import { UserController as U } from "../controllers/user.controller";
import * as s from "../validators/user.schema";

/**
 * Mixed routes: a valid Firebase token, but no linked user required.
 * Mounted BEFORE the global auth pair in app.ts (Backend Guide §14.1).
 */
const auth = Router();
auth.get("/auth/me", firebaseOnly, A.me);
auth.post("/auth/register", registrationRateLimiter, firebaseOnly, validate(s.registerSchema), A.register);

/** Protected routes — authMiddleware is mounted once in app.ts. */
const users = Router();
users.patch("/users/me", authorise("profile.update"), validate(s.updateMeSchema), U.updateMe);

export const authRoutes = auth;
export const userRoutes = users;
