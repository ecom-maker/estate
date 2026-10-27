import {
  PaymentPlanSection,
  ProjectTimelineSection,
} from "@/components/property/payment-timeline";
import { FileText } from "lucide-react";
import { descriptionSections } from "@/lib/property/description";
import { floorplanMatcher } from "@/lib/property/unit-groups";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { cn, formatAED } from "@/lib/utils";
import { handoverLabel } from "@/lib/property/handover";
import { unitIdFromParam, unitSlug } from "@/lib/property/unit-url";
import {
  buildListingSlug,
  typeDefForType,
  slugifyLocality,
} from "@/lib/seo/listing-slug";
import { unitListing } from "@/lib/property/deal";
import { communityLabel } from "@/lib/property/location";
import { SITE_URL } from "@/lib/data-layer/canonical";
import { ProjectGallery } from "@/components/property/project-gallery";
import { AIChat } from "@/components/ai/ai-chat";
import { formatKm } from "@/lib/property/nearby";
import { getNearbyBundle } from "@/lib/property/nearby-bundle";
import { MarketInsightsSection } from "@/components/property/market-insights-section";
import { getMarketInsights } from "@/lib/property/market-data";
import { buildUnitFaqs } from "@/lib/seo/unit-faqs";
import { FaqSection } from "@/components/seo/faq-section";
import { WHATSAPP_NUMBER } from "@/lib/whatsapp";
import { ShareSaveBar } from "@/components/property/share-save-bar";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac/check";

export const dynamic = "force-dynamic";

const unitInclude = {
  property: {
    include: {
      images: { orderBy: { sortOrder: "asc" as const } },
      community: true,
      developer: true,
      amenities: { include: { amenity: true } },
      floorplans: true,
    },
  },
};

async function loadUnit(id: string) {
  try {
    return await prisma.propertyUnit.findUnique({
      where: { id },
      include: unitInclude,
    });
  } catch {
    return null;
  }
}

function bedLabel(beds: number | null): string {
  if (beds == null) return "Unit";
  return beds === 0 ? "Studio" : `${beds}-Bedroom`;
}

type LoadedUnit = NonNullable<Awaited<ReturnType<typeof loadUnit>>>;

