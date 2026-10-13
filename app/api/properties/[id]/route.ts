import { prisma } from "@/lib/db/prisma";
import { failure, success } from "@/lib/api/response";
import { handoverLabel } from "@/lib/property/handover";

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

    // Hidden units aren't public; unit numbers are admin-only — strip both.
    const units = property.units
      .filter((u) => !u.hidden)
      .map(({ unitNumber: _unitNumber, hidden: _hidden, ...u }) => u);

    return success({
      ...property,
      units,
      handover: handoverLabel(property.metadata),
    });
  } catch (error) {
    return failure(
      "PROPERTY_ERROR",
      error instanceof Error ? error.message : "Failed to load property",
      500,
    );
  }
}
