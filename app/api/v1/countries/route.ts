import { apiJson, apiOptions } from "@/lib/data-layer/http";
import { prisma } from "@/lib/db/prisma";
import { countryName } from "@/lib/currency/fx";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

/** Countries with available inventory, newest-populated first by count. */
export async function GET() {
  const groups = await prisma.property.groupBy({
    by: ["country"],
    where: { deletedAt: null, status: { in: ["ACTIVE", "RESERVED"] } },
    _count: { _all: true },
  });

  const data = groups
    .map((g) => ({
      code: g.country ?? "AE",
      name: countryName(g.country ?? "AE"),
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  return apiJson({ total: data.length, data });
}
