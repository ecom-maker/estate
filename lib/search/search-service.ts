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

  if (intent.propertyType) {
    where.type = TYPE_MAP[intent.propertyType];
  }
  // dealType lives in metadata (default "sale" when absent).
  if (intent.dealType === "rent") {
    where.metadata = { path: ["dealType"], equals: "rent" };
  } else if (intent.dealType === "sale") {
    where.NOT = { metadata: { path: ["dealType"], equals: "rent" } };
  }
  if (intent.bedrooms != null) where.bedrooms = { gte: intent.bedrooms };
  if (intent.bathrooms != null) where.bathrooms = { gte: intent.bathrooms };
  if (intent.minPriceAED != null || intent.maxPriceAED != null) {
    where.priceAed = {
      gte: intent.minPriceAED,
      lte: intent.maxPriceAED,
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

  return rankProperties(properties, intent);
}

export type RankedProperty = Property & {
  score: number;
  images?: { url: string; alt: string | null }[];
  community?: { name: string } | null;
  developer?: { name: string } | null;
};
