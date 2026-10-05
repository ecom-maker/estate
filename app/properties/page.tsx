import { prisma } from "@/lib/db/prisma";
import {
  PropertyBrowser,
  type BrowserCard,
} from "@/components/property/property-browser";
import { handoverLabel } from "@/lib/property/handover";

export const dynamic = "force-dynamic";
export const metadata = { title: "Properties" };

export default async function PropertiesPage() {
  let properties: BrowserCard[] = [];
  try {
    const rows = await prisma.property.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        community: true,
      },
      orderBy: { createdAt: "desc" },
      take: 24,
    });
    properties = rows.map((p) => ({ ...p, handover: handoverLabel(p.metadata) }));
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
