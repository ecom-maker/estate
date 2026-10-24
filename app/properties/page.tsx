import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ProjectImage } from "@/components/property/project-image";
import { formatAED } from "@/lib/utils";
import { handoverLabel } from "@/lib/property/handover";
import { unitPath } from "@/lib/property/unit-url";
import { communityLabel } from "@/lib/property/location";
import { unitMatchesDeal } from "@/lib/property/deal";
import { PropertyFilterBar } from "@/components/search/property-filter-bar";
import {
  hasUnitFilters,
  parseSort,
  parseUnitFilters,
  unitFiltersWhere,
  unitSortOrderBy,
} from "@/lib/search/unit-filters";

export const dynamic = "force-dynamic";
// Self-canonical to the clean path: every filter/sort query-string variant
// (?type, ?beds, ?sort, ?furnishing, ?deal, ?min, ?max…) points here, so Google
// treats them as one page instead of "Duplicate without user-selected canonical".
export const metadata = {
  title: "Properties",
  alternates: { canonical: "/properties" },
};

type Photo = { url: string; alt: string | null };

/**
 * One photo per card. Each project's cards rotate through its photos, and a
 * card never repeats the photo of the card just before it, so units from the
 * same project don't look identical side by side.
 */
function pickPhotos(
  projectIds: string[],
  photos: Map<string, Photo[]>,
): (Photo | undefined)[] {
  const turns = new Map<string, number>();
  let lastUrl: string | null = null;
  return projectIds.map((id) => {
    const list = photos.get(id) ?? [];
    if (!list.length) {
      lastUrl = null;
      return undefined;
    }
    let turn = turns.get(id) ?? 0;
    if (list.length > 1 && list[turn % list.length].url === lastUrl) turn++;
    turns.set(id, turn + 1);
    const photo = list[turn % list.length];
    lastUrl = photo.url;
    return photo;
  });
}

// A property = an individual unit inside a project.

function bedLabel(beds: number | null): string {
  if (beds == null) return "—";
  return beds === 0 ? "Studio" : `${beds} Bed`;
}

function statusStyle(status: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s === "sold") return "bg-primary/70 text-white";
  if (s === "reserved") return "bg-accent/80 text-white";
  return "bg-white/95 text-primary"; // available / default
}

/**
 * Off-plan / completed badge for the top-right of a card, with the handover or
 * completion date when it's on file (metadata.handoverDate, else completionLabel).
 */
