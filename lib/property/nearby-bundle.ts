import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getNearbyLandmarks } from "@/lib/property/nearby-live";
import { getNearbySchools } from "@/lib/property/schools";
import { getNearbyHospitals } from "@/lib/property/hospitals";
import { getNearbyMetro } from "@/lib/property/metro";
import { storedNearby, type NearbyLandmark } from "@/lib/property/nearby";

export type NearbyBundle = {
  landmarks: NearbyLandmark[];
  schools: NearbyLandmark[];
  hospitals: NearbyLandmark[];
  metro: NearbyLandmark[];
};

const EMPTY: NearbyBundle = {
  landmarks: [],
  schools: [],
  hospitals: [],
  metro: [],
};

// Bump whenever the landmark set or filtering logic changes — stored caches
// with an older version are treated as stale and recomputed on next view.
const NEARBY_VERSION = 3;

function validList(v: unknown): v is NearbyLandmark[] {
  return (
    Array.isArray(v) &&
    v.every(
      (x) =>
        x &&
        typeof (x as NearbyLandmark).name === "string" &&
        typeof (x as NearbyLandmark).km === "number",
    )
  );
}

/** The stored bundle from metadata.nearbyData, or null if absent/stale. */
function readStored(metadata: unknown): NearbyBundle | null {
  const d = (metadata as { nearbyData?: unknown } | null)?.nearbyData;
  if (!d || typeof d !== "object") return null;
  const b = d as Partial<NearbyBundle> & { version?: number };
  // Older/unversioned caches are stale once the data set changes.
  if (b.version !== NEARBY_VERSION) return null;
  if (
    validList(b.landmarks) &&
    validList(b.schools) &&
    validList(b.hospitals) &&
    validList(b.metro)
  ) {
    return {
      landmarks: b.landmarks,
      schools: b.schools,
      hospitals: b.hospitals,
      metro: b.metro,
    };
  }
  return null;
}

function hasCoords(lat: number | null, lng: number | null): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

/**
 * Nearby data (landmarks, schools, hospitals, metro) for a property/project.
 * Read from the DB (metadata.nearbyData) when present; otherwise computed from
 * the Places/Distance-Matrix APIs and persisted after the response, so every
 * later load is served from the DB with no API calls.
 */
export async function getNearbyBundle(property: {
  id: string;
  latitude: number | null;
  longitude: number | null;
  metadata: unknown;
}): Promise<NearbyBundle> {
  const cached = readStored(property.metadata);
  if (cached) return cached;

  if (!hasCoords(property.latitude, property.longitude)) return EMPTY;

  const [landmarksRaw, schools, hospitals, metro] = await Promise.all([
    getNearbyLandmarks(property.latitude, property.longitude),
    getNearbySchools(property.latitude, property.longitude),
    getNearbyHospitals(property.latitude, property.longitude),
    getNearbyMetro(property.latitude, property.longitude),
  ]);
  const landmarks = landmarksRaw.length
    ? landmarksRaw
    : (storedNearby(property.metadata) ?? []);

  const bundle: NearbyBundle = { landmarks, schools, hospitals, metro };

  // Persist after the response: the next load reads from the DB, never the API.
  after(async () => {
    try {
      const row = await prisma.property.findUnique({
        where: { id: property.id },
        select: { metadata: true },
      });
      const meta = (row?.metadata as Record<string, unknown> | null) ?? {};
      await prisma.property.update({
        where: { id: property.id },
        data: {
          metadata: {
            ...meta,
            nearbyData: { ...bundle, version: NEARBY_VERSION, at: new Date().toISOString() },
          } as Prisma.InputJsonValue,
        },
      });
    } catch {
      // best-effort — a failed write just means the APIs are used again.
    }
  });

  return bundle;
}

/**
 * Force-recompute the nearby data from the APIs and store it immediately
 * (synchronous write), overwriting any cached metadata.nearbyData. Used by the
 * admin "Refresh nearby data" action. Clears the cache when coords are missing.
 */
export async function recomputeAndStoreNearby(property: {
  id: string;
  latitude: number | null;
  longitude: number | null;
}): Promise<NearbyBundle> {
  const bundle: NearbyBundle = hasCoords(property.latitude, property.longitude)
    ? await (async () => {
        const [landmarks, schools, hospitals, metro] = await Promise.all([
          getNearbyLandmarks(property.latitude, property.longitude),
          getNearbySchools(property.latitude, property.longitude),
          getNearbyHospitals(property.latitude, property.longitude),
          getNearbyMetro(property.latitude, property.longitude),
        ]);
        return { landmarks, schools, hospitals, metro };
      })()
    : EMPTY;

  const row = await prisma.property.findUnique({
    where: { id: property.id },
    select: { metadata: true },
  });
  const meta = (row?.metadata as Record<string, unknown> | null) ?? {};
  await prisma.property.update({
    where: { id: property.id },
    data: {
      metadata: {
        ...meta,
        nearbyData: { ...bundle, version: NEARBY_VERSION, at: new Date().toISOString() },
      } as Prisma.InputJsonValue,
    },
  });
  return bundle;
}
