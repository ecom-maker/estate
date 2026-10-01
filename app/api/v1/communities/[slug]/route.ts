import type { PropertyStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { apiJson, apiError, apiOptions } from "@/lib/data-layer/http";
import {
  SITE_URL,
  canonicalSummaryInclude,
  toCanonicalPropertySummary,
} from "@/lib/data-layer/canonical";

export const dynamic = "force-dynamic";
const LISTABLE = ["ACTIVE", "RESERVED"] as PropertyStatus[];

export function OPTIONS() {
  return apiOptions();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const c = await prisma.community.findUnique({
      where: { slug },
      include: {
        schools: true,
        metros: true,
        properties: {
          where: { deletedAt: null, status: { in: LISTABLE } },
          include: canonicalSummaryInclude,
          orderBy: { updatedAt: "desc" },
          take: 48,
        },
      },
    });
    if (!c) return apiError(404, `No community found for slug '${slug}'`);
    return apiJson({
      "@id": `${SITE_URL}/api/v1/communities/${c.slug}`,
      id: c.id,
      name: c.name,
      slug: c.slug,
      city: c.city,
      emirate: c.emirate,
      coordinates:
        c.latitude != null && c.longitude != null
          ? { latitude: c.latitude, longitude: c.longitude }
          : null,
      propertyCount: c.properties.length,
      nearbyLandmarks: {
        schools: c.schools.map((s) => ({
          name: s.name,
          curriculum: s.curriculum,
          rating: s.rating,
        })),
        metroStations: c.metros.map((m) => ({ name: m.name, line: m.line })),
      },
      properties: c.properties.map(toCanonicalPropertySummary),
    });
  } catch (error) {
    return apiError(
      500,
      error instanceof Error ? error.message : "Failed to load community",
    );
  }
}
