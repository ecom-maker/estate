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

/** Well-known Dubai schools, for the "Nearby Schools" section. Coordinates are
 *  approximate — distances are straight-line, like the landmarks above. */
const SCHOOLS: { name: string; lat: number; lng: number }[] = [
  { name: "GEMS Wellington International School", lat: 25.114, lng: 55.186 },
  { name: "Dubai College", lat: 25.118, lng: 55.179 },
  { name: "Kings' School Dubai (Umm Suqeim)", lat: 25.14, lng: 55.201 },
  { name: "Jumeirah College", lat: 25.16, lng: 55.236 },
  { name: "Raffles World Academy", lat: 25.118, lng: 55.236 },
  { name: "GEMS Dubai American Academy", lat: 25.105, lng: 55.196 },
  { name: "GEMS World Academy", lat: 25.105, lng: 55.207 },
  { name: "Dubai International Academy (Emirates Hills)", lat: 25.059, lng: 55.176 },
  { name: "Dubai British School (Emirates Hills)", lat: 25.062, lng: 55.172 },
  { name: "Nord Anglia International School Dubai", lat: 25.064, lng: 55.236 },
  { name: "Repton School Dubai (Nad Al Sheba)", lat: 25.16, lng: 55.32 },
  { name: "GEMS Modern Academy (Nad Al Sheba)", lat: 25.166, lng: 55.328 },
];

/** How many landmarks to keep, nearest first. */
const MAX_RESULTS = 5;
/** Schools further than this from the project aren't worth listing. */
const SCHOOL_MAX_NEAREST_KM = 25;
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

export type NearbyGeo = { name: string; lat: number; lng: number; km: number };

/** Nearest landmarks WITH coordinates (so callers can fetch road distance). */
export function nearestLandmarks(
  lat: number | null | undefined,
  lng: number | null | undefined,
): NearbyGeo[] {
  if (!validCoord(lat, lng)) return [];
  const all = LANDMARKS.map((l) => ({
    name: l.name,
    lat: l.lat,
    lng: l.lng,
    km: Math.round(haversineKm(lat!, lng!, l.lat, l.lng) * 10) / 10,
  })).sort((a, b) => a.km - b.km);
  if (!all.length || all[0].km > MAX_NEAREST_KM) return [];
  return all.slice(0, MAX_RESULTS);
}

/** Nearest schools to the project's coordinates, straight-line, nearest first. */
export function computeNearbySchools(
  lat: number | null | undefined,
  lng: number | null | undefined,
): NearbyLandmark[] {
  if (!validCoord(lat, lng)) return [];
  const all = SCHOOLS.map((s) => ({
    name: s.name,
    km: Math.round(haversineKm(lat!, lng!, s.lat, s.lng) * 10) / 10,
  })).sort((a, b) => a.km - b.km);
  if (!all.length || all[0].km > SCHOOL_MAX_NEAREST_KM) return [];
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
