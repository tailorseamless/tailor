import { UPLOAD_LIMITS } from "../../config/constants";
import { CloudinaryProvider } from "../../infrastructure/storage/cloudinaryProvider";
import { logger } from "../../infrastructure/logger/logger";
import { AppError } from "../errors/AppError";

export interface UploadImageOptions {
  /** Relative to the environment root, e.g. `orders/<businessId>`. */
  folder: string;
  maxDimension: number;
}

export interface UploadedImage {
  url: string;
  publicId: string;
  width: number | null;
  height: number | null;
  bytes: number;
  format: string | null;
}

/** What a storage backend must do. Cloudinary in the app; a fake in checks. */
export interface StorageProvider {
  readonly configured: boolean;
  upload(buffer: Buffer, options: UploadImageOptions): Promise<UploadedImage>;
  destroy(publicId: string): Promise<void>;
}

/**
 * The one door to file storage (Backend Guide §20.5). Controllers and domain
 * services never touch the SDK. Missing credentials are a 503 on upload, never
 * a boot failure; deletes become no-ops.
 */
export class StorageService {
  static Instance = new StorageService();

  private constructor(private provider: StorageProvider = new CloudinaryProvider()) {}

  /** Swap the backend (used by local checks). */
  use(provider: StorageProvider): void {
    this.provider = provider;
  }

  get configured(): boolean {
    return this.provider.configured;
  }

  async uploadImage(buffer: Buffer, folder: string): Promise<UploadedImage> {
    if (!this.provider.configured) throw AppError.unavailable("File storage is not configured");
    try {
      return await this.provider.upload(buffer, { folder, maxDimension: UPLOAD_LIMITS.maxDimension });
    } catch (err) {
      logger.error({ err, folder }, "image upload failed");
      throw new AppError("Upload failed, try again", 502);
    }
  }

  /** Best effort: a failed delete is logged and never fails the request. */
  async deleteImage(publicId: string): Promise<void> {
    if (!this.provider.configured) return;
    try {
      await this.provider.destroy(publicId);
    } catch (err) {
      logger.warn({ err, publicId }, "image could not be deleted from storage");
    }
  }
}
