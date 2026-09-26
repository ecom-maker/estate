import Link from "next/link";
import Image from "next/image";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { formatAED } from "@/lib/utils";
import { AIChat } from "@/components/ai/ai-chat";

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
    <div className="mx-auto grid max-w-7xl gap-8 px-6 py-28 md:grid-cols-[minmax(320px,0.9fr)_1.1fr] md:px-10">
      <aside className="flex h-[70vh] flex-col self-start rounded-sm border border-border bg-card p-4 md:sticky md:top-24 md:h-[calc(100vh-7rem)]">
        <AIChat placeholder="Ask about new projects..." />
      </aside>

      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
              New Developments
            </p>
            <h1 className="mt-1 font-serif text-3xl text-primary">Projects</h1>
            <p className="mt-1 text-sm text-muted">
              {projects.length} off-plan developments from leading developers
            </p>
          </div>
          <Link
            href="/properties"
            className="text-sm font-medium text-accent hover:underline"
          >
            All properties
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-sm border border-border bg-card p-6 text-sm text-muted">
            No off-plan projects are listed right now. Browse the full{" "}
            <Link href="/properties" className="text-accent hover:underline">
              inventory
            </Link>{" "}
            instead.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
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
                        sizes="(max-width:768px) 100vw, 40vw"
                        className="object-cover transition duration-500 group-hover:scale-[1.02]"
                      />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="text-xs uppercase tracking-wider text-muted">
                      {project.developer?.name ??
                        project.community?.name ??
                        "Dubai"}
                    </p>
                    <h2 className="mt-1 font-serif text-xl text-primary">
                      {project.title}
                    </h2>
                    <p className="mt-2 text-sm text-muted">
                      {project.community?.name ?? "Dubai"}
                      {handover ? ` · Handover ${handover}` : ""}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <p className="text-sm font-medium text-primary">
                        from {formatAED(project.priceAed)}
                      </p>
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                        Off-plan
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
