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
  { name: "The Dubai Mall", lat: 25.1972, lng: 55.2796 },
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
  // Ajman
  { name: "Ajman Academy", lat: 25.407, lng: 55.515 },
  { name: "GEMS Our Own English High School Ajman", lat: 25.389, lng: 55.468 },
  { name: "GEMS Winchester School Ajman", lat: 25.399, lng: 55.492 },
  { name: "Habitat School Ajman", lat: 25.412, lng: 55.505 },
  { name: "The City School International Ajman", lat: 25.395, lng: 55.478 },
  // Sharjah (between Ajman and Dubai)
  { name: "Victoria International School of Sharjah", lat: 25.309, lng: 55.47 },
  { name: "Delhi Private School Sharjah", lat: 25.292, lng: 55.47 },
];

/** Major Dubai hospitals, for the "Nearby Hospitals" section (approximate
 *  coordinates; distances are straight-line like the landmarks). */
const HOSPITALS: { name: string; lat: number; lng: number }[] = [
  { name: "Rashid Hospital", lat: 25.234, lng: 55.314 },
  { name: "American Hospital Dubai", lat: 25.231, lng: 55.319 },
  { name: "Mediclinic City Hospital", lat: 25.232, lng: 55.328 },
  { name: "Emirates Hospital Jumeirah", lat: 25.205, lng: 55.247 },
  { name: "Medcare Hospital Al Safa", lat: 25.179, lng: 55.243 },
  { name: "Aster Hospital Mankhool", lat: 25.249, lng: 55.295 },
  { name: "Canadian Specialist Hospital", lat: 25.268, lng: 55.333 },
  { name: "Saudi German Hospital Dubai", lat: 25.105, lng: 55.189 },
  { name: "King's College Hospital Dubai", lat: 25.11, lng: 55.248 },
  { name: "Zulekha Hospital Dubai", lat: 25.288, lng: 55.372 },
  { name: "Dubai Hospital", lat: 25.286, lng: 55.32 },
  // Ajman
  { name: "Sheikh Khalifa Hospital Ajman", lat: 25.3925, lng: 55.4816 },
  { name: "Thumbay University Hospital Ajman", lat: 25.412, lng: 55.489 },
  { name: "Thumbay Hospital Ajman", lat: 25.384, lng: 55.462 },
  { name: "GMC Hospital Ajman", lat: 25.407, lng: 55.478 },
  { name: "Amina Hospital Ajman", lat: 25.397, lng: 55.482 },
  // Sharjah (between Ajman and Dubai)
  { name: "Al Qassimi Hospital Sharjah", lat: 25.354, lng: 55.429 },
  { name: "Zulekha Hospital Sharjah", lat: 25.348, lng: 55.393 },
  { name: "University Hospital Sharjah", lat: 25.293, lng: 55.491 },
];

/** Dubai Metro stations (approximate coords) for the curated fallback. */
const METRO_STATIONS: { name: string; lat: number; lng: number }[] = [
  { name: "Burj Khalifa / Dubai Mall Metro Station", lat: 25.2019, lng: 55.2792 },
  { name: "Business Bay Metro Station", lat: 25.1872, lng: 55.2655 },
  { name: "Financial Centre Metro Station", lat: 25.2136, lng: 55.2817 },
  { name: "Emirates Towers Metro Station", lat: 25.2177, lng: 55.2847 },
  { name: "World Trade Centre Metro Station", lat: 25.2287, lng: 55.2893 },
  { name: "Al Jafiliya Metro Station", lat: 25.229, lng: 55.278 },
  { name: "BurJuman Metro Station", lat: 25.2546, lng: 55.3027 },
  { name: "Max Metro Station", lat: 25.247, lng: 55.304 },
  { name: "Dubai Marina Metro Station", lat: 25.076, lng: 55.1396 },
  { name: "DMCC Metro Station", lat: 25.068, lng: 55.1413 },
  { name: "Sobha Realty Metro Station", lat: 25.096, lng: 55.162 },
  { name: "Mall of the Emirates Metro Station", lat: 25.1192, lng: 55.2004 },
  { name: "Equiti Metro Station", lat: 25.13, lng: 55.211 },
  { name: "Sharaf DG Metro Station", lat: 25.1097, lng: 55.196 },
];

/** How many landmarks to keep, nearest first. */
const MAX_RESULTS = 5;
/** Metro is only "nearby" when this close (km). */
export const METRO_MAX_KM = 2;
/** Schools further than this from the project aren't worth listing. */
const SCHOOL_MAX_NEAREST_KM = 25;
/** Hospitals further than this aren't worth listing. */
const HOSPITAL_MAX_NEAREST_KM = 25;
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

/** Nearest hospitals to the coordinates, straight-line, nearest first. */
export function computeNearbyHospitals(
  lat: number | null | undefined,
  lng: number | null | undefined,
): NearbyLandmark[] {
  if (!validCoord(lat, lng)) return [];
  const all = HOSPITALS.map((h) => ({
    name: h.name,
    km: Math.round(haversineKm(lat!, lng!, h.lat, h.lng) * 10) / 10,
  })).sort((a, b) => a.km - b.km);
  if (!all.length || all[0].km > HOSPITAL_MAX_NEAREST_KM) return [];
  return all.slice(0, MAX_RESULTS);
}

/** Metro stations within METRO_MAX_KM (straight-line), nearest first. */
export function computeNearbyMetro(
  lat: number | null | undefined,
  lng: number | null | undefined,
): NearbyLandmark[] {
  if (!validCoord(lat, lng)) return [];
  return METRO_STATIONS.map((m) => ({
    name: m.name,
    km: Math.round(haversineKm(lat!, lng!, m.lat, m.lng) * 10) / 10,
  }))
    .filter((m) => m.km <= METRO_MAX_KM)
    .sort((a, b) => a.km - b.km)
    .slice(0, MAX_RESULTS);
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
