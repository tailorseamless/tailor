import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encrypts small secrets (AI provider API keys) for storage: AES-256-GCM with a random 12-byte IV.
 * The `context` (e.g. "platform:openai") is bound as additional authenticated data, so a ciphertext
 * copied onto another row fails to open. Format: `v1.<iv>.<tag>.<ciphertext>`, each part base64url.
 */
const VERSION = "v1";

const keyFrom = (secret: string): Buffer => createHash("sha256").update(secret).digest();

export function seal(plaintext: string, secret: string, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/** The plaintext, or null — never a throw — when the value was tampered with, has another context or secret, or is malformed. */
export function open(sealed: string, secret: string, context: string): string | null {
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const [, iv, tag, ciphertext] = parts;
    const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
