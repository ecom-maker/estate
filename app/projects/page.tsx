import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PropertyBrowser } from "@/components/property/property-browser";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "New Projects",
  description:
    "Off-plan developments from leading developers — explore new projects, payment plans, unit types and floor plans.",
};

type ProjectCard = Prisma.PropertyGetPayload<{
  include: { images: true; community: true; developer: true };
}>;

export default async function ProjectsPage() {
  let projects: ProjectCard[] = [];
  try {
    projects = await prisma.property.findMany({
      where: {
        deletedAt: null,
        status: { in: ["ACTIVE", "RESERVED"] },
        offPlan: true,
      },
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        community: true,
        developer: true,
      },
      orderBy: { createdAt: "desc" },
      take: 24,
    });
  } catch {
    projects = [];
  }

  return (
    <PropertyBrowser
      initialProperties={projects}
      cardBasePath="/projects"
      eyebrowField="developer"
      showFromPrice
      eyebrowLabel="New Developments"
      heading="Projects"
      subheading={`${projects.length} off-plan developments from leading developers`}
      altLinkHref="/properties"
      altLinkLabel="All properties"
      chatPlaceholder="Ask about new projects..."
    />
  );
}
