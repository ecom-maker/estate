// Custom next/image loader.
//
// The default Vercel image optimizer cannot reliably fetch our imported
// listing media (reelly-backend.s3.amazonaws.com) — those requests fail and
// the images render broken. So: optimize Unsplash through its own CDN params,
// and serve every other source (S3, Supabase Storage, local) directly.
export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  // Local/public assets — serve as-is.
  if (src.startsWith("/")) return src;

  try {
    const u = new URL(src);
    if (u.hostname === "images.unsplash.com") {
      // Unsplash supports resizing via query params on its own CDN.
      u.searchParams.set("w", String(width));
      u.searchParams.set("q", String(quality ?? 75));
      u.searchParams.set("auto", "format");
      u.searchParams.set("fit", "crop");
      return u.toString();
    }
  } catch {
    // not a parseable URL — fall through
  }

  // S3 / Supabase / anything else: load the original directly in the browser.
  return src;
}
