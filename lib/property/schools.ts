import { computeNearbySchools, type NearbyLandmark } from "@/lib/property/nearby";
import { roadDistancesKm } from "@/lib/property/road-distance";

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
    types?: string[];
  }[];
};

// Place types that are nurseries/early-years, not actual schools.
const EXCLUDED_TYPES = new Set(["preschool", "child_care_agency"]);

// Names that signal a nursery/playschool/activity centre, not a real school —
// even when Google mis-tags it. Real schools won't contain these words.
const NURSERY_NAME =
  /\b(nurser(?:y|ies)|play\s?-?school|pre-?school|kindergarten|early\s?(?:learning|years|childhood)|day\s?-?care|cr[eè]che|nido|swim(?:ming)?|lesson|tutor|tuition|coaching)\b/i;

function isRealSchool(name: string, types: string[] | undefined): boolean {
  if (NURSERY_NAME.test(name)) return false;
  if (types?.some((t) => EXCLUDED_TYPES.has(t))) return false;
  return true;
}

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
          "X-Goog-FieldMask": "places.displayName,places.location,places.types",
        },
        body: JSON.stringify({
          // Only actual schools — not the generic "school" type, which also
          // tags nurseries, swimming lessons and tutoring centres.
          includedTypes: ["primary_school", "secondary_school"],
          excludedTypes: ["preschool", "child_care_agency"],
          maxResultCount: 20,
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

    const nearest = (data.places ?? [])
      .map((p) => {
        const name = p.displayName?.text?.trim();
        const plat = p.location?.latitude;
        const plng = p.location?.longitude;
        if (!name || typeof plat !== "number" || typeof plng !== "number") {
          return null;
        }
        if (!isRealSchool(name, p.types)) return null;
        return {
          name,
          lat: plat,
          lng: plng,
          km: Math.round(haversineKm(lat, lng as number, plat, plng) * 10) / 10,
        };
      })
      .filter((s): s is { name: string; lat: number; lng: number; km: number } =>
        s !== null,
      )
      .slice(0, MAX_RESULTS);

    // Upgrade to driving distance where Google can route it.
    const road = await roadDistancesKm(
      { lat, lng: lng as number },
      nearest.map((s) => ({ lat: s.lat, lng: s.lng })),
    );
    const schools: NearbyLandmark[] = nearest
      .map((s, i) => ({ name: s.name, km: road[i] ?? s.km }))
      .sort((a, b) => a.km - b.km);

    const result = schools.length ? schools : computeNearbySchools(lat, lng);
    cache.set(key, { at: Date.now(), schools: result });
    return result;
  } catch {
    return computeNearbySchools(lat, lng);
  }
}
