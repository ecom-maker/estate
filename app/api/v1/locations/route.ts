import { prisma } from "@/lib/db/prisma";
import { apiJson, apiError, apiOptions } from "@/lib/data-layer/http";
import { SITE_URL } from "@/lib/data-layer/canonical";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

// Location directory: cities and communities agents can filter inventory by.
export async function GET() {
  try {
    const communities = await prisma.community.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { properties: true } } },
    });

    const cityCounts = new Map<string, number>();
    for (const c of communities) {
      const city = c.city ?? "Dubai";
      cityCounts.set(city, (cityCounts.get(city) ?? 0) + c._count.properties);
    }

    return apiJson({
      object: "list",
      cities: [...cityCounts.entries()].map(([name, propertyCount]) => ({
        type: "city",
        name,
        propertyCount,
      })),
      communities: communities.map((c) => ({
        type: "community",
        name: c.name,
        slug: c.slug,
        city: c.city,
        emirate: c.emirate,
        propertyCount: c._count.properties,
        href: `${SITE_URL}/api/v1/communities/${c.slug}`,
      })),
    });
  } catch (error) {
    return apiError(
      500,
      error instanceof Error ? error.message : "Failed to list locations",
    );
  }
}
