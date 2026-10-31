import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ProjectBrowser } from "@/components/property/project-browser";
import { CountryChips } from "@/components/property/country-chips";
import { getCountryFacets } from "@/lib/property/country-facets";
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
  alternates: { canonical: "/projects" },
};

const PROJECTS_WHERE: Prisma.PropertyWhereInput = {
  deletedAt: null,
  status: { in: ["ACTIVE", "RESERVED"] },
  offPlan: true,
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country: countryParam } = await searchParams;
  const country = countryParam?.toUpperCase() || null;
  const where: Prisma.PropertyWhereInput = country
    ? { ...PROJECTS_WHERE, country }
    : PROJECTS_WHERE;

  let projects: ProjectCardData[] = [];
  let total = 0;
  let facets: Awaited<ReturnType<typeof getCountryFacets>> = [];
  try {
    const [rows, count, countryFacets] = await Promise.all([
      prisma.property.findMany({
        where,
        include: projectCardInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.property.count({ where }),
      getCountryFacets(PROJECTS_WHERE),
    ]);
    projects = rows.map(toProjectCardData);
    total = count;
    facets = countryFacets;
  } catch {
    projects = [];
    total = 0;
  }

  return (
    <>
      {facets.length > 1 ? (
        <div className="mx-auto max-w-7xl px-6 pt-24 md:px-10">
          <CountryChips
            facets={facets}
            selected={country}
            hrefFor={(code) => (code ? `/projects?country=${code}` : "/projects")}
          />
        </div>
      ) : null}
      <ProjectBrowser
        initialProjects={projects}
        eyebrowLabel="New Developments"
        heading="Projects"
        subheading={`${total} off-plan developments from leading developers`}
        altLinkHref="/properties"
        altLinkLabel="All properties"
        chatPlaceholder="Ask about new projects..."
      />
    </>
  );
}
