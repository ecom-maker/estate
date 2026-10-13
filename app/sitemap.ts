import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/prisma";
import { getRequestSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const SITE_URL = await getRequestSiteUrl();
  const staticPages: MetadataRoute.Sitemap = [
    "",
    "/search",
    "/properties",
    "/projects",
    "/api-docs",
    "/privacy",
    "/terms",
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "daily",
    priority: path === "" ? 1 : 0.7,
  }));

  try {
    // Developments (both off-plan and ready) live under /projects; individual
    // units are the /properties/unit/<id> listings.
    const [projects, units, communities] = await Promise.all([
      prisma.property.findMany({
        where: { deletedAt: null, status: "ACTIVE" },
        select: { slug: true, updatedAt: true },
        take: 5000,
      }),
      prisma.propertyUnit.findMany({
        where: { property: { deletedAt: null, status: "ACTIVE" } },
        select: { id: true, updatedAt: true },
        take: 10000,
      }),
      prisma.community.findMany({ select: { slug: true, updatedAt: true } }),
    ]);

    const projectPages: MetadataRoute.Sitemap = projects.map((p) => ({
      url: `${SITE_URL}/projects/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
    const unitPages: MetadataRoute.Sitemap = units.map((u) => ({
      url: `${SITE_URL}/properties/unit/${u.id}`,
      lastModified: u.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
    const communityPages: MetadataRoute.Sitemap = communities.map((c) => ({
      url: `${SITE_URL}/search?q=${encodeURIComponent(c.slug)}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly",
      priority: 0.5,
    }));

    return [...staticPages, ...projectPages, ...unitPages, ...communityPages];
  } catch {
    return staticPages;
  }
}
