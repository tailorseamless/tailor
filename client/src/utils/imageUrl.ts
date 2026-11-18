const UPLOAD = "/image/upload/";

/**
 * A smaller copy of a Cloudinary picture, for grids and phones on slow data: scaled down to `width`
 * (never up), in the best format the browser supports. Any other address comes back unchanged.
 */
export function resizedImage(url: string, width: number): string {
  const at = url.indexOf(UPLOAD);
  if (!url.startsWith("https://res.cloudinary.com/") || at < 0) return url;
  const head = url.slice(0, at + UPLOAD.length);
  return `${head}c_limit,w_${width},q_auto,f_auto/${url.slice(at + UPLOAD.length)}`;
}
