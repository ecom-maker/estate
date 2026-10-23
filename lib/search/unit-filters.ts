import type { Prisma, PropertyType } from "@prisma/client";

/**
 * Plain (non-AI) filters for the /properties unit listing. The filter bar
 * writes them to the URL; the page reads them back and turns them into a
 * Prisma query.
 */

// Rich label list (from the reference) → the app's base property types.
export const TYPE_OPTIONS: { label: string; type: string }[] = [
  { label: "Apartment", type: "apartment" },
  { label: "Villa", type: "villa" },
  { label: "Townhouse", type: "townhouse" },
  { label: "Penthouse", type: "penthouse" },
  { label: "Compound", type: "villa" },
  { label: "Duplex", type: "apartment" },
  { label: "Full Floor", type: "unit" },
  { label: "Half Floor", type: "unit" },
  { label: "Whole Building", type: "unit" },
  { label: "Land", type: "land" },
  { label: "Bulk Sale Unit", type: "unit" },
  { label: "Bungalow", type: "villa" },
  { label: "Hotel & Hotel Apartment", type: "unit" },
];

export const BEDROOMS = ["studio", "1", "2", "3", "4", "5", "6", "7", "7+"];
export const BATHROOMS = ["1", "2", "3", "4", "5", "6", "7", "7+"];

export type Furnishing = "" | "furnished" | "unfurnished" | "partly";

// Single-select, shown in the "Filters" panel. "" = All furnishings (no filter).
export const FURNISHING_OPTIONS: { value: Furnishing; label: string }[] = [
  { value: "", label: "All furnishings" },
  { value: "furnished", label: "Furnished" },
  { value: "unfurnished", label: "Unfurnished" },
  { value: "partly", label: "Partly furnished" },
];

// Result ordering for the unit list. Kept separate from UnitFilters — sorting
// isn't a "filter", so it doesn't count toward the active-filter state.
export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_low", label: "Price (low)" },
  { value: "price_high", label: "Price (high)" },
  { value: "beds_least", label: "Beds (least)" },
  { value: "beds_most", label: "Beds (most)" },
] as const;

export type Sort = (typeof SORT_OPTIONS)[number]["value"];
export const DEFAULT_SORT: Sort = "newest";

export function parseSort(v: string | string[] | undefined): Sort {
  const s = one(v);
  return SORT_OPTIONS.some((o) => o.value === s) ? (s as Sort) : DEFAULT_SORT;
}

/** Prisma orderBy for the chosen sort, with a stable id tiebreaker. */
export function unitSortOrderBy(
  sort: Sort,
): Prisma.PropertyUnitOrderByWithRelationInput[] {
  switch (sort) {
    case "price_low":
      return [{ priceAed: "asc" }, { id: "asc" }];
    case "price_high":
      return [{ priceAed: "desc" }, { id: "asc" }];
    case "beds_least":
      return [{ bedrooms: "asc" }, { id: "asc" }];
    case "beds_most":
      return [{ bedrooms: "desc" }, { id: "asc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

export type UnitFilters = {
  q: string;
  types: string[]; // TYPE_OPTIONS labels
  beds: string[];
  baths: string[];
  min: string;
  max: string;
  status: "" | "offplan" | "ready";
  furnishing: Furnishing;
};

export const EMPTY_FILTERS: UnitFilters = {
  q: "",
  types: [],
  beds: [],
  baths: [],
  min: "",
  max: "",
  status: "",
  furnishing: "",
};

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const list = (v: string | string[] | undefined, allowed: string[]) =>
  one(v)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => allowed.includes(s));
const amount = (v: string | string[] | undefined) => {
  const n = Number(one(v).replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : "";
};

export function parseUnitFilters(params: Params): UnitFilters {
  // Older links used beds=0..4 (0 = studio, 4 = 4+).
  const legacyBeds: Record<string, string[]> = {
    "0": ["studio"],
    "4": ["4", "5", "6", "7", "7+"],
  };
  const rawBeds = one(params.beds);
  const beds = legacyBeds[rawBeds] ?? list(params.beds, BEDROOMS);
  const status = one(params.status);
  const furnishing = one(params.furnishing);
  return {
    q: one(params.q).trim().slice(0, 100),
    types: list(params.type, TYPE_OPTIONS.map((o) => o.label)),
    beds,
    baths: list(params.baths, BATHROOMS),
    min: amount(params.min),
    max: amount(params.max),
    status: status === "offplan" || status === "ready" ? status : "",
    furnishing: FURNISHING_OPTIONS.some((o) => o.value && o.value === furnishing)
      ? (furnishing as Furnishing)
      : "",
  };
}

export function unitFiltersToSearch(f: UnitFilters): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.types.length) p.set("type", f.types.join(","));
  if (f.beds.length) p.set("beds", f.beds.join(","));
  if (f.baths.length) p.set("baths", f.baths.join(","));
  if (amount(f.min)) p.set("min", amount(f.min));
  if (amount(f.max)) p.set("max", amount(f.max));
  if (f.status) p.set("status", f.status);
  if (f.furnishing) p.set("furnishing", f.furnishing);
  return p.toString();
}

export function hasUnitFilters(f: UnitFilters) {
  return unitFiltersToSearch(f) !== "";
}

/** "studio" → 0, "7+" → 7 and up, "3" → 3. */
function countMatch(
  field: "bedrooms" | "bathrooms",
  values: string[],
): Prisma.PropertyUnitWhereInput[] {
  return values.map((v) =>
    v === "studio"
      ? { [field]: 0 }
      : v.endsWith("+")
        ? { [field]: { gte: Number(v.slice(0, -1)) } }
        : { [field]: Number(v) },
  );
}

export function unitFiltersWhere(f: UnitFilters): Prisma.PropertyUnitWhereInput[] {
  const and: Prisma.PropertyUnitWhereInput[] = [];
  if (f.q) {
    const text = { contains: f.q, mode: "insensitive" as const };
    and.push({
      property: {
        OR: [
          { title: text },
          { community: { name: text } },
          { community: { city: text } },
          { community: { emirate: text } },
        ],
      },
    });
  }
  const types = [
    ...new Set(
      f.types
        .map((l) => TYPE_OPTIONS.find((o) => o.label === l)?.type)
        .filter((t): t is string => Boolean(t)),
    ),
  ];
  if (types.length) {
    const wanted = types.map((t) => t.toUpperCase()) as PropertyType[];
    // The unit's own type when known (a penthouse in an apartment tower),
    // otherwise the project's type.
    and.push({
      OR: [
        { unitType: { in: wanted } },
        { unitType: null, property: { type: { in: wanted } } },
      ],
    });
  }
  if (f.beds.length) and.push({ OR: countMatch("bedrooms", f.beds) });
  if (f.baths.length) and.push({ OR: countMatch("bathrooms", f.baths) });
  if (f.min) and.push({ priceAed: { gte: Number(f.min) } });
  if (f.max) and.push({ priceAed: { lte: Number(f.max) } });
  if (f.status) and.push({ property: { offPlan: f.status === "offplan" } });
  // Furnishing lives on the project: `furnished` is a boolean, and the richer
  // "partly furnished" state (when known) is parsed into metadata.furnishing.
  if (f.furnishing === "furnished") and.push({ property: { furnished: true } });
  else if (f.furnishing === "unfurnished")
    and.push({ property: { furnished: false } });
  else if (f.furnishing === "partly")
    and.push({
      property: {
        metadata: { path: ["furnishing"], string_contains: "semi" },
      },
    });
  return and;
}
