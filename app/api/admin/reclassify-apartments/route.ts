import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * TEMPORARY one-off maintenance endpoint: classify studio–3-bed inventory as
 * APARTMENT. Guarded by a shared secret and removed right after use.
 * Villas/townhouses/penthouses are preserved.
 */
const SECRET = "reclass-ap-9Xq2M7kz";

export async function POST(request: Request) {
  if (request.headers.get("x-secret") !== SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const units = await prisma.propertyUnit.updateMany({
      where: { bedrooms: { not: null, lte: 3 }, NOT: { unitType: "APARTMENT" } },
      data: { unitType: "APARTMENT" },
    });
    const properties = await prisma.property.updateMany({
      where: {
        deletedAt: null,
        bedrooms: { not: null, lte: 3 },
        type: { notIn: ["VILLA", "TOWNHOUSE", "PENTHOUSE", "APARTMENT"] },
      },
      data: { type: "APARTMENT" },
    });
    return NextResponse.json({
      ok: true,
      unitsUpdated: units.count,
      propertiesUpdated: properties.count,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }
}
