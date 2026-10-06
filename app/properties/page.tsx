import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  PropertyBrowser,
  type BrowserCard,
} from "@/components/property/property-browser";
import { handoverLabel } from "@/lib/property/handover";

export const dynamic = "force-dynamic";
export const metadata = { title: "Properties" };

const PROPERTIES_WHERE: Prisma.PropertyWhereInput = {
  deletedAt: null,
  status: "ACTIVE",
};

export default async function PropertiesPage() {
  let properties: BrowserCard[] = [];
  let total = 0;
  try {
    // No `take`: the full active inventory is listed. `total` is counted rather
    // than read off the array so the subheading cannot under-report.
    const [rows, count] = await Promise.all([
      prisma.property.findMany({
        where: PROPERTIES_WHERE,
        include: {
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
          community: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.property.count({ where: PROPERTIES_WHERE }),
    ]);
    properties = rows.map((p) => ({ ...p, handover: handoverLabel(p.metadata) }));
    total = count;
  } catch {
    properties = [];
    total = 0;
  }

  return (
    <PropertyBrowser
      initialProperties={properties}
      cardBasePath="/properties"
      eyebrowField="community"
      heading="Properties"
      subheading={`${total} listings · luxury villas, residences & investments`}
      altLinkHref="/search"
      altLinkLabel="AI search"
      chatPlaceholder="Ask about our properties..."
    />
  );
}
