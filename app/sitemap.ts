import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/prisma";
import { getAppUrl } from "@/lib/app-url";
import { PROPERTY_TYPES, buildListingSlug, type DealType } from "@/lib/seo/listing-slug";

const DEALS: DealType[] = ["sale", "rent"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getAppUrl();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/search`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/properties`, changeFrequency: "daily", priority: 0.9 },
  ];

  try {
    const [properties, communities] = await Promise.all([
      prisma.property.findMany({
        where: { deletedAt: null, status: "ACTIVE" },
        select: { slug: true, updatedAt: true },
        take: 5000,
      }),
      prisma.community.findMany({ select: { slug: true }, take: 500 }),
    ]);

    // Programmatic SEO landing pages: type x deal x locality.
    const landingRoutes: MetadataRoute.Sitemap = [];
    for (const community of communities) {
      for (const type of PROPERTY_TYPES) {
        for (const deal of DEALS) {
          landingRoutes.push({
            url: `${base}/${buildListingSlug(type.token, deal, community.slug)}`,
            changeFrequency: "daily",
            priority: 0.7,
          });
        }
      }
    }

    return [
      ...staticRoutes,
      ...properties.map((property) => ({
        url: `${base}/properties/${property.slug}`,
        lastModified: property.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...landingRoutes,
    ];
  } catch {
    return staticRoutes;
  }
}
