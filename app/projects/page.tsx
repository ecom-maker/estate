import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ProjectBrowser } from "@/components/property/project-browser";
import {
  toProjectCardData,
  projectCardInclude,
  type ProjectCardData,
} from "@/lib/property/project-card";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "New Projects",
  description:
    "Off-plan developments from leading developers — explore new projects, payment plans, unit types and floor plans.",
};

const PROJECTS_WHERE: Prisma.PropertyWhereInput = {
  deletedAt: null,
  status: { in: ["ACTIVE", "RESERVED"] },
  offPlan: true,
};

export default async function ProjectsPage() {
  let projects: ProjectCardData[] = [];
  let total = 0;
  try {
    // No `take`: the off-plan catalogue is the whole point of this page, so it
    // is listed in full. `total` is counted rather than taken from the array so
    // the subheading stays true if a cap is ever reintroduced.
    const [rows, count] = await Promise.all([
      prisma.property.findMany({
        where: PROJECTS_WHERE,
        include: projectCardInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.property.count({ where: PROJECTS_WHERE }),
    ]);
    projects = rows.map(toProjectCardData);
    total = count;
  } catch {
    projects = [];
    total = 0;
  }

  return (
    <ProjectBrowser
      initialProjects={projects}
      eyebrowLabel="New Developments"
      heading="Projects"
      subheading={`${total} off-plan developments from leading developers`}
      altLinkHref="/properties"
      altLinkLabel="All properties"
      chatPlaceholder="Ask about new projects..."
    />
  );
}
