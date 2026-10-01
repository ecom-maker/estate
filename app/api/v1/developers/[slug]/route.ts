import type { PropertyStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { apiJson, apiError, apiOptions } from "@/lib/data-layer/http";
import {
  SITE_URL,
  canonicalSummaryInclude,
  toCanonicalPropertySummary,
} from "@/lib/data-layer/canonical";

export const dynamic = "force-dynamic";
const LISTABLE = ["ACTIVE", "RESERVED"] as PropertyStatus[];

export function OPTIONS() {
  return apiOptions();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const dev = await prisma.developer.findUnique({
      where: { slug },
      include: {
        properties: {
          where: { deletedAt: null, status: { in: LISTABLE } },
          include: canonicalSummaryInclude,
          orderBy: { updatedAt: "desc" },
          take: 48,
        },
      },
    });
    if (!dev) return apiError(404, `No developer found for slug '${slug}'`);
    return apiJson({
      "@id": `${SITE_URL}/api/v1/developers/${dev.slug}`,
      id: dev.id,
      name: dev.name,
      slug: dev.slug,
      website: dev.website,
      description: dev.description,
      propertyCount: dev.properties.length,
      properties: dev.properties.map(toCanonicalPropertySummary),
    });
  } catch (error) {
    return apiError(
      500,
      error instanceof Error ? error.message : "Failed to load developer",
    );
  }
}
