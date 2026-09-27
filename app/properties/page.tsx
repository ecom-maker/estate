import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PropertyBrowser } from "@/components/property/property-browser";

export const dynamic = "force-dynamic";
export const metadata = { title: "Properties" };

type PropertyCard = Prisma.PropertyGetPayload<{
  include: { images: true; community: true };
}>;

export default async function PropertiesPage() {
  let properties: PropertyCard[] = [];
  try {
    properties = await prisma.property.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        community: true,
      },
      orderBy: { createdAt: "desc" },
      take: 24,
    });
  } catch {
    properties = [];
  }

  return (
    <PropertyBrowser
      initialProperties={properties}
      cardBasePath="/properties"
      eyebrowField="community"
      heading="Properties"
      subheading={`${properties.length} listings · luxury villas, residences & investments`}
      altLinkHref="/search"
      altLinkLabel="AI search"
      chatPlaceholder="Ask about our properties..."
    />
  );
}
