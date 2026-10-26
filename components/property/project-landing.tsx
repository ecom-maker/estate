import Link from "next/link";
import { ProjectCard } from "@/components/property/project-card";
import type { ProjectCardData } from "@/lib/property/project-card";
import { SITE_URL } from "@/lib/data-layer/canonical";

/**
 * A programmatic-SEO landing page that lists developments matching one facet
 * (e.g. "with a payment plan", "handover 2027"). Server-rendered so the grid is
 * crawlable, with breadcrumbs + BreadcrumbList JSON-LD matching the /[listing]
 * pages.
 */
export function ProjectLanding({
  path,
  eyebrow,
  heading,
  intro,
  projects,
}: {
  /** Canonical path of this page, e.g. "/payment-plan" — for the JSON-LD. */
  path: string;
  eyebrow: string;
  heading: string;
  intro: string;
  projects: ProjectCardData[];
}) {
  const crumbs = [
    { name: "Home", item: SITE_URL },
    { name: "Projects", item: `${SITE_URL}/projects` },
    { name: heading, item: `${SITE_URL}${path}` },
  ];
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.item,
    })),
  };

  return (
    <div className="mx-auto max-w-7xl px-6 pb-28 pt-10 md:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        <span className="mx-2" aria-hidden>
          /
        </span>
        <Link href="/projects" className="hover:text-primary">
          Projects
        </Link>
        <span className="mx-2" aria-hidden>
          /
        </span>
        <span className="text-primary">{heading}</span>
      </nav>

      <p className="mt-6 text-xs font-medium uppercase tracking-[0.25em] text-accent">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">{heading}</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">{intro}</p>
      <p className="mt-2 text-sm text-muted">
        {projects.length}{" "}
        {projects.length === 1 ? "development" : "developments"}
      </p>

      {projects.length === 0 ? (
        <p className="mt-10 text-sm text-muted">
          No developments to show right now.{" "}
          <Link href="/projects" className="text-accent hover:underline">
            Browse all projects
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
