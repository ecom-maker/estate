import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/prisma";
import { getRequestSiteUrl } from "@/lib/site-url";
import { unitSlug } from "@/lib/property/unit-url";
import { buildListingSlug, typeDefForType } from "@/lib/seo/listing-slug";
import { unitMatchesDeal } from "@/lib/property/deal";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const SITE_URL = await getRequestSiteUrl();
  const staticPages: MetadataRoute.Sitemap = [
    "",
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
    const [projects, units] = await Promise.all([
      prisma.property.findMany({
        where: { deletedAt: null, status: "ACTIVE" },
        select: {
          slug: true,
          type: true,
          updatedAt: true,
          community: { select: { slug: true } },
        },
        take: 5000,
      }),
      prisma.propertyUnit.findMany({
        where: { hidden: false, property: { deletedAt: null, status: "ACTIVE" } },
        select: {
          id: true,
          bedrooms: true,
          unitType: true,
          metadata: true,
          updatedAt: true,
          property: {
            select: {
              slug: true,
              title: true,
              type: true,
              community: { select: { name: true, emirate: true, slug: true } },
            },
          },
        },
        take: 10000,
      }),
    ]);

    const projectPages: MetadataRoute.Sitemap = projects.map((p) => ({
      url: `${SITE_URL}/projects/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
    const unitPages: MetadataRoute.Sitemap = units.map((u) => ({
      url: `${SITE_URL}/properties/unit/${unitSlug(u)}`,
      lastModified: u.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
    // Location & property-type SEO landing pages (/[listing]): one per
    // community, plus one per property type present in that community
    // (e.g. apartments-for-sale-in-dubai-marina). Replaces the old
    // /search?q= links, which weren't crawlable landing pages.
    const byLocality = new Map<
      string,
      { tokens: Set<string>; lastModified: Date }
    >();
    for (const p of projects) {
      const slug = p.community?.slug;
      if (!slug) continue;
      const entry = byLocality.get(slug) ?? {
        tokens: new Set<string>(["properties"]),
        lastModified: p.updatedAt,
      };
      entry.tokens.add(typeDefForType(p.type).token);
      if (p.updatedAt > entry.lastModified) entry.lastModified = p.updatedAt;
      byLocality.set(slug, entry);
    }
    const listingPages: MetadataRoute.Sitemap = [];
    for (const [localitySlug, { tokens, lastModified }] of byLocality) {
      for (const token of tokens) {
        listingPages.push({
          url: `${SITE_URL}/${buildListingSlug(token, "sale", localitySlug)}`,
          lastModified,
          changeFrequency: "weekly",
          priority: token === "properties" ? 0.6 : 0.55,
        });
      }
    }

    // For-rent landing pages, only where units are actually offered for rent.
    const rentByLocality = new Map<
      string,
      { tokens: Set<string>; lastModified: Date }
    >();
    for (const u of units) {
      if (!unitMatchesDeal(u.metadata, "rent")) continue;
      const slug = u.property.community?.slug;
      if (!slug) continue;
      const entry = rentByLocality.get(slug) ?? {
        tokens: new Set<string>(["properties"]),
        lastModified: u.updatedAt,
      };
      entry.tokens.add(typeDefForType(u.property.type).token);
      if (u.updatedAt > entry.lastModified) entry.lastModified = u.updatedAt;
      rentByLocality.set(slug, entry);
    }
    const rentListingPages: MetadataRoute.Sitemap = [];
    for (const [localitySlug, { tokens, lastModified }] of rentByLocality) {
      for (const token of tokens) {
        rentListingPages.push({
          url: `${SITE_URL}/${buildListingSlug(token, "rent", localitySlug)}`,
          lastModified,
          changeFrequency: "weekly",
          priority: 0.5,
        });
      }
    }

    return [
      ...staticPages,
      ...projectPages,
      ...unitPages,
      ...listingPages,
      ...rentListingPages,
    ];
  } catch {
    return staticPages;
  }
}
