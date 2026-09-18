import type { PropertyType } from "@prisma/client";

/**
 * SEO landing-page URL taxonomy.
 *
 * Pattern (matches competitor portals, e.g. `flats-for-sale-in-palm-jumeirah`):
 *   `{typeToken}-for-{deal}-in-{localitySlug}`
 *
 * These pages are programmatic SEO surfaces: one indexable page per
 * property-type x deal-type x locality combination.
 */

export type DealType = "sale" | "rent";

export interface PropertyTypeDef {
  /** URL token, always plural/lowercase, e.g. "flats". */
  token: string;
  /** Human label, e.g. "Flats". */
  label: string;
  /** Singular label for prose, e.g. "flat". */
  singular: string;
  /** Prisma enum values this token resolves to. Empty = all types. */
  enums: PropertyType[];
}

/**
 * Ordered so the first entry whose `enums` match is the canonical token for a
 * given type. `flats` and `apartments` both cover APARTMENT; `flats` also
 * includes UNIT (studio/serviced units) to match how buyers search.
 */
export const PROPERTY_TYPES: PropertyTypeDef[] = [
  { token: "flats", label: "Flats", singular: "flat", enums: ["APARTMENT", "UNIT"] },
  { token: "apartments", label: "Apartments", singular: "apartment", enums: ["APARTMENT"] },
  { token: "villas", label: "Villas", singular: "villa", enums: ["VILLA"] },
  { token: "penthouses", label: "Penthouses", singular: "penthouse", enums: ["PENTHOUSE"] },
  { token: "townhouses", label: "Townhouses", singular: "townhouse", enums: ["TOWNHOUSE"] },
  { token: "plots", label: "Plots", singular: "plot", enums: ["LAND"] },
  { token: "properties", label: "Properties", singular: "property", enums: [] },
];

export const DEAL_LABELS: Record<DealType, string> = {
  sale: "for Sale",
  rent: "for Rent",
};

const TYPE_BY_TOKEN = new Map(PROPERTY_TYPES.map((t) => [t.token, t]));

export interface ParsedListingSlug {
  typeToken: string;
  deal: DealType;
  localitySlug: string;
  typeDef: PropertyTypeDef;
}

const SLUG_RE = /^([a-z]+)-for-(sale|rent)-in-([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** Parse a listing slug, returning null if it does not match the taxonomy. */
export function parseListingSlug(slug: string): ParsedListingSlug | null {
  const match = SLUG_RE.exec(slug);
  if (!match) return null;
  const [, typeToken, deal, localitySlug] = match;
  const typeDef = TYPE_BY_TOKEN.get(typeToken);
  if (!typeDef) return null;
  return { typeToken, deal: deal as DealType, localitySlug, typeDef };
}

/** Build a canonical listing slug from its parts. */
export function buildListingSlug(
  typeToken: string,
  deal: DealType,
  localitySlug: string,
): string {
  return `${typeToken}-for-${deal}-in-${localitySlug}`;
}

/** Title-case a locality slug when we have no Community record for it. */
export function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** e.g. "Flats for Sale in Palm Jumeirah". */
export function listingTitle(parsed: ParsedListingSlug, localityName: string): string {
  return `${parsed.typeDef.label} ${DEAL_LABELS[parsed.deal]} in ${localityName}`;
}
