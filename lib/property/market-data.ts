import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { kvGet } from "@/lib/settings/kv";
import { dldInsightsQuery } from "@/lib/property/dld-communities";
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

/**
 * AED per sqft of built-up area.
 *
 * Deliberately derived rather than read from the feed's own
 * `transaction_per_sqm_amount`: for villas that figure is computed on PLOT
 * area while `builtup_area_sqm` is the built-up area, so the two disagree
 * (36 of 52 villa rows checked). Averaging the feed's value would mix plot
 * and built-up rates in one line. Dividing by the same area the transactions
 * table displays keeps the chart and the table consistent.
 */
function perSqft(r: Row): number | null {
  if (!r.amountAed || !r.areaSqm || r.areaSqm <= 0) return null;
  return r.amountAed / (r.areaSqm * SQFT_PER_SQM);
}

/** Monthly mean AED/sqft, keyed "YYYY-MM". Months with no sales are absent. */
function monthlyPerSqft(rows: Row[]): Map<string, number> {
  const buckets = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const v = perSqft(r);
    if (v === null) continue;
    const d = r.transactedOn;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key) ?? { sum: 0, n: 0 };
    b.sum += v;
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
function buildSeries(
  primaryM: Map<string, number>,
  secondaryM: Map<string, number> | null,
): { months: string[]; primary: number[]; secondary: number[] } | null {
  const keys = [
    ...new Set([
      ...primaryM.keys(),
      ...(secondaryM ? [...secondaryM.keys()] : []),
    ]),
  ].sort();
  if (keys.length < MIN_TREND_MONTHS) return null;

  const months: string[] = [];
  const primary: number[] = [];
  const secondary: number[] = [];
  let lastP: number | null = null;
  let lastS: number | null = null;

  for (const key of keys) {
    const [y, m] = key.split("-");
    lastP = primaryM.get(key) ?? lastP;
    if (secondaryM) lastS = secondaryM.get(key) ?? lastS;
    if (lastP === null) continue; // nothing to draw yet
    if (secondaryM && lastS === null) continue;
    months.push(`${MONTHS[Number(m) - 1]} ${y.slice(2)}`);
    primary.push(lastP);
    if (secondaryM) secondary.push(lastS as number);
  }
  return months.length >= MIN_TREND_MONTHS ? { months, primary, secondary } : null;
}

type InsightsInput = {
  bedrooms: number | null;
  community?: { name: string } | null;
  /** The project/building name — used to draw a building-specific line when the
   *  DLD records name it. Off-plan towers have no transactions, so this is
   *  usually absent and the chart falls back to community comparables. */
  building?: string | null;
};

/**
 * Full 10-year DLD data (Cloudflare D1, 8M records) through the
 * `dld-transactions` Worker when the `dld_worker` setting is present; the
 * older Supabase `market_transactions` table otherwise, or if the Worker fails.
 */
export async function getMarketInsights(property: InsightsInput): Promise<MarketInsights | null> {
  const worker = await dldWorker();
  if (worker) {
    try {
      return await getD1Insights(worker, property);
    } catch (error) {
      console.error("[market-data] D1 worker failed, using Supabase table", error);
    }
  }
  return getSupabaseInsights(property);
}

