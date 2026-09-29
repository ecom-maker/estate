import { prisma } from "@/lib/db/prisma";
import { apiJson, apiError, apiOptions } from "@/lib/data-layer/http";
import { SITE_URL } from "@/lib/data-layer/canonical";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

export async function GET() {
  try {
    const developers = await prisma.developer.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { properties: true } } },
    });
    return apiJson({
      object: "list",
      total: developers.length,
      data: developers.map((d) => ({
        "@id": `${SITE_URL}/api/v1/developers/${d.slug}`,
        id: d.id,
        name: d.name,
        slug: d.slug,
        website: d.website,
        description: d.description,
        propertyCount: d._count.properties,
      })),
    });
  } catch (error) {
    return apiError(
      500,
      error instanceof Error ? error.message : "Failed to list developers",
    );
  }
}
