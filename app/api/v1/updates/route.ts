import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { apiJson, apiError, apiOptions } from "@/lib/data-layer/http";
import {
  canonicalSummaryInclude,
  toCanonicalPropertySummary,
} from "@/lib/data-layer/canonical";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export function OPTIONS() {
  return apiOptions();
}

/**
 * Listings added or changed since a date, newest first, so personal agents can
 * keep their users current without re-crawling:
 * GET /api/v1/updates?since=2026-10-01&limit=50   (default: last 7 days)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sinceRaw = searchParams.get("since");
  const parsed = sinceRaw ? new Date(sinceRaw) : null;
  if (parsed && Number.isNaN(parsed.getTime())) {
    return apiError(400, "'since' must be a date, e.g. 2026-10-01");
  }
  const since = parsed ?? new Date(Date.now() - 7 * DAY_MS);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);

  try {
    const where: Prisma.PropertyWhereInput = {
      deletedAt: null,
      status: { in: ["ACTIVE", "RESERVED"] },
      updatedAt: { gte: since },
    };
    const [total, items] = await Promise.all([
      prisma.property.count({ where }),
      prisma.property.findMany({
        where,
        include: canonicalSummaryInclude,
        orderBy: { updatedAt: "desc" },
        take: limit,
      }),
    ]);
    return apiJson({
      object: "list",
      since: since.toISOString(),
      total,
      limit,
      data: items.map((p) => ({
        ...toCanonicalPropertySummary(p),
        change: p.createdAt >= since ? "new" : "updated",
        updatedAt: p.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return apiError(500, error instanceof Error ? error.message : "Failed to load updates");
  }
}
