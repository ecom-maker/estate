import type { Prisma } from "@prisma/client";

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

export type UnitFilters = {
  q: string;
  types: string[]; // TYPE_OPTIONS labels
  beds: string[];
  baths: string[];
  min: string;
  max: string;
  status: "" | "offplan" | "ready";
};

export const EMPTY_FILTERS: UnitFilters = {
  q: "",
  types: [],
  beds: [],
  baths: [],
  min: "",
  max: "",
  status: "",
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
  return {
    q: one(params.q).trim().slice(0, 100),
    types: list(params.type, TYPE_OPTIONS.map((o) => o.label)),
    beds,
    baths: list(params.baths, BATHROOMS),
    min: amount(params.min),
    max: amount(params.max),
    status: status === "offplan" || status === "ready" ? status : "",
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
    and.push({
      property: { type: { in: types.map((t) => t.toUpperCase()) as Prisma.EnumPropertyTypeFilter["in"] } },
    });
  }
  if (f.beds.length) and.push({ OR: countMatch("bedrooms", f.beds) });
  if (f.baths.length) and.push({ OR: countMatch("bathrooms", f.baths) });
  if (f.min) and.push({ priceAed: { gte: Number(f.min) } });
  if (f.max) and.push({ priceAed: { lte: Number(f.max) } });
  if (f.status) and.push({ property: { offPlan: f.status === "offplan" } });
  return and;
}
