/**
 * Driving (road) distances from one origin to several destinations, via the
 * Google Distance Matrix API. Needs GOOGLE_MAPS_API_KEY with the Distance
 * Matrix API enabled. Returns km per destination, or null when a leg can't be
 * routed or the API is unavailable (caller falls back to straight-line).
 *
 * Cached per origin+destinations for a week to keep paid calls minimal.
 */

type Pt = { lat: number; lng: number };

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; km: (number | null)[] }>();

export async function roadDistancesKm(
  origin: Pt,
  dests: Pt[],
): Promise<(number | null)[]> {
  if (!dests.length) return [];
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return dests.map(() => null);

  const key =
    `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}|` +
    dests.map((d) => `${d.lat.toFixed(4)},${d.lng.toFixed(4)}`).join(";");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.km;

  try {
    const destStr = dests.map((d) => `${d.lat},${d.lng}`).join("|");
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${origin.lat},${origin.lng}` +
      `&destinations=${encodeURIComponent(destStr)}` +
      `&mode=driving&units=metric&key=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 604800 } });
    if (!res.ok) throw new Error(`DistanceMatrix ${res.status}`);
    const data = (await res.json()) as {
      rows?: { elements?: { status?: string; distance?: { value?: number } }[] }[];
    };
    const elements = data.rows?.[0]?.elements ?? [];
    const km = dests.map((_, i) => {
      const el = elements[i];
      const m = el?.status === "OK" ? el.distance?.value : undefined;
      return typeof m === "number" ? Math.round(m / 100) / 10 : null;
    });
    cache.set(key, { at: Date.now(), km });
    return km;
  } catch {
    return dests.map(() => null);
  }
}
