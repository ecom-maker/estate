import type { Prisma } from "@prisma/client";

// Sort options for the projects listing. Shared between the server page (which
// turns the key into a Prisma orderBy and paginates in the DB) and the client
// ProjectBrowser (which re-sorts the bounded AI-search result set in memory).
export type ProjectSortKey =
  | "newest"
  | "price-asc"
  | "price-desc"
  | "beds-asc"
  | "beds-desc"
  | "handover";

export const PROJECT_SORT_OPTIONS: { value: ProjectSortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "beds-asc", label: "Beds: least" },
  { value: "beds-desc", label: "Beds: most" },
  { value: "handover", label: "Completion date" },
];

export const DEFAULT_PROJECT_SORT: ProjectSortKey = "newest";

export function parseProjectSort(
  v: string | string[] | undefined,
): ProjectSortKey {
  const s = Array.isArray(v) ? v[0] : v;
  return PROJECT_SORT_OPTIONS.some((o) => o.value === s)
    ? (s as ProjectSortKey)
    : DEFAULT_PROJECT_SORT;
}

/**
 * Prisma orderBy for the chosen sort, with a stable id tiebreaker. Missing
 * values sort last so cards with real data lead. Completion date uses the
 * denormalized `handoverAt` column (metadata JSON can't be an orderBy).
 */
export function projectOrderBy(
  sort: ProjectSortKey,
): Prisma.PropertyOrderByWithRelationInput[] {
  const last = { nulls: "last" as const };
  switch (sort) {
    case "price-asc":
      return [{ priceAed: { sort: "asc", ...last } }, { id: "asc" }];
    case "price-desc":
      return [{ priceAed: { sort: "desc", ...last } }, { id: "asc" }];
    case "beds-asc":
      return [{ bedrooms: { sort: "asc", ...last } }, { id: "asc" }];
    case "beds-desc":
      return [{ bedrooms: { sort: "desc", ...last } }, { id: "asc" }];
    case "handover":
      return [{ handoverAt: { sort: "asc", ...last } }, { id: "asc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}
