import { notFound } from "next/navigation";
import { ProjectGallery } from "@/components/property/project-gallery";
import { prisma } from "@/lib/db/prisma";
import { cn, formatAED } from "@/lib/utils";
import { AIChat } from "@/components/ai/ai-chat";
import { UnitsSection } from "@/components/property/units-section";
import { MarketInsightsSection } from "@/components/property/market-insights-section";
import { buildUnitGroups } from "@/lib/property/unit-groups";
import { JsonLd } from "@/components/seo/json-ld";
import { propertyJsonLd } from "@/lib/data-layer/jsonld";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import type { Metadata } from "next";
import { WHATSAPP_NUMBER } from "@/lib/whatsapp";
import { PropertyDescription } from "@/components/property/property-description";
import { metaDescription } from "@/lib/property/description";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const property = await prisma.property.findUnique({ where: { slug } });
    if (!property) return { title: "Property" };
    return {
      title: property.title,
      description: metaDescription(property),
      openGraph: {
        title: property.title,
        description: metaDescription(property),
      },
    };
  } catch {
    return { title: "Property" };
  }
}

export default async function PropertyDetailPage({ params }: Props) {
  const { slug } = await params;
  let property = null;
  try {
    property = await prisma.property.findFirst({
      where: { slug, deletedAt: null },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        videos: true,
        units: true,
        amenities: { include: { amenity: true } },
        community: true,
        developer: true,
        floorplans: true,
        rentalHistory: { orderBy: { rentedAt: "desc" }, take: 3 },
        salesHistory: { orderBy: { soldAt: "desc" }, take: 3 },
      },
    });
  } catch {
    property = null;
  }

  if (!property) notFound();

  const meta = (property.metadata ?? {}) as { handoverDate?: string };
  const handoverDate = meta.handoverDate ? new Date(meta.handoverDate) : null;
  const handoverLabel =
    handoverDate && !Number.isNaN(handoverDate.getTime())
      ? handoverDate.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;

  const unitGroups = buildUnitGroups(property);

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-6 pb-28 pt-14 lg:grid-cols-[1.4fr_0.8fr] md:px-10">
      <JsonLd
        data={propertyJsonLd({
          title: property.title,
          slug: property.slug,
          type: property.type,
          description: property.summary ?? property.description,
          priceAed: property.priceAed,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          areaSqft: property.areaSqft,
          latitude: property.latitude,
          longitude: property.longitude,
          status: property.status,
          community: property.community,
          developer: property.developer,
          images: property.images,
          amenities: property.amenities.map((a) => a.amenity.name),
        })}
      />
      <div>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Properties", href: "/properties" },
            ...(property.community
              ? [
                  {
                    label: property.community.name,
                    href: `/search?q=${encodeURIComponent(property.community.slug)}`,
                  },
                ]
              : []),
            { label: property.title },
          ]}
        />
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.25em] text-accent">
          {property.community?.name ?? "Dubai"}
        </p>
        <h1 className="mt-3 font-serif text-4xl text-primary md:text-5xl">
          {property.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-lg text-muted">{formatAED(property.priceAed)}</p>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
              property.offPlan
                ? "bg-accent/15 text-accent"
                : "bg-primary/10 text-primary",
            )}
          >
            {property.offPlan ? "Off-plan" : "Completed"}
          </span>
          {handoverLabel ? (
            <span className="text-sm text-muted">
              {property.offPlan ? "Delivery" : "Completed"}: {handoverLabel}
            </span>
          ) : null}
        </div>

        <ProjectGallery
          images={property.images}
          title={property.title}
          mapQuery={
            property.latitude != null && property.longitude != null
              ? `${property.latitude},${property.longitude}`
              : property.community
                ? `${property.community.name}, Dubai`
                : `${property.title}, Dubai`
          }
          coords={
            property.latitude != null && property.longitude != null
              ? { lat: property.latitude, lng: property.longitude }
              : null
          }
        />

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Bedrooms", property.bedrooms ?? "—"],
            ["Bathrooms", property.bathrooms ?? "—"],
            [
              "Area",
              property.areaSqft
                ? `${Math.round(property.areaSqft).toLocaleString()} sqft`
                : "—",
            ],
            ["Type", property.type],
            ["Waterfront", property.waterfront ? "Yes" : "No"],
            ["Off-plan", property.offPlan ? "Yes" : "No"],
            ["Yield", property.rentalYield != null ? `${property.rentalYield}%` : "N/A"],
            ["RERA", property.reraStatus ?? "Not available"],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-sm border border-border bg-card p-4"
            >
              <p className="text-[11px] uppercase tracking-wider text-muted">
                {label}
              </p>
              <p className="mt-2 text-sm font-medium text-primary">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <PropertyDescription title="Description" property={property} />
        </div>

        <section className="mt-10">
          <h2 className="font-serif text-2xl text-primary">Amenities</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {property.amenities.map(({ amenity }) => (
              <li
                key={amenity.id}
                className="rounded-sm border border-border bg-card px-3 py-1.5 text-xs text-primary"
              >
                {amenity.name}
              </li>
            ))}
          </ul>
        </section>

        <UnitsSection category={property.type} groups={unitGroups} />

        <MarketInsightsSection
          property={{
            id: property.id,
            title: property.title,
            type: property.type,
            bedrooms: property.bedrooms,
            priceAed: property.priceAed,
            areaSqft: property.areaSqft,
            offPlan: property.offPlan,
            images: property.images,
            community: property.community,
            developer: property.developer,
            paymentPlan: property.paymentPlan,
            metadata: property.metadata,
          }}
        />
      </div>

      <aside className="h-fit rounded-sm border border-border bg-card p-4 lg:sticky lg:top-24">
        <div className="flex h-[70vh] min-h-0 flex-col">
          <AIChat
            propertyId={property.id}
            placeholder="Ask about this property..."
            propertyTitle={property.title}
              whatsappNumber={WHATSAPP_NUMBER}
          />
        </div>
        {property.videos[0] ? (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-wider text-muted">
              Video tour
            </p>
            <div className="mt-3 aspect-[9/16] overflow-hidden rounded-sm bg-primary/10">
              <video
                src={property.videos[0].url}
                controls
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        ) : (
          <p className="mt-6 text-xs text-muted">
            9:16 video tour placeholder — upload via media service.
          </p>
        )}
      </aside>
    </div>
  );
}
