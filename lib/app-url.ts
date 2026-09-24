/** Safe public app URL for metadata, sitemaps, and absolute links. */
export function getAppUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    // Stable production domain (e.g. estate-sugg.vercel.app) — prefer this over
    // VERCEL_URL, which is the per-deployment URL and must not be a canonical.
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (!raw) return "http://localhost:3000";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}
