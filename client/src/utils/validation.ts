import { z } from "zod";

/** Same rule as the server: punctuation is ignored, 7–15 digits with an optional +. */
export const isPhone = (value: string) => /^\+?\d{7,15}$/.test(value.replace(/[\s().-]/g, ""));

export const phoneRequired = z
  .string()
  .trim()
  .min(1, "Enter a phone number")
  .refine(isPhone, "Enter a valid phone number");

export const phoneOptional = z
  .string()
  .trim()
  .refine((v) => !v || isPhone(v), "Enter a valid phone number");

export const emailOptional = z
  .string()
  .trim()
  .refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email address");

/** "" → null, for optional text the API accepts as null. */
export const orNull = (value: string | undefined | null) => (value && value.trim() ? value.trim() : null);

/** Opens WhatsApp with a message (to a number when given). Nigerian 0-prefixed numbers become +234. */
export function whatsappLink(text: string, phone?: string | null): string {
  let digits = (phone ?? "").replace(/[^\d+]/g, "");
  if (digits.startsWith("0")) digits = `234${digits.slice(1)}`;
  digits = digits.replace(/^\+/, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