async function getSupabaseInsights(property: InsightsInput): Promise<MarketInsights | null> {
  const community = property.community?.name;
  if (!community) return null;

  const beds = property.bedrooms === null ? null : String(property.bedrooms);
  const building = property.building?.trim() || null;

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

  const compSales = sameBeds(sales);
  const compRentals = sameBeds(rentals);

  // Building-level (project-specific) transactions, same bedroom count, when
  // the DLD records name this building. For an off-plan tower there are none.
  let buildingSales: Row[] = [];
  let buildingRentals: Row[] = [];
  if (building) {
    const [bs, br] = await Promise.all([
      prisma.marketTransaction.findMany({
        where: {
          emirateCommunity: community,
          purpose: "for-sale",
          building: { equals: building, mode: "insensitive" },
        },
        select,
        orderBy: { transactedOn: "desc" },
        take: 4000,
      }),
      prisma.marketTransaction.findMany({
        where: {
          emirateCommunity: community,
          purpose: "for-rent",
          building: { equals: building, mode: "insensitive" },
        },
        select,
        orderBy: { transactedOn: "desc" },
        take: 4000,
      }),
    ]);
    buildingSales = sameBeds(bs);
    buildingRentals = sameBeds(br);
  }

  // Headline scope (table + primary trend line): the building itself when we
  // have enough of its own sales, otherwise same-bedroom community comparables,
  // otherwise the whole community.
  const useBuilding = buildingSales.length >= MIN_TXNS;
  const sameBedOk = compSales.length >= MIN_TXNS;
  const salesScope = useBuilding
    ? buildingSales
    : sameBedOk
      ? compSales
      : sales;
  const rentalScope = useBuilding
    ? buildingRentals
    : compRentals.length >= MIN_TXNS
      ? compRentals
      : rentals;

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

  const bedWord =
    beds === null
      ? "Similar properties"
      : beds === "0"
        ? "Studios"
        : `${beds} bedroom`;

  // Label for the transactions table (the headline scope used for the rows).
  const comparablesLabel = useBuilding
    ? `${bedWord} at ${building}`
    : sameBedOk
      ? `${bedWord} in ${community}`
      : `Similar properties in ${community}`;

  // Chart line labels. Phrased so the two lines read clearly on their own:
  // the bedroom segment ("4-bedroom average") against the whole-area baseline
  // ("Downtown Dubai average (all sizes)"), rather than the easily-confused
  // "4 bedroom in Downtown Dubai" vs "All Downtown Dubai".
  const segWord =
    beds === null ? "Similar homes" : beds === "0" ? "Studio" : `${beds}-bedroom`;
  const areaAvgLabel = `${community} average (all sizes)`;

  // Trend: pick the most specific scope that spans enough months, so a chart
  // appears wherever the data honestly supports one. When only the whole
  // community has enough months, it draws as a single line (no narrower
  // baseline to compare against); when even that is too thin, no chart.
  type Scope = { sales: Row[]; rentals: Row[]; label: string; kind: string };
  const scopes: Scope[] = [];
  if (useBuilding)
    scopes.push({
      sales: buildingSales,
      rentals: buildingRentals,
      label: `${segWord} at ${building}`,
      kind: "building",
    });
  if (sameBedOk)
    scopes.push({
      sales: compSales,
      rentals: compRentals,
      label: `${segWord} average`,
      kind: "sameBed",
    });
  scopes.push({ sales, rentals, label: areaAvgLabel, kind: "all" });

  const mAllSales = monthlyPerSqft(sales);
  const mAllRentals = monthlyPerSqft(rentals);

  let trend: MarketInsights["trend"] = null;
  for (const scope of scopes) {
    const primaryM = monthlyPerSqft(scope.sales);
    const secondaryM = scope.kind === "all" ? null : mAllSales;
    const saleTrend = buildSeries(primaryM, secondaryM);
    if (!saleTrend) continue;

    const rentPrimaryM = monthlyPerSqft(scope.rentals);
    const rentSecondaryM = scope.kind === "all" ? null : mAllRentals;
    const rentTrend = buildSeries(rentPrimaryM, rentSecondaryM);

    trend = {
      months: saleTrend.months,
      sale: { primary: saleTrend.primary, secondary: saleTrend.secondary },
      rent:
        rentTrend && rentTrend.months.length === saleTrend.months.length
          ? { primary: rentTrend.primary, secondary: rentTrend.secondary }
          : { primary: [], secondary: [] },
      primaryLabel: scope.label,
      secondaryLabel: scope.kind === "all" ? "" : areaAvgLabel,
    };
    break;
  }

  return {
    sold,
    rented,
    comparablesLabel,
    scope: useBuilding ? "building" : "area",
    trend,
  };
}

// ---------------------------------------------------------------------------
// Full DLD data: Cloudflare D1 through the `dld-transactions` Worker
// (infra/cloudflare/dld-transactions/worker.js).
// ---------------------------------------------------------------------------

type WorkerConfig = { url: string; secret: string };

async function dldWorker(): Promise<WorkerConfig | null> {
  const cfg = await kvGet<WorkerConfig | null>("dld_worker", null);
  return cfg?.url && cfg?.secret ? cfg : null;
}

type D1Row = { d: string; a: number | null; s: number | null; r: number | null };
type D1Month = { m: string; n: number; v: number };
type D1Side = { latest: D1Row[]; monthly: D1Month[]; count: number };
type D1Scope = { sales: D1Side; rentals: D1Side };
type D1Response = { since: string; sameBed: D1Scope; all: D1Scope; project: D1Scope | null };

