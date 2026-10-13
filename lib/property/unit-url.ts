/**
 * Human-readable, SEO-friendly URLs for individual units.
 *
 * A unit path looks like
 *   /properties/unit/apartment-for-sale-ajman-ajman-creek-towers-1-bedroom-<id>
 * The descriptive slug is for search engines; the trailing id (a hyphen-free
 * cuid) is what we actually look the unit up by, so the slug can change freely
 * without breaking the link. Old bare-id URLs still resolve and 301 to the
 * canonical slug.
 */

const TYPE_WORD: Record<string, string> = {
  APARTMENT: "apartment",
  VILLA: "villa",
  PENTHOUSE: "penthouse",
  TOWNHOUSE: "townhouse",
  LAND: "land",
  UNIT: "property",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export type UnitUrlInput = {
  id: string;
  bedrooms: number | null;
  unitType?: string | null;
  property: {
    slug: string;
    title: string;
    type?: string | null;
    community?: { name?: string | null; emirate?: string | null } | null;
  };
};

function bedToken(beds: number | null): string {
  if (beds == null) return "";
  return beds === 0 ? "studio" : `${beds}-bedroom`;
}

/** SEO-friendly slug for a unit, ending in its id for lookup. */
export function unitSlug(u: UnitUrlInput): string {
  const typeWord =
    TYPE_WORD[(u.unitType ?? u.property.type ?? "").toUpperCase()] ?? "apartment";
  const tokens = [
    typeWord,
    "for-sale",
    u.property.community?.emirate ?? "",
    u.property.community?.name ?? "",
    bedToken(u.bedrooms),
    u.property.title,
  ]
    .map((t) => slugify(String(t)))
    .filter(Boolean);

  // Collapse immediately repeated words (e.g. "ajman-ajman-creek-towers").
  const deduped: string[] = [];
  for (const word of tokens.join("-").split("-")) {
    if (deduped[deduped.length - 1] !== word) deduped.push(word);
  }
  const base = deduped.join("-");
  return base ? `${base}-${u.id}` : u.id;
}

export function unitPath(u: UnitUrlInput): string {
  return `/properties/unit/${unitSlug(u)}`;
}

/** The trailing segment carries the DB id; the rest is SEO sugar. */
export function unitIdFromParam(param: string): string {
  const last = param.split("-").pop();
  return last && last.length ? last : param;
}
