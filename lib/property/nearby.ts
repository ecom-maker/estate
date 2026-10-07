/**
 * Nearby landmarks for a property, worked out from its coordinates.
 *
 * Distances are straight-line ("as the crow flies"), not drive times — we have
 * no routing data, so the page labels them as such rather than guessing minutes.
 * Stored on `metadata_json.nearby` by scripts/compute-nearby.ts; the page falls
 * back to computing them on the fly when nothing is stored.
 */

export type NearbyLandmark = { name: string; km: number };

const LANDMARKS: { name: string; lat: number; lng: number }[] = [
  { name: "Burj Khalifa & Downtown Dubai", lat: 25.1972, lng: 55.2744 },
  { name: "Dubai Marina", lat: 25.0805, lng: 55.1403 },
  { name: "Palm Jumeirah (Atlantis)", lat: 25.1304, lng: 55.1171 },
  { name: "Burj Al Arab", lat: 25.1412, lng: 55.1853 },
  { name: "Mall of the Emirates", lat: 25.1181, lng: 55.2006 },
  { name: "Dubai International Airport (DXB)", lat: 25.2532, lng: 55.3657 },
  { name: "Al Maktoum International Airport (DWC)", lat: 24.8962, lng: 55.1614 },
];

/** How many landmarks to keep, nearest first. */
const MAX_RESULTS = 5;
/** Beyond this the property isn't in Dubai (e.g. Abu Dhabi, RAK) — show none. */
const MAX_NEAREST_KM = 60;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const validCoord = (lat: number | null | undefined, lng: number | null | undefined) =>
  typeof lat === "number" &&
  typeof lng === "number" &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180 &&
  !(lat === 0 && lng === 0);

export function computeNearby(
  lat: number | null | undefined,
  lng: number | null | undefined,
): NearbyLandmark[] {
  if (!validCoord(lat, lng)) return [];
  const all = LANDMARKS.map((l) => ({
    name: l.name,
    km: Math.round(haversineKm(lat!, lng!, l.lat, l.lng) * 10) / 10,
  })).sort((a, b) => a.km - b.km);
  if (!all.length || all[0].km > MAX_NEAREST_KM) return [];
  return all.slice(0, MAX_RESULTS);
}

/** Read `metadata.nearby` if it is a well-formed list; otherwise null. */
export function storedNearby(metadata: unknown): NearbyLandmark[] | null {
  const v = (metadata as { nearby?: unknown } | null)?.nearby;
  if (!Array.isArray(v)) return null;
  const ok = v.every(
    (x) =>
      x &&
      typeof (x as NearbyLandmark).name === "string" &&
      typeof (x as NearbyLandmark).km === "number",
  );
  return ok ? (v as NearbyLandmark[]) : null;
}

export function formatKm(km: number) {
  return km < 1 ? "Under 1 km" : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
