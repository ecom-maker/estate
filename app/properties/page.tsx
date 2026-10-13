import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ProjectImage } from "@/components/property/project-image";
import { formatAED } from "@/lib/utils";
import { PropertyFilterBar } from "@/components/search/property-filter-bar";
import {
  parseUnitFilters,
  unitFiltersToSearch,
  unitFiltersWhere,
} from "@/lib/search/unit-filters";

export const dynamic = "force-dynamic";
export const metadata = { title: "Properties" };

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

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Plain database filters from the filter bar (no AI).
  const filters = parseUnitFilters(await searchParams);

  const where: Prisma.PropertyUnitWhereInput = {
    hidden: false,
    property: { deletedAt: null, status: "ACTIVE" },
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
    property: {
      id: string;
      title: string;
      slug: string;
      community: { name: string } | null;
    };
  }> = [];
  let total = 0;
  try {
    [units, total] = await Promise.all([
      prisma.propertyUnit.findMany({
        where,
        orderBy: [{ priceAed: "asc" }],
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
          property: {
            select: {
              id: true,
              title: true,
              slug: true,
              community: { select: { name: true } },
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
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
            Properties
          </p>
          <h1 className="mt-3 font-serif text-4xl text-primary">
            Available units
          </h1>
          <p className="mt-2 text-sm text-muted">
            {total} {total === 1 ? "unit" : "units"} across our projects ·{" "}
            <Link href="/search" className="text-accent hover:underline">
              AI search
            </Link>
          </p>
        </div>
      </div>

      {/* Stays under the site header while the list scrolls. */}
      <div className="sticky top-[69px] z-30 -mx-2 mt-6 bg-background px-2 py-3 md:top-[73px]">
        <PropertyFilterBar
          key={unitFiltersToSearch(filters)}
          mode="listing"
          initial={filters}
        />
      </div>

      {units.length === 0 ? (
        <p className="mt-10 text-sm text-muted">
          No units match these filters.
        </p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {units.map((u, i) => {
            const img = cardPhotos[i];
            return (
              <Link
                key={u.id}
                href={`/properties/unit/${u.id}`}
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
                </div>
                <div className="p-4">
                  <p className="text-[11px] uppercase tracking-wider text-accent">
                    {u.property.community?.name ?? "Dubai"}
                  </p>
                  <h2 className="mt-1 truncate font-serif text-lg text-primary">
                    {u.property.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
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
