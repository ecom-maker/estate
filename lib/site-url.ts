import { headers } from "next/headers";
import { SITE_URL } from "@/lib/data-layer/canonical";

/**
 * Absolute base URL for the current request, used by the sitemap and robots so
 * they reflect the domain they are actually served on (no hardcoded host).
 *
 * Resolution order:
 *  1. CANONICAL_SITE_URL — an explicit canonical, when set (SEO-preferred).
 *  2. The request's own host (x-forwarded-host / host) + protocol.
 *  3. VERCEL_PROJECT_PRODUCTION_URL — the stable production *.vercel.app domain.
 *  4. The compiled-in default (SITE_URL).
 */
export async function getRequestSiteUrl(): Promise<string> {
  const override = process.env.CANONICAL_SITE_URL?.trim();
  if (override) return override.replace(/\/+$/, "");

  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
      return `${proto}://${host}`;
    }
  } catch {
    // headers() is unavailable outside a request scope — fall through.
  }

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return SITE_URL;
}
