/**
 * Phone photos are large (often 4–12 MB, sometimes HEIC). The AI needs far less to read handwriting, and the
 * server takes JPG, PNG or WebP up to 5 MB. Redraws the photo as a JPEG no bigger than 2000 px on its long side.
 * The browser decodes it, so any format the phone can show (HEIC on iPhones included) works.
 */
const MAX_SIDE = 2000;
const QUALITY = 0.85;

export class PhotoProblem extends Error {}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      // Honours the camera's rotation, so a sideways photo comes out upright.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall through to <img>, which some browsers decode more formats with.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function shrinkPhoto(file: File, index: number): Promise<File> {
  let image: ImageBitmap | HTMLImageElement;
  try {
    image = await decode(file);
  } catch {
    throw new PhotoProblem(`${file.name || "A photo"} couldn't be opened. Take it again, or choose a JPG or PNG.`);
  }
  const width = "naturalWidth" in image ? image.naturalWidth : image.width;
  const height = "naturalHeight" in image ? image.naturalHeight : image.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new PhotoProblem("This browser can't prepare photos. Try another browser.");
  context.fillStyle = "#fff"; // a transparent PNG would otherwise turn black
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  if ("close" in image) image.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new PhotoProblem(`${file.name || "A photo"} couldn't be prepared. Try taking it again.`);
  return new File([blob], `record-${index + 1}.jpg`, { type: "image/jpeg" });
}
