/**
 * Sale-vs-rent availability, derived from metadata until Property/PropertyUnit
 * gain a first-class deal field.
 *
 * - A unit stores `metadata.listing` ∈ {sale, rent, both} (default sale).
 * - A unit-less property stores `metadata.dealType` (sale|rent) and
 *   `metadata.forRent` (also-for-rent on a completed sale listing).
 */

export type Deal = "sale" | "rent";

export function unitListing(metadata: unknown): "sale" | "rent" | "both" {
  const v = (metadata as { listing?: string } | null)?.listing;
  return v === "rent" || v === "both" ? v : "sale";
}

/** Does this unit belong on a page for the given deal? */
export function unitMatchesDeal(metadata: unknown, deal: Deal): boolean {
  const l = unitListing(metadata);
  return deal === "rent" ? l === "rent" || l === "both" : l === "sale" || l === "both";
}

type PropMeta = { dealType?: string; forRent?: boolean } | null;

/** Does this (unit-less) property belong on a page for the given deal? */
export function propertyMatchesDeal(metadata: unknown, deal: Deal): boolean {
  const meta = (metadata as PropMeta) ?? {};
  if (deal === "rent") return meta.dealType === "rent" || meta.forRent === true;
  return meta.dealType !== "rent"; // sale is the default
}

/**
 * Whether a development (with or without units) has inventory for the deal:
 * any matching visible unit, or — when it has no units — the property itself.
 */
export function developmentMatchesDeal(
  property: { metadata: unknown; units: { hidden?: boolean; metadata: unknown }[] },
  deal: Deal,
): boolean {
  const visible = property.units.filter((u) => !u.hidden);
  if (visible.length > 0) {
    return visible.some((u) => unitMatchesDeal(u.metadata, deal));
  }
  return propertyMatchesDeal(property.metadata, deal);
}
