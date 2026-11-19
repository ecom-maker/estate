import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { RentRate } from "@/lib/property/investment";

/**
 * A recorded annual rent per sqft for a unit, for the investment snapshot.
 *
 * The ladder (set by the business): the unit's *own building* first, then the
 * *nearest building in the same community* that has recorded rents, then
 * nothing. Both rungs come from DLD rent contracts, matched by geography:
 * building names are mostly blank in the data, but coordinates are present on
 * ~99.9% of rows, so a "building" is a cluster of contracts at one location.
 *
 * This reads the Supabase `market_transactions` mirror directly (the D1 insights
 * worker only returns community-level aggregates, not per-building coordinates).
 */

const SQFT_PER_SQM = 10.763910417;
/** Rows within this radius of the unit are treated as its own building. */
const SAME_BUILDING_KM = 0.06;
/** Group contracts into "buildings" by rounding coordinates (~11 m at 4 dp). */
const CLUSTER_DP = 4;
/** A cluster needs at least this many contracts to trust its median. */
const MIN_CLUSTER = 2;
/** Prefer same-bedroom contracts only when the community has enough of them. */
const MIN_SAMEBED_POOL = 8;

type RentRow = {
  lat: number;
  lng: number;
  beds: number | null;
  perSqftYr: number;
};

/** Great-circle distance between two lat/lng points, in km. */
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)));
}

function median(values: number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/**
 * Community rent contracts as lightweight rows, cached for a day (the DLD data
 * refreshes monthly). Cached by community so every unit in it reuses one fetch.
 */
const communityRentRows = unstable_cache(
  async (community: string): Promise<RentRow[]> => {
    const rows = await prisma.marketTransaction.findMany({
      where: {
        emirateCommunity: community,
        purpose: "for-rent",
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        amountAed: true,
        monthlyRentAed: true,
        areaSqm: true,
        bedrooms: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { transactedOn: "desc" },
      take: 6000,
    });

    const out: RentRow[] = [];
    for (const r of rows) {
      const annual = r.amountAed ?? (r.monthlyRentAed ? r.monthlyRentAed * 12 : null);
      const sqft = (r.areaSqm ?? 0) * SQFT_PER_SQM;
      if (!annual || annual <= 0 || sqft <= 0) continue;
      if (r.latitude == null || r.longitude == null) continue;
      const beds = r.bedrooms == null ? null : Number.parseInt(r.bedrooms, 10);
      out.push({
        lat: r.latitude,
        lng: r.longitude,
        beds: Number.isFinite(beds as number) ? (beds as number) : null,
        perSqftYr: annual / sqft,
      });
    }
    return out;
  },
  ["community-rent-rows-v1"],
  { revalidate: 86_400, tags: ["dld"] },
);

type Cluster = { lat: number; lng: number; rents: number[]; distanceKm: number };

/** Group rows into buildings by rounded coordinate; attach distance to the unit. */
function clusters(rows: RentRow[], unitLat: number, unitLng: number): Cluster[] {
  const byKey = new Map<string, { lat: number; lng: number; rents: number[] }>();
  for (const r of rows) {
    const key = `${r.lat.toFixed(CLUSTER_DP)},${r.lng.toFixed(CLUSTER_DP)}`;
    const c = byKey.get(key) ?? { lat: r.lat, lng: r.lng, rents: [] };
    c.rents.push(r.perSqftYr);
    byKey.set(key, c);
  }
  return [...byKey.values()]
    .map((c) => ({
      ...c,
      distanceKm: haversineKm(unitLat, unitLng, c.lat, c.lng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Rent for the unit: its own building if the data names it, otherwise the
 * nearest building in the same community with recorded rents. null when the
 * community has no usable rent data (the snapshot is then hidden).
 */
export async function getRentRate(input: {
  community: string | null | undefined;
  lat: number | null | undefined;
  lng: number | null | undefined;
  bedrooms: number | null;
}): Promise<RentRate | null> {
  const community = input.community?.trim();
  if (!community || input.lat == null || input.lng == null) return null;
  const unitLat = input.lat;
  const unitLng = input.lng;

  const all = await communityRentRows(community);
  if (!all.length) return null;

  // Prefer same-bedroom contracts, but only when there are enough of them that
  // dropping the rest still leaves a meaningful sample; rent per sqft varies a
  // lot by unit size, so a studio's rate shouldn't stand in for a 3-bed.
  const sameBed =
    input.bedrooms == null ? [] : all.filter((r) => r.beds === input.bedrooms);
  const pool = sameBed.length >= MIN_SAMEBED_POOL ? sameBed : all;

  const cs = clusters(pool, unitLat, unitLng);

  // The unit's own building: the nearest cluster sitting essentially on top of
  // it, with enough contracts to trust.
  const own = cs.find(
    (c) => c.distanceKm <= SAME_BUILDING_KM && c.rents.length >= MIN_CLUSTER,
  );
  if (own) {
    const m = median(own.rents);
    if (m) return { perSqftYr: m, scope: "building", distanceKm: 0 };
  }

  // Otherwise the nearest *other* building with enough contracts.
  const near = cs.find(
    (c) => c.distanceKm > SAME_BUILDING_KM && c.rents.length >= MIN_CLUSTER,
  );
  if (near) {
    const m = median(near.rents);
    if (m) return { perSqftYr: m, scope: "area", distanceKm: near.distanceKm };
  }

  // Sparse community: no cluster reaches the threshold. Fall back to the nearest
  // handful of contracts so a figure still shows wherever the community has any.
  const nearest = pool
    .map((r) => ({ r, d: haversineKm(unitLat, unitLng, r.lat, r.lng) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 8);
  const m = median(nearest.map((x) => x.r.perSqftYr));
  if (m) {
    return { perSqftYr: m, scope: "area", distanceKm: nearest[0]?.d ?? null };
  }
  return null;
}
