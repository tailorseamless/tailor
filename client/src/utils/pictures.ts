/** What the server accepts for a picture (UPLOAD_LIMITS there). */
export const PICTURE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PICTURE_MAX_BYTES = 5 * 1024 * 1024;
/** Live pictures on one order or one design. */
export const PICTURES_PER_ITEM = 12;
/** Pictures in one upload request. */
export const PICTURES_PER_REQUEST = 5;

/** Why a chosen file can't be used, or null when it can. */
export const pictureProblem = (file: File): string | null =>
  PICTURE_TYPES.includes(file.type) && file.size <= PICTURE_MAX_BYTES
    ? null
    : `${file.name} isn't a JPG, PNG or WebP photo under 5 MB.`;

/**
 * Sends pictures a request's worth at a time. It stops at the first batch that fails and says how far it got, so
 * the caller can tell the person what is saved instead of losing the thing the pictures belong to.
 */
export async function uploadInBatches(
  files: File[],
  send: (batch: File[]) => Promise<unknown>,
): Promise<{ uploaded: number; uploadError: unknown }> {
  let uploaded = 0;
  for (let i = 0; i < files.length; i += PICTURES_PER_REQUEST) {
    const batch = files.slice(i, i + PICTURES_PER_REQUEST);
    try {
      await send(batch);
      uploaded += batch.length;
    } catch (uploadError) {
      return { uploaded, uploadError };
    }
  }
  return { uploaded, uploadError: null };
}
