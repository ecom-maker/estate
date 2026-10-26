import type { MetadataRoute } from "next";
import { getRequestSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

// Private areas kept out for every crawler.
const DISALLOW = ["/admin", "/api/chat", "/api/knowledge", "/login"];

// AI answer-engine / training crawlers we explicitly welcome on public pages,
// so our data-driven content can be read and cited.
const AI_BOTS = [
  "GPTBot", // OpenAI crawler (training)
  "OAI-SearchBot", // ChatGPT search
  "ChatGPT-User", // ChatGPT browsing on a user's behalf
  "PerplexityBot", // Perplexity
  "Perplexity-User", // Perplexity on a user's behalf
  "ClaudeBot", // Anthropic crawler
  "Claude-SearchBot", // Claude search
  "Google-Extended", // Google Gemini / AI data use
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const SITE_URL = await getRequestSiteUrl();
  return {
    rules: [
      // Default: open to search + AI crawlers; keep admin/api-internals out.
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      // Explicit allow for named AI crawlers (same private-path exclusions).
      ...AI_BOTS.map((bot) => ({
        userAgent: bot,
        allow: "/",
        disallow: DISALLOW,
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
