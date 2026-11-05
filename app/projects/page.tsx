import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ProjectBrowser } from "@/components/property/project-browser";
import { CountryChips } from "@/components/property/country-chips";
import { getCountryFacets } from "@/lib/property/country-facets";
import { countryWhere } from "@/lib/property/country-filter";
import {
  toProjectCardData,
  projectCardInclude,
  type ProjectCardData,
} from "@/lib/property/project-card";
import {
  DEFAULT_PROJECT_SORT,
  parseProjectSort,
  projectOrderBy,
} from "@/lib/property/project-sort";

export const dynamic = "force-dynamic";

// Server-side pagination so the listing scales to thousands of projects without
// shipping every card to the browser. The grid is paginated and sorted in the
// DB; the AI chat search (a bounded set of IDs) stays client-side.
const PAGE_SIZE = 24;

type ProjectsParams = {
  country?: string;
  sort?: string;
  page?: string;
};

function parsePage(v: string | undefined): number {
  const n = Number.parseInt(v ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// Page 1 self-canonicals to the clean path; pages 2+ to ?page=N so the deeper
// projects get indexed and internally linked instead of folding into page one.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ProjectsParams>;
}): Promise<Metadata> {
  const page = parsePage((await searchParams).page);
  const description =
    "Off-plan developments from leading developers — explore new projects, payment plans, unit types and floor plans.";
  return {
    title: page > 1 ? `New Projects – Page ${page}` : "New Projects",
    description,
    alternates: { canonical: page > 1 ? `/projects?page=${page}` : "/projects" },
  };
}

const PROJECTS_WHERE: Prisma.PropertyWhereInput = {
  deletedAt: null,
  status: { in: ["ACTIVE", "RESERVED"] },
  offPlan: true,
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<ProjectsParams>;
}) {
  const params = await searchParams;
  const country = params.country?.toUpperCase() || null;
  const sort = parseProjectSort(params.sort);
  const requestedPage = parsePage(params.page);
  const where: Prisma.PropertyWhereInput = country
    ? { AND: [PROJECTS_WHERE, countryWhere(country)] }
    : PROJECTS_WHERE;

  let projects: ProjectCardData[] = [];
  let total = 0;
  let facets: Awaited<ReturnType<typeof getCountryFacets>> = [];
  let page = 1;
  try {
    const [count, countryFacets] = await Promise.all([
      prisma.property.count({ where }),
      getCountryFacets(PROJECTS_WHERE),
    ]);
    total = count;
    facets = countryFacets;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(requestedPage, totalPages);
    const rows = await prisma.property.findMany({
      where,
      include: projectCardInclude,
      orderBy: projectOrderBy(sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });
    projects = rows.map(toProjectCardData);
  } catch {
    projects = [];
    total = 0;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  page = Math.min(requestedPage, totalPages);

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
        subheading={`${total.toLocaleString()} off-plan developments from leading developers`}
        chatPlaceholder="Ask about new projects..."
        country={country}
        sort={sort}
        defaultSort={DEFAULT_PROJECT_SORT}
        page={page}
        totalPages={totalPages}
      />
    </>
  );
}
