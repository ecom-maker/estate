import type { UnitGroup, UnitRow } from "@/components/property/units-section";

export const PLACEHOLDER_PLAN = "/floorplan-placeholder.svg";

type FloorplanLike = {
  url: string;
  title: string;
  unitRef: string | null;
  mimeType?: string | null;
};

/** A floor plan stored as a PDF (shown embedded / as a file tile, not an <img>). */
export function isPdfPlan(url: string, mimeType?: string | null): boolean {
  return mimeType === "application/pdf" || /\.pdf(?:$|[?#])/i.test(url);
}

type MatchedPlan = { url: string; title: string; isPdf: boolean };
type UnitLike = {
  id: string;
  unitNumber: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  priceAed: number | null;
  hidden?: boolean;
};
type PropertyLike = {
  id: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  priceAed: number | null;
  units: UnitLike[];
  floorplans: FloorplanLike[];
};

const bedLabel = (b: number | null) =>
  b == null ? "Other" : b === 0 ? "Studio" : `${b} Bed`;

const fromLabel = (price: number | null) =>
  price == null
    ? ""
    : price >= 1_000_000
      ? `from ${(price / 1_000_000).toFixed(1)}M AED`
      : `from ${price.toLocaleString()} AED`;

/**
 * Group a property's units by bedroom type for the developer-style Units view.
 * Falls back to a property-derived unit and a seed floor-plan when data is missing.
 */
/**
 * Finds the floor plan for a unit: by its unit number, else by bedroom count
 * (parsed from "2BR" / "Studio" in the plan's ref or title). No match gives
 * null; never a placeholder or a mismatched plan.
 */
export function floorplanMatcher(floorplans: FloorplanLike[]) {
  const floorplanByUnit = new Map<string, MatchedPlan>();
  const floorplanByBeds = new Map<number, MatchedPlan>();
  for (const fp of floorplans) {
    const plan = { url: fp.url, title: fp.title, isPdf: isPdfPlan(fp.url, fp.mimeType) };
    if (fp.unitRef) floorplanByUnit.set(fp.unitRef, plan);
    const ref = `${fp.unitRef ?? ""} ${fp.title ?? ""}`;
    let beds: number | null = /studio/i.test(ref) ? 0 : null;
    if (beds == null) {
      const m = ref.match(/(\d+)\s*BR/i) ?? ref.match(/(\d+)\s*bed/i);
      if (m) beds = Number(m[1]);
    }
    if (beds != null && !floorplanByBeds.has(beds)) {
      floorplanByBeds.set(beds, plan);
    }
  }
  return (unit: { unitNumber: string; bedrooms: number | null }) =>
    floorplanByUnit.get(unit.unitNumber) ??
    (unit.bedrooms != null ? floorplanByBeds.get(unit.bedrooms) : undefined) ??
    null;
}

export function buildUnitGroups(property: PropertyLike): UnitGroup[] {
  const floorplanFor = floorplanMatcher(property.floorplans);

  // Hidden units are kept in the DB but never shown publicly.
  const visibleUnits = property.units.filter((u) => !u.hidden);
  const unitSource: UnitLike[] = visibleUnits.length
    ? visibleUnits
    : [
        {
          id: property.id,
          unitNumber: "Type A",
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          areaSqft: property.areaSqft,
          priceAed: property.priceAed,
        },
      ];

  const groupMap = new Map<
    string,
    { label: string; order: number; prices: number[]; bath: number | null; units: UnitRow[] }
  >();
  for (const u of unitSource) {
    const key = u.bedrooms == null ? "other" : String(u.bedrooms);
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        label: bedLabel(u.bedrooms),
        order: u.bedrooms ?? 99,
        prices: [],
        bath: u.bathrooms ?? property.bathrooms,
        units: [],
      });
    }
    const grp = groupMap.get(key)!;
    if (u.priceAed != null) grp.prices.push(u.priceAed);
    // Unit numbers are admin-only — never expose them publicly. Show a neutral
    // layout label (e.g. "2 Bed · Layout A") derived from position, not the
    // stored unit_number. Floor plans are still matched by unitNumber internally.
    const letter = String.fromCharCode(65 + Math.min(grp.units.length, 25));
    const label =
      grp.label === "Other" ? `Layout ${letter}` : `${grp.label} · Layout ${letter}`;
    // Real match by unit, else by bedroom count; otherwise no plan is shown
    // (never a placeholder or a mismatched one).
    const fp = floorplanFor(u);
    grp.units.push({
      id: u.id,
      layoutType: label,
      bathrooms: u.bathrooms ?? property.bathrooms,
      areaSqft: u.areaSqft ?? property.areaSqft,
      floorplanUrl: fp?.url ?? "",
      floorplanIsPdf: fp?.isPdf ?? false,
      floorplanTitle: `${label} floor plan`,
    });
  }

  return [...groupMap.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, g]) => ({
      key,
      label: g.label,
      fromLabel: fromLabel(g.prices.length ? Math.min(...g.prices) : null),
      bathrooms: g.bath,
      units: g.units,
    }));
}
