import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { cn, formatAED } from "@/lib/utils";
import { AIChat } from "@/components/ai/ai-chat";
import { UnitsSection } from "@/components/property/units-section";
import { buildUnitGroups } from "@/lib/property/unit-groups";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const project = await prisma.property.findFirst({
      where: { slug, deletedAt: null },
      include: { developer: true },
    });
    if (!project) return { title: "Project" };
    const title = `${project.title}${project.developer ? ` by ${project.developer.name}` : ""}`;
    return {
      title,
      description: project.description?.slice(0, 160),
      openGraph: { title, description: project.description?.slice(0, 160) },
    };
  } catch {
    return { title: "Project" };
  }
}

function handoverLabel(metadata: unknown): string | null {
  const meta = (metadata ?? {}) as { handoverDate?: string };
  if (!meta.handoverDate) return null;
  const d = new Date(meta.handoverDate);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;

  let project = null;
  try {
    project = await prisma.property.findFirst({
      where: { slug, deletedAt: null },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        units: true,
        floorplans: true,
        amenities: { include: { amenity: true } },
        community: true,
        developer: true,
      },
    });
  } catch {
    project = null;
  }

  if (!project) notFound();

  const hero = project.images[0];
  const gallery = project.images.slice(1, 5);
  const unitGroups = buildUnitGroups(project);
  const handover = handoverLabel(project.metadata);
  const bedSummary = unitGroups.length
    ? unitGroups.length === 1
      ? unitGroups[0].label
      : `${unitGroups[0].label} – ${unitGroups[unitGroups.length - 1].label}`
    : `${project.bedrooms ?? "—"} Bed`;
  const highlights: [string, string][] = [
    ["Developer", project.developer?.name ?? "—"],
    ["Location", project.community?.name ?? "Dubai"],
    ["Handover", handover ?? "TBA"],
    ["Starting price", `from ${formatAED(project.priceAed)}`],
    ["Unit types", bedSummary],
    ["Status", project.offPlan ? "Off-plan" : "Ready"],
  ];

  // Payment plan (from paymentPlan JSON, with sensible defaults)
  const pp = (project.paymentPlan ?? {}) as {
    downPaymentPct?: number;
    duringConstructionPct?: number;
    onHandoverPct?: number;
  };
  const paymentSteps: { pct: number; label: string; sub: string | null }[] = [
    { pct: pp.downPaymentPct ?? 20, label: "Down payment", sub: "At sales launch" },
    { pct: pp.duringConstructionPct ?? 40, label: "During construction", sub: null },
    { pct: pp.onHandoverPct ?? 40, label: "On handover", sub: null },
  ];

  // Project timeline (from metadata.timeline, with defaults)
  const projectMeta = (project.metadata ?? {}) as {
    handoverDate?: string;
    timeline?: {
      announced?: string;
      constructionStart?: string;
      completion?: string;
    };
  };
  const tl = projectMeta.timeline ?? {};
  const fmtLong = (v?: string | null) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? v
      : d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
  };
  const constructionRaw = tl.constructionStart ?? "2026-02-01";
  const completionRaw = tl.completion ?? projectMeta.handoverDate ?? "2029-09-01";
  const milestones = [
    { title: "Project announcement", date: fmtLong(tl.announced), done: true },
    { title: "Construction Started", date: fmtLong(constructionRaw), done: true },
    { title: "Expected Completion", date: fmtLong(completionRaw), done: false },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/projects" className="hover:text-primary">
          Projects
        </Link>
        <span className="mx-2">/</span>
        <span className="text-primary">{project.title}</span>
      </nav>

      {/* Hero */}
      {project.developer ? (
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.25em] text-accent">
          {project.developer.name}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-4xl text-primary md:text-5xl">
          {project.title}
        </h1>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wide",
            project.offPlan
              ? "bg-accent/15 text-accent"
              : "bg-primary/10 text-primary",
          )}
        >
          {project.offPlan ? "Off-plan" : "Ready"}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">
        {project.community?.name ?? "Dubai"} · from {formatAED(project.priceAed)}
        {handover ? ` · Handover ${handover}` : ""}
      </p>

      <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-sm bg-primary/10">
        {hero ? (
          <Image
            src={hero.url}
            alt={hero.alt ?? project.title}
            fill
            priority
            className="object-cover"
            sizes="(max-width:1024px) 100vw, 66vw"
          />
        ) : null}
      </div>
      {gallery.length ? (
        <div className="mt-3 grid grid-cols-4 gap-3">
          {gallery.map((img) => (
            <div
              key={img.id}
              className="relative aspect-[4/3] overflow-hidden rounded-sm bg-primary/10"
            >
              <Image
                src={img.url}
                alt={img.alt ?? project.title}
                fill
                sizes="20vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.5fr_0.8fr]">
        <div>
          {/* Overview */}
          <section>
            <h2 className="font-serif text-2xl text-primary">Overview</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
              {project.description}
            </p>
          </section>

          {/* Highlights */}
          <section className="mt-10">
            <h2 className="font-serif text-2xl text-primary">
              Project highlights
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {highlights.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-sm border border-border bg-card p-4"
                >
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    {label}
                  </p>
                  <p className="mt-2 text-sm font-medium text-primary">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Payment plan */}
          <section className="mt-10">
            <h2 className="font-serif text-2xl text-primary">Payment plan</h2>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              {paymentSteps.map((s, i) => (
                <Fragment key={s.label}>
                  <div className="flex-1 rounded-sm border border-border bg-card p-5 text-center">
                    <p className="font-serif text-2xl text-primary">{s.pct}%</p>
                    <p className="mt-1 text-sm font-medium text-primary">
                      {s.label}
                    </p>
                    {s.sub ? (
                      <p className="mt-0.5 text-xs text-muted">{s.sub}</p>
                    ) : null}
                  </div>
                  {i < paymentSteps.length - 1 ? (
                    <span
                      className="hidden text-lg text-muted sm:block"
                      aria-hidden
                    >
                      ›
                    </span>
                  ) : null}
                </Fragment>
              ))}
            </div>
          </section>

          {/* Project timeline */}
          <section className="mt-10">
            <h2 className="font-serif text-2xl text-primary">Project timeline</h2>
            <ol className="mt-4 rounded-sm border border-border bg-card p-6">
              {milestones.map((m, i) => (
                <li
                  key={m.title}
                  className="relative flex gap-4 pb-6 last:pb-0"
                >
                  {i < milestones.length - 1 ? (
                    <span
                      className="absolute left-[11px] top-6 h-full w-px bg-border"
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={cn(
                      "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px]",
                      m.done
                        ? "border-accent bg-accent text-white"
                        : "border-border bg-card text-transparent",
                    )}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <div className="pt-0.5">
                    <p className="text-sm font-medium text-primary">
                      {m.title}
                    </p>
                    <p className="text-sm text-muted">{m.date ?? "-"}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Units & floor plans */}
          <UnitsSection category={project.type} groups={unitGroups} />

          {/* Amenities */}
          {project.amenities.length ? (
            <section className="mt-10">
              <h2 className="font-serif text-2xl text-primary">Amenities</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {project.amenities.map(({ amenity }) => (
                  <li
                    key={amenity.id}
                    className="rounded-sm border border-border bg-card px-3 py-1.5 text-xs text-primary"
                  >
                    {amenity.name}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

        </div>

        {/* Sticky enquiry aside */}
        <aside className="h-fit rounded-sm border border-border bg-card p-5 lg:sticky lg:top-24">
          <h3 className="font-serif text-xl text-primary">
            Register your interest
          </h3>
          <p className="mt-2 text-sm text-muted">
            Ask about pricing, payment plans, availability and handover — grounded
            only in known project facts.
          </p>
          <div className="mt-4">
            <AIChat
              propertyId={project.id}
              placeholder="Ask about this project..."
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
