import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type CityFacet = { city: string; count: number };

/**
 * Distinct cities (with counts) among properties matching `where`, most
 * inventory first. A property's city comes from its linked community — its
 * `city`, falling back to `emirate` (where Dubai / Abu Dhabi live for the UAE).
 * Properties with no community, or whose community has neither, are left out of
 * the chips rather than bucketed under a guessed city.
 */
export async function getCityFacets(
  where: Prisma.PropertyWhereInput,
): Promise<CityFacet[]> {
  try {
    const groups = await prisma.property.groupBy({
      by: ["communityId"],
      where,
      _count: { _all: true },
    });

    const ids = groups
      .map((g) => g.communityId)
      .filter((id): id is string => Boolean(id));
    if (!ids.length) return [];

    const communities = await prisma.community.findMany({
      where: { id: { in: ids } },
      select: { id: true, city: true, emirate: true },
    });
    const cityOf = new Map(
      communities.map((c) => [c.id, c.city?.trim() || c.emirate?.trim() || null]),
    );

    // Several communities can share a city, so sum their property counts.
    const counts = new Map<string, number>();
    for (const g of groups) {
      const city = g.communityId ? cityOf.get(g.communityId) : null;
      if (!city) continue;
      counts.set(city, (counts.get(city) ?? 0) + g._count._all);
    }

    return [...counts.entries()]
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
  } catch {
    return [];
  }
}