function deliveryBadge(
  offPlan: boolean,
  metadata: unknown,
): { label: string; date: string | null } {
  const meta = (metadata ?? {}) as { completionLabel?: string | null };
  const date = handoverLabel(metadata) ?? meta.completionLabel?.trim() ?? null;
  return { label: offPlan ? "Off-plan" : "Completed", date };
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Plain database filters from the filter bar (no AI).
  const filters = parseUnitFilters(params);
  const sort = parseSort(params.sort);
  const dealParam = Array.isArray(params.deal) ? params.deal[0] : params.deal;
  const rentOnly = dealParam === "rent";
  const filtered = hasUnitFilters(filters) || rentOnly;

  const live = { deletedAt: null, status: "ACTIVE" as const };
  const where: Prisma.PropertyUnitWhereInput = {
    hidden: false,
    property: live,
    AND: unitFiltersWhere(filters),
  };

  let units: Array<{
    id: string;
    bedrooms: number | null;
    bathrooms: number | null;
    areaSqft: number | null;
    priceAed: number | null;
    view: string | null;
    status: string | null;
    unitType: string | null;
    metadata: Prisma.JsonValue;
    property: {
      id: string;
      title: string;
      slug: string;
      type: string;
      offPlan: boolean;
      metadata: Prisma.JsonValue;
      community: { name: string; emirate: string | null } | null;
      developer: { name: string } | null;
    };
  }> = [];
  let total = 0;
  try {
    [units, total] = await Promise.all([
      prisma.propertyUnit.findMany({
        where,
        orderBy: unitSortOrderBy(sort),
        take: 300,
        select: {
          id: true,
          bedrooms: true,
          bathrooms: true,
          areaSqft: true,
          priceAed: true,
          view: true,
          status: true,
          unitType: true,
          metadata: true,
          property: {
            select: {
              id: true,
              title: true,
              slug: true,
              type: true,
              offPlan: true,
              metadata: true,
              community: { select: { name: true, emirate: true } },
              developer: { select: { name: true } },
            },
          },
        },
      }),
      prisma.propertyUnit.count({ where }),
    ]);
  } catch {
    units = [];
    total = 0;
  }

  // "For rent" tab: keep only units offered for rent (per-unit metadata.listing).
  if (rentOnly) {
    units = units.filter((u) => unitMatchesDeal(u.metadata, "rent"));
    total = units.length;
  }

  // Each project's photos, loaded once in a fixed order (id breaks sortOrder
  // ties) with duplicate URLs removed, so cards can rotate through them.
  const photos = new Map<string, Photo[]>();
  try {
    const rows = await prisma.propertyImage.findMany({
      where: { propertyId: { in: [...new Set(units.map((u) => u.property.id))] } },
      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      select: { propertyId: true, url: true, alt: true },
    });
    for (const r of rows) {
      const list = photos.get(r.propertyId) ?? [];
      if (list.length < 8 && !list.some((x) => x.url === r.url)) {
        list.push({ url: r.url, alt: r.alt });
      }
      photos.set(r.propertyId, list);
    }
  } catch {
    // Cards fall back to the placeholder.
  }
  const cardPhotos = pickPhotos(
    units.map((u) => u.property.id),
    photos,
  );

  return (
    <div className="mx-auto max-w-7xl px-6 pb-28 pt-6 md:px-10">
      {/* Stays under the site header while the list scrolls. */}
      <div className="sticky top-[69px] z-30 -mx-2 bg-background px-2 py-3 md:top-[73px]">
        {/* No remount key: the bar stays mounted across filter navigations so
            open popovers (multi-select type/beds) persist. It syncs itself to
            the URL instead. */}
        <PropertyFilterBar mode="listing" initial={filters} sort={sort} />
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
            Properties
          </p>
          <h1 className="mt-3 font-serif text-4xl text-primary">
            Available units
          </h1>
          <p className="mt-2 text-sm text-muted">
            {total} {total === 1 ? "unit" : "units"}{" "}
            {filtered ? "match your filters" : "across our projects"}
          </p>
        </div>
      </div>


      {units.length === 0 ? (
        <p className="mt-10 text-sm text-muted">No units match these filters.</p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {units.map((u, i) => {
            const img = cardPhotos[i];
            const delivery = deliveryBadge(u.property.offPlan, u.property.metadata);
            return (
              <Link
                key={u.id}
                href={unitPath({
                  id: u.id,
                  bedrooms: u.bedrooms,
                  unitType: u.unitType,
                  property: u.property,
                })}
                className="group overflow-hidden rounded-xl border border-border bg-card transition hover:border-accent hover:shadow-sm"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <ProjectImage
                    url={img?.url ?? null}
                    alt={img?.alt ?? u.property.title}
                    title={u.property.title}
                  />
                  {u.status ? (
                    <span
                      className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize shadow-sm ${statusStyle(u.status)}`}
                    >
                      {u.status}
                    </span>
                  ) : null}
                  <span
                    className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-medium shadow-sm ${
                      u.property.offPlan
                        ? "bg-accent/90 text-white"
                        : "bg-white/95 text-primary"
                    }`}
                  >
                    {delivery.label}
                    {delivery.date ? ` · ${delivery.date}` : ""}
                  </span>
                </div>
                <div className="p-5">
                  {/* Developer-first header, matching the project cards:
                      developer eyebrow · project title · location. Falls back to
                      the location as the eyebrow when no developer is on file. */}
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
                    {u.property.developer?.name ??
                      communityLabel(
                        u.property.community?.name,
                        u.property.community?.emirate,
                      )}
                  </p>
                  <h2 className="mt-1 font-serif text-2xl leading-tight text-primary">
                    {u.property.title}
                  </h2>
                  {u.property.developer?.name ? (
                    <p className="mt-1 text-sm text-muted">
                      {communityLabel(
                        u.property.community?.name,
                        u.property.community?.emirate,
                      )}
                    </p>
                  ) : null}
                  <p className="mt-3 text-sm text-muted">
                    {u.unitType && u.unitType !== "APARTMENT" && u.unitType !== "UNIT"
                      ? `${u.unitType.charAt(0)}${u.unitType.slice(1).toLowerCase()} · `
                      : ""}
                    {bedLabel(u.bedrooms)}
                    {u.bathrooms != null ? ` · ${u.bathrooms} bath` : ""}
                    {u.areaSqft
                      ? ` · ${Math.round(u.areaSqft).toLocaleString()} sqft`
                      : ""}
                  </p>
                  {u.view ? (
                    <p className="mt-0.5 text-xs text-muted">{u.view} view</p>
                  ) : null}
                  <p className="mt-3 font-serif text-xl text-primary">
                    {u.priceAed ? formatAED(u.priceAed) : "Price on request"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
