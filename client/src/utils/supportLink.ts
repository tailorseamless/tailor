/** WhatsApp to Tailor Seamless support, opening with which business is asking (never anything about its customers). */
export const supportLink = (whatsapp: string | null | undefined, businessName: string): string | null =>
  whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hello, I need help with Tailor Seamless (${businessName}).`)}`
    : null;
