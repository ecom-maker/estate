import { computeNearbySchools, type NearbyLandmark } from "@/lib/property/nearby";

/**
 * Nearby schools from Google Places (Nearby Search, New). Needs
 * GOOGLE_MAPS_API_KEY with the Places API enabled; without it (or on any
 * failure) it falls back to the curated list in lib/property/nearby.ts.
 *
 * Results are cached per rounded coordinate for a week to avoid repeat calls.
 */

const MAX_RESULTS = 5;
const SEARCH_RADIUS_M = 8000;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const cache = new Map<string, { at: number; schools: NearbyLandmark[] }>();

function validCoord(lat?: number | null, lng?: number | null): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

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

type PlacesResponse = {
  places?: {
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
  }[];
};

export async function getNearbySchools(
  lat: number | null | undefined,
  lng: number | null | undefined,
): Promise<NearbyLandmark[]> {
  if (!validCoord(lat, lng)) return [];

  const key = `${lat.toFixed(3)},${(lng as number).toFixed(3)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.schools;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return computeNearbySchools(lat, lng);

  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchNearby",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.displayName,places.location",
        },
        body: JSON.stringify({
          includedTypes: ["school"],
          maxResultCount: 15,
          rankPreference: "DISTANCE",
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lng as number },
              radius: SEARCH_RADIUS_M,
            },
          },
        }),
        next: { revalidate: 604800 },
      },
    );
    if (!res.ok) throw new Error(`Places ${res.status}`);
    const data = (await res.json()) as PlacesResponse;

    const schools: NearbyLandmark[] = (data.places ?? [])
      .map((p) => {
        const name = p.displayName?.text?.trim();
        const plat = p.location?.latitude;
        const plng = p.location?.longitude;
        if (!name || typeof plat !== "number" || typeof plng !== "number") {
          return null;
        }
        return {
          name,
          km: Math.round(haversineKm(lat, lng as number, plat, plng) * 10) / 10,
        };
      })
      .filter((s): s is NearbyLandmark => s !== null)
      .slice(0, MAX_RESULTS);

    const result = schools.length ? schools : computeNearbySchools(lat, lng);
    cache.set(key, { at: Date.now(), schools: result });
    return result;
  } catch {
    return computeNearbySchools(lat, lng);
  }
}
