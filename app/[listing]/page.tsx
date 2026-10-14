import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { formatAED } from "@/lib/utils";
import { bedroomsText, isStartingFigure } from "@/lib/property/bedrooms";
import { getAppUrl } from "@/lib/app-url";
import { unitPath } from "@/lib/property/unit-url";
import { unitMatchesDeal, developmentMatchesDeal } from "@/lib/property/deal";
import {
  parseListingSlug,
  buildListingSlug,
  humanizeSlug,
  listingTitle,
  DEAL_LABELS,
  type ParsedListingSlug,
} from "@/lib/seo/listing-slug";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ listing: string }> };

const BASE = getAppUrl();

type ListingProperty = Prisma.PropertyGetPayload<{
  include: {
    images: true;
    community: true;
    units: { select: { bedrooms: true; hidden: true; metadata: true } };
  };
}>;

type ListingUnit = Prisma.PropertyUnitGetPayload<{
  select: {
    id: true;
    bedrooms: true;
    bathrooms: true;
    areaSqft: true;
    priceAed: true;
    view: true;
    status: true;
    unitType: true;
    metadata: true;
    property: {
      select: {
        slug: true;
        title: true;
        type: true;
        community: { select: { name: true; emirate: true } };
        images: { select: { url: true; alt: true } };
      };
    };
  };
}>;

interface ResolvedListing {
  parsed: ParsedListingSlug;
  localityName: string;
  localityCity: string | null;
  properties: ListingProperty[];
  units: ListingUnit[];
  nearby: { name: string; slug: string }[];
}

type Photo = { url: string; alt: string | null };

/**
 * One photo per unit card, rotating through each project's photos so that two
 * units of the same project shown side by side don't display the same image.
 */
function pickUnitPhotos(
  units: { property: { slug: string; images: Photo[] } }[],
): (Photo | undefined)[] {
  const turns = new Map<string, number>();
  let lastUrl: string | null = null;
  return units.map((u) => {
    const list = u.property.images ?? [];
    if (!list.length) {
      lastUrl = null;
      return undefined;
    }
    let turn = turns.get(u.property.slug) ?? 0;
    if (list.length > 1 && list[turn % list.length].url === lastUrl) turn++;
    turns.set(u.property.slug, turn + 1);
    const photo = list[turn % list.length];
    lastUrl = photo.url;
    return photo;
  });
}

