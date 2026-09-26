import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { cn, formatAED } from "@/lib/utils";
import { AIChat } from "@/components/ai/ai-chat";
import {
  UnitsSection,
  type UnitGroup,
  type UnitRow,
} from "@/components/property/units-section";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const property = await prisma.property.findUnique({ where: { slug } });
    if (!property) return { title: "Property" };
    return {
      title: property.title,
      description: property.description?.slice(0, 160),
      openGraph: {
        title: property.title,
        description: property.description?.slice(0, 160),
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

  const primary = property.images[0];
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

  // ----- Units grouped by bedroom type, with floor-plan + seed fallbacks -----
  const PLACEHOLDER_PLAN = "/floorplan-placeholder.svg";
  const floorplanByUnit = new Map<string, { url: string; title: string }>();
  for (const fp of property.floorplans) {
    if (fp.unitRef) floorplanByUnit.set(fp.unitRef, { url: fp.url, title: fp.title });
  }
  const anyFloorplan = property.floorplans[0]
    ? { url: property.floorplans[0].url, title: property.floorplans[0].title }
    : null;

  type UnitLike = {
    id: string;
    unitNumber: string;
    bedrooms: number | null;
    bathrooms: number | null;
    areaSqft: number | null;
    priceAed: number | null;
  };
  // Seed a single layout from the property itself when no units are recorded.
  const unitSource: UnitLike[] = property.units.length
    ? property.units
    : [
        {
          id: property.id,
          unitNumber: "Type A",
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          areaSqft: property.areaSqft,
          priceAed: property.priceAed,
        },
      ];

  const bedLabel = (b: number | null) =>
    b == null ? "Other" : b === 0 ? "Studio" : `${b} Bed`;
  const fromLabel = (price: number | null) =>
    price == null
      ? ""
      : price >= 1_000_000
        ? `from ${(price / 1_000_000).toFixed(1)}M AED`
        : `from ${price.toLocaleString()} AED`;

  const groupMap = new Map<
    string,
    { label: string; order: number; prices: number[]; bath: number | null; units: UnitRow[] }
  >();
  for (const u of unitSource) {
    const key = u.bedrooms == null ? "other" : String(u.bedrooms);
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        label: bedLabel(u.bedrooms),
        order: u.bedrooms ?? 99,
        prices: [],
        bath: u.bathrooms ?? property.bathrooms,
        units: [],
      });
    }
    const grp = groupMap.get(key)!;
    if (u.priceAed != null) grp.prices.push(u.priceAed);
    const fp =
      floorplanByUnit.get(u.unitNumber) ??
      anyFloorplan ?? {
        url: PLACEHOLDER_PLAN,
        title: `${u.unitNumber} floor plan`,
      };
    grp.units.push({
      id: u.id,
      layoutType: u.unitNumber,
      bathrooms: u.bathrooms ?? property.bathrooms,
      areaSqft: u.areaSqft ?? property.areaSqft,
      floorplanUrl: fp.url,
      floorplanTitle: fp.title,
    });
  }
  const unitGroups: UnitGroup[] = [...groupMap.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, g]) => ({
      key,
      label: g.label,
      fromLabel: fromLabel(g.prices.length ? Math.min(...g.prices) : null),
      bathrooms: g.bath,
      units: g.units,
    }));

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-6 py-28 lg:grid-cols-[1.4fr_0.8fr] md:px-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
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

        <div className="relative mt-8 aspect-[16/10] overflow-hidden rounded-sm bg-primary/10">
          {primary ? (
            <Image
              src={primary.url}
              alt={primary.alt ?? property.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width:1024px) 100vw, 60vw"
            />
          ) : null}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Bedrooms", property.bedrooms ?? "—"],
            ["Bathrooms", property.bathrooms ?? "—"],
            ["Area", property.areaSqft ? `${property.areaSqft} sqft` : "—"],
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

        <section className="mt-10">
          <h2 className="font-serif text-2xl text-primary">Description</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
            {property.description}
          </p>
        </section>

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
      </div>

      <aside className="h-fit rounded-sm border border-border bg-card p-5 lg:sticky lg:top-24">
        <AIChat
          propertyId={property.id}
          placeholder="Ask about this property..."
        />
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