/** Cached for a day per (community, beds, project): the D1 data changes only on a monthly top-up. */
const fetchD1 = unstable_cache(
  async (url: string, secret: string, query: string): Promise<D1Response> => {
    const res = await fetch(`${url}/insights?${query}`, {
      headers: { "x-dld-secret": secret },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`dld worker ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as D1Response;
  },
  ["dld-insights-v1"],
  { revalidate: 86_400, tags: ["dld"] },
);

function d1Rows(rows: D1Row[]): Row[] {
  return rows.map((r) => ({
    transactedOn: new Date(`${r.d}T00:00:00Z`),
    amountAed: r.a,
    amountPerSqm: null,
    areaSqm: r.s,
    monthlyRentAed: r.r,
    bedrooms: null,
  }));
}

function d1Months(rows: D1Month[]): Map<string, number> {
  return new Map(rows.map((r) => [r.m, r.v]));
}

async function getD1Insights(worker: WorkerConfig, property: InsightsInput): Promise<MarketInsights | null> {
  const community = property.community?.name;
  const query = dldInsightsQuery(property);
  if (!community || !query) return null;

  const beds = property.bedrooms === null ? null : String(property.bedrooms);
  const building = property.building?.trim() || null;
  const data = await fetchD1(worker.url, worker.secret, query);

  const useBuilding = (data.project?.sales.count ?? 0) >= MIN_TXNS;
  const sameBedOk = data.sameBed.sales.count >= MIN_TXNS;
  const salesScope = useBuilding ? data.project! : sameBedOk ? data.sameBed : data.all;
  const rentalScope = useBuilding
    ? data.project!
    : data.sameBed.rentals.count >= MIN_TXNS
      ? data.sameBed
      : data.all;

  if (salesScope.sales.count < MIN_TXNS) return null;

  const sold = d1Rows(salesScope.sales.latest)
    .map((r) => toTxn(r))
    .filter((t): t is Txn => t !== null)
    .slice(0, 14);
  const rented = d1Rows(rentalScope.rentals.latest)
    .map((r) => toTxn(r, true))
    .filter((t): t is Txn => t !== null)
    .slice(0, 14);
  if (sold.length < MIN_TXNS) return null;

  const bedWord =
    beds === null ? "Similar properties" : beds === "0" ? "Studios" : `${beds} bedroom`;
  const comparablesLabel = useBuilding
    ? `${bedWord} at ${building}`
    : sameBedOk
      ? `${bedWord} in ${community}`
      : `Similar properties in ${community}`;
  const segWord =
    beds === null ? "Similar homes" : beds === "0" ? "Studio" : `${beds}-bedroom`;
  const areaAvgLabel = `${community} average (all sizes)`;

  const scopes: { s: D1Scope; label: string; kind: string }[] = [];
  if (useBuilding) scopes.push({ s: data.project!, label: `${segWord} at ${building}`, kind: "building" });
  if (sameBedOk) scopes.push({ s: data.sameBed, label: `${segWord} average`, kind: "sameBed" });
  scopes.push({ s: data.all, label: areaAvgLabel, kind: "all" });

  const mAllSales = d1Months(data.all.sales.monthly);
  const mAllRentals = d1Months(data.all.rentals.monthly);
  let trend: MarketInsights["trend"] = null;
  for (const sc of scopes) {
    const saleTrend = buildSeries(d1Months(sc.s.sales.monthly), sc.kind === "all" ? null : mAllSales);
    if (!saleTrend) continue;
    const rentTrend = buildSeries(d1Months(sc.s.rentals.monthly), sc.kind === "all" ? null : mAllRentals);
    trend = {
      months: saleTrend.months,
      sale: { primary: saleTrend.primary, secondary: saleTrend.secondary },
      rent:
        rentTrend && rentTrend.months.length === saleTrend.months.length
          ? { primary: rentTrend.primary, secondary: rentTrend.secondary }
          : { primary: [], secondary: [] },
      primaryLabel: sc.label,
      secondaryLabel: sc.kind === "all" ? "" : areaAvgLabel,
    };
    break;
  }

  return {
    sold,
    rented,
    comparablesLabel,
    scope: useBuilding ? "building" : "area",
    trend,
    salesCount: salesScope.sales.count,
  };
}
