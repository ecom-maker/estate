import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { apiJson, apiError, apiOptions } from "@/lib/data-layer/http";
import {
  canonicalSummaryInclude,
  toCanonicalPropertySummary,
} from "@/lib/data-layer/canonical";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

// Projects = off-plan developments.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || 24, 1),
    100,
  );
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  try {
    const where: Prisma.PropertyWhereInput = {
      deletedAt: null,
      offPlan: true,
      status: { in: ["ACTIVE", "RESERVED"] },
    };
    const [total, items] = await Promise.all([
      prisma.property.count({ where }),
      prisma.property.findMany({
        where,
        include: canonicalSummaryInclude,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
    ]);
    return apiJson({
      object: "list",
      total,
      limit,
      offset,
      data: items.map(toCanonicalPropertySummary),
    });
  } catch (error) {
    return apiError(
      500,
      error instanceof Error ? error.message : "Failed to list projects",
    );
  }
}
