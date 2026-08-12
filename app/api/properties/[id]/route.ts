import { prisma } from "@/lib/db/prisma";
import { failure, success } from "@/lib/api/response";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const property = await prisma.property.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
        deletedAt: null,
      },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        videos: true,
        floorplans: true,
        documents: true,
        units: true,
        amenities: { include: { amenity: true } },
        community: true,
        developer: true,
        salesHistory: { orderBy: { soldAt: "desc" }, take: 10 },
        rentalHistory: { orderBy: { rentedAt: "desc" }, take: 10 },
      },
    });

    if (!property) {
      return failure("NOT_FOUND", "Property not found", 404);
    }

    return success(property);
  } catch (error) {
    return failure(
      "PROPERTY_ERROR",
      error instanceof Error ? error.message : "Failed to load property",
      500,
    );
  }
}
