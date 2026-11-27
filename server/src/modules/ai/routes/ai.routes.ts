import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { aiRateLimiter } from "../../../shared/middleware/rateLimiter.middleware";
import { uploadFiles } from "../../../shared/middleware/upload.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { FILE_TYPES } from "../../../shared/utils/fileTypes";
import { CAPTURE_LIMITS } from "../domain/recordCapture";
import { AiController as C } from "../controllers/ai.controller";
import * as s from "../validators/ai.schema";

// No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
const router = Router();

// Any team member: is AI available, and how much is left today.
router.get("/ai/status", authorise("ai.use"), validate(s.statusSchema), C.status);

// Snap a record. It drafts customers, so it needs the permission to add them (measurements and orders have
// the same front-desk roles). Rate-limited BEFORE the photos are read into memory.
router.post(
  "/ai/record-capture",
  authorise("customer.create"),
  aiRateLimiter,
  uploadFiles("files", CAPTURE_LIMITS.files, { maxMb: CAPTURE_LIMITS.fileMb, allowed: FILE_TYPES.record }),
  validate(s.noInputSchema),
  C.recordCapture,
);

// The platform's AI (super admins). Usage counts are readable by support too.
const ai = authorise("admin.ai");
router.get("/admin/ai", ai, validate(s.noInputSchema), C.overview);
router.get("/admin/ai/usage", authorise("admin.read"), validate(s.usageSchema), C.usage);
router.get("/admin/ai/tokens", authorise("admin.read"), validate(s.listBalancesSchema), C.balances);
router.post("/admin/ai/tokens/:businessId", ai, validate(s.grantTokensSchema), C.grantTokens);
router.patch("/admin/ai/settings", ai, validate(s.updateSettingsSchema), C.updateSettings);
// These call the provider (and cost or count against its limits), so they are rate-limited.
router.put("/admin/ai/credentials/:provider", ai, aiRateLimiter, validate(s.saveCredentialSchema), C.saveCredential);
router.post("/admin/ai/credentials/:provider/models", ai, aiRateLimiter, validate(s.listModelsSchema), C.models);
router.post("/admin/ai/test", ai, aiRateLimiter, validate(s.testSchema), C.test);
router.post("/admin/ai/credentials/:provider/activate", ai, validate(s.providerParamsSchema), C.activate);
router.delete("/admin/ai/credentials/:provider", ai, validate(s.providerParamsSchema), C.removeCredential);
router.put("/admin/ai/feature-models/:feature", ai, validate(s.featureModelSchema), C.setFeatureModel);
router.delete("/admin/ai/feature-models/:feature", ai, validate(s.featureParamsSchema), C.clearFeatureModel);

export const aiRoutes = router;
