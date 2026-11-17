import { UPLOAD_LIMITS } from "../../../config/constants";
import { logger } from "../../../infrastructure/logger/logger";
import { AppError } from "../../../shared/errors/AppError";
import { runInTransaction } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { StorageService, type UploadedImage } from "../../../shared/services/storage.service";
import { ActivityService } from "../../activity/services/activity.service";
import type { ImageRecord, ImageTarget, IncomingFile } from "../dto/media.dto";
import { ImageRepository } from "../repositories/image.repository";

/**
 * Pictures on orders and designs. Cloudinary and PostgreSQL cannot share a
 * transaction, so it is upload → persist → compensate (Backend Guide §20.15):
 * if any upload or the database write fails, the files already uploaded are
 * deleted again. Callers check the target belongs to the actor's business first.
 */
export class ImageService {
  static Instance = new ImageService();

  private constructor(
    private readonly images = ImageRepository.Instance,
    private readonly storage = StorageService.Instance,
    private readonly activity = ActivityService.Instance,
  ) {}

  list(target: ImageTarget): Promise<ImageRecord[]> {
    return this.images.listFor(target);
  }

  async add(actor: Actor, target: ImageTarget, files: IncomingFile[]): Promise<ImageRecord[]> {
    if (files.length === 0) {
      throw AppError.unprocessable("Choose at least one picture", [{ field: "images", message: "Required" }]);
    }
    if (!this.storage.configured) throw AppError.unavailable("File storage is not configured");
    const existing = await this.images.countFor(target);
    if (existing + files.length > UPLOAD_LIMITS.imagesPerItem) {
      throw AppError.unprocessable(`At most ${UPLOAD_LIMITS.imagesPerItem} pictures are allowed`, [
        { field: "images", message: `${UPLOAD_LIMITS.imagesPerItem - existing} more can be added` },
      ]);
    }

    const folder = `${target.kind === "order" ? "orders" : "designs"}/${actor.businessId}`;
    const uploaded: { image: UploadedImage; originalName: string }[] = [];
    try {
      for (const file of files) {
        uploaded.push({ image: await this.storage.uploadImage(file.buffer, folder), originalName: file.originalname });
      }
      await runInTransaction(async (tx) => {
        await this.images.insertMany(actor.businessId, target, uploaded, existing, actor.id, tx);
        await this.activity.audit(
          {
            businessId: actor.businessId,
            actorId: actor.id,
            action: "image.added",
            entityType: target.kind,
            entityId: target.id,
            payload: { count: uploaded.length },
          },
          tx,
        );
      });
    } catch (err) {
      await this.discard(uploaded.map(({ image }) => image.publicId));
      throw err;
    }
    return this.images.listFor(target);
  }

  /** Soft-deletes the row, then removes the file from Cloudinary (best effort, after the commit). */
  async remove(actor: Actor, target: ImageTarget, imageId: string): Promise<void> {
    const publicId = await runInTransaction(async (tx) => {
      const image = await this.images.findForTarget(imageId, target, tx);
      if (!image) throw AppError.notFound("Picture not found");
      await this.images.remove(image.id, tx);
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "image.removed",
          entityType: target.kind,
          entityId: target.id,
          payload: { imageId },
        },
        tx,
      );
      return image.publicId;
    });
    await this.storage.deleteImage(publicId);
  }

  /** Compensating delete: logs and never throws. */
  private async discard(publicIds: string[]): Promise<void> {
    for (const publicId of publicIds) await this.storage.deleteImage(publicId);
    if (publicIds.length > 0) logger.warn({ count: publicIds.length }, "uploaded pictures discarded after a failure");
  }
}
