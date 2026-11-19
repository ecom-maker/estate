import "server-only";
import type { MarketInsights } from "@/lib/property/market-insights";

/**
 * Investment / cash-flow snapshot for a unit, computed only from data we have:
 * the unit's sale price and area, recorded DLD rent comparables (building-first,
 * else area), and the project's service-charge rate. Projections use fixed,
 * clearly-disclosed assumptions. Returns null when there isn't enough to show
 * even a gross yield (no price, no area, or no rent comparables).
 */

/** Price appreciation assumption for the capital-gain projection. */
export const APPRECIATION_RATE = 0.07;
export const PROJECTION_YEARS = 5;
/** Property-management fee as a share of gross rent. */
export const MANAGEMENT_RATE = 0.05;

export type Investment = {
  price: number;
  area: number;
  rentPerSqftYr: number;
  rentScope: "building" | "area";
  grossAnnualRent: number;
  grossYield: number; // fraction, e.g. 0.076
  capitalGain: number; // over PROJECTION_YEARS
  /** Present only when a per-sqft service charge is known. */
  net: {
    serviceChargePerSqft: number;
    serviceCharges: number;
    managementRate: number;
    management: number;
    netAnnual: number;
    netYield: number; // fraction
    monthlyCashflow: number;
    totalReturn: number; // capital gain + rent cash flow over the horizon
    totalReturnRate: number; // total return / price
  } | null;
};

/**
 * Pull a per-sqft service-charge rate out of the free-text field (admin stores
 * it like "AED 18/sqft"). Accepts "AED 18/sqft", "18 AED per sqft", "18/sqft",
 * or a bare number. Returns null when no sensible per-sqft figure is present.
 */
export function parseServiceChargePerSqft(text: unknown): number | null {
  if (typeof text !== "string") return null;
  const t = text.toLowerCase().replace(/,/g, "").trim();
  if (!t) return null;
  // A number tied to a "sqft" / "sq ft" / "sq.ft" unit.
  const m = t.match(/(\d+(?:\.\d+)?)\s*(?:aed)?\s*(?:\/|per)?\s*sq\s*\.?\s*ft/);
  const n = m ? Number(m[1]) : t.match(/^(\d+(?:\.\d+)?)$/) ? Number(t) : NaN;
  // Guard against nonsense (e.g. a parsed year or price). Dubai service
  // charges are a few to a few tens of AED per sqft.
  return Number.isFinite(n) && n > 0 && n <= 200 ? n : null;
}

export function computeInvestment(input: {
  priceAed: number | null;
  areaSqft: number | null;
  insights: MarketInsights | null;
  serviceChargeText: unknown;
}): Investment | null {
  const price = input.priceAed ?? 0;
  const area = input.areaSqft ?? 0;
  if (price <= 0 || area <= 0) return null;

  const rent = input.insights?.rentComparable ?? null;
  if (!rent) return null;

  const grossAnnualRent = rent.perSqftYr * area;
  const grossYield = grossAnnualRent / price;
  const capitalGain =
    price * ((1 + APPRECIATION_RATE) ** PROJECTION_YEARS - 1);

  const base: Investment = {
    price,
    area,
    rentPerSqftYr: rent.perSqftYr,
    rentScope: rent.scope,
    grossAnnualRent,
    grossYield,
    capitalGain,
    net: null,
  };

  const scPerSqft = parseServiceChargePerSqft(input.serviceChargeText);
  if (scPerSqft === null) return base;

  const serviceCharges = scPerSqft * area;
  const management = grossAnnualRent * MANAGEMENT_RATE;
  const netAnnual = grossAnnualRent - serviceCharges - management;
  const totalReturn = capitalGain + netAnnual * PROJECTION_YEARS;

  return {
    ...base,
    net: {
      serviceChargePerSqft: scPerSqft,
      serviceCharges,
      managementRate: MANAGEMENT_RATE,
      management,
      netAnnual,
      netYield: netAnnual / price,
      monthlyCashflow: netAnnual / 12,
      totalReturn,
      totalReturnRate: totalReturn / price,
    },
  };
}
