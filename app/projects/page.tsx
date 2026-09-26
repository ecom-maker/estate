import Link from "next/link";
import Image from "next/image";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { formatAED } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "New Projects",
  description:
    "Off-plan developments from leading developers — explore new projects, payment plans, unit types and floor plans.",
};

type ProjectCard = Prisma.PropertyGetPayload<{
  include: { images: true; community: true; developer: true };
}>;

function handoverLabel(metadata: Prisma.JsonValue | null): string | null {
  const meta = (metadata ?? {}) as { handoverDate?: string };
  if (!meta.handoverDate) return null;
  const d = new Date(meta.handoverDate);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

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
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        New Developments
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Projects</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Off-plan developments from leading developers. Explore payment plans,
        unit types and floor plans.
      </p>

      {projects.length === 0 ? (
        <div className="mt-12 rounded-sm border border-border bg-card p-8 text-sm text-muted">
          No off-plan projects are listed right now. Browse the full{" "}
          <Link href="/properties" className="text-accent hover:underline">
            inventory
          </Link>{" "}
          instead.
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const image = project.images[0];
            const handover = handoverLabel(project.metadata);
            return (
              <Link
                key={project.id}
                href={`/projects/${project.slug}`}
                className="group overflow-hidden rounded-sm border border-border bg-card transition hover:border-accent"
              >
                <div className="relative aspect-[4/3] bg-primary/10">
                  {image?.url ? (
                    <Image
                      src={image.url}
                      alt={image.alt ?? project.title}
                      fill
                      sizes="(max-width:768px) 100vw, 33vw"
                      className="object-cover transition duration-500 group-hover:scale-[1.02]"
                    />
                  ) : null}
                  <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-primary">
                    Off-plan
                  </span>
                </div>
                <div className="p-5">
                  {project.developer ? (
                    <p className="text-xs uppercase tracking-wider text-muted">
                      {project.developer.name}
                    </p>
                  ) : null}
                  <h2 className="mt-1 font-serif text-lg text-primary">
                    {project.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {project.community?.name ?? "Dubai"}
                  </p>
                  <p className="mt-3 text-sm font-medium text-primary">
                    from {formatAED(project.priceAed)}
                  </p>
                  {handover ? (
                    <p className="mt-1 text-xs text-muted">
                      Handover: {handover}
                    </p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
