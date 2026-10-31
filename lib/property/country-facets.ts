import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { countryName } from "@/lib/currency/fx";

export type CountryFacet = { code: string; name: string | null; count: number };

/**
 * Distinct countries (with counts) among properties matching `where`, most
 * inventory first. Used to render a country selector only when more than one
 * country has stock — so single-country (UAE) setups show no selector.
 */
export async function getCountryFacets(
  where: Prisma.PropertyWhereInput,
): Promise<CountryFacet[]> {
  try {
    const groups = await prisma.property.groupBy({
      by: ["country"],
      where,
      _count: { _all: true },
    });
    return groups
      .map((g) => ({
        code: g.country ?? "AE",
        name: countryName(g.country ?? "AE"),
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}
