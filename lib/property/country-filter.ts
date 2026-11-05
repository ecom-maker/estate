import type { Prisma } from "@prisma/client";

/**
 * Listings with no country are UAE: the Property Finder import left
 * `properties.country` blank, and the site already labels a blank country as
 * the United Arab Emirates. Filters and the country buttons must treat blank
 * the same way, or UAE shows twice and its filter misses those listings.
 */
export const DEFAULT_COUNTRY = "AE";

export function countryWhere(code: string): Prisma.PropertyWhereInput {
  const c = code.toUpperCase();
  return c === DEFAULT_COUNTRY ? { OR: [{ country: c }, { country: null }] } : { country: c };
}

/** Merge groupBy rows so blank and "AE" count as one country. */
export function mergeCountryCounts(
  groups: { country: string | null; count: number }[],
): { code: string; count: number }[] {
  const totals = new Map<string, number>();
  for (const g of groups) {
    const code = (g.country ?? DEFAULT_COUNTRY).toUpperCase();
    totals.set(code, (totals.get(code) ?? 0) + g.count);
  }
  return [...totals].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count);
}
