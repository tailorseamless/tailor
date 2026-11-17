import { createHash, randomBytes } from "node:crypto";

/** SHA-256 hex. Secret links are stored only as this hash and shown once (Backend Guide §13.6). */
export const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

/** A URL-safe secret with 256 bits of randomness. */
export const randomToken = (): string => randomBytes(32).toString("base64url");
