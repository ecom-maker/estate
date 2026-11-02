// Brochures live on the media server by naming convention, not in the DB:
//   https://media.dmglobal.me/<slug>/<slug>-brochure.pdf
// They were uploaded out-of-band, so there are no PropertyDocument rows for
// them. This resolves the conventional URL and confirms the file exists before
// we link it (≈60 of 70 projects have one). The check fetches only the first
// byte and is cached (revalidated weekly) so it never downloads the PDF or
// hammers the media server on every render.
const MEDIA_BASE = "https://media.dmglobal.me";

export function brochureUrlForSlug(slug: string): string {
  return `${MEDIA_BASE}/${slug}/${slug}-brochure.pdf`;
}

export async function brochureUrl(slug: string): Promise<string | null> {
  const url = brochureUrlForSlug(slug);
  try {
    const res = await fetch(url, {
      headers: { Range: "bytes=0-0" },
      next: { revalidate: 604800 },
    });
    // 200 (whole file) or 206 (partial) both mean it's there; 404 means not.
    return res.ok ? url : null;
  } catch {
    return null;
  }
}
