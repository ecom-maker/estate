import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ProjectImage } from "@/components/property/project-image";
import { formatAED } from "@/lib/utils";

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
const BED_FILTERS = [
  { key: "any", label: "Any beds" },
  { key: "0", label: "Studio" },
  { key: "1", label: "1 Bed" },
  { key: "2", label: "2 Bed" },
  { key: "3", label: "3 Bed" },
  { key: "4", label: "4+ Bed" },
];

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
  searchParams: Promise<{ beds?: string }>;
}) {
  const { beds } = await searchParams;
  const bedFilter = BED_FILTERS.some((b) => b.key === beds) ? beds : "any";

  const where: Prisma.PropertyUnitWhereInput = {
    hidden: false,
    property: { deletedAt: null, status: "ACTIVE" },
    ...(bedFilter && bedFilter !== "any"
      ? bedFilter === "4"
        ? { bedrooms: { gte: 4 } }
        : { bedrooms: Number(bedFilter) }
      : {}),
  };

  let units: Array<{
    id: string;
    bedrooms: number | null;
    bathrooms: number | null;
    areaSqft: number | null;
    priceAed: number | null;
    view: string | null;
    status: string | null;
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

      <div className="mt-6 flex flex-wrap gap-2">
        {BED_FILTERS.map((b) => (
          <Link
            key={b.key}
            href={b.key === "any" ? "/properties" : `/properties?beds=${b.key}`}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
              bedFilter === b.key
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted hover:border-accent hover:text-primary"
            }`}
          >
            {b.label}
          </Link>
        ))}
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
