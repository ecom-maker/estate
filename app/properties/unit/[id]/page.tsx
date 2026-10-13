import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { cn, formatAED } from "@/lib/utils";
import { handoverLabel } from "@/lib/property/handover";
import { unitIdFromParam, unitSlug } from "@/lib/property/unit-url";
import { SITE_URL } from "@/lib/data-layer/canonical";
import { ProjectGallery } from "@/components/property/project-gallery";
import { AIChat } from "@/components/ai/ai-chat";
import { formatKm } from "@/lib/property/nearby";
import { getNearbyBundle } from "@/lib/property/nearby-bundle";
import { WHATSAPP_NUMBER } from "@/lib/whatsapp";
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
              className="flex items-center gap-3 rounded-sm border border-border bg-card px-4 py-3"
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
        <nav className="text-sm text-muted">
          <Link href="/properties" className="hover:text-accent">
            Properties
          </Link>{" "}
          /{" "}
          <Link href={`/projects/${p.slug}`} className="hover:text-accent">
            {p.title}
          </Link>
        </nav>

        <p className="mt-6 text-xs font-medium uppercase tracking-[0.25em] text-accent">
          {p.community?.name ?? "Dubai"}
        </p>
        <h1 className="mt-2 font-serif text-4xl text-primary">
          {bedLabel(unit.bedrooms)} at {p.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-lg text-muted">
            {unit.priceAed ? formatAED(unit.priceAed) : "Price on request"}
          </p>
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
