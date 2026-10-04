import { success, failure } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import {
  toProjectCardData,
  projectCardInclude,
  type ProjectCardData,
} from "@/lib/property/project-card";

export const dynamic = "force-dynamic";

/** GET /api/projects/cards?ids=a,b,c — rich project-card data, in the order given. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const ids = (url.searchParams.get("ids") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 48);

    if (ids.length === 0) return success<ProjectCardData[]>([]);

    const rows = await prisma.property.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: projectCardInclude,
    });

    const byId = new Map(rows.map((r) => [r.id, toProjectCardData(r)]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((c): c is ProjectCardData => Boolean(c));

    return success(ordered);
  } catch (error) {
    return failure(
      "PROJECT_CARDS_ERROR",
      error instanceof Error ? error.message : "Failed to load project cards",
      500,
    );
  }
}