/** Resolve a listing slug to its locality + matching properties (or null). */
async function resolveListing(slug: string): Promise<ResolvedListing | null> {
  const parsed = parseListingSlug(slug);
  if (!parsed) return null;

  try {
    const community = await prisma.community.findUnique({
      where: { slug: parsed.localitySlug },
    });
    const localityName = community?.name ?? humanizeSlug(parsed.localitySlug);
    const localityCity = community?.city ?? community?.emirate ?? null;

    const where: Prisma.PropertyWhereInput = {
      deletedAt: null,
      status: { in: ["ACTIVE", "RESERVED"] },
    };
    if (parsed.typeDef.enums.length > 0) {
      where.type = { in: parsed.typeDef.enums };
    }
    // TODO(dealType): once Property gains an explicit dealType(sale|rent)
    // field (see BUILD-PLAN), filter on parsed.deal here. Today the portal
    // is sales-oriented, so both share the active-inventory query.
    if (community) {
      where.communityId = community.id;
    } else {
      const term = localityName;
      where.OR = [
        { community: { name: { contains: term, mode: "insensitive" } } },
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ];
    }

    const [propertiesRaw, unitsRaw, nearby] = await Promise.all([
      prisma.property.findMany({
        where,
        include: {
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
          community: true,
          units: { select: { bedrooms: true, hidden: true, metadata: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
      // Individual units in matching projects — the actual listings.
      prisma.propertyUnit.findMany({
        where: { hidden: false, property: where },
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
              slug: true,
              title: true,
              type: true,
              community: { select: { name: true, emirate: true } },
              images: {
                orderBy: { sortOrder: "asc" },
                take: 8,
                select: { url: true, alt: true },
              },
            },
          },
        },
        orderBy: { priceAed: "asc" },
        take: 200,
      }),
      prisma.community.findMany({
        where: community ? { id: { not: community.id } } : {},
        select: { name: true, slug: true },
        orderBy: { name: "asc" },
        take: 6,
      }),
    ]);

    // Keep only inventory offered for this page's deal (sale or rent).
    const units = unitsRaw
      .filter((u) => unitMatchesDeal(u.metadata, parsed.deal))
      .slice(0, 24);
    const properties = propertiesRaw
      .filter((p) => developmentMatchesDeal(p, parsed.deal))
      .slice(0, 24);

    return { parsed, localityName, localityCity, properties, units, nearby };
  } catch {
    // DB unavailable — still render an indexable shell rather than 500.
    return {
      parsed,
      localityName: humanizeSlug(parsed.localitySlug),
      localityCity: null,
      properties: [],
      units: [],
      nearby: [],
    };
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { listing } = await params;
  const resolved = await resolveListing(listing);
  if (!resolved) return { title: "Not found" };

  const { parsed, localityName, properties } = resolved;
  const title = `${listingTitle(parsed, localityName)} | DM Global`;
  const count = properties.length;
  const description =
    `${count > 0 ? `${count}+ ` : ""}${parsed.typeDef.label.toLowerCase()} ` +
    `${DEAL_LABELS[parsed.deal].toLowerCase()} in ${localityName} from trusted builders ` +
    `and owners. Latest prices, locality insights and FAQs to help you compare options.`;
  const canonical = `${BASE}/${listing}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

function faqFor(parsed: ParsedListingSlug, localityName: string) {
  const type = parsed.typeDef.label.toLowerCase();
  const singular = parsed.typeDef.singular;
  const deal = parsed.deal === "sale" ? "buy" : "rent";
  return [
    {
      q: `How many ${type} are available ${DEAL_LABELS[parsed.deal].toLowerCase()} in ${localityName}?`,
      a: `We list verified ${type} ${DEAL_LABELS[parsed.deal].toLowerCase()} in ${localityName} from trusted builders and owners, updated regularly as new inventory is added.`,
    },
    {
      q: `What is the price range of ${type} in ${localityName}?`,
      a: `Prices for ${type} in ${localityName} vary by size, floor, view and finishing. Browse the listings below to compare current asking prices and recent transaction trends.`,
    },
    {
      q: `Is it a good time to ${deal} a ${singular} in ${localityName}?`,
      a: `${localityName} remains a sought-after location. Use our locality insights, price history and AI assistant to evaluate whether now is the right time for you.`,
    },
    {
      q: `How do I schedule a viewing for a ${singular} in ${localityName}?`,
      a: `Open any listing below and use the enquiry option to connect with the listing agent and arrange a viewing at a time that suits you.`,
    },
  ];
}

export default async function ListingLandingPage({ params }: Props) {
  const { listing } = await params;
  const resolved = await resolveListing(listing);
  if (!resolved) notFound();

  const { parsed, localityName, localityCity, properties, units, nearby } =
    resolved;
  const heading = listingTitle(parsed, localityName);
  const dealLower = DEAL_LABELS[parsed.deal].toLowerCase();
  const typeLower = parsed.typeDef.label.toLowerCase();
  // priceAed is the sale price; rent asking prices aren't captured yet.
  const isRent = parsed.deal === "rent";
  const unitPhotos = pickUnitPhotos(units);

  // Unique, data-driven intro copy (not boilerplate): names + real "from" price.
  const projectNames = [...new Set(properties.map((p) => p.title))].slice(0, 3);
  const saleMin = units.reduce<number | null>(
    (m, u) => (u.priceAed && (m == null || u.priceAed < m) ? u.priceAed : m),
    null,
  );
  const rentValues = units
    .map((u) => (u.metadata as { rentPriceAed?: number } | null)?.rentPriceAed)
    .filter((n): n is number => typeof n === "number" && n > 0);
  const priceBit = isRent
    ? rentValues.length
      ? ` from ${formatAED(Math.min(...rentValues))}/yr`
      : ""
    : saleMin != null
      ? ` from ${formatAED(saleMin)}`
      : "";
  const intro =
    `Browse ${typeLower} ${dealLower} in ${localityName}` +
    (projectNames.length
      ? `, including ${projectNames.join(", ")}`
      : "") +
    (priceBit ? `, with prices${priceBit}` : "") +
    `. Compare live listings, price trends and FAQs below.`;
  const faqs = faqFor(parsed, localityName);
  const canonical = `${BASE}/${listing}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: BASE },
          { "@type": "ListItem", position: 2, name: heading, item: canonical },
        ],
      },
      {
        "@type": "ItemList",
        name: heading,
        numberOfItems: units.length + properties.length,
        itemListElement: [
          ...units.map((u, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${BASE}${unitPath({
              id: u.id,
              bedrooms: u.bedrooms,
              unitType: u.unitType,
              property: u.property,
            })}`,
            name: `${
              u.bedrooms == null
                ? "Unit"
                : u.bedrooms === 0
                  ? "Studio"
                  : `${u.bedrooms}-Bedroom`
            } at ${u.property.title}`,
          })),
          ...properties.map((p, i) => ({
            "@type": "ListItem",
            position: units.length + i + 1,
            url: `${BASE}/properties/${p.slug}`,
            name: p.title,
          })),
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-primary">{heading}</span>
      </nav>

      <p className="mt-6 text-xs font-medium uppercase tracking-[0.25em] text-accent">
        {localityCity ?? "Locality"}
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary md:text-5xl">{heading}</h1>

      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">{intro}</p>

      {/* Individual unit listings */}
      {units.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-serif text-2xl text-primary">
            Available {typeLower} in {localityName}
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {units.map((u, i) => {
              const image = unitPhotos[i];
              const bedText =
                u.bedrooms == null
                  ? "—"
                  : u.bedrooms === 0
                    ? "Studio"
                    : `${u.bedrooms} Bed`;
              return (
                <Link
                  key={u.id}
                  href={unitPath({
                    id: u.id,
                    bedrooms: u.bedrooms,
                    unitType: u.unitType,
                    property: u.property,
                  })}
                  className="group overflow-hidden rounded-sm border border-border bg-card transition hover:border-accent"
                >
                  <div className="relative aspect-[4/3] bg-primary/10">
                    {image ? (
                      <Image
                        src={image.url}
                        alt={image.alt ?? u.property.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <div className="p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-accent">
                      {u.property.community?.name ?? localityName}
                    </p>
                    <h3 className="mt-2 font-serif text-lg text-primary">
                      {u.property.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      {isRent
                        ? (() => {
                            const rent = (
                              u.metadata as { rentPriceAed?: number } | null
                            )?.rentPriceAed;
                            return rent
                              ? `${formatAED(rent)}/yr`
                              : "Rent price on request";
                          })()
                        : u.priceAed
                          ? formatAED(u.priceAed)
                          : "Price on request"}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      {[
                        bedText,
                        u.bathrooms != null ? `${u.bathrooms} bath` : null,
                        u.areaSqft != null
                          ? `${Math.round(u.areaSqft).toLocaleString()} sqft`
                          : null,
                        u.view ? `${u.view} view` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Developments */}
      {properties.length === 0 ? (
        <div className="mt-10 rounded-sm border border-border bg-card p-8 text-sm text-muted">
          No {typeLower} {dealLower} in {localityName} are listed right now. Explore nearby
          localities below or{" "}
          <Link href="/search" className="text-accent hover:underline">
            search all inventory
          </Link>
          .
        </div>
      ) : (
        <section className="mt-16">
          <h2 className="font-serif text-2xl text-primary">
            Developments in {localityName}
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => {
            const image = property.images[0];
            return (
              <Link
                key={property.id}
                href={`/properties/${property.slug}`}
                className="group overflow-hidden rounded-sm border border-border bg-card transition hover:border-accent"
              >
                <div className="relative aspect-[4/3] bg-primary/10">
                  {image ? (
                    <Image
                      src={image.url}
                      alt={image.alt ?? property.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <div className="p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">
                    {property.community?.name ?? localityName}
                  </p>
                  <h2 className="mt-2 font-serif text-lg text-primary">{property.title}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {isRent
                      ? "Rent price on request"
                      : `${isStartingFigure(property) ? "from " : ""}${formatAED(property.priceAed)}`}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {[
                      bedroomsText(property),
                      property.bathrooms != null ? `${property.bathrooms} bath` : null,
                      property.areaSqft != null
                        ? `${property.areaSqft.toLocaleString()} sqft`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </Link>
            );
          })}
          </div>
        </section>
      )}

      {/* Nearby localities — internal linking for SEO */}
      {nearby.length > 0 ? (
        <section className="mt-16">
          <h2 className="font-serif text-2xl text-primary">
            {parsed.typeDef.label} nearby
          </h2>
          <p className="mt-1 text-sm text-muted">Explore more options around this area.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {nearby.map((c) => {
              const slug = buildListingSlug(parsed.typeToken, parsed.deal, c.slug);
              return (
                <Link
                  key={c.slug}
                  href={`/${slug}`}
                  className="flex items-center justify-between rounded-sm border border-border bg-card px-4 py-3 text-sm text-primary transition hover:border-accent"
                >
                  <span>
                    {parsed.typeDef.label} {DEAL_LABELS[parsed.deal].toLowerCase()} in {c.name}
                  </span>
                  <span className="text-accent">→</span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* FAQ */}
      <section className="mt-16">
        <h2 className="font-serif text-2xl text-primary">Frequently asked questions</h2>
        <div className="mt-6 divide-y divide-border border-y border-border">
          {faqs.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="cursor-pointer list-none text-sm font-medium text-primary">
                {f.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
