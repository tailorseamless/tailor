/**
 * What files are accepted, by extension, MIME type and content (Backend Guide
 * §20.4). All three must agree: a renamed .exe never gets through as a .jpg.
 */
interface FileRule {
  mimes: readonly string[];
  /** Does the buffer start the way this kind of file does? */
  sniff: (buffer: Buffer) => boolean;
}

const startsWith = (buffer: Buffer, bytes: number[], offset = 0) =>
  buffer.length >= offset + bytes.length && bytes.every((byte, i) => buffer[offset + i] === byte);

const JPEG: FileRule = { mimes: ["image/jpeg"], sniff: (b) => startsWith(b, [0xff, 0xd8, 0xff]) };

export const FILE_RULES: Record<string, FileRule> = {
  jpg: JPEG,
  jpeg: JPEG,
  png: { mimes: ["image/png"], sniff: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  // "RIFF" .... "WEBP"
  webp: {
    mimes: ["image/webp"],
    sniff: (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8),
  },
};

export const FILE_TYPES = {
  /** Reference pictures and design photos. */
  image: ["jpg", "jpeg", "png", "webp"],
} as const;

export type FileTypeSet = (typeof FILE_TYPES)[keyof typeof FILE_TYPES];

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

/** Extension in the set, and the MIME type matches the extension. */
export function typeAllowed(filename: string, mime: string, allowed: readonly string[]): boolean {
  const ext = extensionOf(filename);
  return allowed.includes(ext) && (FILE_RULES[ext]?.mimes.includes(mime.toLowerCase()) ?? false);
}

/** The bytes really are what the extension says. */
export function sniffMatches(filename: string, buffer: Buffer): boolean {
  return FILE_RULES[extensionOf(filename)]?.sniff(buffer) ?? false;
}
