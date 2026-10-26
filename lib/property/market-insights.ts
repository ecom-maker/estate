/**
 * Shapes for the market insights shown on property pages.
 *
 * These used to be generated from the property's own price with a seeded PRNG,
 * which produced a plausible-looking 5-year curve and a transactions table for
 * buildings that had never transacted. Both are now built from recorded DLD
 * transactions — see `lib/property/market-data.ts`. Nothing on these pages is
 * estimated: when there is too little real data, the section is not rendered.
 */

export type Txn = { date: string; aed: number; area: number };

export type MarketInsights = {
  sold: Txn[];
  rented: Txn[];
  /** What the sold/rented rows represent, e.g. "1 bedroom at <project>" or
   *  "1 bedroom in <community>". Drives the transactions table subtitle. */
  comparablesLabel?: string;
  /** Whether the rows are this building's own sales ("building") or
   *  same-bedroom comparables across the community ("area"). Drives the
   *  transactions table heading so it never claims "this building" for what are
   *  actually area comparables (e.g. an off-plan tower with no sales yet). */
  scope?: "building" | "area";
  /**
   * null when the comparables exist but span too few months to call a trend.
   * The transactions table is still shown in that case — it is a list of real
   * sales and stands on its own — while the chart is omitted.
   */
  trend: {
    months: string[]; // oldest → newest
    sale: { primary: number[]; secondary: number[] }; // AED / sqft
    rent: { primary: number[]; secondary: number[] }; // AED / sqft / year
    primaryLabel: string;
    secondaryLabel: string;
  } | null;
};
