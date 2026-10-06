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
  trend: {
    months: string[]; // oldest → newest
    sale: { primary: number[]; secondary: number[] }; // AED / sqft
    rent: { primary: number[]; secondary: number[] }; // AED / sqft / year
    primaryLabel: string;
    secondaryLabel: string;
  };
};
