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

// A project is an off-plan development; returns the full canonical record.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const project = await prisma.property.findFirst({
      where: { slug, deletedAt: null, offPlan: true },
      include: canonicalPropertyInclude,
    });
    if (!project) return apiError(404, `No project found for slug '${slug}'`);
    return apiJson(toCanonicalProperty(project));
  } catch (error) {
    return apiError(
      500,
      error instanceof Error ? error.message : "Failed to load project",
    );
  }
}
