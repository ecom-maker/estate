/**
 * The DM Global business WhatsApp line (digits only, for wa.me links).
 * NEXT_PUBLIC_WHATSAPP_NUMBER overrides it per deployment.
 */
export const WHATSAPP_NUMBER = (
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim() || "16509105069"
).replace(/\D/g, "");
