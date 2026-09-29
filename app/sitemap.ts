import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/prisma";
import { SITE_URL } from "@/lib/data-layer/canonical";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    "",
    "/search",
    "/properties",
    "/projects",
    "/api-docs",
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "daily",
    priority: path === "" ? 1 : 0.7,
  }));

  try {
    const [properties, projects, communities] = await Promise.all([
      prisma.property.findMany({
        where: { deletedAt: null, status: "ACTIVE", offPlan: false },
        select: { slug: true, updatedAt: true },
        take: 5000,
      }),
      prisma.property.findMany({
        where: { deletedAt: null, offPlan: true },
        select: { slug: true, updatedAt: true },
        take: 5000,
      }),
      prisma.community.findMany({ select: { slug: true, updatedAt: true } }),
    ]);

    const propertyPages: MetadataRoute.Sitemap = properties.map((p) => ({
      url: `${SITE_URL}/properties/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
    const projectPages: MetadataRoute.Sitemap = projects.map((p) => ({
      url: `${SITE_URL}/projects/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
    const communityPages: MetadataRoute.Sitemap = communities.map((c) => ({
      url: `${SITE_URL}/search?q=${encodeURIComponent(c.slug)}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly",
      priority: 0.5,
    }));

    return [
      ...staticPages,
      ...propertyPages,
      ...projectPages,
      ...communityPages,
    ];
  } catch {
    return staticPages;
  }
}
