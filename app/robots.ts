export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/agent"],
    },
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/sitemap.xml`,
  };
}
