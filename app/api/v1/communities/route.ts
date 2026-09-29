import { prisma } from "@/lib/db/prisma";
import { apiJson, apiError, apiOptions } from "@/lib/data-layer/http";
import { SITE_URL } from "@/lib/data-layer/canonical";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

export async function GET() {
  try {
    const communities = await prisma.community.findMany({
      orderBy: { name: "asc" },
      include: {
        schools: true,
        metros: true,
        _count: { select: { properties: true } },
      },
    });
    return apiJson({
      object: "list",
      total: communities.length,
      data: communities.map((c) => ({
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
        propertyCount: c._count.properties,
        nearbyLandmarks: {
          schools: c.schools.map((s) => ({
            name: s.name,
            curriculum: s.curriculum,
            rating: s.rating,
          })),
          metroStations: c.metros.map((m) => ({ name: m.name, line: m.line })),
        },
      })),
    });
  } catch (error) {
    return apiError(
      500,
      error instanceof Error ? error.message : "Failed to list communities",
    );
  }
}
