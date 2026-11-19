import "server-only";
import type { MarketInsights } from "@/lib/property/market-insights";

/**
 * Investment / cash-flow snapshot for a unit, computed only from data we have:
 * the unit's sale price and area, a recorded DLD rent rate (the unit's own
 * building first, else the nearest building in the same community — see
 * `lib/property/rent-comparable.ts`), and the project's service-charge rate.
 * Projections use fixed, clearly-disclosed assumptions. Returns null when there
 * isn't enough to show even a gross yield (no price, no area, or no rent).
 */

/** A recorded rent rate for the unit, and where it came from. */
export type RentRate = {
  perSqftYr: number;
  /** "building" = the unit's own building; "area" = a nearby building. */
  scope: "building" | "area";
  /** Distance to the source building, for the "area" case (km). */
  distanceKm?: number | null;
};

/** Fallback price-appreciation rate when there isn't enough recorded history. */
export const APPRECIATION_RATE = 0.07;
export const PROJECTION_YEARS = 5;
/** Property-management fee as a share of gross rent. */
export const MANAGEMENT_RATE = 0.05;

/** Minimum months of price trend before an observed growth rate is trusted. */
const MIN_TREND_MONTHS = 12;
/**
 * Minimum recorded sales behind a *specific* scope (a single building/bedroom)
 * before its own trend is trusted. Below this, a building's short history is
 * launch-phase noise, so the steadier community average is used instead.
 */
const MIN_SALES_FOR_SPECIFIC = 12;
/** Observed growth is blended this far toward the baseline, then clamped. */
const OBSERVED_WEIGHT = 0.5;
const RATE_MIN = 0.02;
const RATE_MAX = 0.15;

export type Appreciation = {
  rate: number;
  /** "observed" = derived from recorded prices; "baseline" = the flat default. */
  source: "observed" | "baseline";
  /** What the observed trend was measured on, e.g. "Business Bay average". */
  basisLabel?: string | null;
};

/**
 * Fit a line to ln(price) over the monthly series and annualise the slope into a
 * growth rate, blended halfway toward the baseline (so one hot/cold year can't
 * run away) and clamped to a sane band. null when the series is too short or has
 * a non-positive value.
 */
function rateFromSeries(series: number[], basisLabel?: string): Appreciation | null {
  const n = series.length;
  if (n < MIN_TREND_MONTHS || series.some((v) => !(v > 0))) return null;

  // Ordinary least squares on (monthIndex, ln price); the slope is the monthly
  // log growth, so exp(slope * 12) - 1 is the annual rate.
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const y = Math.log(series[i]);
    sx += i;
    sy += y;
    sxx += i * i;
    sxy += i * y;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slopePerMonth = (n * sxy - sx * sy) / denom;
  const observed = Math.exp(slopePerMonth * 12) - 1;
  if (!Number.isFinite(observed)) return null;

  const blended =
    OBSERVED_WEIGHT * observed + (1 - OBSERVED_WEIGHT) * APPRECIATION_RATE;
  const rate = Math.min(RATE_MAX, Math.max(RATE_MIN, blended));
  return { rate, source: "observed", basisLabel: basisLabel ?? null };
}

/**
 * Annual price-appreciation rate for the capital-gain projection.
 *
 * Uses the unit's recorded price/sqft trend. The chart's own scope is the most
 * specific one available (this building/bedroom, else the community); the
 * community average it carries alongside is used instead when the specific scope
 * rests on too few real sales to be a trend, or when the building is still new
 * (`preferCommunity`) — a new tower's own prices are launch-phase noise, not
 * multi-year appreciation, however many sales it has. Falls back to the flat
 * baseline when there isn't a year of usable history either way.
 */
export function appreciationFromInsights(
  insights: MarketInsights | null | undefined,
  opts?: { preferCommunity?: boolean },
): Appreciation {
  const baseline: Appreciation = { rate: APPRECIATION_RATE, source: "baseline" };
  const trend = insights?.trend;
  if (!trend) return baseline;

  // The trend carries the community average as its secondary line whenever the
  // primary is a specific scope (secondaryLabel is then set and aligned).
  const hasCommunity =
    !!trend.secondaryLabel &&
    trend.sale.secondary.length === trend.sale.primary.length &&
    trend.sale.secondary.length > 0;
  const specificIsThin =
    (insights?.salesCount ?? Number.POSITIVE_INFINITY) < MIN_SALES_FOR_SPECIFIC;

  if (hasCommunity && (specificIsThin || opts?.preferCommunity)) {
    return (
      rateFromSeries(trend.sale.secondary, trend.secondaryLabel) ?? baseline
    );
  }
  return rateFromSeries(trend.sale.primary, trend.primaryLabel) ?? baseline;
}

export type Investment = {
  price: number;
  area: number;
  rentPerSqftYr: number;
  rentScope: "building" | "area";
  /** Distance to the rent source when it's a nearby building (km). */
  rentDistanceKm?: number | null;
  grossAnnualRent: number;
  grossYield: number; // fraction, e.g. 0.076
  appreciation: Appreciation; // the rate used for the capital-gain projection
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
  rent: RentRate | null;
  serviceChargeText: unknown;
  appreciation?: Appreciation;
}): Investment | null {
  const price = input.priceAed ?? 0;
  const area = input.areaSqft ?? 0;
  if (price <= 0 || area <= 0) return null;

  const rent = input.rent;
  if (!rent || !(rent.perSqftYr > 0)) return null;

  const appreciation = input.appreciation ?? {
    rate: APPRECIATION_RATE,
    source: "baseline" as const,
  };
  const grossAnnualRent = rent.perSqftYr * area;
  const grossYield = grossAnnualRent / price;
  const capitalGain =
    price * ((1 + appreciation.rate) ** PROJECTION_YEARS - 1);

  const base: Investment = {
    price,
    area,
    rentPerSqftYr: rent.perSqftYr,
    rentScope: rent.scope,
    rentDistanceKm: rent.distanceKm ?? null,
    grossAnnualRent,
    grossYield,
    appreciation,
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
