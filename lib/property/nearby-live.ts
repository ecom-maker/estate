import { nearestLandmarks, type NearbyLandmark } from "@/lib/property/nearby";
import { roadDistancesKm } from "@/lib/property/road-distance";

/**
 * Nearest landmarks with DRIVING distance from the project. Falls back to the
 * straight-line distance for any leg Google can't route (or when no API key).
 */
export async function getNearbyLandmarks(
  lat: number | null | undefined,
  lng: number | null | undefined,
): Promise<NearbyLandmark[]> {
  const near = nearestLandmarks(lat, lng);
  if (!near.length) return [];
  const road = await roadDistancesKm(
    { lat: lat as number, lng: lng as number },
    near.map((n) => ({ lat: n.lat, lng: n.lng })),
  );
  return near
    .map((n, i) => ({ name: n.name, km: road[i] ?? n.km }))
    .sort((a, b) => a.km - b.km);
}
