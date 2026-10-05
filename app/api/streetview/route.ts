import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Redirect to the best Google Street View for a coordinate.
 *
 * A plain `map_action=pano&viewpoint=` URL snaps to the nearest panorama of any
 * kind, which near a building is often a user-uploaded 360 photo (e.g. from a
 * balcony) rather than the official road-level Street View. So when a Maps API
 * key is configured we look up the nearest OUTDOOR panorama (Google's own
 * imagery, user photospheres excluded) via the free Street View metadata API
 * and open that exact panorama. Without a key, we fall back to the map at the
 * coordinates, where the correct Street View is one click away.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.redirect("https://www.google.com/maps");
  }

  const key =
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

  const mapFallback = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  if (key) {
    try {
      const metaUrl =
        `https://maps.googleapis.com/maps/api/streetview/metadata` +
        `?location=${lat},${lng}&source=outdoor&radius=500&key=${key}`;
      const res = await fetch(metaUrl, { cache: "no-store" });
      const data = (await res.json()) as {
        status?: string;
        pano_id?: string;
        location?: { lat: number; lng: number };
      };
      if (data.status === "OK" && data.pano_id) {
        // Open the exact official panorama.
        return NextResponse.redirect(
          `https://www.google.com/maps/@?api=1&map_action=pano&pano=${encodeURIComponent(data.pano_id)}`,
        );
      }
      if (data.status === "OK" && data.location) {
        return NextResponse.redirect(
          `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${data.location.lat},${data.location.lng}`,
        );
      }
    } catch {
      // fall through to the map fallback
    }
  }

  return NextResponse.redirect(mapFallback);
}
