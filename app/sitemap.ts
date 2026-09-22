import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/prisma";
import { getAppUrl } from "@/lib/app-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getAppUrl();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/search`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/properties`, changeFrequency: "daily", priority: 0.9 },
  ];

  try {
    const properties = await prisma.property.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { slug: true, updatedAt: true },
      take: 5000,
    });
    return [
      ...staticRoutes,
      ...properties.map((property) => ({
        url: `${base}/properties/${property.slug}`,
        lastModified: property.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
