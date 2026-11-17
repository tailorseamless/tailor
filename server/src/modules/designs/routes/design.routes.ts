import { Router } from "express";
import { UPLOAD_LIMITS } from "../../../config/constants";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { uploadRateLimiter } from "../../../shared/middleware/rateLimiter.middleware";
import { uploadFiles } from "../../../shared/middleware/upload.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { FILE_TYPES } from "../../../shared/utils/fileTypes";
import { DesignController as D } from "../controllers/design.controller";
import * as s from "../validators/design.schema";

// No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
// Uploads: authorise → rate limiter → upload → validate → controller (§20.6).
const router = Router();
const read = authorise("design.read");
const manage = authorise("design.manage");
const images = uploadFiles("images", UPLOAD_LIMITS.filesPerRequest, {
  maxMb: UPLOAD_LIMITS.imageMb,
  allowed: FILE_TYPES.image,
});

router.get("/designs", read, validate(s.listDesignsSchema), D.list);
router.get("/designs/categories", read, validate(s.noInputSchema), D.categories);
router.post("/designs", manage, validate(s.createDesignSchema), D.create);
router.get("/designs/:id", read, validate(s.designIdSchema), D.detail);
router.patch("/designs/:id", manage, validate(s.updateDesignSchema), D.update);
router.delete("/designs/:id", manage, validate(s.designIdSchema), D.remove);
router.post("/designs/:id/images", manage, uploadRateLimiter, images, validate(s.designIdSchema), D.addImages);
router.delete("/designs/:id/images/:imageId", manage, validate(s.designImageSchema), D.removeImage);

export const designRoutes = router;
