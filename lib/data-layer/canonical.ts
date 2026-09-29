import { Prisma } from "@prisma/client";

/**
 * Canonical Property Data Layer
 * ------------------------------------------------------------------
 * A stable, source-agnostic JSON representation of the inventory that sits
 * between the database and every consumer (website, AI chat, external AI
 * agents). It exposes the full luxury entity graph:
 *
 *   developer → project → building/property → unit → amenities
 *             → location (community) → nearby landmarks (schools, metros)
 *
 * The shape here is the contract; the REST/GraphQL layer and JSON-LD both
 * derive from it, so agents get one consistent view of a property.
 */

// Canonical URLs must be stable, so prefer the production domain over the
// per-deployment hash URL that NEXT_PUBLIC_APP_URL can resolve to on Vercel.
export const SITE_URL = (
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined) ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://estate-sugg.vercel.app"
).replace(/\/$/, "");

// Prisma include that hydrates the whole entity graph for one property.
export const canonicalPropertyInclude = {
  developer: true,
  community: {
    include: {
      schools: true,
      metros: true,
    },
  },
  units: { orderBy: { unitNumber: Prisma.SortOrder.asc } },
  images: { orderBy: { sortOrder: Prisma.SortOrder.asc } },
  videos: { orderBy: { sortOrder: Prisma.SortOrder.asc } },
  floorplans: true,
  amenities: { include: { amenity: true } },
  salesHistory: { orderBy: { soldAt: Prisma.SortOrder.desc }, take: 10 },
  rentalHistory: { orderBy: { rentedAt: Prisma.SortOrder.desc }, take: 10 },
} satisfies Prisma.PropertyInclude;

export type CanonicalPropertyRecord = Prisma.PropertyGetPayload<{
  include: typeof canonicalPropertyInclude;
}>;

type Meta = {
  dealType?: string;
  handoverDate?: string;
  timeline?: unknown;
  nearbyAttractions?: unknown;
  [key: string]: unknown;
};

const TYPE_TO_SCHEMA: Record<string, string> = {
  VILLA: "SingleFamilyResidence",
  TOWNHOUSE: "SingleFamilyResidence",
  APARTMENT: "Apartment",
  PENTHOUSE: "Apartment",
  UNIT: "Apartment",
  LAND: "LandForm",
};

function coordinates(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return null;
  return { latitude: lat, longitude: lng };
}

/** Full canonical representation of a single property / project. */
export function toCanonicalProperty(p: CanonicalPropertyRecord) {
  const meta = (p.metadata ?? {}) as Meta;
  const url = `${SITE_URL}/properties/${p.slug}`;

  return {
    "@id": url,
    "@type": TYPE_TO_SCHEMA[p.type] ?? "Residence",
    id: p.id,
    slug: p.slug,
    url,
    title: p.title,
    description: p.description,
    propertyType: p.type.toLowerCase(),
    dealType: meta.dealType === "rent" ? "rent" : "sale",

    status: {
      listing: p.status,
      offPlan: p.offPlan,
      ready: p.ready,
      availability: p.availability,
      reraStatus: p.reraStatus,
      handoverDate: meta.handoverDate ?? null,
    },

    price: {
      currency: "AED",
      amount: p.priceAed,
      rentalYieldPct: p.rentalYield,
    },

    size: {
      areaSqft: p.areaSqft,
      plotAreaSqft: p.plotAreaSqft,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      floors: p.floors,
    },

    features: {
      waterfront: p.waterfront,
      privateBeach: p.privateBeach,
      furnished: p.furnished,
    },

    developer: p.developer
      ? {
          id: p.developer.id,
          name: p.developer.name,
          slug: p.developer.slug,
          website: p.developer.website,
        }
      : null,

    location: {
      coordinates: coordinates(p.latitude, p.longitude),
      community: p.community
        ? {
            id: p.community.id,
            name: p.community.name,
            slug: p.community.slug,
            city: p.community.city,
            emirate: p.community.emirate,
            coordinates: coordinates(
              p.community.latitude,
              p.community.longitude,
            ),
          }
        : null,
      nearbyLandmarks: {
        schools: (p.community?.schools ?? []).map((s) => ({
          name: s.name,
          curriculum: s.curriculum,
          rating: s.rating,
          coordinates: coordinates(s.latitude, s.longitude),
        })),
        metroStations: (p.community?.metros ?? []).map((m) => ({
          name: m.name,
          line: m.line,
          coordinates: coordinates(m.latitude, m.longitude),
        })),
        attractions: meta.nearbyAttractions ?? [],
      },
    },

    amenities: p.amenities.map((a) => a.amenity.name),

    units: p.units.map((u) => ({
      unitNumber: u.unitNumber,
      floor: u.floor,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      areaSqft: u.areaSqft,
      price: { currency: "AED", amount: u.priceAed },
      view: u.view,
      status: u.status,
    })),

    media: {
      images: p.images.map((i) => ({
        url: i.url,
        alt: i.alt,
        primary: i.isPrimary,
      })),
      videos: p.videos.map((v) => ({ url: v.url, title: v.title })),
      floorplans: p.floorplans.map((f) => ({
        title: f.title,
        url: f.url,
        floor: f.floor,
        areaSqft: f.areaSqft,
      })),
    },

    paymentPlan: p.paymentPlan ?? null,
    projectTimeline: meta.timeline ?? null,

    priceHistory: {
      sales: p.salesHistory.map((s) => ({
        date: s.soldAt.toISOString().slice(0, 10),
        amountAed: s.priceAed,
        buyerType: s.buyerType,
      })),
      rentals: p.rentalHistory.map((r) => ({
        date: r.rentedAt.toISOString().slice(0, 10),
        annualRentAed: r.annualRentAed,
      })),
    },

    updatedAt: p.updatedAt.toISOString(),
  };
}

export type CanonicalProperty = ReturnType<typeof toCanonicalProperty>;

// Lightweight include + shape for list endpoints.
export const canonicalSummaryInclude = {
  developer: { select: { name: true, slug: true } },
  community: { select: { name: true, slug: true, city: true } },
  images: { orderBy: { sortOrder: Prisma.SortOrder.asc }, take: 1 },
} satisfies Prisma.PropertyInclude;

export type CanonicalSummaryRecord = Prisma.PropertyGetPayload<{
  include: typeof canonicalSummaryInclude;
}>;

export function toCanonicalPropertySummary(p: CanonicalSummaryRecord) {
  const meta = (p.metadata ?? {}) as Meta;
  const url = `${SITE_URL}/properties/${p.slug}`;
  return {
    "@id": url,
    id: p.id,
    slug: p.slug,
    url,
    title: p.title,
    propertyType: p.type.toLowerCase(),
    dealType: meta.dealType === "rent" ? "rent" : "sale",
    price: { currency: "AED", amount: p.priceAed },
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    areaSqft: p.areaSqft,
    offPlan: p.offPlan,
    ready: p.ready,
    community: p.community?.name ?? null,
    developer: p.developer?.name ?? null,
    image: p.images[0]?.url ?? null,
  };
}
