import type { AuthUser, FirebaseIdentity } from "../shared/services/access.service";

declare global {
  namespace Express {
    interface Request {
      /** Set by requestId middleware; echoed as X-Request-Id. */
      requestId: string;
      /** The verified Firebase login (authMiddleware, firebaseOnly). */
      firebase?: FirebaseIdentity;
      /** The linked TailorFlow user (authMiddleware). */
      user?: AuthUser;
      /** The business every query is scoped to (tenantMiddleware). */
      tenant?: { businessId: string };
      /** Output of validate(schema); read with input(req, schema). */
      validated?: unknown;
    }
  }
}

export {};
