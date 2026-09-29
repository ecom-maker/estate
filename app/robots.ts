import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/data-layer/canonical";

export default function robots(): MetadataRoute.Robots {
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
