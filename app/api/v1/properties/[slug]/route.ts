import { prisma } from "@/lib/db/prisma";
import { apiJson, apiError, apiOptions } from "@/lib/data-layer/http";
import {
  canonicalPropertyInclude,
  toCanonicalProperty,
} from "@/lib/data-layer/canonical";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const property = await prisma.property.findFirst({
      where: { slug, deletedAt: null },
      include: canonicalPropertyInclude,
    });
    if (!property) {
      return apiError(404, `No property found for slug '${slug}'`);
    }
    return apiJson(toCanonicalProperty(property));
  } catch (error) {
    return apiError(
      500,
      error instanceof Error ? error.message : "Failed to load property",
    );
  }
}
