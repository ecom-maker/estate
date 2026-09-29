import { SITE_URL } from "@/lib/data-layer/canonical";

const TYPE_TO_SCHEMA: Record<string, string> = {
  VILLA: "SingleFamilyResidence",
  TOWNHOUSE: "SingleFamilyResidence",
  APARTMENT: "Apartment",
  PENTHOUSE: "Apartment",
  UNIT: "Apartment",
  LAND: "Residence",
};

type JsonLdProperty = {
  title: string;
  slug: string;
  type: string;
  description?: string | null;
  priceAed?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaSqft?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
  community?: { name: string; city?: string | null; emirate?: string | null } | null;
  developer?: { name: string } | null;
  images?: { url: string }[] | null;
  amenities?: string[];
};

/** schema.org Residence + Offer for a property/project detail page. */
export function propertyJsonLd(p: JsonLdProperty) {
  const url = `${SITE_URL}/properties/${p.slug}`;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": TYPE_TO_SCHEMA[p.type] ?? "Residence",
    name: p.title,
    url,
    ...(p.description ? { description: p.description } : {}),
    ...(p.images?.length ? { image: p.images.map((i) => i.url) } : {}),
    ...(p.bedrooms != null ? { numberOfBedrooms: p.bedrooms } : {}),
    ...(p.bathrooms != null
      ? { numberOfBathroomsTotal: p.bathrooms }
      : {}),
    ...(p.areaSqft != null
      ? {
          floorSize: {
            "@type": "QuantitativeValue",
            value: p.areaSqft,
            unitCode: "FTK",
          },
        }
      : {}),
    address: {
      "@type": "PostalAddress",
      ...(p.community?.name ? { addressLocality: p.community.name } : {}),
      ...(p.community?.emirate ? { addressRegion: p.community.emirate } : {}),
      addressCountry: "AE",
    },
  };

  if (p.latitude != null && p.longitude != null) {
    data.geo = {
      "@type": "GeoCoordinates",
      latitude: p.latitude,
      longitude: p.longitude,
    };
  }

  if (p.priceAed != null) {
    data.offers = {
      "@type": "Offer",
      price: p.priceAed,
      priceCurrency: "AED",
      availability:
        p.status === "ACTIVE"
          ? "https://schema.org/InStock"
          : "https://schema.org/LimitedAvailability",
      url,
    };
  }

  if (p.amenities?.length) {
    data.amenityFeature = p.amenities.map((name) => ({
      "@type": "LocationFeatureSpecification",
      name,
      value: true,
    }));
  }

  return data;
}
