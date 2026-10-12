import {
  computeNearbyHospitals,
  type NearbyLandmark,
} from "@/lib/property/nearby";
import { roadDistancesKm } from "@/lib/property/road-distance";

/**
 * Nearby hospitals from Google Places (Nearby Search, New), ranked by driving
 * distance. Needs GOOGLE_MAPS_API_KEY with the Places API enabled; falls back
 * to a curated list of major Dubai hospitals otherwise. Cached per rounded
 * coordinate for a week.
 */

const MAX_RESULTS = 5;
const SEARCH_RADIUS_M = 12000;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const cache = new Map<string, { at: number; hospitals: NearbyLandmark[] }>();

// A hospital's name says so; clinics, pharmacies, dental and labs are excluded.
const HOSPITAL_NAME = /\bhospitals?\b/i;
const NON_HOSPITAL_NAME =
  /\b(clinic|polyclinic|pharmac(?:y|ies)|dental|dentist|laborator|diagnostic|physiotherap|day\s?surgery)\b/i;
const EXCLUDED_TYPES = new Set([
  "dentist",
  "pharmacy",
  "physiotherapist",
  "doctor",
]);

function isRealHospital(name: string, types: string[] | undefined): boolean {
  if (!HOSPITAL_NAME.test(name)) return false;
  if (NON_HOSPITAL_NAME.test(name)) return false;
  if (types?.some((t) => EXCLUDED_TYPES.has(t))) return false;
  return true;
}

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

export async function getNearbyHospitals(
  lat: number | null | undefined,
  lng: number | null | undefined,
): Promise<NearbyLandmark[]> {
  if (!validCoord(lat, lng)) return [];

  const key = `${lat.toFixed(3)},${(lng as number).toFixed(3)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.hospitals;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return computeNearbyHospitals(lat, lng);

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
          includedTypes: ["hospital"],
          excludedTypes: ["dentist", "pharmacy", "physiotherapist", "doctor"],
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
        if (!isRealHospital(name, p.types)) return null;
        return {
          name,
          lat: plat,
          lng: plng,
          km: Math.round(haversineKm(lat, lng as number, plat, plng) * 10) / 10,
        };
      })
      .filter((h): h is { name: string; lat: number; lng: number; km: number } =>
        h !== null,
      )
      .slice(0, MAX_RESULTS);

    const road = await roadDistancesKm(
      { lat, lng: lng as number },
      nearest.map((h) => ({ lat: h.lat, lng: h.lng })),
    );
    const hospitals: NearbyLandmark[] = nearest
      .map((h, i) => ({ name: h.name, km: road[i] ?? h.km }))
      .sort((a, b) => a.km - b.km);

    const result = hospitals.length
      ? hospitals
      : computeNearbyHospitals(lat, lng);
    cache.set(key, { at: Date.now(), hospitals: result });
    return result;
  } catch {
    return computeNearbyHospitals(lat, lng);
  }
}
