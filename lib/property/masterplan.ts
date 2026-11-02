const PLAN_CAPTION = /master\s?-?\s?plan|site\s?-?\s?plan/i;

/** A gallery image captioned as the masterplan / site plan, not a photo. */
export function isMasterplanImage(img: { alt?: string | null }) {
  return PLAN_CAPTION.test(img.alt ?? "");
}

/** Masterplan image: an admin-set URL (metadata.masterplanImageUrl), else a captioned gallery image. */
export function masterplanImageOf(project: {
  metadata: unknown;
  images: { url: string; alt?: string | null }[];
}): string | null {
  const set = (project.metadata as { masterplanImageUrl?: string | null } | null)?.masterplanImageUrl;
  return set?.trim() || project.images.find(isMasterplanImage)?.url || null;
}
