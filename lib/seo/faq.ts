/** One FAQ entry. The visible text and the FAQPage JSON-LD use these strings
 *  verbatim, so they always match. */
export type Faq = { q: string; a: string };

/** AED per sqft, formatted for prose: "AED 2,648/sqft". */
export function perSqft(value: number): string {
  return `AED ${Math.round(value).toLocaleString()}/sqft`;
}

/** "Studios, 1, 2 and 3-bedroom" style joiner. */
export function joinAnd(parts: string[]): string {
  const clean = parts.filter(Boolean);
  if (clean.length <= 1) return clean[0] ?? "";
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
}

/** Drop any entry missing a question or answer, so no empty FAQ renders. */
export function compactFaqs(faqs: Faq[]): Faq[] {
  return faqs.filter((f) => f.q.trim() !== "" && f.a.trim() !== "");
}
