import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { cn, formatAED } from "@/lib/utils";
import { AIChat } from "@/components/ai/ai-chat";
import { UnitsSection } from "@/components/property/units-section";
import { buildUnitGroups } from "@/lib/property/unit-groups";
import { JsonLd } from "@/components/seo/json-ld";
import { propertyJsonLd } from "@/lib/data-layer/jsonld";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import {
  buildListingSlug,
  typeDefForType,
  slugifyLocality,
} from "@/lib/seo/listing-slug";
import { communityLabel } from "@/lib/property/location";
import { ProjectGallery } from "@/components/property/project-gallery";
import { WHATSAPP_NUMBER } from "@/lib/whatsapp";
import { PropertyDescription } from "@/components/property/property-description";
import { metaDescription } from "@/lib/property/description";
import { formatKm } from "@/lib/property/nearby";
import { getNearbyBundle } from "@/lib/property/nearby-bundle";
import { MarketInsightsSection } from "@/components/property/market-insights-section";
import { getMarketInsights } from "@/lib/property/market-data";
import { buildProjectFaqs } from "@/lib/seo/project-faqs";
import { FaqSection } from "@/components/seo/faq-section";
import {
  PaymentPlanSection,
  ProjectTimelineSection,
} from "@/components/property/payment-timeline";

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
    const canonical = `/projects/${project.slug}`;
    return {
      title,
      description: metaDescription(project),
      alternates: { canonical },
      openGraph: { title, description: metaDescription(project), url: canonical },
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
        videos: true,
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
  const unitGroups = buildUnitGroups(project);
  const handover = handoverLabel(project.metadata);
  // Service charge is a free-text string on the project metadata, shown only
  // when it's on file.
  const serviceCharge =
    (
      (project.metadata as { serviceCharge?: string | null } | null)
        ?.serviceCharge ?? ""
    ).trim() || null;
  const bedSummary = unitGroups.length
    ? unitGroups.length === 1
      ? unitGroups[0].label
      : `${unitGroups[0].label} – ${unitGroups[unitGroups.length - 1].label}`
    : `${project.bedrooms ?? "—"} Bed`;
  const highlights: [string, string][] = [
    ["Developer", project.developer?.name ?? "—"],
    ["Location", communityLabel(project.community?.name, project.community?.emirate)],
    ["Handover", handover ?? "TBA"],
    ["Starting price", `from ${formatAED(project.priceAed)}`],
    ["Unit types", bedSummary],
    ["Status", project.offPlan ? "Off-plan" : "Ready"],
  ];

  // Nearby data: served from the DB (metadata.nearbyData) after the first
  // compute; the APIs are only called when it isn't stored yet.
  const {
    landmarks: nearby,
    schools: nearbySchools,
    hospitals: nearbyHospitals,
    metro: nearbyMetro,
  } = await getNearbyBundle(project);

  // Data-driven FAQs (server-rendered + FAQPage JSON-LD via <FaqSection>).
  const insights = await getMarketInsights({
    bedrooms: project.bedrooms,
    community: project.community ? { name: project.community.name } : null,
    building: project.title,
  });
  const avgPerSqft = (() => {
    const vals = (insights?.sold ?? [])
      .map((s) => (s.area > 0 ? s.aed / s.area : null))
      .filter((n): n is number => typeof n === "number" && n > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  })();
  const trendDirection = ((): "rising" | "softening" | "stable" | null => {
    const p = insights?.trend?.sale.primary ?? [];
    if (p.length < 2 || !p[0]) return null;
    const ch = (p[p.length - 1] - p[0]) / p[0];
    return ch > 0.03 ? "rising" : ch < -0.03 ? "softening" : "stable";
  })();
  const projectFaqs = buildProjectFaqs({
    title: project.title,
    offPlan: project.offPlan,
    startingPriceAed: project.priceAed,
    developerName: project.developer?.name ?? null,
    handoverLabel: handover,
    paymentPlan: project.paymentPlan as {
      downPaymentPct?: number | null;
      duringConstructionPct?: number | null;
      onHandoverPct?: number | null;
    } | null,
    unitLayouts: unitGroups.map((g) => g.label),
    schools: nearbySchools,
    hospitals: nearbyHospitals,
    transactionCount: insights?.sold.length ?? null,
    avgPerSqft,
    trendDirection,
    comparablesLabel: insights?.comparablesLabel ?? null,
  });
  const projectLastUpdated = [
    project.updatedAt,
    ...project.units.map((u) => u.updatedAt),
  ].reduce<Date | null>((acc, d) => (d && (!acc || d > acc) ? d : acc), null);

  return (
    <div className="mx-auto max-w-7xl px-6 pb-28 pt-14 md:px-10">
      <JsonLd
        data={propertyJsonLd({
          title: project.title,
          slug: project.slug,
          type: project.type,
          description: project.summary ?? project.description,
          priceAed: project.priceAed,
          bedrooms: project.bedrooms,
          bathrooms: project.bathrooms,
          areaSqft: project.areaSqft,
          latitude: project.latitude,
          longitude: project.longitude,
          status: project.status,
          community: project.community,
          developer: project.developer,
          images: project.images,
          amenities: project.amenities.map((a) => a.amenity.name),
        })}
      />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Projects", href: "/projects" },
          ...(project.community?.slug
            ? (() => {
                const td = typeDefForType(project.type);
                const emirate = project.community.emirate;
                const emSlug = emirate ? slugifyLocality(emirate) : null;
                const commSlug = project.community.slug;
                return [
                  {
                    label: td.label,
                    href: `/${buildListingSlug(td.token, "sale", emSlug ?? commSlug)}`,
                  },
                  ...(emirate && emSlug
                    ? [
                        {
                          label: emirate,
                          href: `/${buildListingSlug("properties", "sale", emSlug)}`,
                        },
                      ]
                    : []),
                  {
                    label: project.community.name,
                    href: `/${buildListingSlug("properties", "sale", commSlug)}`,
                  },
                ];
              })()
            : []),
          ...(project.developer
            ? [{ label: project.developer.name }]
            : []),
          { label: project.title },
        ]}
      />

      {/* Hero */}
      {project.developer ? (
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.25em] text-accent">
          {project.developer.name}
        </p>
      ) : null}
      <h1 className="mt-2 font-serif text-4xl text-primary md:text-5xl">
        {project.title}
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-lg text-muted">
        <span>
          {communityLabel(project.community?.name, project.community?.emirate)} · from{" "}
          {formatAED(project.priceAed)}
          {serviceCharge ? ` · Service charge ${serviceCharge}` : ""}
          {handover ? ` · Handover ${handover}` : ""}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
            project.offPlan
              ? "bg-accent/15 text-accent"
              : "bg-primary/10 text-primary",
          )}
        >
          {project.offPlan ? "Off-plan" : "Ready"}
        </span>
      </p>

      <ProjectGallery
        images={project.images}
        title={project.title}
        mapQuery={
          project.latitude != null && project.longitude != null
            ? `${project.latitude},${project.longitude}`
            : project.community
              ? `${project.community.name}, Dubai`
              : `${project.title}, Dubai`
        }
        coords={
          project.latitude != null && project.longitude != null
            ? { lat: project.latitude, lng: project.longitude }
            : null
        }
      />

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.5fr_0.8fr]">
        {/* min-w-0: let wide children (units table) scroll instead of
            stretching the grid track past a phone viewport. */}
        <div className="min-w-0">
          {/* Overview */}
          <PropertyDescription title="Overview" property={project} />

          {/* Highlights */}
          <section className="mt-10">
            <h2 className="font-serif text-2xl text-primary">
              Project highlights
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {highlights.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-border bg-card p-4"
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

          {/* Amenities */}
          {project.amenities.length ? (
            <section className="mt-10">
              <h2 className="font-serif text-2xl text-primary">Amenities</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {project.amenities.map(({ amenity }) => (
                  <li
                    key={amenity.id}
                    className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-primary"
                  >
                    {amenity.name}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Nearby landmarks */}
          {nearby.length ? (
            <section className="mt-10">
              <h2 className="font-serif text-2xl text-primary">Nearby</h2>
              <p className="mt-1 text-sm text-muted">
                Driving distance from the project
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {nearby.map((n) => (
                  <li
                    key={n.name}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <span className="whitespace-nowrap rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                      {formatKm(n.km)}
                    </span>
                    <span className="min-w-0 text-sm text-primary">{n.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Nearby schools */}
          {nearbySchools.length ? (
            <section className="mt-10">
              <h2 className="font-serif text-2xl text-primary">
                Nearby Schools
              </h2>
              <p className="mt-1 text-sm text-muted">
                Driving distance from the project
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {nearbySchools.map((s) => (
                  <li
                    key={s.name}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <span className="whitespace-nowrap rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                      {formatKm(s.km)}
                    </span>
                    <span className="min-w-0 text-sm text-primary">{s.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Nearby hospitals */}
          {nearbyHospitals.length ? (
            <section className="mt-10">
              <h2 className="font-serif text-2xl text-primary">
                Nearby Hospitals
              </h2>
              <p className="mt-1 text-sm text-muted">
                Driving distance from the project
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {nearbyHospitals.map((h) => (
                  <li
                    key={h.name}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <span className="whitespace-nowrap rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                      {formatKm(h.km)}
                    </span>
                    <span className="min-w-0 text-sm text-primary">{h.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Nearby metro — only when within 2 km */}
          {nearbyMetro.length ? (
            <section className="mt-10">
              <h2 className="font-serif text-2xl text-primary">
                Nearby Metro Stations
              </h2>
              <p className="mt-1 text-sm text-muted">
                Driving distance from the project · within 2 km
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {nearbyMetro.map((m) => (
                  <li
                    key={m.name}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <span className="whitespace-nowrap rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                      {formatKm(m.km)}
                    </span>
                    <span className="min-w-0 text-sm text-primary">{m.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <PaymentPlanSection project={project} />
          <ProjectTimelineSection project={project} />

          {/* Units & floor plans */}
          <UnitsSection
            category={project.type}
            groups={unitGroups}
            fromDeveloper={project.offPlan}
          />

          {/* Recorded DLD transactions + price trend for comparable units */}
          <MarketInsightsSection
            bedroomsLabel={bedSummary}
            property={{
              id: project.id,
              slug: project.slug,
              title: project.title,
              type: project.type,
              bedrooms: project.bedrooms,
              priceAed: project.priceAed,
              areaSqft: project.areaSqft,
              offPlan: project.offPlan,
              images: project.images,
              community: project.community,
              developer: project.developer,
              paymentPlan: project.paymentPlan,
              metadata: project.metadata,
            }}
          />

          <FaqSection faqs={projectFaqs} lastUpdated={projectLastUpdated} />
        </div>

        {/* Sticky enquiry aside */}
        <aside className="h-fit min-w-0 rounded-sm border border-border bg-card p-5 lg:sticky lg:top-24">
          <h3 className="font-serif text-xl text-primary">
            Register your interest
          </h3>
          <p className="mt-2 text-sm text-muted">
            Ask about pricing, payment plans, availability and handover — grounded
            only in known project facts.
          </p>
          <div className="mt-4 flex h-[70vh] min-h-0 flex-col">
            <AIChat
              propertyId={project.id}
              placeholder="Ask about this project..."
              propertyTitle={project.title}
              whatsappNumber={WHATSAPP_NUMBER}
            />
          </div>
          {project.videos[0] ? (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-wider text-muted">
                Video tour
              </p>
              <div className="mt-3 aspect-[9/16] overflow-hidden rounded-sm bg-primary/10">
                <video
                  src={project.videos[0].url}
                  controls
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
