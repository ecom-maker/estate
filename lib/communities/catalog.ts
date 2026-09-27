// Canonical Dubai communities and the title/slug patterns that imply each one.
// Single source of truth for the intent heuristic's fallback list and the
// admin "Backfill communities" action.

export type CommunitySeed = {
  name: string;
  slug: string;
  /** Lowercase substrings in a property's title/slug that imply this community. */
  match: string[];
};

// Order matters for `communityForText`: most specific first, so a title with
// "Palm Jumeirah" resolves to Palm Jumeirah rather than the standalone Jumeirah.
export const COMMUNITY_CATALOG: CommunitySeed[] = [
  { name: "Business Bay", slug: "business-bay", match: ["business bay"] },
  { name: "Emirates Hills", slug: "emirates-hills", match: ["emirates hill"] },
  { name: "Palm Jumeirah", slug: "palm-jumeirah", match: ["palm"] },
  { name: "Downtown Dubai", slug: "downtown-dubai", match: ["downtown"] },
  { name: "Dubai Marina", slug: "dubai-marina", match: ["marina"] },
  {
    name: "Arabian Ranches",
    slug: "arabian-ranches",
    match: ["arabian", "ranches"],
  },
  { name: "Jumeirah", slug: "jumeirah", match: ["jumeirah"] },
];

export const COMMUNITY_NAMES = COMMUNITY_CATALOG.map((c) => c.name);

/** The community implied by a property's title/slug, or null if none match. */
export function communityForText(text: string): CommunitySeed | null {
  const t = text.toLowerCase();
  for (const community of COMMUNITY_CATALOG) {
    if (community.match.some((m) => t.includes(m))) return community;
  }
  return null;
}
