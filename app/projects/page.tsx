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

export default async function ProjectsPage() {
  let projects: ProjectCardData[] = [];
  try {
    const rows = await prisma.property.findMany({
      where: {
        deletedAt: null,
        status: { in: ["ACTIVE", "RESERVED"] },
        offPlan: true,
      },
      include: projectCardInclude,
      orderBy: { createdAt: "desc" },
      take: 24,
    });
    projects = rows.map(toProjectCardData);
  } catch {
    projects = [];
  }

  return (
    <ProjectBrowser
      initialProjects={projects}
      eyebrowLabel="New Developments"
      heading="Projects"
      subheading={`${projects.length} off-plan developments from leading developers`}
      altLinkHref="/properties"
      altLinkLabel="All properties"
      chatPlaceholder="Ask about new projects..."
    />
  );
}
