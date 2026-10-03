import type { Property, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { SearchIntent } from "@/lib/validation/search-intent";
import { rankProperties } from "./ranking";

const TYPE_MAP = {
  villa: "VILLA",
  apartment: "APARTMENT",
  penthouse: "PENTHOUSE",
  townhouse: "TOWNHOUSE",
  unit: "UNIT",
  land: "LAND",
} as const;

export async function searchProperties(intent: SearchIntent) {
  const where: Prisma.PropertyWhereInput = {
    deletedAt: null,
    status: { in: ["ACTIVE", "RESERVED"] },
  };

  if (intent.propertyTypes?.length) {
    where.type = { in: intent.propertyTypes.map((t) => TYPE_MAP[t]) };
  } else if (intent.propertyType) {
    where.type = TYPE_MAP[intent.propertyType];
  }
  // A list is an exact any-of; a single value is an exact count too — asking
  // for "3 baths" must not return 5-bath homes. Use a list (e.g. "3 or 4 bed")
  // to match several counts.
  if (intent.bedroomsList?.length) {
    where.bedrooms = { in: intent.bedroomsList };
  } else if (intent.bedrooms != null) {
    where.bedrooms = intent.bedrooms;
  }
  if (intent.bathroomsList?.length) {
    where.bathrooms = { in: intent.bathroomsList };
  } else if (intent.bathrooms != null) {
    where.bathrooms = intent.bathrooms;
  }
  if (intent.minPriceAED != null || intent.maxPriceAED != null) {
    where.priceAed = {
      gte: intent.minPriceAED,
      lte: intent.maxPriceAED,
    };
  }
  if (intent.minAreaSqft != null || intent.maxAreaSqft != null) {
    where.areaSqft = {
      gte: intent.minAreaSqft ?? undefined,
      lte: intent.maxAreaSqft ?? undefined,
    };
  }
  if (intent.waterfront != null) where.waterfront = intent.waterfront;
  if (intent.privateBeach != null) where.privateBeach = intent.privateBeach;
  if (intent.furnished != null) where.furnished = intent.furnished;
  if (intent.offPlan != null) where.offPlan = intent.offPlan;
  if (intent.ready != null) where.ready = intent.ready;

  if (intent.community || intent.location) {
    const term = intent.community ?? intent.location ?? "";
    where.OR = [
      { community: { name: { contains: term, mode: "insensitive" } } },
      { title: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ];
  }

  if (intent.developer) {
    where.developer = {
      name: { contains: intent.developer, mode: "insensitive" },
    };
  }

  const properties = await prisma.property.findMany({
    where,
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 3 },
      community: true,
      developer: true,
      amenities: { include: { amenity: true } },
    },
    take: 48,
  });

  // dealType lives in metadata (default "sale" when absent) — filter in code so
  // absent values are treated as sale (a SQL "NOT rent" would drop NULLs).
  const filtered = intent.dealType
    ? properties.filter((p) => {
        const dt =
          (p.metadata as { dealType?: string } | null)?.dealType ?? "sale";
        return dt === intent.dealType;
      })
    : properties;

  return rankProperties(filtered, intent);
}

export type RankedProperty = Property & {
  score: number;
  images?: { url: string; alt: string | null }[];
  community?: { name: string } | null;
  developer?: { name: string } | null;
};
