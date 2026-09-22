import { getAppUrl } from "@/lib/app-url";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/agent"],
    },
    sitemap: `${getAppUrl()}/sitemap.xml`,
  };
}
