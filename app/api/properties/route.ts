import { prisma } from "@/lib/db/prisma";
import { failure, success } from "@/lib/api/response";
import type { Prisma, PropertyType } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(48, Number(searchParams.get("pageSize") ?? 12));
    const type = searchParams.get("type") ?? undefined;
    const community = searchParams.get("community") ?? undefined;

    const where: Prisma.PropertyWhereInput = {
      deletedAt: null,
      status: { in: ["ACTIVE", "RESERVED"] },
    };

    if (type) {
      where.type = type.toUpperCase() as PropertyType;
    }

    if (community) {
      where.community = {
        name: { contains: community, mode: "insensitive" },
      };
    }

    const [items, total] = await Promise.all([
      prisma.property.findMany({
        where,
        include: {
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
          community: true,
          developer: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.property.count({ where }),
    ]);

    return success({ items, total, page, pageSize });
  } catch (error) {
    return failure(
      "PROPERTIES_ERROR",
      error instanceof Error ? error.message : "Failed to load properties",
      500,
    );
  }
}