/** Canonical SEO slug for a loaded unit. */
function canonicalSlug(unit: LoadedUnit): string {
  return unitSlug({
    id: unit.id,
    bedrooms: unit.bedrooms,
    unitType: unit.unitType,
    property: {
      slug: unit.property.slug,
      title: unit.property.title,
      type: unit.property.type,
      community: unit.property.community,
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const unit = await loadUnit(unitIdFromParam(id));
  if (!unit) return { title: "Unit" };
  const title = `${bedLabel(unit.bedrooms)} at ${unit.property.title}`;
  return {
    title,
    alternates: { canonical: `${SITE_URL}/properties/unit/${canonicalSlug(unit)}` },
  };
}

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const unit = await loadUnit(unitIdFromParam(id));
  if (!unit || unit.hidden) notFound();

  // Redirect legacy bare-id links (and any stale slug) to the canonical URL.
  const canonical = canonicalSlug(unit);
  if (id !== canonical) permanentRedirect(`/properties/unit/${canonical}`);

  const p = unit.property;
  // First paragraph of the project's "About the project" (as on its page).
  const aboutProject =
    descriptionSections(p).find((s) => s.key === "about")?.paragraphs[0] ?? null;
  // Same match as the project page's Units section (unit number, then beds).
  const floorplan = floorplanMatcher(p.floorplans)(unit);

  // Unit numbers are admin-only — shown here only to signed-in admins.
  const session = await auth();
  const isAdminViewer = isAdmin(
    (session?.user as { roles?: string[] } | undefined)?.roles,
  );

  const nearby = await getNearbyBundle(p);

  // Delivery badge: off-plan with handover date, or completed with the
  // completion date when it's on file (metadata.handoverDate / completionLabel).
  const delivery = {
    label: p.offPlan ? "Off-plan" : "Completed",
    date:
      handoverLabel(p.metadata) ??
      (p.metadata as { completionLabel?: string | null } | null)
        ?.completionLabel?.trim() ??
      null,
  };

  // Sale vs rent availability (per-unit metadata.listing + rent asking price).
  const listing = unitListing(unit.metadata);
  const rentPrice =
    (unit.metadata as { rentPriceAed?: number } | null)?.rentPriceAed ?? null;
  const rentText = rentPrice ? `${formatAED(rentPrice)}/yr` : "Rent price on request";
  // Service charge is a project-level fact (metadata.serviceCharge); shown on
  // the unit only when it's on file.
  const serviceCharge =
    (
      (p.metadata as { serviceCharge?: string | null } | null)?.serviceCharge ??
      ""
    ).trim() || null;
  // Parking is a free-text metadata string, shown only when on file.
  const parking =
    (
      (p.metadata as { parking?: string | null } | null)?.parking ?? ""
    ).trim() || null;

  // Data-driven unit FAQs (server-rendered + FAQPage JSON-LD via <FaqSection>).
  const unitInsights = await getMarketInsights({
    bedrooms: unit.bedrooms,
    community: p.community ? { name: p.community.name } : null,
    building: p.title,
  });
  const unitAvgPerSqft = (() => {
    const vals = (unitInsights?.sold ?? [])
      .map((s) => (s.area > 0 ? s.aed / s.area : null))
      .filter((n): n is number => typeof n === "number" && n > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  })();
  const unitPricePerSqft =
    unit.priceAed && unit.areaSqft && unit.areaSqft > 0
      ? unit.priceAed / unit.areaSqft
      : null;
  const unitFaqs = buildUnitFaqs({
    projectTitle: p.title,
    pricePerSqft: unitPricePerSqft,
    avgPerSqft: unitAvgPerSqft,
    avgScopeLabel: unitInsights
      ? unitInsights.scope === "building"
        ? "building"
        : (p.community?.name ?? null)
      : null,
    paymentPlan: p.paymentPlan as {
      downPaymentPct?: number | null;
      duringConstructionPct?: number | null;
      onHandoverPct?: number | null;
    } | null,
    listing,
    rentPriceAed: rentPrice,
  });
  const unitLastUpdated = [unit.updatedAt, p.updatedAt].reduce<Date | null>(
    (acc, d) => (d && (!acc || d > acc) ? d : acc),
    null,
  );

  // Breadcrumb trail: Properties / <type> / <emirate> / <community> / <project>.
  const crumbDeal = listing === "rent" ? "rent" : "sale";
  const crumbType = typeDefForType(unit.unitType ?? p.type);
  const emirate = p.community?.emirate ?? null;
  const emSlug = emirate ? slugifyLocality(emirate) : null;
  const commSlug = p.community?.slug ?? null;

  const specs: [string, string][] = [
    ["Bedrooms", unit.bedrooms == null ? "—" : unit.bedrooms === 0 ? "Studio" : String(unit.bedrooms)],
    ["Bathrooms", unit.bathrooms != null ? String(unit.bathrooms) : "—"],
    [
      "Area",
      unit.areaSqft ? `${Math.round(unit.areaSqft).toLocaleString()} sqft` : "—",
    ],
    ["View", unit.view ?? "—"],
    ["Status", unit.status ? unit.status : "—"],
    ["Developer", p.developer?.name ?? "—"],
    ...(parking ? ([["Parking", parking]] as [string, string][]) : []),
  ];

  const section = (title: string, items: { name: string; km: number }[]) =>
    items.length ? (
      <section className="mt-10">
        <h2 className="font-serif text-2xl text-primary">{title}</h2>
        <p className="mt-1 text-sm text-muted">Driving distance from the project</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {items.map((n) => (
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
    ) : null;

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-6 pb-28 pt-14 md:grid-cols-[1.6fr_0.9fr] md:px-10">
      <div>
        <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
          <Link href="/properties" className="hover:text-accent">
            Properties
          </Link>
          {commSlug ? (
            <>
              <span aria-hidden>/</span>
              <Link
                href={`/${buildListingSlug(crumbType.token, crumbDeal, emSlug ?? commSlug)}`}
                className="hover:text-accent"
              >
                {crumbType.label}
              </Link>
              {emirate && emSlug ? (
                <>
                  <span aria-hidden>/</span>
                  <Link
                    href={`/${buildListingSlug("properties", crumbDeal, emSlug)}`}
                    className="hover:text-accent"
                  >
                    {emirate}
                  </Link>
                </>
              ) : null}
              <span aria-hidden>/</span>
              <Link
                href={`/${buildListingSlug("properties", crumbDeal, commSlug)}`}
                className="hover:text-accent"
              >
                {p.community?.name}
              </Link>
            </>
          ) : null}
          <span aria-hidden>/</span>
          <Link href={`/projects/${p.slug}`} className="hover:text-accent">
            {p.title}
          </Link>
        </nav>

        <p className="mt-6 text-xs font-medium uppercase tracking-[0.25em] text-accent">
          {communityLabel(p.community?.name, p.community?.emirate)}
        </p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <h1 className="font-serif text-4xl text-primary">
            {bedLabel(unit.bedrooms)} at {p.title}
          </h1>
          <ShareSaveBar
            shareId={canonical}
            title={`${bedLabel(unit.bedrooms)} at ${p.title}`}
            subtitle={`${communityLabel(
              p.community?.name,
              p.community?.emirate,
            )} · ${
              listing === "rent"
                ? rentText
                : unit.priceAed
                  ? formatAED(unit.priceAed)
                  : "Price on request"
            }`}
            imageUrl={p.images[0]?.url ?? null}
            path={`/properties/unit/${canonical}`}
            entityLabel="property"
            className="mt-1 flex-none"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-lg text-muted">
            {listing === "rent"
              ? rentText
              : unit.priceAed
                ? formatAED(unit.priceAed)
                : "Price on request"}
          </p>
          {listing === "both" ? (
            <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
              Also for rent · {rentText}
            </span>
          ) : listing === "rent" ? (
            <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
              For rent
            </span>
          ) : null}
          {unit.status ? (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium capitalize text-primary">
              {unit.status}
            </span>
          ) : null}
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              p.offPlan ? "bg-accent/90 text-white" : "bg-primary/10 text-primary",
            )}
          >
            {delivery.label}
            {delivery.date ? ` · ${delivery.date}` : ""}
          </span>
          {serviceCharge ? (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              Service charge {serviceCharge}
            </span>
          ) : null}
          {parking ? (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              Parking · {parking}
            </span>
          ) : null}
          {isAdminViewer ? (
            <span className="inline-flex flex-wrap items-center gap-2 rounded-sm border border-accent/30 bg-accent/5 px-2.5 py-0.5 text-xs text-primary">
              <span className="font-medium">Unit {unit.unitNumber}</span>
              {unit.floor != null ? (
                <span className="text-muted">· Floor {unit.floor}</span>
              ) : null}
              <span className="text-muted">· admin-only</span>
            </span>
          ) : null}
        </div>

        {p.images.length ? (
          <ProjectGallery
            images={p.images}
            title={p.title}
            mapQuery={
              p.latitude != null && p.longitude != null
                ? `${p.latitude},${p.longitude}`
                : p.community
                  ? `${p.community.name}, Dubai`
                  : `${p.title}, Dubai`
            }
            coords={
              p.latitude != null && p.longitude != null
                ? { lat: p.latitude, lng: p.longitude }
                : null
            }
          />
        ) : null}

        {aboutProject ? (
          <section className="mt-8">
            <h2 className="font-serif text-2xl text-primary">About the project</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{aboutProject}</p>
          </section>
        ) : null}

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {specs.map(([label, value]) => (
            <div
              key={label}
              className="rounded-sm border border-border bg-card p-4"
            >
              <p className="text-[11px] uppercase tracking-wider text-muted">
                {label}
              </p>
              <p className="mt-2 text-sm font-medium capitalize text-primary">
                {value}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm text-muted">
          This unit is part of{" "}
          <Link
            href={`/projects/${p.slug}`}
            className="text-accent hover:underline"
          >
            {p.title}
          </Link>
          . See the full development for payment plans, floor plans and handover.
        </p>

        {p.amenities.length ? (
          <section className="mt-10">
            <h2 className="font-serif text-2xl text-primary">Amenities</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {p.amenities.map(({ amenity }) => (
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

        {section("Nearby", nearby.landmarks)}
        {section("Nearby Schools", nearby.schools)}
        {section("Nearby Hospitals", nearby.hospitals)}
        {section("Nearby Metro Stations", nearby.metro)}

        {/* Same as the project page. */}
        <PaymentPlanSection project={p} />
        {floorplan ? (
          <section className="mt-10">
            <h2 className="font-serif text-2xl text-primary">Floor plan</h2>
            {floorplan.isPdf ? (
              <div className="mt-4 overflow-hidden rounded-sm border border-border bg-card">
                <object
                  data={floorplan.url}
                  type="application/pdf"
                  aria-label={`${bedLabel(unit.bedrooms)} floor plan at ${p.title}`}
                  className="h-[420px] w-full sm:h-[640px]"
                >
                  {/* Shown where the browser can't embed PDFs (most phones). */}
                  <a
                    href={floorplan.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
                  >
                    <FileText className="h-10 w-10 text-accent" aria-hidden />
                    <span className="text-sm font-medium text-primary">
                      Floor plan (PDF)
                    </span>
                    <span className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                      Open floor plan
                    </span>
                  </a>
                </object>
                <a
                  href={floorplan.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block border-t border-border py-3 text-center text-sm font-medium text-accent hover:underline"
                >
                  Open floor plan (PDF)
                </a>
              </div>
            ) : (
              <a
                href={floorplan.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block overflow-hidden rounded-sm border border-border bg-card p-4 transition hover:border-accent"
                aria-label="Open the floor plan full size"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={floorplan.url}
                  alt={`${bedLabel(unit.bedrooms)} floor plan at ${p.title}`}
                  className="mx-auto max-h-[560px] w-full object-contain"
                />
                <span className="mt-3 block text-center text-xs text-muted">
                  Tap to open full size
                </span>
              </a>
            )}
          </section>
        ) : null}
        <ProjectTimelineSection project={p} />

        {/* Recorded DLD transactions + price trend, scoped to this unit's
            bedroom count (unit-wise comparables in the community). */}
        <MarketInsightsSection
          showProjectInfo={false}
          property={{
            id: p.id,
            slug: p.slug,
            title: p.title,
            type: unit.unitType ?? p.type,
            bedrooms: unit.bedrooms,
            priceAed: unit.priceAed,
            areaSqft: unit.areaSqft,
            offPlan: p.offPlan,
            images: p.images,
            community: p.community,
            developer: p.developer,
            paymentPlan: p.paymentPlan,
            metadata: p.metadata,
          }}
        />

        {p.latitude != null && p.longitude != null ? (
          <section className="mt-16">
            <h2 className="font-serif text-2xl text-primary">
              Where you&rsquo;ll be
            </h2>
            <p className="mt-1 text-sm text-muted">
              {communityLabel(p.community?.name, p.community?.emirate)}
            </p>
            <div className="mt-5 overflow-hidden rounded-xl border border-border">
              <iframe
                title={`Map of ${communityLabel(p.community?.name, p.community?.emirate)}`}
                src={`https://maps.google.com/maps?q=${p.latitude},${p.longitude}&z=14&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-[360px] w-full border-0"
              />
            </div>
          </section>
        ) : null}

        <FaqSection faqs={unitFaqs} lastUpdated={unitLastUpdated} />
      </div>

      <aside className="h-fit rounded-sm border border-border bg-card p-4 lg:sticky lg:top-24">
        <div className={cn("flex h-[70vh] min-h-0 flex-col")}>
          <AIChat
            propertyId={p.id}
            propertyTitle={p.title}
            placeholder="Ask about this property..."
            whatsappNumber={WHATSAPP_NUMBER}
          />
        </div>
      </aside>
    </div>
  );
}
