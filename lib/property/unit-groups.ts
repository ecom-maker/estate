import type { UnitGroup, UnitRow } from "@/components/property/units-section";

export const PLACEHOLDER_PLAN = "/floorplan-placeholder.svg";

type FloorplanLike = { url: string; title: string; unitRef: string | null };
type UnitLike = {
  id: string;
  unitNumber: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  priceAed: number | null;
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
export function buildUnitGroups(property: PropertyLike): UnitGroup[] {
  const floorplanByUnit = new Map<string, { url: string; title: string }>();
  for (const fp of property.floorplans) {
    if (fp.unitRef) floorplanByUnit.set(fp.unitRef, { url: fp.url, title: fp.title });
  }
  const anyFloorplan = property.floorplans[0]
    ? { url: property.floorplans[0].url, title: property.floorplans[0].title }
    : null;

  const unitSource: UnitLike[] = property.units.length
    ? property.units
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
    const fp =
      floorplanByUnit.get(u.unitNumber) ??
      anyFloorplan ?? {
        url: PLACEHOLDER_PLAN,
        title: `${u.unitNumber} floor plan`,
      };
    grp.units.push({
      id: u.id,
      layoutType: u.unitNumber,
      bathrooms: u.bathrooms ?? property.bathrooms,
      areaSqft: u.areaSqft ?? property.areaSqft,
      floorplanUrl: fp.url,
      floorplanTitle: fp.title,
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
