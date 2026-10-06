import { prisma } from "@/lib/db/prisma";
import type { MarketInsights, Txn } from "@/lib/property/market-insights";

/**
 * Real market insights for a property, built from DLD transaction records
 * (`market_transactions`, sourced from Bayut / Happy Endpoint).
 *
 * Scoped to **similar properties**, not to the building itself: these are
 * off-plan projects, so a tower handing over in 2027 has no resale history of
 * its own. Comparables are the same bedroom count in the same community —
 * which is also the only granularity the upstream API can filter on.
 *
 * Returns `null` when there isn't enough real data to say anything. Callers
 * must hide the section in that case rather than showing an estimate: every
 * figure here is a recorded transaction or it is not shown at all.
 */

const SQFT_PER_SQM = 10.7639;

/** Below this, an average is noise rather than a market signal. */
const MIN_TXNS = 6;
/** A trend line needs several months, not several days, to mean anything. */
const MIN_TREND_MONTHS = 3;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

type Row = {
  transactedOn: Date;
  amountAed: number | null;
  amountPerSqm: number | null;
  areaSqm: number | null;
  monthlyRentAed: number | null;
  bedrooms: string | null;
};

function fmtDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function toTxn(r: Row, annualRent = false): Txn | null {
  const area = Math.round((r.areaSqm ?? 0) * SQFT_PER_SQM);
  const aed = annualRent
    ? (r.amountAed ?? (r.monthlyRentAed ? r.monthlyRentAed * 12 : null))
    : r.amountAed;
  if (!aed || area <= 0) return null;
  return { date: fmtDate(r.transactedOn), aed: Math.round(aed), area };
}

/** Monthly mean AED/sqft, keyed "YYYY-MM". Months with no sales are absent. */
function monthlyPerSqft(rows: Row[]): Map<string, number> {
  const buckets = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    if (!r.amountPerSqm) continue;
    const d = r.transactedOn;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key) ?? { sum: 0, n: 0 };
    b.sum += r.amountPerSqm / SQFT_PER_SQM;
    b.n += 1;
    buckets.set(key, b);
  }
  return new Map([...buckets].map(([k, b]) => [k, Math.round(b.sum / b.n)]));
}

/**
 * Walks the covered months in order, carrying the last known value forward
 * across gaps so a quiet month doesn't draw a hole in the line. Returns null
 * if the data spans too few months to be a trend.
 */
function series(
  comparable: Map<string, number>,
  wider: Map<string, number>,
): { months: string[]; primary: number[]; secondary: number[] } | null {
  const keys = [...new Set([...comparable.keys(), ...wider.keys()])].sort();
  if (keys.length < MIN_TREND_MONTHS) return null;

  const months: string[] = [];
  const primary: number[] = [];
  const secondary: number[] = [];
  let lastP: number | null = null;
  let lastS: number | null = null;

  for (const key of keys) {
    const [y, m] = key.split("-");
    lastP = comparable.get(key) ?? lastP;
    lastS = wider.get(key) ?? lastS;
    if (lastP === null || lastS === null) continue; // nothing to draw yet
    months.push(`${MONTHS[Number(m) - 1]} ${y.slice(2)}`);
    primary.push(lastP);
    secondary.push(lastS);
  }
  return months.length >= MIN_TREND_MONTHS ? { months, primary, secondary } : null;
}

export async function getMarketInsights(property: {
  bedrooms: number | null;
  community?: { name: string } | null;
}): Promise<MarketInsights | null> {
  const community = property.community?.name;
  if (!community) return null;

  const beds = property.bedrooms === null ? null : String(property.bedrooms);

  // Two scopes: same-bedroom comparables (the headline figure) and everything
  // in the community (the baseline the comparables are read against).
  const select = {
    transactedOn: true,
    amountAed: true,
    amountPerSqm: true,
    areaSqm: true,
    monthlyRentAed: true,
    bedrooms: true,
  } as const;

  const [sales, rentals] = await Promise.all([
    prisma.marketTransaction.findMany({
      where: { emirateCommunity: community, purpose: "for-sale" },
      select,
      orderBy: { transactedOn: "desc" },
      take: 4000,
    }),
    prisma.marketTransaction.findMany({
      where: { emirateCommunity: community, purpose: "for-rent" },
      select,
      orderBy: { transactedOn: "desc" },
      take: 4000,
    }),
  ]);

  const sameBeds = (rows: Row[]) =>
    beds === null ? rows : rows.filter((r) => r.bedrooms === beds);

  // Prefer same-bedroom comparables; fall back to the whole community only
  // when there are too few of them to average honestly.
  const compSales = sameBeds(sales);
  const compRentals = sameBeds(rentals);
  const salesScope = compSales.length >= MIN_TXNS ? compSales : sales;
  const rentalScope = compRentals.length >= MIN_TXNS ? compRentals : rentals;

  if (salesScope.length < MIN_TXNS) return null;

  const sold = salesScope
    .map((r) => toTxn(r))
    .filter((t): t is Txn => t !== null)
    .slice(0, 14);
  const rented = rentalScope
    .map((r) => toTxn(r, true))
    .filter((t): t is Txn => t !== null)
    .slice(0, 14);

  if (sold.length < MIN_TXNS) return null;

  const saleTrend = series(monthlyPerSqft(salesScope), monthlyPerSqft(sales));
  const rentTrend = series(monthlyPerSqft(rentalScope), monthlyPerSqft(rentals));

  // The chart needs a sale series; rent is optional and reuses the sale months
  // only when it genuinely covers them.
  if (!saleTrend) return null;

  const bedLabel =
    beds === null || salesScope !== compSales
      ? "Similar properties"
      : beds === "0"
        ? "Studios"
        : `${beds} bedroom`;

  return {
    sold,
    rented,
    trend: {
      months: saleTrend.months,
      sale: { primary: saleTrend.primary, secondary: saleTrend.secondary },
      rent:
        rentTrend && rentTrend.months.length === saleTrend.months.length
          ? { primary: rentTrend.primary, secondary: rentTrend.secondary }
          : { primary: [], secondary: [] },
      primaryLabel: `${bedLabel} in ${community}`,
      secondaryLabel: `All ${community}`,
    },
  };
}
