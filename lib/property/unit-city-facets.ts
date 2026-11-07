import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type CityFacet = { city: string; count: number };

/**
 * Distinct cities (with unit counts) among the property units matching `where`,
 * most inventory first. A unit has no community of its own — it belongs to a
 * project (Property), whose community carries the location. So units are grouped
 * by project, then each project is mapped to its community's `city` (falling
 * back to `emirate`, where Dubai / Abu Dhabi live for the UAE) and the counts
 * are summed per city. Units whose project has no community, or whose community
 * has neither city nor emirate, are left out rather than bucketed under a guess.
 *
 * `where` is the same clause the listing counts with, so the breakdown always
 * adds up to the "Available units" total for the current filters.
 */
export async function getUnitCityFacets(
  where: Prisma.PropertyUnitWhereInput,
): Promise<CityFacet[]> {
  try {
    const groups = await prisma.propertyUnit.groupBy({
      by: ["propertyId"],
      where,
      _count: { _all: true },
    });
    if (!groups.length) return [];

    const ids = groups.map((g) => g.propertyId);
    const props = await prisma.property.findMany({
      where: { id: { in: ids } },
      select: { id: true, community: { select: { city: true, emirate: true } } },
    });
    const cityOf = new Map(
      props.map((p) => [
        p.id,
        p.community?.city?.trim() || p.community?.emirate?.trim() || null,
      ]),
    );

    // Several projects can share a city, so sum their unit counts.
    const counts = new Map<string, number>();
    for (const g of groups) {
      const city = cityOf.get(g.propertyId);
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
