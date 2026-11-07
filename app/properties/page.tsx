import Link from "next/link";
import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ProjectImage } from "@/components/property/project-image";
import {
  handoverLabel,
  handoverMs,
  effectiveOffPlan,
} from "@/lib/property/handover";
import { formatMoney, formatUnitPrice } from "@/lib/currency/fx";
import { unitPath } from "@/lib/property/unit-url";
import { communityLabel } from "@/lib/property/location";
import { cn } from "@/lib/utils";
import { PropertyFilterBar } from "@/components/search/property-filter-bar";
import { Pager } from "@/components/property/pager";
import { getUnitCityFacets } from "@/lib/property/unit-city-facets";
import {
  DEFAULT_SORT,
  hasUnitFilters,
  parseSort,
  parseUnitFilters,
  unitFiltersToSearch,
  unitFiltersWhere,
  unitSortOrderBy,
} from "@/lib/search/unit-filters";

const PAGE_SIZE = 48;

/** Clamp a ?page param to a positive integer (defaults to 1). */
function parsePage(v: string | string[] | undefined): number {
  const raw = Array.isArray(v) ? v[0] : v;
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export const dynamic = "force-dynamic";

// Self-canonical to the clean path: every filter/sort query-string variant
// (?type, ?beds, ?sort, ?furnishing, ?deal, ?min, ?max…) collapses to
// /properties, so Google treats them as one page instead of "Duplicate without
// user-selected canonical". Pagination is the exception: each page beyond the
// first is its own canonical (?page=N) so the deeper inventory gets indexed and
// internally linked, rather than all folding into page one.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const page = parsePage((await searchParams).page);
  return {
    title: page > 1 ? `Properties – Page ${page}` : "Properties",
    alternates: { canonical: page > 1 ? `/properties?page=${page}` : "/properties" },
  };
}

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
): { label: string; date: string | null; offPlan: boolean } {
  const meta = (metadata ?? {}) as { completionLabel?: string | null };
  const date = handoverLabel(metadata) ?? meta.completionLabel?.trim() ?? null;
  // Use the effective state (a past handover counts as completed) for BOTH the
  // label and the colour below, so a "Completed" badge is never styled off-plan.
  const effectivelyOffPlan = effectiveOffPlan(offPlan, metadata);
  return {
    label: effectivelyOffPlan ? "Off-plan" : "Completed",
    date,
    offPlan: effectivelyOffPlan,
  };
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
  const requestedPage = parsePage(params.page);
  const dealParam = Array.isArray(params.deal) ? params.deal[0] : params.deal;
  const rentOnly = dealParam === "rent";
  const filtered = hasUnitFilters(filters) || rentOnly;

  const live = { deletedAt: null, status: "ACTIVE" as const };
  // "For rent" is derived from each unit's metadata.listing (rent | both). It
  // used to be filtered in memory, but pagination needs the count and the
  // skip/take to reflect it, so it's a DB clause now.
  const rentWhere: Prisma.PropertyUnitWhereInput[] = rentOnly
    ? [
        {
          OR: [
            { metadata: { path: ["listing"], equals: "rent" } },
            { metadata: { path: ["listing"], equals: "both" } },
          ],
        },
      ]
    : [];
  const where: Prisma.PropertyUnitWhereInput = {
    hidden: false,
    property: live,
    AND: [...unitFiltersWhere(filters), ...rentWhere],
  };

  // Completion date lives in the parent project's JSON metadata, not a sortable
  // column, so that sort can't be pushed to the DB. For it we load every match,
  // sort in memory, then slice the page; all other sorts paginate in the DB.
  const isCompletionSort = sort === "completion";

  const unitSelect = {
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
        priceAed: true,
        priceNative: true,
        currency: true,
        community: { select: { name: true, emirate: true } },
        developer: { select: { name: true } },
      },
    },
  } satisfies Prisma.PropertyUnitSelect;

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
      priceAed: number | null;
      priceNative: number | null;
      currency: string;
      community: { name: string; emirate: string | null } | null;
      developer: { name: string } | null;
    };
  }> = [];
  let total = 0;
  try {
    total = await prisma.propertyUnit.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    const skip = (page - 1) * PAGE_SIZE;

    if (isCompletionSort) {
      // Soonest handover first; units with no date on file fall to the end.
      // The DB order is the newest-first fallback for ties. Sorting is global,
      // so the whole result set is loaded, ordered, then sliced to the page.
      const all = await prisma.propertyUnit.findMany({
        where,
        orderBy: unitSortOrderBy(sort),
        select: unitSelect,
      });
      const last = Number.POSITIVE_INFINITY;
      all.sort(
        (a, b) =>
          (handoverMs(a.property.metadata) ?? last) -
          (handoverMs(b.property.metadata) ?? last),
      );
      units = all.slice(skip, skip + PAGE_SIZE);
    } else {
      units = await prisma.propertyUnit.findMany({
        where,
        orderBy: unitSortOrderBy(sort),
        skip,
        take: PAGE_SIZE,
        select: unitSelect,
      });
    }
  } catch {
    units = [];
    total = 0;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  // City breakdown of the current result set (same `where` as the count, so the
  // numbers add up to the "Available units" total). Shown next to the heading.
  const cityFacets = await getUnitCityFacets(where);

  // Preserves the active filters, sort and deal while moving between pages.
  const pageHref = (p: number) => {
    const sp = new URLSearchParams(unitFiltersToSearch(filters));
    if (sort !== DEFAULT_SORT) sp.set("sort", sort);
    if (rentOnly) sp.set("deal", "rent");
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/properties?${qs}` : "/properties";
  };

  // City pills filter the list by setting the `q` search (which matches the
  // community's city / emirate), keeping every other active filter and the
  // sort. `city=""` clears it (used to toggle the active pill off). Page resets
  // to 1, since the result set changes.
  const activeCity = filters.q.trim().toLowerCase();
  const cityHref = (city: string) => {
    const sp = new URLSearchParams(unitFiltersToSearch({ ...filters, q: city }));
    if (sort !== DEFAULT_SORT) sp.set("sort", sort);
    if (rentOnly) sp.set("deal", "rent");
    const qs = sp.toString();
    return qs ? `/properties?${qs}` : "/properties";
  };
  // Show the breakdown when there's more than one city, or when the lone
  // remaining city is the one currently selected (so its pill stays visible to
  // toggle off).
  const showCityFacets =
    cityFacets.length > 1 ||
    cityFacets.some((c) => c.city.toLowerCase() === activeCity);

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
            {total.toLocaleString()} {total === 1 ? "unit" : "units"}{" "}
            {filtered ? "match your filters" : "across our projects"}
            {totalPages > 1 ? ` · Page ${page} of ${totalPages}` : ""}
          </p>
        </div>
        {showCityFacets ? (
          <div className="flex flex-wrap items-center gap-2">
            {cityFacets.map((c) => {
              const active = c.city.toLowerCase() === activeCity;
              return (
                <Link
                  key={c.city}
                  href={active ? cityHref("") : cityHref(c.city)}
                  scroll={false}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition",
                    active
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-card text-primary hover:border-accent",
                  )}
                >
                  {c.city}
                  <span className={active ? "text-accent/70" : "text-muted"}>
                    {c.count.toLocaleString()}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : null}
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
                target="_blank"
                rel="noopener noreferrer"
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
                      delivery.offPlan
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
                    {u.priceAed
                      ? formatUnitPrice(u.priceAed, u.property.currency)
                      : u.property.priceAed
                        ? `from ${formatMoney(u.property.priceNative ?? u.property.priceAed, u.property.currency)}`
                        : "Price on request"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Pager page={page} totalPages={totalPages} hrefFor={pageHref} />
    </div>
  );
}
