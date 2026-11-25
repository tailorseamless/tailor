import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { env } from "../../config/env";
import type { StorageProvider, UploadedImage, UploadImageOptions } from "../../shared/services/storage.service";

/**
 * The only place the Cloudinary SDK is configured and called (Backend Guide
 * §20.3). Configured once, and only when credentials exist.
 */
let configured = false;
function client() {
  if (!configured) {
    const { cloudName, apiKey, apiSecret } = env.cloudinary;
    cloudinary.config({
      cloud_name: cloudName ?? "",
      api_key: apiKey ?? "",
      api_secret: apiSecret ?? "",
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

export class CloudinaryProvider implements StorageProvider {
  readonly configured = env.cloudinary.configured;

  upload(buffer: Buffer, options: UploadImageOptions): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const stream = client().uploader.upload_stream(
        {
          // Folders are relative to the environment root: tailorflow/dev/<folder>.
          folder: `${env.cloudinary.folderRoot}/${options.folder}`,
          resource_type: "image",
          // Resized on upload so a 12 MP phone photo is not stored or served as one.
          transformation: [
            { width: options.maxDimension, height: options.maxDimension, crop: "limit", quality: "auto" },
          ],
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) return reject(error ?? new Error("Cloudinary returned no result"));
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width ?? null,
            height: result.height ?? null,
            bytes: result.bytes ?? buffer.length,
            format: result.format ?? null,
          });
        },
      );
      stream.end(buffer);
    });
  }

  async destroy(publicId: string): Promise<void> {
    // `invalidate` stops the CDN serving a removed picture.
    await client().uploader.destroy(publicId, { resource_type: "image", invalidate: true });
  }
}

/** How much of the Cloudinary plan is used (Admin API `usage`). Null when Cloudinary isn't set up. */
export interface CloudinaryUsage {
  plan: string | null;
  /** Credits are what Cloudinary bills on (storage, bandwidth and transformations combined). */
  credits: { used: number; limit: number | null; usedPercent: number | null };
  storageBytes: number;
  bandwidthBytes: number;
  objects: number;
  transformations: number;
  lastUpdated: string | null;
}

const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

export async function cloudinaryUsage(): Promise<CloudinaryUsage | null> {
  if (!env.cloudinary.configured) return null;
  const raw = (await client().api.usage()) as Record<string, unknown>;
  const part = (key: string) => (raw[key] ?? {}) as Record<string, unknown>;
  const credits = part("credits");
  return {
    plan: typeof raw.plan === "string" ? raw.plan : null,
    credits: {
      used: num(credits.usage),
      limit: typeof credits.limit === "number" ? credits.limit : null,
      usedPercent: typeof credits.used_percent === "number" ? credits.used_percent : null,
    },
    storageBytes: num(part("storage").usage),
    bandwidthBytes: num(part("bandwidth").usage),
    objects: num(part("objects").usage),
    transformations: num(part("transformations").usage),
    lastUpdated: typeof raw.last_updated === "string" ? raw.last_updated : null,
  };
}
