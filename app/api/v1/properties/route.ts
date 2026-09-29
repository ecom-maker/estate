import type { Prisma, PropertyType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { apiJson, apiError, apiOptions } from "@/lib/data-layer/http";
import {
  canonicalSummaryInclude,
  toCanonicalPropertySummary,
  SITE_URL,
} from "@/lib/data-layer/canonical";

export const dynamic = "force-dynamic";

const TYPES = ["villa", "apartment", "penthouse", "townhouse", "unit", "land"];

export function OPTIONS() {
  return apiOptions();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const where: Prisma.PropertyWhereInput = {
    deletedAt: null,
    status: { in: ["ACTIVE", "RESERVED"] },
  };

  const type = searchParams.get("type")?.toLowerCase();
  if (type && TYPES.includes(type)) {
    where.type = type.toUpperCase() as PropertyType;
  }
  const community = searchParams.get("community");
  if (community) {
    where.community = { name: { contains: community, mode: "insensitive" } };
  }
  const developer = searchParams.get("developer");
  if (developer) {
    where.developer = { name: { contains: developer, mode: "insensitive" } };
  }
  const minBeds = Number(searchParams.get("minBedrooms"));
  if (Number.isFinite(minBeds) && minBeds > 0) {
    where.bedrooms = { gte: minBeds };
  }
  const minPrice = Number(searchParams.get("minPrice"));
  const maxPrice = Number(searchParams.get("maxPrice"));
  if (
    (Number.isFinite(minPrice) && minPrice > 0) ||
    (Number.isFinite(maxPrice) && maxPrice > 0)
  ) {
    where.priceAed = {
      gte: Number.isFinite(minPrice) && minPrice > 0 ? minPrice : undefined,
      lte: Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : undefined,
    };
  }
  const offPlan = searchParams.get("offPlan");
  if (offPlan === "true") where.offPlan = true;
  if (offPlan === "false") where.offPlan = false;

  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || 24, 1),
    100,
  );
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  try {
    const [total, items] = await Promise.all([
      prisma.property.count({ where }),
      prisma.property.findMany({
        where,
        include: canonicalSummaryInclude,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
      }),
    ]);

    return apiJson({
      "@context": `${SITE_URL}/api/v1/openapi.json`,
      object: "list",
      total,
      limit,
      offset,
      data: items.map(toCanonicalPropertySummary),
    });
  } catch (error) {
    return apiError(
      500,
      error instanceof Error ? error.message : "Failed to list properties",
    );
  }
}
