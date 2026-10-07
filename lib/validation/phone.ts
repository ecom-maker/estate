/**
 * Phone-number check shared by the enquiry and sell forms and their API routes.
 *
 * Accepts the ways people actually type numbers ("+971 50 123 4567",
 * "050-123-4567", "(04) 123 4567") and rejects letters or other symbols.
 * 7–15 digits: 15 is the E.164 maximum, 7 the shortest local number worth
 * calling back. Returns a message to show the user, or null when valid.
 */
export function phoneError(value: string): string | null {
  const v = value.trim();
  if (!v) return "Enter a contact number.";
  if (!/^\+?[\d\s().-]+$/.test(v)) {
    return "Use digits only, e.g. +971 50 123 4567.";
  }
  const digits = v.replace(/\D/g, "").length;
  if (digits < 7) return "That number looks too short. Include the area or country code.";
  if (digits > 15) return "That number looks too long. Check for extra digits.";
  return null;
}
