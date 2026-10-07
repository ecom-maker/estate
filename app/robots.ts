import type { MetadataRoute } from "next";
import { getRequestSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const SITE_URL = await getRequestSiteUrl();
  return {
    rules: [
      // Open to search + AI crawlers; keep admin/api-internals out.
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/chat", "/api/knowledge", "/login"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
